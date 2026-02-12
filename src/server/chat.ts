import { createServerFn } from '@tanstack/react-start'
import { createAgent, createModel } from '../lib/agent'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { UIElement } from '@json-render/core'
import type { NestedUIElement, QueryResult, Report, StreamArtifactPayload } from '../lib/types'
import type { BaseMessage } from '@langchain/core/messages'
import { executeDatasetQuery } from '../lib/datasetTools'
import {
  collectArtifactRenderabilityIssues,
  sanitizeArtifactContent,
} from '../lib/renderability'

type StreamTextChunk = { type: 'text'; content: string }
type StreamToolStartChunk = { type: 'tool_start'; toolCallId: string; name: string; args: Record<string, {}> }
type StreamToolEndChunk = { type: 'tool_end'; toolCallId: string; result: {} }
type StreamDoneChunk = {
  type: 'done'
  ui: NestedUIElement | null
  queryResults: QueryResult[]
  report: Report | null
  artifacts?: StreamArtifactPayload[]
  suggestions?: string[]
}
type StreamChunk = StreamTextChunk | StreamToolStartChunk | StreamToolEndChunk | StreamDoneChunk

interface RenderedArtifact {
  type: 'visualization' | 'report'
  ui: NestedUIElement | null
  report: Report | null
}

interface ArtifactRepairInput {
  agent: ReturnType<typeof createAgent>
  finalMessages: BaseMessage[]
  ui: NestedUIElement | null
  report: Report | null
  queryResults: QueryResult[]
}

interface ArtifactRepairResult {
  ui: NestedUIElement | null
  report: Report | null
  queryResults: QueryResult[]
  repaired: boolean
}

function mergeQueryResultsByResultKey(
  baseResults: QueryResult[],
  nextResults: QueryResult[]
): QueryResult[] {
  const merged = new Map<string, QueryResult>()

  for (const result of baseResults) {
    merged.set(result.resultKey, result)
  }

  for (const result of nextResults) {
    merged.set(result.resultKey, result)
  }

  return Array.from(merged.values())
}

function getQueryResultSummary(queryResults: QueryResult[]): string {
  if (queryResults.length === 0) {
    return '- No query results were returned'
  }

  return queryResults
    .map((result) => {
      const rows = Array.isArray(result.data) ? result.data : []
      const sampleRow = rows.find((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row))
      const keys = sampleRow ? Object.keys(sampleRow) : []
      return `- ${result.resultKey}: ${rows.length} row(s), keys: [${keys.join(', ')}]`
    })
    .join('\n')
}

function buildArtifactRepairPrompt(
  ui: NestedUIElement | null,
  report: Report | null,
  queryResults: QueryResult[]
): string {
  const issues = collectArtifactRenderabilityIssues({
    ui,
    report,
    queryResults,
  })

  const issueSummary = issues
    .map((issue, index) => {
      const keys = issue.requiredKeys?.length ? ` requiredKeys=[${issue.requiredKeys.join(', ')}]` : ''
      const available = issue.availableKeys?.length ? ` availableKeys=[${issue.availableKeys.join(', ')}]` : ''
      const path = issue.dataPath ? ` dataPath=${issue.dataPath}` : ''
      return `${index + 1}. ${issue.target}/${issue.componentType}:${path}${keys}${available}. Error: ${issue.message}`
    })
    .join('\n')

  const hasReport = Boolean(report)
  const hasUi = Boolean(ui)

  return [
    'The previous render output is not fully renderable in the app.',
    'Regenerate ONLY a corrected render tool call using existing query results where possible.',
    'Do not add narrative text.',
    'Rules:',
    '- dataPath must be "/<resultKey>" from query_dataset results.',
    '- Table columns must map to actual keys in the selected result.',
    '- Chart x/y/name/value keys must exist in result rows.',
    '- Prefer changing column/key bindings over creating decorative text-only output.',
    '',
    `Current artifact type: ${hasReport ? 'report' : hasUi ? 'visualization' : 'unknown'}`,
    'Query result summary:',
    getQueryResultSummary(queryResults),
    '',
    'Renderability issues:',
    issueSummary || '- Unknown renderability issue',
  ].join('\n')
}

