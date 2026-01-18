import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChatPanel } from '../components/ChatPanel'
import { ArtifactPanel } from '../components/ArtifactPanel'
import { sendMessage } from '../server/chat'
import type { Message, NestedUIElement } from '../lib/types'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentUi, setCurrentUi] = useState<NestedUIElement | null>(null)

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const result = await sendMessage({
        data: {
          message: content,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        },
      })

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

  return (
    <div className="flex h-screen">
      <div className="w-1/2 border-r border-gray-200">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
        />
      </div>
      <div className="w-1/2">
        <ArtifactPanel ui={currentUi} />
      </div>
    </div>
  )
}
