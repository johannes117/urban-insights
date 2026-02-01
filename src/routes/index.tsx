import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChatPanel } from '../components/ChatPanel'
import { ArtifactPanel } from '../components/ArtifactPanel'
import { WelcomeScreen } from '../components/WelcomeScreen'
import { streamMessage } from '../server/chat'
import type { Message, NestedUIElement, QueryResult, StreamChunk, ToolCall } from '../lib/types'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLGA, setSelectedLGA] = useState<string | null>(null)
  const [artifactState, setArtifactState] = useState<{
    items: Array<{ ui: NestedUIElement; queryResults: QueryResult[] }>
    index: number
  }>({ items: [], index: -1 })
  const [chatWidthPercent, setChatWidthPercent] = useState(33)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const hasConversation = messages.length > 0
  const hasArtifact = artifactState.items.length > 0
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

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const stream = await streamMessage({
        data: {
          message: content,
          history: messages
            .filter((m) => m.role !== 'tool')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          lgaContext: selectedLGA || undefined,
        },
      }) as AsyncIterable<StreamChunk>

      let currentTextMessageId: string | null = null
      let currentText = ''
      const toolMessageIds = new Map<string, string>()

      for await (const chunk of stream) {
        const typedChunk = chunk

        if (typedChunk.type === 'text') {
          if (!currentTextMessageId) {
            currentTextMessageId = crypto.randomUUID()
            currentText = typedChunk.content
            const assistantMessage: Message = {
              id: currentTextMessageId,
              role: 'assistant',
              content: currentText,
            }
            setMessages((prev) => [...prev, assistantMessage])
          } else {
            currentText += typedChunk.content
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentTextMessageId ? { ...m, content: currentText } : m
              )
            )
          }
        } else if (typedChunk.type === 'tool_start') {
          currentTextMessageId = null
          currentText = ''

          const toolMessageId = crypto.randomUUID()
          toolMessageIds.set(typedChunk.toolCallId, toolMessageId)

          const toolCall: ToolCall = {
            id: typedChunk.toolCallId,
            name: typedChunk.name,
            args: typedChunk.args,
            status: 'running',
          }

          const toolMessage: Message = {
            id: toolMessageId,
            role: 'tool',
            content: '',
            toolCall,
          }
          setMessages((prev) => [...prev, toolMessage])
        } else if (typedChunk.type === 'tool_end') {
          const toolMessageId = toolMessageIds.get(typedChunk.toolCallId)
          if (toolMessageId) {
            const updatedToolCall = { status: 'complete' as const, result: typedChunk.result }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === toolMessageId && m.toolCall
                  ? {
                      ...m,
                      toolCall: { ...m.toolCall, ...updatedToolCall },
                    }
                  : m
              )
            )
          }
        } else if (typedChunk.type === 'done') {
          if (!currentTextMessageId && currentText === '') {
            const doneMessage: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: "I've created the visualization for you.",
              ui: typedChunk.ui ?? undefined,
            }
            setMessages((prev) => [...prev, doneMessage])
          } else if (currentTextMessageId && typedChunk.ui) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentTextMessageId ? { ...m, ui: typedChunk.ui ?? undefined } : m
              )
            )
          }

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
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ])
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

  if (!hasConversation) {
    return (
      <WelcomeScreen
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        selectedLGA={selectedLGA}
        onLGAChange={setSelectedLGA}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex h-screen bg-gray-50 p-6 ${!hasArtifact ? 'justify-center' : ''}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`min-w-0 ${hasArtifact ? 'mr-6' : 'w-full max-w-3xl'}`}
        style={hasArtifact ? { width: `${chatWidthPercent}%` } : undefined}
      >
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          selectedLGA={selectedLGA}
          onLGAChange={setSelectedLGA}
        />
      </div>
      {hasArtifact && (
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
      )}
    </div>
  )
}
