import { useCallback, useState } from 'react'
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
} from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../lib/types'
import { ToolCallDisplay } from './ToolCallDisplay'

const EXAMPLE_PROMPTS: { icon: LucideIcon; text: string }[] = [
  { icon: Users, text: 'Show the population of City of Melbourne' },
  { icon: TrendingDown, text: 'Which LGAs have the highest disadvantage?' },
  { icon: DollarSign, text: 'Compare median income across LGAs' },
  { icon: BarChart3, text: 'Top 10 LGAs by population' },
  { icon: Calendar, text: 'Median age by Victorian LGA' },
  { icon: Globe, text: 'Overseas-born population by LGA' },
  { icon: GraduationCap, text: 'Year 12 completion rates by LGA' },
  { icon: LayoutDashboard, text: 'Regional vs metro Victoria dashboard' },
]

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (message: string) => void
}

export function ChatPanel({ messages, isLoading, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [censusData, setCensusData] = useState<any>(null)

  const scrollAnchorRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    },
    [messages.length, isLoading],
  )

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userInput = input.trim()
    onSendMessage(userInput)
    setInput('')

    try {
      const response = await fetch('/api/census', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lga: userInput,
          topic: 'population',
        }),
      })

      const data = await response.json()
      setCensusData(data)
    } catch (err) {
      console.error('Failed to fetch ABS census data', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500">Start a conversation</p>
              <p className="mt-1 text-sm text-gray-400">
                Ask about ABS Census data by LGA
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
                  className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50"
                >
                  <prompt.icon className="h-4 w-4 text-gray-400" />
                  <span>{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isLast = index === messages.length - 1
          const isStreaming = isLast && isLoading && message.role === 'assistant'

          if (message.role === 'tool' && message.toolCall) {
            return (
              <div key={message.id} ref={isLast ? scrollAnchorRef : undefined}>
                <ToolCallDisplay toolCall={message.toolCall} />
              </div>
            )
          }

          if (message.role === 'assistant') {
            return (
              <div
                key={message.id}
                ref={isLast ? scrollAnchorRef : undefined}
                className="prose prose-sm max-w-none"
              >
                <Markdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </Markdown>
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />
                )}
              </div>
            )
          }

          return (
            <div
              key={message.id}
              ref={isLast ? scrollAnchorRef : undefined}
              className="flex justify-end"
            >
              <div className="max-w-[80%] rounded-lg bg-gray-900 px-4 py-2 text-white">
                {message.content}
              </div>
            </div>
          )
        })}
      </div>

      {censusData && (
        <div className="mx-2 mb-4 rounded-lg border bg-gray-50 p-4">
          <h3 className="text-sm font-semibold">
            ABS Census Population (2021)
          </h3>
          <p className="text-xs text-gray-600">
            LGA Code: {censusData.lgaCode}
          </p>
          <p className="text-lg font-bold">
            {censusData.value.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            Source: {censusData.source}
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-2 flex flex-col gap-2 rounded-xl border bg-white p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about an LGA (e.g. City of Melbourne)"
          className="min-h-[60px] resize-none bg-transparent text-sm focus:outline-none"
          disabled={isLoading}
        />
        <div className="flex justify-between">
          <Settings2 className="h-4 w-4 text-gray-400" />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-full bg-gray-100 p-2"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}

