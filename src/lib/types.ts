import type { ReactNode } from 'react'

export interface NestedUIElement {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  props?: { [key: string]: {} }
  children?: NestedUIElement[]
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
  status: 'pending' | 'running' | 'complete'
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  ui?: NestedUIElement
  toolCall?: ToolCall
}

export interface ChatState {
  messages: Message[]
  isLoading: boolean
}

export interface QueryResult {
  resultKey: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[]
  query?: string
  partial?: boolean
}

export interface StreamArtifactPayload {
  ui?: NestedUIElement | null
  report?: Report | null
}

export type ArtifactDataSnapshot = Record<string, Record<string, unknown>[]>

export interface ComponentProps<T = Record<string, unknown>> {
  element: { type: string; props: T }
  children?: ReactNode
  data?: Record<string, unknown>
}

export type StreamChunk =
  | { type: 'text'; content: string }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  | { type: 'tool_start'; toolCallId: string; name: string; args: Record<string, {}> }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  | { type: 'tool_end'; toolCallId: string; result: {} }
  | {
      type: 'done'
      ui: NestedUIElement | null
      queryResults: QueryResult[]
      report: Report | null
      artifacts?: StreamArtifactPayload[]
      suggestions?: string[]
    }

export interface ReportSection {
  type: 'text' | 'chart' | 'table' | 'metric'
  title?: string
  content?: string
  dataPath?: string
  chartType?: 'bar' | 'line' | 'pie'
  xKey?: string
  yKey?: string
  nameKey?: string
  valueKey?: string
  columns?: string[]
  source?: string
}

export interface Report {
  title: string
  recipient: string
  lga: string
  date: string
  introduction: string
  sections: ReportSection[]
  callToAction: string
  closing: string
  sources: string[]
}

export type ArtifactType = 'visualization' | 'report'

export interface Artifact {
  type: ArtifactType
  ui?: NestedUIElement
  report?: Report
  queryResults: QueryResult[]
  dataSnapshot?: ArtifactDataSnapshot
}
