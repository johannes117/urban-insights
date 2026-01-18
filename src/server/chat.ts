import { createServerFn } from '@tanstack/react-start'
import { createAgent } from '../lib/agent'
import type { UIElement } from '@json-render/core'

interface AgentMessage {
  role: string
  content: string | Array<{ type: string; tool_use_id?: string; content?: string; name?: string; input?: unknown }>
}

interface ToolCall {
  name: string
  args: {
    ui?: unknown
  }
}

function extractUiFromMessages(messages: AgentMessage[]): UIElement | null {
  for (const msg of messages) {
    // Check for tool_calls array (LangChain format)
    const msgAny = msg as Record<string, unknown>
    if (msgAny.tool_calls && Array.isArray(msgAny.tool_calls)) {
      for (const toolCall of msgAny.tool_calls as Array<{ name: string; args: Record<string, unknown> }>) {
        if (toolCall.name === 'render_ui' && toolCall.args?.ui) {
          return toolCall.args.ui as UIElement
        }
      }
    }

    // Check for additional_kwargs.tool_calls
    if (msgAny.additional_kwargs && typeof msgAny.additional_kwargs === 'object') {
      const kwargs = msgAny.additional_kwargs as Record<string, unknown>
      if (kwargs.tool_calls && Array.isArray(kwargs.tool_calls)) {
        for (const toolCall of kwargs.tool_calls as Array<{ function?: { name: string; arguments: string } }>) {
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

    for (const block of msg.content) {
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

interface SendMessageInput {
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: SendMessageInput) => d)
  .handler(async ({ data }) => {
    const agent = createAgent()

    const messages = [
      ...(data.history?.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })) ?? []),
      { role: 'user' as const, content: data.message },
    ]

    try {
      const result = await agent.invoke({ messages })
      const agentMessages = result.messages as AgentMessage[]
      const ui = extractUiFromMessages(agentMessages)
      const response = extractTextContent(agentMessages)

      return {
        success: true,
        response: response || "I've created the visualization for you.",
        ui,
      }
    } catch (error) {
      console.error('Agent error:', error)
      return {
        success: false,
        response: 'Sorry, I encountered an error processing your request.',
        ui: null,
      }
    }
  })
