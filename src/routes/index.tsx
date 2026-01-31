import { useRef, useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChatPanel } from '../components/ChatPanel'
import { ArtifactPanel } from '../components/ArtifactPanel'
import { WelcomeScreen } from '../components/WelcomeScreen'
import { UserMenu } from '../components/UserMenu'
import { ChatHistory } from '../components/ChatHistory'
import { AuthProvider, useAuth } from '../lib/authContext'
import { streamMessage } from '../server/chat'
import { getSession } from '../server/auth'
import {
  createChatSession,
  getChatSession,
  saveMessage,
  updateMessage,
} from '../server/chatHistory'
import type { Message, NestedUIElement, QueryResult, StreamChunk, ToolCall } from '../lib/types'
import type { User } from '../db/schema'

export const Route = createFileRoute('/')({
  component: AppWithAuth,
  ssr: false,
  loader: async () => {
    try {
      const { user } = await getSession()
      return { user }
    } catch {
      return { user: null }
    }
  },
})

function AppWithAuth() {
  const { user } = Route.useLoaderData()
  return (
    <AuthProvider initialUser={user}>
      <App />
    </AuthProvider>
  )
}

function App() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLGA, setSelectedLGA] = useState<string | null>(null)
  const [artifactState, setArtifactState] = useState<{
    items: Array<{ ui: NestedUIElement; queryResults: QueryResult[] }>
    index: number
  }>({ items: [], index: -1 })
  const [chatWidthPercent, setChatWidthPercent] = useState(33)
  const [isDragging, setIsDragging] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const messageCountRef = useRef(0)

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

  const handleSelectChat = async (chatSessionId: string) => {
    try {
      const { session, messages: loadedMessages } = await getChatSession({
        data: { chatSessionId },
      })
      if (session) {
        setCurrentChatSessionId(session.id)
        setSelectedLGA(session.selectedLga)
        setMessages(loadedMessages)
        messageCountRef.current = loadedMessages.length

        const artifacts: Array<{ ui: NestedUIElement; queryResults: QueryResult[] }> = []
        for (const msg of loadedMessages) {
          if (msg.ui) {
            artifacts.push({ ui: msg.ui, queryResults: [] })
          }
        }
        if (artifacts.length > 0) {
          setArtifactState({ items: artifacts, index: artifacts.length - 1 })
        } else {
          setArtifactState({ items: [], index: -1 })
        }
      }
    } catch (error) {
      console.error('Failed to load chat:', error)
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setArtifactState({ items: [], index: -1 })
    setCurrentChatSessionId(null)
    setSelectedLGA(null)
    messageCountRef.current = 0
  }

  const persistMessage = async (chatSessionId: string, message: Message, sortOrder: number) => {
    if (!user) return
    try {
      await saveMessage({ data: { chatSessionId, message, sortOrder } })
    } catch (error) {
      console.error('Failed to persist message:', error)
    }
  }

  const persistMessageUpdate = async (messageId: string, updates: { content?: string; ui?: NestedUIElement; toolCall?: ToolCall }) => {
    if (!user) return
    try {
      await updateMessage({ data: { messageId, ...updates } })
    } catch (error) {
      console.error('Failed to update message:', error)
    }
  }

  const handleSendMessage = async (content: string) => {
    const messageContent = selectedLGA
      ? `[Context: User has selected ${selectedLGA}] ${content}`
      : content

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    let chatSessionId = currentChatSessionId

    if (user && !chatSessionId) {
      try {
        const title = content.length > 50 ? content.substring(0, 50) + '...' : content
        const { session } = await createChatSession({
          data: { title, selectedLga: selectedLGA },
        })
        if (session) {
          chatSessionId = session.id
          setCurrentChatSessionId(session.id)
        }
      } catch (error) {
        console.error('Failed to create chat session:', error)
      }
    }

    setMessages((prev) => [...prev, userMessage])
    const userMessageOrder = messageCountRef.current++

    if (chatSessionId) {
      persistMessage(chatSessionId, userMessage, userMessageOrder)
    }

    setIsLoading(true)

    try {
      const stream = await streamMessage({
        data: {
          message: messageContent,
          history: messages
            .filter((m) => m.role !== 'tool')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        },
      })

      let currentTextMessageId: string | null = null
      let currentText = ''
      const toolMessageIds = new Map<string, string>()

      for await (const chunk of stream) {
        const typedChunk = chunk as StreamChunk

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

            const order = messageCountRef.current++
            if (chatSessionId) {
              persistMessage(chatSessionId, assistantMessage, order)
            }
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

          const order = messageCountRef.current++
          if (chatSessionId) {
            persistMessage(chatSessionId, toolMessage, order)
          }
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
            if (chatSessionId) {
              const existingMsg = messages.find((m) => m.id === toolMessageId)
              if (existingMsg?.toolCall) {
                persistMessageUpdate(toolMessageId, {
                  toolCall: { ...existingMsg.toolCall, ...updatedToolCall },
                })
              }
            }
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

            const order = messageCountRef.current++
            if (chatSessionId) {
              persistMessage(chatSessionId, doneMessage, order)
            }
          } else if (currentTextMessageId && typedChunk.ui) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentTextMessageId ? { ...m, ui: typedChunk.ui ?? undefined } : m
              )
            )
            if (chatSessionId && currentTextMessageId) {
              persistMessageUpdate(currentTextMessageId, { content: currentText, ui: typedChunk.ui ?? undefined })
            }
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
      <>
        <WelcomeScreen
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          selectedLGA={selectedLGA}
          onLGAChange={setSelectedLGA}
          onShowHistory={() => setShowHistory(true)}
        />
        <ChatHistory
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          currentChatId={currentChatSessionId}
        />
      </>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`relative flex h-screen bg-gray-50 p-6 ${!hasArtifact ? 'justify-center' : ''}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="absolute right-6 top-6 z-10">
          <UserMenu onShowHistory={user ? () => setShowHistory(true) : undefined} />
        </div>

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
      <ChatHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        currentChatId={currentChatSessionId}
      />
    </>
  )
}
