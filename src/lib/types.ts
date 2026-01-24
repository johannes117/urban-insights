import type { ReactNode } from 'react'

export interface NestedUIElement {
  type: string
  props?: { [key: string]: {} }
  children?: NestedUIElement[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  ui?: NestedUIElement
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
  | { type: 'done'; ui: NestedUIElement | null; queryResults: QueryResult[] }
