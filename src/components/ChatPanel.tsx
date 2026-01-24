import { useCallback, useState } from 'react'
import { ArrowUp, Settings2 } from 'lucide-react'
import type { Message } from '../lib/types'
import { ToolCallDisplay } from './ToolCallDisplay'

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (message: string) => void
}

export function ChatPanel({ messages, isLoading, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState('')

  const scrollAnchorRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    },
    [messages.length, isLoading],
  )

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="relative flex h-full flex-col bg-transparent">
      <div className="flex-1 space-y-4 overflow-y-auto px-2 pb-36 pt-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500">Start a conversation</p>
              <p className="mt-1 text-sm text-gray-400">
                Ask me to create charts, dashboards, or visualizations
              </p>
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1
          const isStreaming = isLastMessage && isLoading && message.role === 'assistant'
          return (
          <div
            key={message.id}
            ref={isLastMessage ? scrollAnchorRef : undefined}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mb-2">
                  {message.toolCalls.map((tc) => (
                    <ToolCallDisplay key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
              {(message.content || isStreaming) && (
                <p className="whitespace-pre-wrap">
                  {message.content}
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 animate-pulse" />
                  )}
                </p>
              )}
            </div>
          </div>
        )
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="absolute bottom-4 left-2 right-2 z-10 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg focus-within:ring-1 focus-within:ring-gray-300"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow up..."
          className="min-h-[60px] w-full resize-none bg-transparent px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            className="text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
