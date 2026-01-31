import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { google, createSession, validateSession, invalidateSession, findOrCreateUser, getGoogleUser } from '../lib/auth'
import { generateCodeVerifier, generateState } from 'arctic'
import type { User } from '../db/schema'

export interface AuthState {
  user: User | null
  isLoading: boolean
}

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const sessionId = await getCookie('session')
  if (!sessionId) return { user: null }

  const result = await validateSession(sessionId)
  if (!result) {
    await deleteCookie('session')
    return { user: null }
  }

  return { user: result.user }
})

export const initiateGoogleAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const state = generateState()
  const codeVerifier = generateCodeVerifier()

  const scopes = ['openid', 'profile', 'email']
  const url = google.createAuthorizationURL(state, codeVerifier, scopes)

  await setCookie('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
    sameSite: 'lax',
  })

  await setCookie('google_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
  })

  return { url: url.toString() }
})

export const handleGoogleCallback = createServerFn({ method: 'POST' })
  .inputValidator((d: { code: string; state: string }) => d)
  .handler(async ({ data }) => {
    const { code, state } = data

    const storedState = await getCookie('google_oauth_state')
    const codeVerifier = await getCookie('google_code_verifier')

    if (!storedState || !codeVerifier || state !== storedState) {
      return { success: false, error: 'Invalid state' }
    }

    try {
      const tokens = await google.validateAuthorizationCode(code, codeVerifier)
      const googleUser = await getGoogleUser(tokens.accessToken())

      const user = await findOrCreateUser({
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      })

      const sessionId = await createSession(user.id)

      await setCookie('session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
        sameSite: 'lax',
      })

      await deleteCookie('google_oauth_state')
      await deleteCookie('google_code_verifier')

      return { success: true, user }
    } catch (error) {
      console.error('Google OAuth error:', error)
      return { success: false, error: 'Authentication failed' }
    }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionId = await getCookie('session')
  if (sessionId) {
    await invalidateSession(sessionId)
    await deleteCookie('session')
  }
  return { success: true }
})