async function attemptArtifactRepair({
  agent,
  finalMessages,
  ui,
  report,
  queryResults,
}: ArtifactRepairInput): Promise<ArtifactRepairResult> {
  const initialIssues = collectArtifactRenderabilityIssues({
    ui,
    report,
    queryResults,
  })

  if (initialIssues.length === 0) {
    return { ui, report, queryResults, repaired: false }
  }

  const prompt = buildArtifactRepairPrompt(ui, report, queryResults)

  try {
    const repairedState = await agent.invoke(
      {
        messages: [...finalMessages, new HumanMessage(prompt)],
      },
      { recursionLimit: 25 }
    )

    const repairedMessages = repairedState.messages as BaseMessage[]
    const repairedUi = (extractUiFromMessages(repairedMessages) as NestedUIElement | null) ?? null
    const repairedReport = extractReportFromMessages(repairedMessages)
    const repairedQueryResults = mergeQueryResultsByResultKey(
      queryResults,
      extractQueryResults(repairedMessages)
    )

    const repairedIssues = collectArtifactRenderabilityIssues({
      ui: repairedUi,
      report: repairedReport,
      queryResults: repairedQueryResults,
    })

    if (repairedIssues.length < initialIssues.length) {
      return {
        ui: repairedUi,
        report: repairedReport,
        queryResults: repairedQueryResults,
        repaired: true,
      }
    }
  } catch (error) {
    console.warn('Artifact repair attempt failed:', error)
  }

  return { ui, report, queryResults, repaired: false }
}

function extractUiFromMessages(messages: BaseMessage[]): UIElement | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const msgAny = msg as unknown as Record<string, unknown>

    if (msgAny.tool_calls && Array.isArray(msgAny.tool_calls)) {
      const toolCalls = msgAny.tool_calls as Array<{ name: string; args: Record<string, unknown> }>
      for (let j = toolCalls.length - 1; j >= 0; j--) {
        const tc = toolCalls[j]
        if (tc.name === 'render_ui' && tc.args?.ui) {
          return tc.args.ui as UIElement
        }
      }
    }

    if (msgAny.additional_kwargs && typeof msgAny.additional_kwargs === 'object') {
      const kwargs = msgAny.additional_kwargs as Record<string, unknown>
      if (kwargs.tool_calls && Array.isArray(kwargs.tool_calls)) {
        const toolCalls = kwargs.tool_calls as Array<{ function?: { name: string; arguments: string } }>
        for (let j = toolCalls.length - 1; j >= 0; j--) {
          const tc = toolCalls[j]
          if (tc.function?.name === 'render_ui') {
            try {
              const args = JSON.parse(tc.function.arguments)
              if (args.ui) return args.ui as UIElement
            } catch {}
          }
        }
      }
    }
  }
  return null
}

function extractRenderedArtifactsFromMessages(messages: BaseMessage[]): RenderedArtifact[] {
  const artifacts: RenderedArtifact[] = []

  for (const message of messages) {
    const toolCalls = extractToolCallsFromMessage(message)
    if (toolCalls.length === 0) continue

    for (const toolCall of toolCalls) {
      if (toolCall.name === 'render_ui' && toolCall.args?.ui) {
        artifacts.push({
          type: 'visualization',
          ui: toolCall.args.ui as NestedUIElement,
          report: null,
        })
      }

      if (toolCall.name === 'render_report' && toolCall.args?.report) {
        artifacts.push({
          type: 'report',
          ui: null,
          report: toolCall.args.report as Report,
        })
      }
    }
  }

  return artifacts
}

function extractTextContent(messages: BaseMessage[]): string {
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) return ''

  const content = lastMessage.content
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === 'object' && block && 'type' in block && block.type === 'text' && 'text' in block) {
        return block.text as string
      }
    }
  }

  return ''
}

