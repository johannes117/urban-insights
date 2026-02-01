import { createServerFn } from '@tanstack/react-start'
import { createAgent } from '../lib/agent'
import type { UIElement } from '@json-render/core'
import type { NestedUIElement, QueryResult } from '../lib/types'

type StreamTextChunk = { type: 'text'; content: string }
type StreamToolStartChunk = { type: 'tool_start'; toolCallId: string; name: string; args: Record<string, {}> }
type StreamToolEndChunk = { type: 'tool_end'; toolCallId: string; result: {} }
type StreamDoneChunk = { type: 'done'; ui: NestedUIElement | null; queryResults: QueryResult[] }
type StreamChunk = StreamTextChunk | StreamToolStartChunk | StreamToolEndChunk | StreamDoneChunk

interface AgentMessage {
  role: string
  content: string | Array<{ type: string; tool_use_id?: string; content?: string; name?: string; input?: unknown }>
  [key: string]: unknown
}

interface ToolCall {
  name: string
  args: {
    ui?: unknown
    query?: string
    resultKey?: string
  }
}

function extractUiFromMessages(messages: AgentMessage[]): UIElement | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const msg = messages[messageIndex]
    // Check for tool_calls array (LangChain format)
    const msgAny = msg as unknown as Record<string, unknown>
    if (msgAny.tool_calls && Array.isArray(msgAny.tool_calls)) {
      const toolCalls = msgAny.tool_calls as Array<{ name: string; args: Record<string, unknown> }>
      for (let i = toolCalls.length - 1; i >= 0; i--) {
        const toolCall = toolCalls[i]
        if (toolCall.name === 'render_ui' && toolCall.args?.ui) {
          return toolCall.args.ui as UIElement
        }
      }
    }

    // Check for additional_kwargs.tool_calls
    if (msgAny.additional_kwargs && typeof msgAny.additional_kwargs === 'object') {
      const kwargs = msgAny.additional_kwargs as Record<string, unknown>
      if (kwargs.tool_calls && Array.isArray(kwargs.tool_calls)) {
        const toolCalls = kwargs.tool_calls as Array<{ function?: { name: string; arguments: string } }>
        for (let i = toolCalls.length - 1; i >= 0; i--) {
          const toolCall = toolCalls[i]
          if (toolCall.function?.name === 'render_ui') {
            try {
              const args = JSON.parse(toolCall.function.arguments)
              if (args.ui) {
                return args.ui as UIElement
              }
            } catch (e) {
              console.error('Failed to parse tool arguments:', e)
            }
          }
        }
      }
    }

    if (typeof msg.content === 'string') continue

    for (let i = msg.content.length - 1; i >= 0; i--) {
      const block = msg.content[i]
      if (block.type === 'tool_use' && block.name === 'render_ui') {
        const toolUse = block as unknown as ToolCall
        if (toolUse.args?.ui) {
          return toolUse.args.ui as UIElement
        }
      }
    }
  }
  return null
}

function extractTextContent(messages: AgentMessage[]): string {
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) return ''

  if (typeof lastMessage.content === 'string') {
    return lastMessage.content
  }

  for (const block of lastMessage.content) {
    if (block.type === 'text' && block.content) {
      return block.content
    }
  }

  return ''
}

function extractQueryResults(messages: AgentMessage[]): QueryResult[] {
  const results: QueryResult[] = []

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      if (msg.role === 'tool' || msg.type === 'tool') {
        try {
          const parsed = JSON.parse(msg.content)
          if (parsed.success && parsed.resultKey && parsed.data) {
            results.push({ resultKey: parsed.resultKey, data: parsed.data })
          }
        } catch {
          // Not a JSON response, skip
        }
      }
      continue
    }

    if (!Array.isArray(msg.content)) continue

    for (const block of msg.content) {
      if (block.type === 'tool_result' && typeof block.content === 'string') {
        try {
          const parsed = JSON.parse(block.content)
          if (parsed.success && parsed.resultKey && parsed.data) {
            results.push({ resultKey: parsed.resultKey, data: parsed.data })
          }
        } catch {
          // Not a JSON response, skip
        }
      }
    }
  }

  return results
}

