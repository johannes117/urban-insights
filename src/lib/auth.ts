import { Google } from 'arctic'
import { db, users, sessions } from '../db'
import { eq, and, gt } from 'drizzle-orm'
import type { User } from '../db/schema'

const getBaseUrl = () => {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NODE_ENV === 'production') return process.env.APP_URL || 'http://localhost:3000'
  return 'http://localhost:3000'
}

export const google = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${getBaseUrl()}/auth/callback/google`
)

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = generateSessionToken()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  })

  return sessionId
}

export async function validateSession(sessionId: string): Promise<{ user: User; session: { id: string; expiresAt: Date } } | null> {
  const [result] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!result) return null

  // Extend session if it expires in less than 15 days
  const fifteenDays = 15 * 24 * 60 * 60 * 1000
  if (result.session.expiresAt.getTime() - Date.now() < fifteenDays) {
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db.update(sessions).set({ expiresAt: newExpiresAt }).where(eq(sessions.id, sessionId))
    result.session.expiresAt = newExpiresAt
  }

  return {
    user: result.user,
    session: { id: result.session.id, expiresAt: result.session.expiresAt },
  }
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

export async function findOrCreateUser(googleUser: {
  id: string
  email: string
  name: string
  picture?: string
}): Promise<User> {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleUser.id))
    .limit(1)

  if (existingUser) {
    // Update user info in case it changed
    await db
      .update(users)
      .set({
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
      })
      .where(eq(users.id, existingUser.id))

    return { ...existingUser, email: googleUser.email, name: googleUser.name, avatarUrl: googleUser.picture ?? null }
  }

  const [newUser] = await db
    .insert(users)
    .values({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.picture,
    })
    .returning()

  return newUser
}

export interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
}

export async function getGoogleUser(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Google user info')
  }

  return response.json()
}
