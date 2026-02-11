import { describe, expect, it } from 'vitest'

import {
  CHAT_SESSIONS_STORAGE_KEY,
  createChatSessionSnapshot,
  loadChatSessions,
  saveChatSessions,
} from './chatSessions'
import type { Message } from './types'

function createMemoryStorage(initialValue?: string) {
  const values = new Map<string, string>()

  if (initialValue) {
    values.set(CHAT_SESSIONS_STORAGE_KEY, initialValue)
  }

  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

function makeMessage(id: string, role: Message['role'], content: string): Message {
  return { id, role, content }
}

describe('chatSessions', () => {
  it('returns an empty list for malformed storage payloads', () => {
    const storage = createMemoryStorage('{"broken": true')

    expect(loadChatSessions(storage)).toEqual([])
  })

  it('derives a session title from the first user message', () => {
    const snapshot = createChatSessionSnapshot({
      id: 'session-1',
      messages: [
        makeMessage('m-1', 'assistant', 'Hello'),
        makeMessage('m-2', 'user', 'How affordable is renting in Geelong this year?'),
      ],
      artifactState: { items: [], index: -1 },
      updatedAt: '2026-01-10T10:00:00.000Z',
    })

    expect(snapshot.title).toBe('How affordable is renting in Geelong this year?')
  })

  it('saves and loads sessions sorted by latest update timestamp', () => {
    const storage = createMemoryStorage()
    const older = createChatSessionSnapshot({
      id: 'older',
      messages: [makeMessage('m-1', 'user', 'Older chat')],
      artifactState: { items: [], index: -1 },
      updatedAt: '2026-01-10T09:00:00.000Z',
    })
    const newer = createChatSessionSnapshot({
      id: 'newer',
      messages: [makeMessage('m-2', 'user', 'Newer chat')],
      artifactState: { items: [], index: -1 },
      updatedAt: '2026-01-10T11:00:00.000Z',
    })

    saveChatSessions([older, newer], storage)
    const loaded = loadChatSessions(storage)

    expect(loaded.map((session) => session.id)).toEqual(['newer', 'older'])
  })

  it('falls back to compact storage when localStorage quota is exceeded', () => {
    const values = new Map<string, string>()
    let setItemCount = 0
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null
      },
      setItem(key: string, value: string) {
        setItemCount += 1
        if (setItemCount === 1) {
          throw new Error('Quota exceeded')
        }
        values.set(key, value)
      },
    }

    const toolMessage: Message = {
      id: 'tool-message',
      role: 'tool',
      content: '',
      toolCall: {
        id: 'tool-1',
        name: 'query_dataset',
        args: {
          query: 'SELECT * FROM "dataset_schools" LIMIT 10',
          resultKey: 'melbourne_schools',
        },
        status: 'complete',
        result: {
          success: true,
          resultKey: 'melbourne_schools',
          data: [{ school: 'A' }],
        },
      },
    }

    const session = createChatSessionSnapshot({
      id: 'session-1',
      messages: [toolMessage],
      artifactState: {
        index: 0,
        items: [
          {
            type: 'visualization',
            queryResults: [
              {
                resultKey: 'melbourne_schools',
                data: [{ school: 'A' }],
              },
            ],
            ui: {
              type: 'Table',
              props: {
                columns: ['school'],
                dataPath: '/melbourne_schools',
              },
            },
          },
        ],
      },
      updatedAt: '2026-01-10T11:00:00.000Z',
    })

    saveChatSessions([session], storage)

    const persisted = JSON.parse(storage.getItem(CHAT_SESSIONS_STORAGE_KEY) ?? '[]') as Array<{
      messages: Array<{ toolCall?: { result?: { data?: unknown[]; partial?: boolean } } }>
      artifactState: {
        items: Array<{
          queryResults: Array<{ data: unknown[]; query?: string; partial?: boolean }>
          dataSnapshot?: Record<string, unknown[]>
        }>
      }
    }>

    expect(persisted).toHaveLength(1)
    expect(persisted[0]?.messages[0]?.toolCall?.result?.data).toEqual([])
    expect(persisted[0]?.messages[0]?.toolCall?.result?.partial).toBe(true)
    expect(persisted[0]?.artifactState.items[0]?.queryResults[0]?.data).toEqual([])
    expect(persisted[0]?.artifactState.items[0]?.queryResults[0]?.partial).toBe(true)
    expect(persisted[0]?.artifactState.items[0]?.queryResults[0]?.query).toBe(
      'SELECT * FROM "dataset_schools" LIMIT 10'
    )
    expect(persisted[0]?.artifactState.items[0]?.dataSnapshot?.melbourne_schools).toEqual([
      { school: 'A' },
    ])
  })
})
