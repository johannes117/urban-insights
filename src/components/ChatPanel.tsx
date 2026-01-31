import { useCallback } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import type { Message } from "../lib/types"
import { ToolCallDisplay } from "./ToolCallDisplay"
import { ChatInput } from "./ChatInput"

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (message: string) => void
  selectedLGA: string | null
  onLGAChange: (lga: string | null) => void
}

export function ChatPanel({
  messages,
  isLoading,
  onSendMessage,
  selectedLGA,
  onLGAChange,
}: ChatPanelProps) {
  const scrollAnchorRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "end" })
      }
    },
    [messages.length, isLoading],
  )

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-sm text-gray-400">Your conversation will appear here</p>
          </div>
        )}

        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1
          const isStreaming =
            isLastMessage && isLoading && message.role === "assistant"

          if (message.role === "tool" && message.toolCall) {
            return (
              <div key={message.id} ref={isLastMessage ? scrollAnchorRef : undefined}>
                <ToolCallDisplay toolCall={message.toolCall} />
              </div>
            )
          }

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
        <ChatInput
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          placeholder="Ask a follow up..."
          selectedLGA={selectedLGA}
          onLGAChange={onLGAChange}
          showLGASelector={true}
        />
      </div>
    </div>
  )
}
