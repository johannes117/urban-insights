import { useState } from 'react'
import { Check, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import type { ToolCall } from '../lib/types'

interface ToolCallDisplayProps {
  toolCalls: ToolCall[]
}

const STEP_LABELS: Record<string, string> = {
  list_datasets: 'Checked data sources',
  get_dataset_schema: 'Read data structure',
  query_dataset: 'Queried data',
  render_ui: 'Created visualization',
  render_report: 'Generated report',
  get_data: 'Retrieved data',
}

export function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  if (toolCalls.length === 0) return null

  const allComplete = toolCalls.every((tc) => tc.status === 'complete')
  const names = new Set(toolCalls.map((tc) => tc.name))
  const groupLabel = names.has('render_ui')
    ? allComplete ? 'Created visualization' : 'Creating visualization...'
    : names.has('render_report')
      ? allComplete ? 'Generated report' : 'Generating report...'
      : allComplete ? 'Explored' : 'Exploring...'

  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        {allComplete ? (
          <Check className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        )}
        <span>{groupLabel}</span>
      </button>

      {expanded && (
        <div className="ml-5 mt-1 space-y-1 border-l-2 border-gray-200 pl-3">
          {toolCalls.map((tc) => {
            const label = STEP_LABELS[tc.name] ?? tc.name
            const done = tc.status === 'complete'
            return (
              <div key={tc.id} className="flex items-center gap-1.5 text-sm text-gray-600">
                {done ? (
                  <Check className="h-3 w-3 shrink-0 text-gray-400" />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin shrink-0 text-gray-400" />
                )}
                <span>{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
