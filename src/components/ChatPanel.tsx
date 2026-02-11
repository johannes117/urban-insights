import { useCallback, useMemo } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import type { Message, ToolCall } from "../lib/types"
import { ToolCallDisplay } from "./ToolCallDisplay"
import { ChatInput } from "./ChatInput"

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (message: string) => void
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
}

type GroupedEntry =
  | { type: "message"; message: Message; index: number }
  | { type: "tool_group"; toolCalls: ToolCall[]; lastIndex: number }

export function ChatPanel({
  messages,
  isLoading,
  onSendMessage,
  suggestions = [],
  onSuggestionClick,
}: ChatPanelProps) {
  const scrollAnchorRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "end" })
      }
    },
    [messages.length, isLoading],
  )

  const grouped = useMemo(() => {
    const result: GroupedEntry[] = []
    let i = 0
    while (i < messages.length) {
      const msg = messages[i]
      if (msg.role === "tool" && msg.toolCall) {
        const toolCalls: ToolCall[] = []
        let lastIdx = i
        while (i < messages.length && messages[i].role === "tool" && messages[i].toolCall) {
          toolCalls.push(messages[i].toolCall!)
          lastIdx = i
          i++
        }
        result.push({ type: "tool_group", toolCalls, lastIndex: lastIdx })
      } else {
        result.push({ type: "message", message: msg, index: i })
        i++
      }
    }
    return result
  }, [messages])

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-sm text-gray-400">Your conversation will appear here</p>
          </div>
        )}

        {grouped.map((entry) => {
          if (entry.type === "tool_group") {
            const isLast = entry.lastIndex === messages.length - 1
            return (
              <div key={`tool-group-${entry.lastIndex}`} ref={isLast ? scrollAnchorRef : undefined}>
                <ToolCallDisplay toolCalls={entry.toolCalls} />
              </div>
            )
          }

          const { message, index } = entry
          const isLastMessage = index === messages.length - 1
          const isStreaming =
            isLastMessage && isLoading && message.role === "assistant"

          if (message.role === "assistant") {
            return (
              <div
                key={message.id}
                ref={isLastMessage ? scrollAnchorRef : undefined}
                className="text-gray-900 prose prose-sm prose-gray max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-gray-900"
              >
                {(message.content || isStreaming) && (
                  <>
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </Markdown>
                    {isStreaming && (
                      <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 animate-pulse" />
                    )}
                  </>
                )}
              </div>
            )
          }

          return (
            <div
              key={message.id}
              ref={isLastMessage ? scrollAnchorRef : undefined}
              className="flex justify-end"
            >
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-900 text-white">
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 shrink-0">
        {suggestions.length > 0 && !isLoading && (
          <div className="mb-2 flex flex-wrap gap-2 animate-fade-in">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick?.(suggestion)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <ChatInput
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          placeholder="Ask a follow up..."
        />
      </div>
    </div>
  )
}