function extractQueryResults(messages: BaseMessage[]): QueryResult[] {
  const queryByToolCallId = new Map<string, { resultKey?: string; query?: string }>()
  const queryByResultKey = new Map<string, string>()

  for (const msg of messages) {
    const toolCalls = extractToolCallsFromMessage(msg)
    for (const tc of toolCalls) {
      if (tc.name !== 'query_dataset') continue

      const resultKey =
        typeof tc.args.resultKey === 'string' ? tc.args.resultKey : undefined
      const query =
        typeof tc.args.query === 'string' ? tc.args.query : undefined

      if (resultKey && query) {
        queryByResultKey.set(resultKey, query)
      }

      if (tc.id) {
        queryByToolCallId.set(tc.id, { resultKey, query })
      }
    }
  }

  const results: QueryResult[] = []

  for (const msg of messages) {
    const msgAny = msg as unknown as Record<string, unknown>
    const msgType = msgAny.type || msgAny._type || (msg.constructor as { name?: string })?.name

    if (msgType === 'tool' || msgType === 'ToolMessage') {
      const toolCallId = typeof msgAny.tool_call_id === 'string' ? msgAny.tool_call_id : undefined
      const content = msg.content
      if (typeof content === 'string') {
        try {
          const parsed = JSON.parse(content)
          if (parsed.success && parsed.resultKey && parsed.data) {
            const query =
              (typeof parsed.query === 'string' ? parsed.query : undefined) ??
              queryByToolCallId.get(toolCallId ?? '')?.query ??
              queryByResultKey.get(parsed.resultKey)

            results.push({
              resultKey: parsed.resultKey,
              data: parsed.data,
              query,
            })
          } else if (parsed.error) {
            console.warn('[extractQueryResults] Tool returned error:', parsed.error)
          }
        } catch (e) {
          console.warn('[extractQueryResults] Failed to parse tool message:', e, 'Content preview:', content.slice(0, 200))
        }
      }
    }
  }

  console.log('[extractQueryResults] Extracted', results.length, 'query results:', results.map(r => r.resultKey))
  return results
}

function extractReportFromMessages(messages: BaseMessage[]): Report | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const msgAny = msg as unknown as Record<string, unknown>

    if (msgAny.tool_calls && Array.isArray(msgAny.tool_calls)) {
      const toolCalls = msgAny.tool_calls as Array<{ name: string; args: Record<string, unknown> }>
      for (let j = toolCalls.length - 1; j >= 0; j--) {
        const tc = toolCalls[j]
        if (tc.name === 'render_report' && tc.args?.report) {
          return tc.args.report as Report
        }
      }
    }

    if (msgAny.additional_kwargs && typeof msgAny.additional_kwargs === 'object') {
      const kwargs = msgAny.additional_kwargs as Record<string, unknown>
      if (kwargs.tool_calls && Array.isArray(kwargs.tool_calls)) {
        const toolCalls = kwargs.tool_calls as Array<{ function?: { name: string; arguments: string } }>
        for (let j = toolCalls.length - 1; j >= 0; j--) {
          const tc = toolCalls[j]
          if (tc.function?.name === 'render_report') {
            try {
              const args = JSON.parse(tc.function.arguments)
              if (args.report) return args.report as Report
            } catch {}
          }
        }
      }
    }
  }
  return null
}

