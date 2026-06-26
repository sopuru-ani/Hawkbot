import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { streamChat } from './api/chat'
import type { ApiChatMessage, ChatMessage } from './types/chat'

function createId() {
  return crypto.randomUUID()
}

function toApiMessages(messages: ChatMessage[]): ApiChatMessage[] {
  return messages.map(({ role, content }) => ({ role, content }))
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()

    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: trimmed,
    }
    const assistantId = createId()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    }

    const nextMessages = [...messages, userMessage, assistantMessage]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat(
        toApiMessages([...messages, userMessage]),
        {
          onStatus: ({ message }) => {
            setMessages((current) =>
              current.map((entry) =>
                entry.id === assistantId ? { ...entry, status: message } : entry,
              ),
            )
          },
          onToken: (text) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: message.content + text,
                      status: undefined,
                    }
                  : message,
              ),
            )
          },
          onDone: ({ mode, sources }) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      streaming: false,
                      status: undefined,
                      mode,
                      sources,
                    }
                  : message,
              ),
            )
          },
          onError: (message) => {
            setMessages((current) =>
              current.map((entry) =>
                entry.id === assistantId
                  ? {
                      ...entry,
                      content: entry.content || message,
                      streaming: false,
                      status: undefined,
                      error: true,
                    }
                  : entry,
              ),
            )
          },
        },
        controller.signal,
      )
    } catch (error) {
      if (controller.signal.aborted) return

      const message =
        error instanceof Error ? error.message : 'Something went wrong.'
      setMessages((current) =>
        current.map((entry) =>
          entry.id === assistantId
            ? { ...entry, content: message, streaming: false, error: true }
            : entry,
        ),
      )
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Hawkbot</h1>
        <p className="text-sm text-gray-500">
          Ask about UMES or anything else.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-center text-gray-500">
              <p>
                Try &ldquo;How much does it cost to apply to UMES?&rdquo; or ask a
                general question.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <article
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.error
                      ? 'border border-red-200 bg-red-50 text-red-800'
                      : 'border border-gray-200 bg-white text-gray-900 shadow-sm'
                }`}
              >
                {message.streaming && !message.content && message.status ? (
                  <p className="italic text-gray-500">{message.status}</p>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {message.content}
                    {message.streaming && message.content && (
                      <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-gray-400" />
                    )}
                  </p>
                )}

                {message.role === 'assistant' &&
                  !message.streaming &&
                  message.mode && (
                    <p className="mt-2 text-xs text-gray-500">
                      {message.mode === 'umes' ? 'UMES knowledge' : 'General'}
                    </p>
                  )}

                {message.sources && message.sources.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
                    {message.sources.map((source) => (
                      <li key={source.url}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="sticky bottom-0 bg-gray-50 pt-2">
          <div className="flex gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Hawkbot..."
              rows={1}
              disabled={isLoading}
              className="max-h-40 flex-1 resize-none rounded-xl px-3 py-2 text-sm text-gray-900 outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="self-end rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            Enter to send, Shift+Enter for a new line
          </p>
        </form>
      </main>
    </div>
  )
}

export default App
