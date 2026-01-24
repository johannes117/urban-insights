import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChatPanel } from '../components/ChatPanel'
import { ArtifactPanel } from '../components/ArtifactPanel'
import { streamMessage } from '../server/chat'
import type { Message, NestedUIElement, QueryResult, StreamChunk, ToolCall } from '../lib/types'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [artifactState, setArtifactState] = useState<{
    items: Array<{ ui: NestedUIElement; queryResults: QueryResult[] }>
    index: number
  }>({ items: [], index: -1 })
  const [chatWidthPercent, setChatWidthPercent] = useState(33)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const currentArtifact =
    artifactState.index >= 0 ? artifactState.items[artifactState.index] ?? null : null

  const handleArtifactIndexChange = (nextIndex: number) => {
    setArtifactState((prev) => {
      if (prev.items.length === 0) return prev
      const clamped = Math.min(prev.items.length - 1, Math.max(0, nextIndex))
      return { ...prev, index: clamped }
    })
  }

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setIsLoading(true)

    try {
      const stream = await streamMessage({
        data: {
          message: content,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        },
      })

      let accumulatedText = ''
      const toolCallsMap = new Map<string, ToolCall>()

      for await (const chunk of stream) {
        const typedChunk = chunk as StreamChunk
        if (typedChunk.type === 'text') {
          accumulatedText += typedChunk.content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: accumulatedText } : m
            )
          )
        } else if (typedChunk.type === 'tool_start') {
          const toolCall: ToolCall = {
            id: typedChunk.toolCallId,
            name: typedChunk.name,
            args: typedChunk.args,
            status: 'running',
          }
          toolCallsMap.set(typedChunk.toolCallId, toolCall)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, toolCalls: Array.from(toolCallsMap.values()) }
                : m
            )
          )
        } else if (typedChunk.type === 'tool_end') {
          const existing = toolCallsMap.get(typedChunk.toolCallId)
          if (existing) {
            existing.status = 'complete'
            existing.result = typedChunk.result
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, toolCalls: Array.from(toolCallsMap.values()) }
                  : m
              )
            )
          }
        } else if (typedChunk.type === 'done') {
          const finalContent = accumulatedText || "I've created the visualization for you."
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: finalContent, ui: typedChunk.ui ?? undefined }
                : m
            )
          )

          if (typedChunk.ui) {
            setArtifactState((prev) => {
              const items = [
                ...prev.items,
                { ui: typedChunk.ui!, queryResults: typedChunk.queryResults || [] },
              ]
              return { items, index: items.length - 1 }
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) {
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const position = ((event.clientX - rect.left) / rect.width) * 100
    const clamped = Math.min(60, Math.max(20, position))
    setChatWidthPercent(clamped)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  return (
    <div
      ref={containerRef}
      className="flex h-screen bg-gray-50 p-6"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="min-w-0 mr-6" style={{ width: `${chatWidthPercent}%` }}>
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
        />
      </div>
      <div className="min-w-0 flex-1">
        <ArtifactPanel
          ui={currentArtifact?.ui ?? null}
          queryResults={currentArtifact?.queryResults ?? []}
          onResizePointerDown={handlePointerDown}
          isResizing={isDragging}
          artifactCount={artifactState.items.length}
          artifactIndex={artifactState.index}
          onArtifactIndexChange={handleArtifactIndexChange}
        />
      </div>
    </div>
  )
}
