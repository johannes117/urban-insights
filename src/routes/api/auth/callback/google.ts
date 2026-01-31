import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { google, createSession, findOrCreateUser, getGoogleUser } from '../../../../lib/auth'

export const APIRoute = createAPIFileRoute('/api/auth/callback/google')({
  GET: async ({ request }) => {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    const baseUrl = process.env.APP_URL || 'https://urban-insights-monash.vercel.app'

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${baseUrl}/?error=${encodeURIComponent(error)}` },
      })
    }

    if (!code || !state) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${baseUrl}/?error=missing_code` },
      })
    }

    const storedState = await getCookie('google_oauth_state')
    const codeVerifier = await getCookie('google_code_verifier')

    if (!storedState || !codeVerifier || state !== storedState) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${baseUrl}/?error=invalid_state` },
      })
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
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
      })

      await deleteCookie('google_oauth_state')
      await deleteCookie('google_code_verifier')

      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl },
      })
    } catch (error) {
      console.error('Google OAuth error:', error)
      return new Response(null, {
        status: 302,
        headers: { Location: `${baseUrl}/?error=auth_failed` },
      })
    }
  },
})