interface SendMessageInput {
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  lgaContext?: string
}

export interface SendMessageResult {
  success: boolean
  response: string
  ui: NestedUIElement | null
  queryResults: QueryResult[]
}

export const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: SendMessageInput) => d)
  .handler(async ({ data }) => {
    const agent = createAgent({ lgaContext: data.lgaContext })

    const messages = [
      ...(data.history?.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })) ?? []),
      { role: 'user' as const, content: data.message },
    ]

    try {
      const result = await agent.invoke({ messages }, { recursionLimit: 50 })
      const agentMessages = result.messages as unknown as AgentMessage[]
      const ui = extractUiFromMessages(agentMessages)
      const response = extractTextContent(agentMessages)
      const queryResults = extractQueryResults(agentMessages)

      return {
        success: true,
        response: response || "I've created the visualization for you.",
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

function extractTextFromMessageChunk(messageChunk: unknown): string | null {
  if (!messageChunk || typeof messageChunk !== 'object') return null

  const msg = messageChunk as Record<string, unknown>
  const content = msg.content

  if (typeof content === 'string') {
    return content
  }

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

interface LangChainToolCall {
  id?: string
  name: string
  args: Record<string, unknown>
}

function extractToolCallsFromMessage(
  messageChunk: unknown
): LangChainToolCall[] {
  if (!messageChunk || typeof messageChunk !== 'object') return []

  const msg = messageChunk as Record<string, unknown>

  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    return msg.tool_calls as LangChainToolCall[]
  }

  if (msg.additional_kwargs && typeof msg.additional_kwargs === 'object') {
    const kwargs = msg.additional_kwargs as Record<string, unknown>
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

function isToolMessage(messageChunk: unknown): { toolCallId: string; content: string } | null {
  if (!messageChunk || typeof messageChunk !== 'object') return null

  const msg = messageChunk as Record<string, unknown>
  const msgType = msg.type || msg._type || (msg.constructor as { name?: string })?.name

  if (
    (msgType === 'tool' || msg.role === 'tool' || msgType === 'ToolMessage' || msgType === 'ToolMessageChunk') &&
    msg.tool_call_id &&
    typeof msg.content === 'string'
  ) {
    return {
      toolCallId: msg.tool_call_id as string,
      content: msg.content,
    }
  }

  return null
}

export const streamMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: SendMessageInput) => d)
  .handler(async function* ({ data }) {
    const agent = createAgent({ lgaContext: data.lgaContext })

    const messages = [
      ...(data.history?.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })) ?? []),
      { role: 'user' as const, content: data.message },
    ]

    try {
      const stream = await agent.stream(
        { messages },
        { recursionLimit: 50, streamMode: ['messages', 'values'] }
      )

      let finalMessages: AgentMessage[] = []
      const seenToolCalls = new Set<string>()
      const pendingToolCalls = new Map<string, { name: string; args: Record<string, unknown> }>()

      for await (const chunk of stream) {
        const [mode, chunkData] = chunk as unknown as [string, unknown]

        if (mode === 'messages') {
          const [messageChunk, metadata] = chunkData as [unknown, Record<string, unknown>]

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
              } catch {
                // keep as string
              }
              yield {
                type: 'tool_end',
                toolCallId: toolResult.toolCallId,
                result: parsedResult,
              } satisfies StreamToolEndChunk
            }
            continue
          }

          if (toolCalls.length > 0) {
            continue
          }

          const text = extractTextFromMessageChunk(messageChunk)
          if (text) {
            yield { type: 'text', content: text } satisfies StreamTextChunk
          }
        } else if (mode === 'values') {
          const values = chunkData as { messages?: AgentMessage[] }
          if (values.messages) {
            finalMessages = values.messages
          }
        }
      }

      const ui = extractUiFromMessages(finalMessages)
      const queryResults = extractQueryResults(finalMessages)

      yield {
        type: 'done',
        ui: (ui as NestedUIElement | null) ?? null,
        queryResults,
      } satisfies StreamDoneChunk
    } catch (error) {
      console.error('Agent streaming error:', error)
      yield { type: 'done', ui: null, queryResults: [] } satisfies StreamDoneChunk
    }
  })