async function generateSuggestions(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string[]> {
  const model = createModel()
  const lastMessages = history.slice(-6)
  const conversationText = lastMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  const response = await model.invoke([
    new HumanMessage(
      `Based on this conversation, suggest 2-3 short follow-up questions the user might ask next. Each must be under 60 characters. Return ONLY a JSON array of strings, no other text.\n\nConversation:\n${conversationText}`
    ),
  ])

  const text = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? (response.content.find(
          (b): b is { type: 'text'; text: string } =>
            typeof b === 'object' && b !== null && 'type' in b && b.type === 'text'
        )?.text ?? '')
      : ''

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  const parsed = JSON.parse(match[0])
  if (!Array.isArray(parsed)) return []
  return parsed.filter((s): s is string => typeof s === 'string').slice(0, 3)
}

interface SendMessageInput {
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

interface RehydrateQueriesInput {
  queries: Array<{ resultKey: string; query: string }>
}

export interface SendMessageResult {
  success: boolean
  response: string
  ui: NestedUIElement | null
  report?: Report | null
  artifacts?: StreamArtifactPayload[]
  queryResults: QueryResult[]
}

export const rehydrateQueryResults = createServerFn({ method: 'POST' })
  .inputValidator((d: RehydrateQueriesInput) => d)
  .handler(async ({ data }) => {
    const dedupedQueries = new Map<string, string>()

    for (const item of data.queries) {
      const resultKey = item.resultKey?.trim()
      const query = item.query?.trim()
      if (!resultKey || !query) continue
      dedupedQueries.set(resultKey, query)
    }

    const queryResults: QueryResult[] = []
    const errors: Array<{ resultKey: string; error: string }> = []

    for (const [resultKey, query] of dedupedQueries.entries()) {
      const result = await executeDatasetQuery({ query, resultKey })

      if ('success' in result && result.success) {
        queryResults.push({
          resultKey: result.resultKey,
          data: result.data,
          query: result.query ?? query,
        })
      } else if ('error' in result) {
        errors.push({
          resultKey,
          error: result.error,
        })
      }
    }

    return {
      success: true,
      queryResults,
      errors,
    }
  })

export const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: SendMessageInput) => d)
  .handler(async ({ data }) => {
    const agent = createAgent()

    const messages: BaseMessage[] = [
      ...(data.history?.map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      ) ?? []),
      new HumanMessage(data.message),
    ]

    try {
      const result = await agent.invoke({ messages }, { recursionLimit: 100 })
      const finalMessages = result.messages as BaseMessage[]
      const response = extractTextContent(finalMessages)
      const initialUi = (extractUiFromMessages(finalMessages) as NestedUIElement | null) ?? null
      const initialQueryResults = extractQueryResults(finalMessages)
      const initialReport = extractReportFromMessages(finalMessages)
      const initialArtifacts = extractRenderedArtifactsFromMessages(finalMessages)

      const repaired = await attemptArtifactRepair({
        agent,
        finalMessages,
        ui: initialUi,
        report: initialReport,
        queryResults: initialQueryResults,
      })

      const sanitized = sanitizeArtifactContent({
        ui: repaired.ui,
        report: repaired.report,
        queryResults: repaired.queryResults,
      })

      const artifacts: StreamArtifactPayload[] =
        initialArtifacts.length > 0
          ? initialArtifacts.map((artifact, index) => {
              const isLastArtifact = index === initialArtifacts.length - 1
              if (!isLastArtifact || !repaired.repaired) {
                return {
                  ui: artifact.ui,
                  report: artifact.report,
                }
              }

              return {
                ui: repaired.ui,
                report: repaired.report,
              }
            })
          : [
              {
                ui: sanitized.ui,
                report: sanitized.report,
              }
            ]

      return {
        success: true,
        response: response || "I've processed your request.",
        ui: sanitized.ui,
        report: sanitized.report,
        artifacts,
        queryResults: repaired.queryResults,
      }
    } catch (error) {
      console.error('Agent error:', error)
      return {
        success: false,
        response: 'Sorry, I encountered an error processing your request.',
        ui: null,
        report: null,
        artifacts: [],
        queryResults: [],
      }
    }
  })

interface ToolCall {
  id?: string
  name: string
  args: Record<string, unknown>
}

function extractToolCallsFromMessage(msg: unknown): ToolCall[] {
  if (!msg || typeof msg !== 'object') return []

  const msgAny = msg as Record<string, unknown>

  if (msgAny.tool_calls && Array.isArray(msgAny.tool_calls)) {
    return msgAny.tool_calls as ToolCall[]
  }

  if (msgAny.additional_kwargs && typeof msgAny.additional_kwargs === 'object') {
    const kwargs = msgAny.additional_kwargs as Record<string, unknown>
    if (kwargs.tool_calls && Array.isArray(kwargs.tool_calls)) {
      return (kwargs.tool_calls as Array<{ id?: string; function?: { name: string; arguments: string } }>)
        .filter((tc) => tc.function)
        .map((tc) => ({
          id: tc.id,
          name: tc.function!.name,
          args: JSON.parse(tc.function!.arguments || '{}'),
        }))
    }
  }

  return []
}

function isToolMessage(msg: unknown): { toolCallId: string; content: string } | null {
  if (!msg || typeof msg !== 'object') return null

  const msgAny = msg as Record<string, unknown>
  const msgType = msgAny.type || msgAny._type || (msgAny.constructor as { name?: string })?.name

  if (
    (msgType === 'tool' || msgType === 'ToolMessage' || msgType === 'ToolMessageChunk') &&
    msgAny.tool_call_id &&
    typeof msgAny.content === 'string'
  ) {
    return {
      toolCallId: msgAny.tool_call_id as string,
      content: msgAny.content,
    }
  }

  return null
}

function extractTextFromChunk(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== 'object') return null

  const msg = chunk as Record<string, unknown>
  const content = msg.content

  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === 'string') return block
      if (block && typeof block === 'object' && 'text' in block) {
        return (block as { text: string }).text
      }
    }
  }

  return null
}

