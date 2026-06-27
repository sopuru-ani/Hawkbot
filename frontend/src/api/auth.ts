export type User = {
  id: string
  email: string
  display_name: string | null
}

export type RegisterPayload = {
  email: string
  password: string
  display_name?: string
}

export type LoginPayload = {
  email: string
  password: string
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

export async function fetchMe(): Promise<User | null> {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    credentials: 'include',
  })

  if (response.status === 401) return null
  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as User
}

export async function register(payload: RegisterPayload): Promise<User> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as User
}

export async function login(payload: LoginPayload): Promise<User> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as User
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok && response.status !== 204) {
    throw new Error(await parseError(response))
  }
}
