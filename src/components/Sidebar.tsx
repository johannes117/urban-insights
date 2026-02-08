import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { MessageSquareText, SquarePen, Database, Trash2 } from 'lucide-react'

interface SidebarProps {
  onNewChat?: () => void
  sessions?: {
    id: string
    title: string
    updatedAt: string
  }[]
  activeSessionId?: string | null
  onSelectSession?: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInHours = Math.round(diffInMs / (1000 * 60 * 60))

  if (diffInHours <= 20) {
    if (diffInHours <= 1) return 'Just now'
    return `${diffInHours}h ago`
  }

  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('en-AU', {
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  return new Intl.DateTimeFormat('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function Sidebar({
  onNewChat,
  sessions = [],
  activeSessionId = null,
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [supportsHover, setSupportsHover] = useState(true)
  const navigate = useNavigate()
  const shouldShowRecents = isExpanded

  useEffect(() => {
    const hoverQuery = window.matchMedia('(hover: hover)')

    const handleHoverCapabilityChange = () => {
      const canHover = hoverQuery.matches
      setSupportsHover(canHover)
      if (!canHover) {
        setIsExpanded(true)
      }
    }

    handleHoverCapabilityChange()
    hoverQuery.addEventListener('change', handleHoverCapabilityChange)
    return () => hoverQuery.removeEventListener('change', handleHoverCapabilityChange)
  }, [])

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat()
    } else {
      navigate({ to: '/' })
      window.location.reload()
    }
  }

  return (
    <div
      className="group/sidebar flex h-screen flex-col border-r border-gray-200 bg-gray-50 transition-all duration-200"
      style={{ width: isExpanded ? (supportsHover ? '280px' : 'min(280px, 82vw)') : '56px' }}
      onMouseEnter={supportsHover ? () => setIsExpanded(true) : undefined}
      onMouseLeave={supportsHover ? () => setIsExpanded(false) : undefined}
    >
      <div className="flex flex-col gap-1 p-2">
        <Link
          to="/"
          className="flex h-10 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-gray-100"
        >
          <img
            src="/images/urban-insights-logo.png"
            alt="Urban Insights"
            className="h-6 w-6 shrink-0 object-contain"
          />
          <span
            className={`whitespace-nowrap text-sm font-medium text-gray-900 transition-opacity duration-200 ${
              isExpanded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Urban Insights
          </span>
        </Link>

        <button
          type="button"
          onClick={handleNewChat}
          className="flex h-10 items-center gap-3 rounded-lg px-2 text-gray-700 transition-colors hover:bg-gray-100"
        >
          <SquarePen className="h-5 w-5 shrink-0" />
          <span
            className={`whitespace-nowrap text-sm transition-opacity duration-200 ${
              isExpanded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            New chat
          </span>
        </button>

        <Link
          to="/data-sources"
          className="flex h-10 items-center gap-3 rounded-lg px-2 text-gray-700 transition-colors hover:bg-gray-100"
        >
          <Database className="h-5 w-5 shrink-0" />
          <span
            className={`whitespace-nowrap text-sm transition-opacity duration-200 ${
              isExpanded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Data sources
          </span>
        </Link>
      </div>

      {shouldShowRecents ? (
        <>
          <div className="mx-2 mt-2 border-t border-gray-200" />

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2">
            <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              <MessageSquareText className="h-3.5 w-3.5" />
              Recents
            </div>

            {sessions.length === 0 && (
              <p className="px-2 text-xs text-gray-400">
                No chats yet
              </p>
            )}

            <div className="space-y-1">
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId

                return (
                  <div
                    key={session.id}
                    className={`group/session relative rounded-lg transition-colors ${
                      isActive ? 'bg-white ring-1 ring-gray-200' : 'hover:bg-gray-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSession?.(session.id)}
                      className="w-full text-left"
                    >
                      <div className="px-2 py-2">
                        <p
                          className="truncate text-sm text-gray-700"
                          title={session.title}
                        >
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatTimestamp(session.updatedAt)}
                        </p>
                      </div>
                    </button>

                    {onDeleteSession && (
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        className="absolute right-1 top-1 hidden h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 group-hover/session:flex"
                        aria-label={`Delete chat ${session.title}`}
                        title="Delete chat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  )
}
