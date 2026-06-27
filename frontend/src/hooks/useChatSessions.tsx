import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as sessionsApi from '../api/sessions'
import type { SessionSummary } from '../api/sessions'
import { useAuth } from './useAuth'

const LAST_SESSION_KEY = 'hawkbot:lastSessionId'

type ChatSessionsContextValue = {
  sessions: SessionSummary[]
  loading: boolean
  refresh: () => Promise<void>
  createSession: () => Promise<SessionSummary>
  deleteSession: (sessionId: string) => Promise<void>
  updateSessionTitle: (sessionId: string, title: string) => void
}

const ChatSessionsContext = createContext<ChatSessionsContextValue | null>(null)

export function ChatSessionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setSessions([])
      return
    }

    setLoading(true)
    try {
      const next = await sessionsApi.listSessions()
      setSessions(next)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createSession = useCallback(async () => {
    const session = await sessionsApi.createSession()
    setSessions((current) => [session, ...current.filter((entry) => entry.id !== session.id)])
    return session
  }, [])

  const deleteSession = useCallback(async (sessionId: string) => {
    await sessionsApi.deleteSession(sessionId)
    setSessions((current) => current.filter((entry) => entry.id !== sessionId))
    if (getLastSessionId() === sessionId) {
      clearLastSessionId()
    }
  }, [])

  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setSessions((current) =>
      current.map((entry) => (entry.id === sessionId ? { ...entry, title } : entry)),
    )
  }, [])

  const value = useMemo(
    () => ({
      sessions,
      loading,
      refresh,
      createSession,
      deleteSession,
      updateSessionTitle,
    }),
    [sessions, loading, refresh, createSession, deleteSession, updateSessionTitle],
  )

  return (
    <ChatSessionsContext.Provider value={value}>{children}</ChatSessionsContext.Provider>
  )
}

export function useChatSessions() {
  const context = useContext(ChatSessionsContext)
  if (!context) {
    throw new Error('useChatSessions must be used within ChatSessionsProvider')
  }
  return context
}

export function getLastSessionId(): string | null {
  try {
    return localStorage.getItem(LAST_SESSION_KEY)
  } catch {
    return null
  }
}

export function setLastSessionId(sessionId: string) {
  try {
    localStorage.setItem(LAST_SESSION_KEY, sessionId)
  } catch {
    // ignore storage errors
  }
}

export function clearLastSessionId() {
  try {
    localStorage.removeItem(LAST_SESSION_KEY)
  } catch {
    // ignore storage errors
  }
}

export function formatSessionTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
