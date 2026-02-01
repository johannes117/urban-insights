import { useState } from "react"
import { ArrowUp } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
  placeholder?: string
}

export function ChatInput({
  onSendMessage,
  isLoading,
  placeholder = "Ask about Victorian census data...",
}: ChatInputProps) {
  const [input, setInput] = useState("")

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim())
      setInput("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg focus-within:ring-1 focus-within:ring-gray-300"
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[60px] w-full resize-none bg-transparent px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
        disabled={isLoading}
      />

      <div className="flex items-center justify-end px-2">
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
