import { createServerFn } from '@tanstack/react-start'
import { createAgent } from '../lib/agent'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { UIElement } from '@json-render/core'
import type { NestedUIElement, QueryResult, Report } from '../lib/types'
import type { BaseMessage } from '@langchain/core/messages'
import { executeDatasetQuery } from '../lib/datasetTools'

type StreamTextChunk = { type: 'text'; content: string }
type StreamToolStartChunk = { type: 'tool_start'; toolCallId: string; name: string; args: Record<string, {}> }
type StreamToolEndChunk = { type: 'tool_end'; toolCallId: string; result: {} }
type StreamDoneChunk = { type: 'done'; ui: NestedUIElement | null; queryResults: QueryResult[]; report: Report | null }
type StreamChunk = StreamTextChunk | StreamToolStartChunk | StreamToolEndChunk | StreamDoneChunk

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
      } else {
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
      const ui = extractUiFromMessages(finalMessages)
      const response = extractTextContent(finalMessages)
      const queryResults = extractQueryResults(finalMessages)

      return {
        success: true,
        response: response || "I've processed your request.",
        ui: (ui as NestedUIElement | null) ?? null,
        queryResults,
      }
    } catch (error) {
      console.error('Agent error:', error)
      return {
        success: false,
        response: 'Sorry, I encountered an error processing your request.',
        ui: null,
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

      const ui = extractUiFromMessages(finalMessages)
      const queryResults = extractQueryResults(finalMessages)
      const report = extractReportFromMessages(finalMessages)

      yield {
        type: 'done',
        ui: (ui as NestedUIElement | null) ?? null,
        queryResults,
        report,
      } satisfies StreamDoneChunk
    } catch (error) {
      console.error('Agent streaming error:', error)
      yield { type: 'done', ui: null, queryResults: [], report: null } satisfies StreamDoneChunk
    }
  })
