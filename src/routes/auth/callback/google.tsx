import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { handleGoogleCallback } from '../../../server/auth'

export const Route = createFileRoute('/auth/callback/google')({
  component: GoogleCallback,
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) || '',
    state: (search.state as string) || '',
    error: search.error as string | undefined,
  }),
})

function GoogleCallback() {
  const { code, state, error } = Route.useSearch()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (error) {
      setStatus('error')
      setErrorMessage(error)
      return
    }

    if (!code || !state) {
      setStatus('error')
      setErrorMessage('Missing authorization code')
      return
    }

    handleGoogleCallback({ data: { code, state } })
      .then((result) => {
        if (result.success) {
          navigate({ to: '/' })
        } else {
          setStatus('error')
          setErrorMessage(result.error || 'Authentication failed')
        }
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage('An unexpected error occurred')
        console.error('Callback error:', err)
      })
  }, [code, state, error, navigate])

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-xl font-medium text-gray-900">Authentication Failed</h1>
          <p className="mt-2 text-gray-600">{errorMessage}</p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        <p className="mt-4 text-gray-600">Signing you in...</p>
      </div>
    </div>
  )
}
