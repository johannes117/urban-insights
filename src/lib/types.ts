import type { ReactNode } from 'react'

export interface NestedUIElement {
  type: string
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
}

export interface ComponentProps<T = Record<string, unknown>> {
  element: { type: string; props: T }
  children?: ReactNode
  data?: Record<string, unknown>
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; toolCallId: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; toolCallId: string; result: unknown }
  | { type: 'done'; ui: NestedUIElement | null; queryResults: QueryResult[] }
