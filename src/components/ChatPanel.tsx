import { useCallback, useState } from "react"
import {
  ArrowUp,
  Settings2,
  Users,
  TrendingDown,
  DollarSign,
  BarChart3,
  Calendar,
  Globe,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import type { Message } from "../lib/types"
import { ToolCallDisplay } from "./ToolCallDisplay"
import LGASelector from "./LGASelector"
import { getLgaCode } from "../lib/abs/lgaMapper"

const EXAMPLE_PROMPTS: { icon: LucideIcon; text: string }[] = [
  { icon: Users, text: "Show the population distribution across Victorian LGAs" },
  { icon: TrendingDown, text: "Which LGAs have the highest SEIFA disadvantage index?" },
  { icon: DollarSign, text: "Compare median household income for Melbourne, Geelong, and Ballarat" },
  { icon: BarChart3, text: "Create a bar chart of top 10 LGAs by population" },
  { icon: Calendar, text: "What is the median age in each Victorian LGA?" },
  { icon: Globe, text: "Show overseas-born population percentage by LGA" },
  { icon: GraduationCap, text: "Which areas have the highest Year 12 completion rates?" },
  { icon: LayoutDashboard, text: "Create a dashboard comparing regional vs metropolitan Victoria" },
]

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (message: string) => void
}

export function ChatPanel({ messages, isLoading, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [selectedLGA, setSelectedLGA] = useState<string | null>(null)

  const scrollAnchorRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "end" })
      }
    },
    [messages.length, isLoading],
  )

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

  const handleLGASelect = (lga: string) => {
    setSelectedLGA(lga)

    const absCode = getLgaCode(lga)
    console.log("Selected LGA:", lga, "ABS code:", absCode)

    // auto-trigger a query (optional)
    // onSendMessage(`Show population data for ${lga}`)
  }

  return (
    <div className="flex h-full flex-col bg-transparent">

      {/* LGA Selector */}
      <div className="px-2 pt-2">
        <LGASelector
          lgaList={[
            "City of Melbourne",
            "City of Port Phillip",
            "City of Yarra",
            "City of Greater Geelong",
            "City of Ballarat",
          ]}
          onSelect={handleLGASelect}
        />
        {selectedLGA && (
          <p className="text-xs text-gray-500 mt-1">
            Selected LGA: <span className="font-medium">{selectedLGA}</span>
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500">Start a conversation</p>
              <p className="mt-1 text-sm text-gray-400">
                Ask me to create charts, dashboards, or visualizations
              </p>
            </div>

            <div className="mt-6 w-full max-w-md space-y-2">
              <p className="text-xs text-gray-400 text-center mb-3">
                Try an example:
              </p>

              {EXAMPLE_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSendMessage(prompt.text)}
                  className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-left text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                >
                  <prompt.icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span>{prompt.text}</span>
                </button>
              ))}
            </div>
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

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="mt-4 shrink-0 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg focus-within:ring-1 focus-within:ring-gray-300"
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
