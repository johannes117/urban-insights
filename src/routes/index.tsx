import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChatPanel } from '../components/ChatPanel'
import { ArtifactPanel } from '../components/ArtifactPanel'
import { sendMessage, type SendMessageResult } from '../server/chat'
import type { Message, NestedUIElement } from '../lib/types'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentUi, setCurrentUi] = useState<NestedUIElement | null>(null)
  const [chatWidthPercent, setChatWidthPercent] = useState(33)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const result = (await sendMessage({
        data: {
          message: content,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        },
      })) as SendMessageResult

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.response,
        ui: result.ui ?? undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (result.ui) {
        setCurrentUi(result.ui)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }
      setMessages((prev) => [...prev, errorMessage])
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
          ui={currentUi}
          onResizePointerDown={handlePointerDown}
          isResizing={isDragging}
        />
      </div>
    </div>
  )
}
