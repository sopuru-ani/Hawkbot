import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SidebarTrigger } from '../components/Sidebar'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { formatSessionTime, useChatSessions } from '../hooks/useChatSessions'
import { useTheme } from '../hooks/useTheme'

export function SearchPage() {
  const { theme, setTheme } = useTheme()
  const { sessions, loading } = useChatSessions()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return sessions
    return sessions.filter((session) =>
      session.title.toLowerCase().includes(normalized),
    )
  }, [query, sessions])

  return (
    <>
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger />
          <h2 className="truncate text-sm font-medium text-foreground">Search chats</h2>
        </div>
        <ThemeSwitcher theme={theme} onChange={setTheme} />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title..."
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading chats...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted">
            {query.trim() ? 'No chats match your search.' : 'No chats yet.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((session) => (
              <li key={session.id}>
                <Link
                  to={`/chat/${session.id}`}
                  className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-accent-subtle"
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {session.title}
                  </p>
                  <p className="text-xs text-muted">
                    {formatSessionTime(session.updated_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
