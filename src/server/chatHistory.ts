import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { db, chatSessions, messages } from '../db'
import { validateSession } from '../lib/auth'
import { eq, desc, asc } from 'drizzle-orm'
import type { ChatSession, Message as DbMessage } from '../db/schema'
import type { Message, NestedUIElement, ToolCall } from '../lib/types'

export const listChatSessions = createServerFn({ method: 'GET' }).handler(async () => {
  const sessionId = await getCookie('session')
  if (!sessionId) return { sessions: [] }

  const result = await validateSession(sessionId)
  if (!result) return { sessions: [] }

  const userSessions = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, result.user.id))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(50)

  return { sessions: userSessions }
})

export const getChatSession = createServerFn({ method: 'GET' })
  .inputValidator((d: { chatSessionId: string }) => d)
  .handler(async ({ data }) => {
    const sessionId = await getCookie('session')
    if (!sessionId) return { session: null, messages: [] }

    const result = await validateSession(sessionId)
    if (!result) return { session: null, messages: [] }

    const [chatSession] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, data.chatSessionId))
      .limit(1)

    if (!chatSession || chatSession.userId !== result.user.id) {
      return { session: null, messages: [] }
    }

    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatSessionId, data.chatSessionId))
      .orderBy(asc(messages.sortOrder))

    const formattedMessages: Message[] = chatMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      ui: m.ui as NestedUIElement | undefined,
      toolCall: m.toolCall as ToolCall | undefined,
    }))

    return { session: chatSession, messages: formattedMessages }
  })

export const createChatSession = createServerFn({ method: 'POST' })
  .inputValidator((d: { title: string; selectedLga?: string | null }) => d)
  .handler(async ({ data }) => {
    const sessionId = await getCookie('session')
    if (!sessionId) return { session: null }

    const result = await validateSession(sessionId)
    if (!result) return { session: null }

    const [newSession] = await db
      .insert(chatSessions)
      .values({
        userId: result.user.id,
        title: data.title,
        selectedLga: data.selectedLga,
      })
      .returning()

    return { session: newSession }
  })

export const updateChatSessionTitle = createServerFn({ method: 'POST' })
  .inputValidator((d: { chatSessionId: string; title: string }) => d)
  .handler(async ({ data }) => {
    const sessionId = await getCookie('session')
    if (!sessionId) return { success: false }

    const result = await validateSession(sessionId)
    if (!result) return { success: false }

    await db
      .update(chatSessions)
      .set({ title: data.title, updatedAt: new Date() })
      .where(eq(chatSessions.id, data.chatSessionId))

    return { success: true }
  })

export const deleteChatSession = createServerFn({ method: 'POST' })
  .inputValidator((d: { chatSessionId: string }) => d)
  .handler(async ({ data }) => {
    const sessionId = await getCookie('session')
    if (!sessionId) return { success: false }

    const result = await validateSession(sessionId)
    if (!result) return { success: false }

    const [chatSession] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, data.chatSessionId))
      .limit(1)

    if (!chatSession || chatSession.userId !== result.user.id) {
      return { success: false }
    }

    await db.delete(chatSessions).where(eq(chatSessions.id, data.chatSessionId))
    return { success: true }
  })

export const saveMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: { chatSessionId: string; message: Message; sortOrder: number }) => d)
  .handler(async ({ data }) => {
    const sessionId = await getCookie('session')
    if (!sessionId) return { success: false }

    const result = await validateSession(sessionId)
    if (!result) return { success: false }

    await db.insert(messages).values({
      id: data.message.id,
      chatSessionId: data.chatSessionId,
      role: data.message.role,
      content: data.message.content,
      ui: data.message.ui ?? null,
      toolCall: data.message.toolCall ?? null,
      sortOrder: data.sortOrder,
    })

    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, data.chatSessionId))

    return { success: true }
  })

export const updateMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: { messageId: string; content?: string; ui?: NestedUIElement; toolCall?: ToolCall }) => d)
  .handler(async ({ data }) => {
    const sessionId = await getCookie('session')
    if (!sessionId) return { success: false }

    const result = await validateSession(sessionId)
    if (!result) return { success: false }

    const updates: Partial<DbMessage> = {}
    if (data.content !== undefined) updates.content = data.content
    if (data.ui !== undefined) updates.ui = data.ui
    if (data.toolCall !== undefined) updates.toolCall = data.toolCall

    if (Object.keys(updates).length > 0) {
      await db.update(messages).set(updates).where(eq(messages.id, data.messageId))
    }

    return { success: true }
  })
