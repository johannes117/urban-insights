import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { getSession, initiateGoogleAuth, logout as logoutFn } from '../server/auth'
import type { User } from '../db/schema'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [isLoading, setIsLoading] = useState(false)

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true)
    try {
      const { url } = await initiateGoogleAuth()
      window.location.href = url
    } catch (error) {
      console.error('Failed to initiate Google auth:', error)
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await logoutFn()
      setUser(null)
    } catch (error) {
      console.error('Failed to logout:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const { user } = await getSession()
      setUser(user)
    } catch (error) {
      console.error('Failed to refresh session:', error)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithGoogle, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
