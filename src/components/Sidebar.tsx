import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { SquarePen, Database } from 'lucide-react'

interface SidebarProps {
  onNewChat?: () => void
}

export function Sidebar({ onNewChat }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()

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
      style={{ width: isExpanded ? '240px' : '56px' }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
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

      <div className="flex-1" />
    </div>
  )
}
