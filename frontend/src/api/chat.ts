import type {
  ApiChatMessage,
  StreamDonePayload,
  StreamStatusPayload,
} from '../types/chat'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export interface StreamCallbacks {
  onStatus?: (payload: StreamStatusPayload) => void
  onToken: (text: string) => void
  onDone: (payload: StreamDonePayload) => void
  onError: (message: string) => void
}

function parseSseBlock(block: string, callbacks: StreamCallbacks) {
  let event = 'message'
  let data = ''

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      data = line.slice(5).trim()
    }
  }

  if (!data) return

  const payload = JSON.parse(data) as Record<string, unknown>

  if (event === 'status') {
    callbacks.onStatus?.(payload as unknown as StreamStatusPayload)
  } else if (event === 'token' && typeof payload.text === 'string') {
    callbacks.onToken(payload.text)
  } else if (event === 'done') {
    callbacks.onDone(payload as unknown as StreamDonePayload)
  } else if (event === 'error' && typeof payload.message === 'string') {
    callbacks.onError(payload.message)
  }
}

export async function streamChat(
  messages: ApiChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ messages, session_id: sessionId }),
    signal,
  })

  if (response.status === 401) {
    throw new Error('Sign in required to chat')
  }

  if (!response.ok) {
    throw new Error(`Chat request failed (${response.status})`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (part.trim()) {
        parseSseBlock(part, callbacks)
      }
    }
  }

  if (buffer.trim()) {
    parseSseBlock(buffer, callbacks)
  }
}
