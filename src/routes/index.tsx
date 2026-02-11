import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChatPanel } from '../components/ChatPanel'
import { ArtifactPanel } from '../components/ArtifactPanel'
import { WelcomeScreen } from '../components/WelcomeScreen'
import { Sidebar } from '../components/Sidebar'
import {
  createChatSessionSnapshot,
  loadChatSessions,
  saveChatSessions,
  type ArtifactStateSnapshot,
  type ChatSessionSnapshot,
} from '../lib/chatSessions'
import {
  buildArtifactDataSnapshot,
  mergeQueryResultsWithSnapshot,
  snapshotHasRows,
} from '../lib/artifactSnapshots'
import { rehydrateQueryResults, streamMessage } from '../server/chat'
import type {
  Artifact,
  Message,
  NestedUIElement,
  QueryResult,
  Report,
  StreamChunk,
  ToolCall,
} from '../lib/types'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

const EMPTY_ARTIFACT_STATE: ArtifactStateSnapshot = { items: [], index: -1 }

function toResultKey(dataPath: string | undefined): string | null {
  if (!dataPath) return null

  const key = dataPath.replace(/^\//, '').split('/')[0]?.trim()
  if (!key) return null
  return key
}

function collectResultKeysFromUi(element: NestedUIElement | undefined, target: Set<string>): void {
  if (!element) return

  if (typeof element.props?.dataPath === 'string') {
    const key = toResultKey(element.props.dataPath)
    if (key) target.add(key)
  }

  if (!Array.isArray(element.children)) return
  for (const child of element.children) {
    collectResultKeysFromUi(child, target)
  }
}

function collectResultKeysFromReport(report: Report | undefined, target: Set<string>): void {
  if (!report) return

  for (const section of report.sections) {
    const key = toResultKey(section.dataPath)
    if (key) target.add(key)
  }
}

function getArtifactRequiredResultKeys(artifact: Artifact): Set<string> {
  const requiredKeys = new Set<string>()
  collectResultKeysFromUi(artifact.ui, requiredKeys)
  collectResultKeysFromReport(artifact.report, requiredKeys)
  return requiredKeys
}

function extractQueryMapFromMessages(messages: Message[]): Map<string, string> {
  const queryMap = new Map<string, string>()

  for (const message of messages) {
    if (message.role !== 'tool' || !message.toolCall) continue
    if (message.toolCall.name !== 'query_dataset') continue

    const query = message.toolCall.args.query
    const resultKey = message.toolCall.args.resultKey
    if (typeof query !== 'string' || typeof resultKey !== 'string') continue
    queryMap.set(resultKey, query)
  }

  return queryMap
}

function hasRenderableQueryData(result: QueryResult | undefined): boolean {
  if (!result) return false
  return Array.isArray(result.data) && result.data.length > 0
}

function mergeArtifactResults(existingResults: QueryResult[], fetchedResults: QueryResult[]): QueryResult[] {
  const merged = new Map<string, QueryResult>()

  for (const result of existingResults) {
    merged.set(result.resultKey, result)
  }

  for (const result of fetchedResults) {
    merged.set(result.resultKey, result)
  }

  return Array.from(merged.values())
}

function mergeArtifactStateResults(
  state: ArtifactStateSnapshot,
  fetchedResults: QueryResult[]
): ArtifactStateSnapshot {
  if (fetchedResults.length === 0) return state

  const fetchedByKey = new Map(fetchedResults.map((result) => [result.resultKey, result]))
  const items = state.items.map((artifact) => {
    const requiredKeys = getArtifactRequiredResultKeys(artifact)
    if (requiredKeys.size === 0) return artifact

    const relevantFetched = Array.from(requiredKeys)
      .map((key) => fetchedByKey.get(key))
      .filter((result): result is QueryResult => Boolean(result))

    if (relevantFetched.length === 0) return artifact

    const mergedQueryResults = mergeArtifactResults(artifact.queryResults, relevantFetched)

    return {
      ...artifact,
      queryResults: mergedQueryResults,
      dataSnapshot: buildArtifactDataSnapshot({
        ui: artifact.ui,
        report: artifact.report,
        queryResults: mergedQueryResults,
      }),
    }
  })

  return { ...state, items }
}

function buildRehydrateQueries(session: ChatSessionSnapshot): Array<{ resultKey: string; query: string }> {
  const requiredKeys = new Set<string>()
  const existingResultsByKey = new Map<string, QueryResult>()

  for (const artifact of session.artifactState.items) {
    const keys = getArtifactRequiredResultKeys(artifact)
    for (const key of keys) requiredKeys.add(key)

    for (const result of artifact.queryResults) {
      existingResultsByKey.set(result.resultKey, result)
    }
  }

  if (requiredKeys.size === 0) return []

  const queryMap = extractQueryMapFromMessages(session.messages)
  const queriesToRun = new Map<string, string>()

  for (const resultKey of requiredKeys) {
    const existing = existingResultsByKey.get(resultKey)
    const hasSnapshot = session.artifactState.items.some((artifact) =>
      snapshotHasRows(artifact.dataSnapshot, resultKey)
    )

    if (hasSnapshot) continue
    if (hasRenderableQueryData(existing)) continue

    const query = existing?.query ?? queryMap.get(resultKey)
    if (!query) continue
    queriesToRun.set(resultKey, query)
  }

  return Array.from(queriesToRun.entries()).map(([resultKey, query]) => ({ resultKey, query }))
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [artifactState, setArtifactState] = useState<ArtifactStateSnapshot>(EMPTY_ARTIFACT_STATE)
  const [sessions, setSessions] = useState<ChatSessionSnapshot[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [chatWidthPercent, setChatWidthPercent] = useState(33)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const rehydrateTaskRef = useRef(0)

  const hasConversation = messages.length > 0
  const hasArtifact = artifactState.items.length > 0
  const currentArtifact =
    artifactState.index >= 0 ? artifactState.items[artifactState.index] ?? null : null
  const currentArtifactQueryResults = currentArtifact
    ? mergeQueryResultsWithSnapshot(currentArtifact.queryResults, currentArtifact.dataSnapshot)
    : []

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  const rehydrateSessionIfNeeded = async (session: ChatSessionSnapshot) => {
    const queriesToRun = buildRehydrateQueries(session)
    if (queriesToRun.length === 0) return

    const taskId = ++rehydrateTaskRef.current

    try {
      const response = await rehydrateQueryResults({
        data: {
          queries: queriesToRun,
        },
      })

      if (taskId !== rehydrateTaskRef.current) return
      if (!response.success || response.queryResults.length === 0) return

      setSessions((prev) =>
        prev.map((item) =>
          item.id === session.id
            ? {
                ...item,
                artifactState: mergeArtifactStateResults(item.artifactState, response.queryResults),
              }
            : item
        )
      )

      if (activeSessionIdRef.current === session.id) {
        setArtifactState((prev) => mergeArtifactStateResults(prev, response.queryResults))
      }

      if (response.errors.length > 0) {
        console.warn('Some query results could not be rehydrated:', response.errors)
      }
    } catch (error) {
      console.error('Failed to rehydrate query results:', error)
    }
  }

  const activateSession = (session: ChatSessionSnapshot) => {
    setActiveSessionId(session.id)
    setMessages(session.messages)
    setSuggestions(session.suggestions ?? [])
    setArtifactState(session.artifactState)
    void rehydrateSessionIfNeeded(session)
  }

  useEffect(() => {
    const storedSessions = loadChatSessions()
    setSessions(storedSessions)

    if (storedSessions.length > 0) {
      activateSession(storedSessions[0])
    }

    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    saveChatSessions(sessions)
  }, [sessions, isHydrated])

  useEffect(() => {
    if (!isHydrated || !activeSessionId) return
    if (messages.length === 0 && artifactState.items.length === 0) return

    setSessions((prev) => {
      const existingSession = prev.find((session) => session.id === activeSessionId)
      const hasNewContent = !existingSession || messages.length !== existingSession.messages.length
      const nextSnapshot = createChatSessionSnapshot({
        id: activeSessionId,
        messages,
        artifactState,
        suggestions,
        createdAt: existingSession?.createdAt,
        updatedAt: hasNewContent ? undefined : existingSession?.updatedAt,
      })

      return [nextSnapshot, ...prev.filter((session) => session.id !== activeSessionId)]
    })
  }, [activeSessionId, artifactState, isHydrated, messages, suggestions])

  const handleArtifactIndexChange = (nextIndex: number) => {
    setArtifactState((prev) => {
      if (prev.items.length === 0) return prev
      const clamped = Math.min(prev.items.length - 1, Math.max(0, nextIndex))
      return { ...prev, index: clamped }
    })
  }

  const handleSendMessage = async (content: string) => {
    if (!activeSessionId) {
      const newSessionId = crypto.randomUUID()
      const nowIso = new Date().toISOString()

      setSessions((prev) => [
        createChatSessionSnapshot({
          id: newSessionId,
          messages: [],
          artifactState: EMPTY_ARTIFACT_STATE,
          createdAt: nowIso,
          updatedAt: nowIso,
        }),
        ...prev,
      ])
      setActiveSessionId(newSessionId)
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setSuggestions([])
    setIsLoading(true)

    try {
      const stream = await streamMessage({
        data: {
          message: content,
          history: messages
            .filter((m) => m.role !== 'tool')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        },
      }) as AsyncIterable<StreamChunk>

      let currentTextMessageId: string | null = null
      let currentText = ''
      const toolMessageIds = new Map<string, string>()

      for await (const chunk of stream) {
        const typedChunk = chunk

        if (typedChunk.type === 'text') {
          if (!currentTextMessageId) {
            currentTextMessageId = crypto.randomUUID()
            currentText = typedChunk.content
            const assistantMessage: Message = {
              id: currentTextMessageId,
              role: 'assistant',
              content: currentText,
            }
            setMessages((prev) => [...prev, assistantMessage])
          } else {
            currentText += typedChunk.content
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentTextMessageId ? { ...m, content: currentText } : m
              )
            )
          }
        } else if (typedChunk.type === 'tool_start') {
          currentTextMessageId = null
          currentText = ''

          const toolMessageId = crypto.randomUUID()
          toolMessageIds.set(typedChunk.toolCallId, toolMessageId)

          const toolCall: ToolCall = {
            id: typedChunk.toolCallId,
            name: typedChunk.name,
            args: typedChunk.args,
            status: 'running',
          }

          const toolMessage: Message = {
            id: toolMessageId,
            role: 'tool',
            content: '',
            toolCall,
          }
          setMessages((prev) => [...prev, toolMessage])
        } else if (typedChunk.type === 'tool_end') {
          const toolMessageId = toolMessageIds.get(typedChunk.toolCallId)
          if (toolMessageId) {
            const updatedToolCall = { status: 'complete' as const, result: typedChunk.result }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === toolMessageId && m.toolCall
                  ? {
                      ...m,
                      toolCall: { ...m.toolCall, ...updatedToolCall },
                    }
                  : m
              )
            )
          }
        } else if (typedChunk.type === 'done') {
          if (!currentTextMessageId && currentText === '') {
            const doneMessage: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: "I've created the visualization for you.",
              ui: typedChunk.ui ?? undefined,
            }
            setMessages((prev) => [...prev, doneMessage])
          } else if (currentTextMessageId && typedChunk.ui) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentTextMessageId ? { ...m, ui: typedChunk.ui ?? undefined } : m
              )
            )
          }

          if (typedChunk.suggestions?.length) {
            setSuggestions(typedChunk.suggestions)
          }

          if (typedChunk.ui || typedChunk.report) {
            setArtifactState((prev) => {
              const queryResults = typedChunk.queryResults || []
              const newArtifact: Artifact = {
                type: typedChunk.report ? 'report' : 'visualization',
                ui: typedChunk.ui ?? undefined,
                report: typedChunk.report ?? undefined,
                queryResults,
                dataSnapshot: buildArtifactDataSnapshot({
                  ui: typedChunk.ui ?? undefined,
                  report: typedChunk.report ?? undefined,
                  queryResults,
                }),
              }
              const items = [...prev.items, newArtifact]
              return { items, index: items.length - 1 }
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) {
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const position = ((event.clientX - rect.left) / rect.width) * 100
    const clamped = Math.min(60, Math.max(20, position))
    setChatWidthPercent(clamped)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  const handleNewChat = () => {
    if (isLoading) return
    rehydrateTaskRef.current += 1
    setActiveSessionId(null)
    setMessages([])
    setSuggestions([])
    setArtifactState(EMPTY_ARTIFACT_STATE)
  }

  const handleSelectSession = (sessionId: string) => {
    if (isLoading) return

    const targetSession = sessions.find((session) => session.id === sessionId)
    if (!targetSession) return

    activateSession(targetSession)
  }

  const handleDeleteSession = (sessionId: string) => {
    if (isLoading) return

    const remaining = sessions.filter((session) => session.id !== sessionId)
    setSessions(remaining)

    if (activeSessionId !== sessionId) return

    const nextActiveSession = remaining[0]
    if (!nextActiveSession) {
      setActiveSessionId(null)
      setMessages([])
      setArtifactState(EMPTY_ARTIFACT_STATE)
      return
    }

    activateSession(nextActiveSession)
  }

  if (!hasConversation) {
    return (
      <div className="flex h-screen">
        <Sidebar
          onNewChat={handleNewChat}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
        <div className="flex-1">
          <WelcomeScreen
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        onNewChat={handleNewChat}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />
      <div
        ref={containerRef}
        className={`relative flex flex-1 bg-gray-50 p-6 ${!hasArtifact ? 'justify-center' : ''}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={`min-w-0 ${hasArtifact ? 'mr-6' : 'w-full max-w-3xl'}`}
          style={hasArtifact ? { width: `${chatWidthPercent}%` } : undefined}
        >
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            suggestions={suggestions}
            onSuggestionClick={handleSendMessage}
          />
        </div>
        {hasArtifact && (
          <div className="min-w-0 flex-1">
            <ArtifactPanel
              ui={currentArtifact?.ui ?? null}
              report={currentArtifact?.report ?? null}
              queryResults={currentArtifactQueryResults}
              onResizePointerDown={handlePointerDown}
              isResizing={isDragging}
              artifactCount={artifactState.items.length}
              artifactIndex={artifactState.index}
              onArtifactIndexChange={handleArtifactIndexChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
