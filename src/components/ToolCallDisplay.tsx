import { useState } from 'react'
import { ChevronRight, ChevronDown, Database, Search, LayoutGrid, Loader2 } from 'lucide-react'
import type { ToolCall } from '../lib/types'

interface ToolCallDisplayProps {
  toolCall: ToolCall
}

const toolDisplayInfo: Record<string, { label: string; expandedLabel: string; icon: typeof Database }> = {
  list_datasets: {
    label: 'Listed datasets',
    expandedLabel: 'Checking available datasets',
    icon: Database,
  },
  get_dataset_schema: {
    label: 'Got dataset schema',
    expandedLabel: 'Getting dataset structure',
    icon: Database,
  },
  query_dataset: {
    label: 'Queried dataset',
    expandedLabel: 'Running SQL query',
    icon: Search,
  },
  render_ui: {
    label: 'Rendered visualization',
    expandedLabel: 'Creating visualization',
    icon: LayoutGrid,
  },
  get_data: {
    label: 'Fetched data',
    expandedLabel: 'Fetching data',
    icon: Database,
  },
}

function formatToolResult(result: unknown): string {
  if (result === null || result === undefined) return ''
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result)
      return formatParsedResult(parsed)
    } catch {
      return result.slice(0, 200) + (result.length > 200 ? '...' : '')
    }
  }
  return formatParsedResult(result)
}

function formatParsedResult(parsed: unknown): string {
  if (typeof parsed !== 'object' || parsed === null) {
    return String(parsed).slice(0, 200)
  }

  const obj = parsed as Record<string, unknown>

  if (obj.datasets && Array.isArray(obj.datasets)) {
    return `Found ${obj.datasets.length} dataset(s)`
  }

  if (obj.columns && Array.isArray(obj.columns)) {
    return `${obj.columns.length} columns, ${obj.totalRows || obj.rowCount || '?'} rows`
  }

  if (obj.data && Array.isArray(obj.data)) {
    return `${obj.data.length} rows returned`
  }

  if (obj.success && obj.ui) {
    return 'Visualization created'
  }

  if (obj.error) {
    return `Error: ${String(obj.error).slice(0, 100)}`
  }

  return JSON.stringify(parsed).slice(0, 150) + '...'
}

function formatArgs(name: string, args: Record<string, unknown>): string {
  if (name === 'query_dataset' && args.query) {
    const query = String(args.query)
    return query.length > 80 ? query.slice(0, 80) + '...' : query
  }
  if (name === 'get_dataset_schema' && args.datasetName) {
    return String(args.datasetName)
  }
  if (name === 'get_data' && args.dataKey) {
    return String(args.dataKey)
  }
  return ''
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const info = toolDisplayInfo[toolCall.name] || {
    label: toolCall.name,
    expandedLabel: toolCall.name,
    icon: Database,
  }

  const Icon = info.icon
  const isRunning = toolCall.status === 'running'
  const displayLabel = isRunning ? info.expandedLabel : info.label
  const argsDisplay = formatArgs(toolCall.name, toolCall.args)

  return (
    <div className="my-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        <span>{displayLabel}</span>
      </button>

      {isExpanded && (
        <div className="ml-5 mt-2 pl-3 border-l-2 border-gray-200 text-sm text-gray-600 space-y-2">
          {argsDisplay && (
            <div className="font-mono text-xs bg-gray-50 rounded px-2 py-1.5 text-gray-700 break-all">
              {argsDisplay}
            </div>
          )}
          {toolCall.status === 'complete' && toolCall.result !== undefined && (
            <div className="text-gray-500">
              {formatToolResult(toolCall.result)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
