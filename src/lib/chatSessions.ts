import type { Artifact, Message } from './types'
import { buildArtifactDataSnapshot } from './artifactSnapshots'

export const CHAT_SESSIONS_STORAGE_KEY = 'urban-insights.chat-sessions.v1'
const MAX_STORED_SESSIONS = 40
const FALLBACK_TITLE = 'New chat'
const MAX_COMPACT_QUERY_ROWS = 150

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface ArtifactStateSnapshot {
  items: Artifact[]
  index: number
}

export interface ChatSessionSnapshot {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: Message[]
  artifactState: ArtifactStateSnapshot
  suggestions?: string[]
}

interface CreateChatSessionSnapshotInput {
  id: string
  messages: Message[]
  artifactState: ArtifactStateSnapshot
  suggestions?: string[]
  createdAt?: string
  updatedAt?: string
}

type CompactMode = 'sampled' | 'query-only'

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function truncateLine(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function deriveSessionTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(
    (message) => message.role === 'user' && message.content.trim().length > 0
  )

  if (firstUserMessage) {
    return truncateLine(firstUserMessage.content.trim(), 62)
  }

  const firstAssistantMessage = messages.find(
    (message) => message.role === 'assistant' && message.content.trim().length > 0
  )
  if (firstAssistantMessage) {
    return truncateLine(firstAssistantMessage.content.trim(), 62)
  }

  return FALLBACK_TITLE
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function ensureArtifactSnapshot(artifact: Artifact): Artifact {
  if (artifact.dataSnapshot && Object.keys(artifact.dataSnapshot).length > 0) {
    return artifact
  }

  const dataSnapshot = buildArtifactDataSnapshot({
    ui: artifact.ui,
    report: artifact.report,
    queryResults: artifact.queryResults,
  })

  if (Object.keys(dataSnapshot).length === 0) {
    return artifact
  }

  return {
    ...artifact,
    dataSnapshot,
  }
}

function normalizeArtifactState(value: unknown): ArtifactStateSnapshot {
  if (!isObject(value)) {
    return { items: [], index: -1 }
  }

  const items = Array.isArray(value.items)
    ? (value.items as Artifact[]).map(ensureArtifactSnapshot)
    : []
  const rawIndex = typeof value.index === 'number' ? value.index : -1
  const index = Math.min(items.length - 1, Math.max(-1, rawIndex))

  return { items, index }
}

function extractQueryMapFromMessages(messages: Message[]): Map<string, string> {
  const queryMap = new Map<string, string>()

  for (const message of messages) {
    if (message.role !== 'tool' || !message.toolCall) continue
    if (message.toolCall.name !== 'query_dataset') continue

    const rawQuery = message.toolCall.args.query
    const rawResultKey = message.toolCall.args.resultKey

    if (typeof rawQuery !== 'string' || typeof rawResultKey !== 'string') continue
    queryMap.set(rawResultKey, rawQuery)
  }

  return queryMap
}

function selectCompactRows(
  rows: Array<Record<string, unknown>>,
  mode: CompactMode
): Array<Record<string, unknown>> {
  if (mode === 'query-only') return []
  return rows.slice(0, MAX_COMPACT_QUERY_ROWS)
}

function compactQueryResultData(
  messages: Message[],
  artifactState: ArtifactStateSnapshot,
  mode: CompactMode
): ArtifactStateSnapshot {
  const queryMap = extractQueryMapFromMessages(messages)
  const compactedItems = artifactState.items.map((artifact) => {
    const dataSnapshot =
      artifact.dataSnapshot && Object.keys(artifact.dataSnapshot).length > 0
        ? artifact.dataSnapshot
        : buildArtifactDataSnapshot({
            ui: artifact.ui,
            report: artifact.report,
            queryResults: artifact.queryResults,
          })

    return {
      ...artifact,
      dataSnapshot,
      queryResults: artifact.queryResults.map((result) => ({
        resultKey: result.resultKey,
        data: selectCompactRows(result.data, mode),
        query: result.query ?? queryMap.get(result.resultKey),
        partial: true,
      })),
    }
  })

  return {
    items: compactedItems,
    index: artifactState.index,
  }
}

function compactToolMessage(message: Message, mode: CompactMode): Message {
  if (message.role !== 'tool' || !message.toolCall) return message
  if (message.toolCall.name !== 'query_dataset') return message
  if (!isObject(message.toolCall.result)) return message

  const result = message.toolCall.result as Record<string, unknown>
  if (!Array.isArray(result.data)) return message

  const compactResult = {
    ...result,
    data: selectCompactRows(result.data as Array<Record<string, unknown>>, mode),
    partial: true,
  }

  return {
    ...message,
    toolCall: {
      ...message.toolCall,
      result: compactResult,
    },
  }
}

function compactSessionForStorage(session: ChatSessionSnapshot, mode: CompactMode): ChatSessionSnapshot {
  const compactedMessages = session.messages.map((message) => compactToolMessage(message, mode))

  return {
    ...session,
    messages: compactedMessages,
    artifactState: compactQueryResultData(compactedMessages, session.artifactState, mode),
  }
}

function normalizeSession(value: unknown): ChatSessionSnapshot | null {
  if (!isObject(value)) return null

  const id = typeof value.id === 'string' ? value.id : null
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : null
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : null

  if (!id || !createdAt || !updatedAt) return null

  const messages = Array.isArray(value.messages) ? (value.messages as Message[]) : []
  const artifactState = normalizeArtifactState(value.artifactState)
  const titleCandidate = typeof value.title === 'string' ? value.title.trim() : ''

  const suggestions = Array.isArray(value.suggestions)
    ? (value.suggestions as unknown[]).filter((s): s is string => typeof s === 'string')
    : undefined

  return {
    id,
    title: titleCandidate || deriveSessionTitle(messages),
    createdAt,
    updatedAt,
    messages,
    artifactState,
    suggestions,
  }
}

function sortSessionsByUpdatedAt(a: ChatSessionSnapshot, b: ChatSessionSnapshot): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

export function createChatSessionSnapshot({
  id,
  messages,
  artifactState,
  suggestions,
  createdAt,
  updatedAt,
}: CreateChatSessionSnapshotInput): ChatSessionSnapshot {
  const now = new Date().toISOString()
  const resolvedUpdatedAt = updatedAt ?? now

  return {
    id,
    title: deriveSessionTitle(messages),
    createdAt: createdAt ?? resolvedUpdatedAt,
    updatedAt: resolvedUpdatedAt,
    messages,
    artifactState: normalizeArtifactState(artifactState),
    suggestions,
  }
}

export function loadChatSessions(storage: StorageLike | null = getBrowserStorage()): ChatSessionSnapshot[] {
  if (!storage) return []

  const raw = storage.getItem(CHAT_SESSIONS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map(normalizeSession)
      .filter((session): session is ChatSessionSnapshot => session !== null)
      .sort(sortSessionsByUpdatedAt)
  } catch {
    return []
  }
}

export function saveChatSessions(
  sessions: ChatSessionSnapshot[],
  storage: StorageLike | null = getBrowserStorage()
): void {
  if (!storage) return

  const limitedSessions = [...sessions]
    .sort(sortSessionsByUpdatedAt)
    .slice(0, MAX_STORED_SESSIONS)

  const sampledSessions = limitedSessions.map((session) =>
    compactSessionForStorage(session, 'sampled')
  )

  try {
    storage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sampledSessions))
  } catch (sampledError) {
    try {
      const queryOnlySessions = limitedSessions.map((session) =>
        compactSessionForStorage(session, 'query-only')
      )
      storage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(queryOnlySessions))
    } catch (queryOnlyError) {
      console.error('Failed to persist chat sessions:', sampledError, queryOnlyError)
    }
  }
}
