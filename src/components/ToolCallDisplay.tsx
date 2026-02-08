import { useState } from 'react'
import { Check, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import type { ToolCall } from '../lib/types'

interface ToolCallDisplayProps {
  toolCalls: ToolCall[]
}


const STEP_LABELS: Record<string, string> = {
  list_datasets: 'Fetching data',
  get_dataset_schema: 'Fetching data',
  query_dataset: 'Gathering results',
  render_ui: 'Creating visualization',
  render_report: 'Generating report',
  get_data: 'Fetching data',
}

const TOOL_LABELS: Record<string, string> = {
  list_datasets: 'List datasets',
  get_dataset_schema: 'Get schema',
  query_dataset: 'Run query',
  render_ui: 'Render visualization',
  render_report: 'Render report',
  get_data: 'Get data',
}

function formatResultSummary(result: unknown): string {
  if (result === null || result === undefined) return ''
  if (typeof result === 'string') {
    try {
      return formatParsedResult(JSON.parse(result))
    } catch {
      return result.slice(0, 80) + (result.length > 80 ? '...' : '')
    }
  }
  return formatParsedResult(result)
}

function formatParsedResult(parsed: unknown): string {
  if (typeof parsed !== 'object' || parsed === null) return String(parsed).slice(0, 80)
  const obj = parsed as Record<string, unknown>
  if (obj.datasets && Array.isArray(obj.datasets)) return `Found ${obj.datasets.length} dataset(s)`
  if (obj.columns && Array.isArray(obj.columns)) return `${obj.columns.length} columns, ${obj.totalRows ?? obj.rowCount ?? '?'} rows`
  if (obj.data && Array.isArray(obj.data)) return `${obj.data.length} rows returned`
  if (obj.success && obj.ui) return 'Visualization created'
  if (obj.error) return `Error: ${String(obj.error).slice(0, 60)}`
  return JSON.stringify(parsed).slice(0, 60) + '...'
}

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (toolCalls.length === 0) return null

  return (
    <div className="my-2">
      {toolCalls.map((tc) => {
        const running = tc.status === 'running'
        const stepLabel = STEP_LABELS[tc.name] ?? 'Fetching data'
        const isExpanded = expandedIds.has(tc.id)
        const toolLabel = TOOL_LABELS[tc.name] ?? tc.name
        const summary =
          tc.status === 'complete' && tc.result !== undefined
            ? formatResultSummary(tc.result)
            : tc.status === 'running'
              ? 'Running...'
              : 'Pending'
        return (
          <div key={tc.id} className="my-1">
            <button
              type="button"
              onClick={() => toggle(tc.id)}
              className="flex w-full items-center gap-1.5 text-left text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )}
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Check className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{stepLabel}</span>
            </button>
            {isExpanded && (
              <div className="ml-5 mt-1 pl-3 border-l-2 border-gray-200 text-sm text-gray-600">
                <span className="font-medium text-gray-700">{toolLabel}</span>
                {summary && <span className="text-gray-500"> — {summary}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
