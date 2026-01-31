import { useState, useEffect } from 'react'
import { X, MessageSquare, Trash2, Plus } from 'lucide-react'
import { listChatSessions, deleteChatSession } from '../server/chatHistory'
import type { ChatSession } from '../db/schema'

interface ChatHistoryProps {
  isOpen: boolean
  onClose: () => void
  onSelectChat: (chatSessionId: string) => void
  onNewChat: () => void
  currentChatId: string | null
}

export function ChatHistory({ isOpen, onClose, onSelectChat, onNewChat, currentChatId }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen])

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const { sessions } = await listChatSessions()
      setSessions(sessions)
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    try {
      await deleteChatSession({ data: { chatSessionId: sessionId } })
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (error) {
      console.error('Failed to delete chat session:', error)
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const d = new Date(date)
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return d.toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative ml-auto flex h-full w-80 flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-medium text-gray-900">Chat History</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={() => {
              onNewChat()
              onClose()
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No chat history yet
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelectChat(session.id)
                    onClose()
                  }}
                  className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-100 ${
                    currentChatId === session.id ? 'bg-gray-100' : ''
                  }`}
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-900">{session.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(session.updatedAt)}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, session.id)}
                    className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
