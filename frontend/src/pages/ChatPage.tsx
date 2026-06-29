import { ArrowRight, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { streamChat } from '../api/chat'
import * as sessionsApi from '../api/sessions'
import { EmptyChatGreeting } from '../components/EmptyChatGreeting'
import { SidebarTrigger } from '../components/Sidebar'
import { MarkdownContent } from '../components/MarkdownContent'
import { ThinkingDropdown } from '../components/ThinkingDropdown'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import {
  setLastSessionId,
  getLastSessionId,
  useChatSessions,
} from '../hooks/useChatSessions'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { createId } from '../lib/id'
import type { ApiChatMessage, ChatMessage } from '../types/chat'

const CHAT_WIDTH = 'max-w-3xl'
const TEXTAREA_MAX_HEIGHT = 192
const SINGLE_LINE_HEIGHT = 24

function toApiMessages(messages: ChatMessage[]): ApiChatMessage[] {
  return messages.map(({ role, content }) => ({ role, content }))
}

function storedToChatMessages(
  stored: sessionsApi.StoredChatMessage[],
): ChatMessage[] {
  return stored.map((message) => ({
    id: createId(),
    role: message.role,
    content: message.content,
    mode: message.mode,
    sources: message.sources,
  }))
}

export function ChatPage() {
  const { chatId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const resetToken = (location.state as { reset?: number } | null)?.reset
  const { user, loading: authLoading } = useAuth()
  const { sessions, refresh, updateSessionTitle } = useChatSessions()
  const { theme, setTheme } = useTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionTitle, setSessionTitle] = useState('New chat')
  const [loadingSession, setLoadingSession] = useState(Boolean(chatId))
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMultiline, setIsMultiline] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const nextHeight = Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY =
      scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden'
    setIsMultiline(scrollHeight > SINGLE_LINE_HEIGHT)
  }, [])

  useEffect(() => {
    if (chatId || authLoading || !user) return
    const lastId = getLastSessionId()
    if (lastId) {
      navigate(`/chat/${lastId}`, { replace: true })
    }
  }, [chatId, authLoading, user, navigate])

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setInput('')
    setIsLoading(false)
    requestAnimationFrame(adjustTextareaHeight)

    if (!chatId) {
      setMessages([])
      setSessionTitle('New chat')
      setLoadingSession(false)
      return
    }

    let cancelled = false
    setLoadingSession(true)

    async function loadSession() {
      try {
        const session = await sessionsApi.fetchSession(chatId!)
        if (cancelled) return
        setMessages(storedToChatMessages(session.messages))
        setSessionTitle(session.title)
        setLastSessionId(session.id)
      } catch {
        if (!cancelled) {
          setMessages([])
          setSessionTitle('New chat')
          navigate('/chat', { replace: true })
        }
      } finally {
        if (!cancelled) setLoadingSession(false)
      }
    }

    void loadSession()
    return () => {
      cancelled = true
    }
  }, [chatId, resetToken, navigate, adjustTextareaHeight])

  useEffect(() => {
    if (!chatId) return
    const summary = sessions.find((entry) => entry.id === chatId)
    if (summary) {
      setSessionTitle(summary.title)
    }
  }, [chatId, sessions])

  useEffect(() => {
    adjustTextareaHeight()
  }, [input, adjustTextareaHeight])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()

    const trimmed = input.trim()
    if (!trimmed || isLoading || loadingSession) return

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
    requestAnimationFrame(adjustTextareaHeight)
    setIsLoading(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat(
        toApiMessages([...messages, userMessage]),
        {
          onStatus: ({ message }) => {
            if (!message) return
            setMessages((current) =>
              current.map((entry) => {
                if (entry.id !== assistantId) return entry
                const previous = entry.thinking ?? []
                const thinking =
                  previous[previous.length - 1] === message
                    ? previous
                    : [...previous, message]
                return { ...entry, thinking }
              }),
            )
          },
          onToken: (text) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: message.content + text,
                    }
                  : message,
              ),
            )
          },
          onDone: ({ mode, sources, session_id, title }) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      streaming: false,
                      mode,
                      sources,
                    }
                  : message,
              ),
            )

            if (session_id) {
              setLastSessionId(session_id)
              if (title) {
                setSessionTitle(title)
                updateSessionTitle(session_id, title)
              }
              if (!chatId) {
                navigate(`/chat/${session_id}`, { replace: true })
              }
              void refresh()
            }
          },
          onError: (message) => {
            setMessages((current) =>
              current.map((entry) =>
                entry.id === assistantId
                  ? {
                      ...entry,
                      content: entry.content || message,
                      streaming: false,
                      error: true,
                    }
                  : entry,
              ),
            )
          },
        },
        controller.signal,
        chatId,
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

  const showGreeting = !authLoading && !loadingSession && messages.length === 0

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return

    if (window.matchMedia('(pointer: coarse)').matches) return

    event.preventDefault()
    void handleSubmit()
  }

  return (
    <>
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger />
          <h2 className="truncate text-sm font-medium text-foreground">
            {loadingSession ? 'Loading...' : sessionTitle}
          </h2>
        </div>
        <ThemeSwitcher theme={theme} onChange={setTheme} />
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {showGreeting && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center px-4 pb-36"
            style={{ bottom: 0 }}
          >
            <EmptyChatGreeting user={user} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: 16 }}>
          <div
            className={`mx-auto flex w-full min-w-0 ${CHAT_WIDTH} flex-col gap-4 px-4 py-4`}
          >
            {loadingSession ? (
              <p className="text-sm text-muted">Loading conversation...</p>
            ) : (
              messages.map((message) =>
                message.role === 'user' ? (
                  <article key={message.id} className="flex min-w-0 justify-end">
                    <div className="min-w-0 max-w-[85%] rounded-2xl bg-user-message px-4 py-3 text-sm leading-relaxed text-foreground">
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </article>
                ) : (
                  <article key={message.id} className="min-w-0 w-full">
                    {message.thinking && message.thinking.length > 0 && (
                      message.streaming ? (
                        <p className="mb-2 text-xs italic text-muted">
                          {message.thinking[message.thinking.length - 1]}
                        </p>
                      ) : (
                        <ThinkingDropdown steps={message.thinking} />
                      )
                    )}

                    {message.streaming && !message.content && !message.thinking?.length ? (
                      <p className="text-xs italic text-muted">Thinking...</p>
                    ) : (
                      <MarkdownContent
                        content={message.content}
                        streaming={message.streaming}
                        error={message.error}
                      />
                    )}

                    {message.role === 'assistant' && !message.streaming && message.mode && (
                      <p className="mt-2 text-xs text-muted">
                        {message.mode === 'umes' ? 'UMES knowledge' : 'General'}
                      </p>
                    )}

                    {message.sources && message.sources.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {message.sources.map((source) => (
                          <li key={source.url} className="break-words">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="break-words text-link underline-offset-2 hover:text-link-hover hover:underline"
                            >
                              {source.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ),
              )
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="relative shrink-0 bg-background pb-5 pt-2">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-full h-[72px]"
            style={{
              background:
                'linear-gradient(to top, var(--theme-background) 0%, color-mix(in srgb, var(--theme-background) 75%, transparent) 45%, transparent 100%)',
            }}
            aria-hidden
          />

          <form onSubmit={handleSubmit} className={`mx-auto w-full ${CHAT_WIDTH} px-4`}>
            <div
              className={`flex gap-2 rounded-3xl border border-border bg-surface px-4 py-2.5 shadow-sm ${
                isMultiline ? 'items-end' : 'items-center'
              }`}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What you want..."
                rows={1}
                disabled={isLoading || loadingSession}
                className="min-h-6 flex-1 resize-none bg-transparent py-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted disabled:opacity-60"
              />
              <button
                type={isLoading ? 'button' : 'submit'}
                disabled={(!isLoading && !input.trim()) || loadingSession}
                aria-label={isLoading ? 'Stop' : 'Send message'}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <Square className="size-3 fill-current" strokeWidth={0} />
                ) : (
                  <ArrowRight className="size-4" strokeWidth={2} />
                )}
              </button>
            </div>
            <p className="mt-2.5 text-center text-xs text-muted">
              Hawkbot is AI and can make mistakes. Please double check responses
            </p>
          </form>
        </div>
      </main>
    </>
  )
}
