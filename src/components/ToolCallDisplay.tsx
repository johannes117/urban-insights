import { Check, Loader2 } from 'lucide-react'
import type { ToolCall } from '../lib/types'

interface ToolCallDisplayProps {
  toolCall: ToolCall
}

const GENERIC_LABEL_RUNNING = 'Thinking...'
const GENERIC_LABEL_COMPLETE = 'Done'

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const isRunning = toolCall.status === 'running'

  return (
    <div className="my-2 flex items-center gap-1.5 text-sm text-gray-500">
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      <span>{isRunning ? GENERIC_LABEL_RUNNING : GENERIC_LABEL_COMPLETE}</span>
    </div>
  )
}
