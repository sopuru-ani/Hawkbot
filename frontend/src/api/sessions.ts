export type SessionSummary = {
  id: string
  title: string
  updated_at: string
}

export type StoredChatMessage = {
  role: 'user' | 'assistant'
  content: string
  created_at: string
  mode?: 'umes' | 'general'
  sources?: { title: string; url: string }[]
}

export type SessionDetail = SessionSummary & {
  messages: StoredChatMessage[]
  created_at: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | { msg?: string }[] }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return body.detail[0].msg
    }
  } catch {
    // ignore parse errors
  }
  return `Request failed (${response.status})`
}

export async function listSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${API_BASE}/api/sessions`, {
    credentials: 'include',
  })

  if (response.status === 401) {
    throw new Error('Sign in required')
  }
  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as SessionSummary[]
}

export async function createSession(): Promise<SessionSummary> {
  const response = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    credentials: 'include',
  })

  if (response.status === 401) {
    throw new Error('Sign in required')
  }
  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as SessionSummary
}

export async function fetchSession(sessionId: string): Promise<SessionDetail> {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    credentials: 'include',
  })

  if (response.status === 401) {
    throw new Error('Sign in required')
  }
  if (response.status === 404) {
    throw new Error('Session not found')
  }
  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as SessionDetail
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (response.status === 401) {
    throw new Error('Sign in required')
  }
  if (response.status === 404) {
    throw new Error('Session not found')
  }
  if (!response.ok && response.status !== 204) {
    throw new Error(await parseError(response))
  }
}