export const streamMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: SendMessageInput) => d)
  .handler(async function* ({ data }) {
    const agent = createAgent()

    const messages: BaseMessage[] = [
      ...(data.history?.map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      ) ?? []),
      new HumanMessage(data.message),
    ]

    try {
      const stream = await agent.stream(
        { messages },
        { recursionLimit: 50, streamMode: ['messages', 'values'] as const }
      )

      let finalMessages: BaseMessage[] = []
      const seenToolCalls = new Set<string>()
      const pendingToolCalls = new Map<string, { name: string; args: Record<string, unknown> }>()

      for await (const chunk of stream) {
        const [mode, chunkData] = chunk as unknown as [string, unknown]

        if (mode === 'messages') {
          const [messageChunk] = chunkData as [unknown, unknown]

          const toolCalls = extractToolCallsFromMessage(messageChunk)
          for (const tc of toolCalls) {
            const toolCallId = tc.id || `${tc.name}-${Date.now()}`
            if (!seenToolCalls.has(toolCallId)) {
              seenToolCalls.add(toolCallId)
              pendingToolCalls.set(toolCallId, { name: tc.name, args: tc.args })
              yield {
                type: 'tool_start',
                toolCallId,
                name: tc.name,
                args: tc.args as Record<string, {}>,
              } satisfies StreamToolStartChunk
            }
          }

          const toolResult = isToolMessage(messageChunk)
          if (toolResult) {
            const pending = pendingToolCalls.get(toolResult.toolCallId)
            if (pending) {
              pendingToolCalls.delete(toolResult.toolCallId)
              let parsedResult: {} = toolResult.content
              try {
                parsedResult = JSON.parse(toolResult.content)
              } catch {}
              yield {
                type: 'tool_end',
                toolCallId: toolResult.toolCallId,
                result: parsedResult,
              } satisfies StreamToolEndChunk
            }
            continue
          }

          if (toolCalls.length > 0) continue

          const text = extractTextFromChunk(messageChunk)
          if (text) {
            yield { type: 'text', content: text } satisfies StreamTextChunk
          }
        } else if (mode === 'values') {
          const values = chunkData as { messages?: BaseMessage[] }
          if (values.messages) {
            finalMessages = values.messages
          }
        }
      }

      const initialUi = (extractUiFromMessages(finalMessages) as NestedUIElement | null) ?? null
      const initialQueryResults = extractQueryResults(finalMessages)
      const initialReport = extractReportFromMessages(finalMessages)
      const initialArtifacts = extractRenderedArtifactsFromMessages(finalMessages)

      const repaired = await attemptArtifactRepair({
        agent,
        finalMessages,
        ui: initialUi,
        report: initialReport,
        queryResults: initialQueryResults,
      })

      const sanitized = sanitizeArtifactContent({
        ui: repaired.ui,
        report: repaired.report,
        queryResults: repaired.queryResults,
      })

      const artifacts: StreamArtifactPayload[] =
        initialArtifacts.length > 0
          ? initialArtifacts.map((artifact, index) => {
              const isLastArtifact = index === initialArtifacts.length - 1
              if (!isLastArtifact || !repaired.repaired) {
                return {
                  ui: artifact.ui,
                  report: artifact.report,
                }
              }

              return {
                ui: repaired.ui,
                report: repaired.report,
              }
            })
          : [
              {
                ui: sanitized.ui,
                report: sanitized.report,
              },
            ]

      let suggestions: string[] | undefined
      try {
        const history = [
          ...(data.history ?? []),
          { role: 'user' as const, content: data.message },
          { role: 'assistant' as const, content: extractTextContent(finalMessages) },
        ]
        suggestions = await generateSuggestions(history)
      } catch (e) {
        console.warn('Failed to generate suggestions:', e)
      }

      yield {
        type: 'done',
        ui: sanitized.ui,
        queryResults: repaired.queryResults,
        report: sanitized.report,
        artifacts,
        suggestions,
      } satisfies StreamDoneChunk
    } catch (error) {
      console.error('Agent streaming error:', error)
      yield {
        type: 'done',
        ui: null,
        queryResults: [],
        report: null,
        artifacts: [],
      } satisfies StreamDoneChunk
    }
  })
