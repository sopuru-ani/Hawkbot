import {
  ChevronsUpDown,
  LogOut,
  MessageSquarePlus,
  PanelLeft,
  PanelLeftClose,
  Search,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useChatSessions } from '../hooks/useChatSessions'
import { useAuth, userInitials, userLabel } from '../hooks/useAuth'

const MD_MEDIA = '(min-width: 768px)'

type SidebarContextValue = {
  mobileOpen: boolean
  toggleMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }
  return context
}

type SidebarItemProps = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  collapsed: boolean
  onClick?: () => void
  disabled?: boolean
}

function SidebarItem({ icon: Icon, label, collapsed, onClick, disabled }: SidebarItemProps) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center rounded-lg py-2 text-sm transition-colors ${
        disabled
          ? 'cursor-not-allowed text-muted opacity-50'
          : 'text-foreground hover:bg-accent-subtle'
      } ${collapsed ? 'justify-center px-2' : 'gap-3 px-2.5'}`}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span
        className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${
          collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'
        }`}
      >
        {label}
      </span>
    </button>
  )
}

function SidebarPanel({
  collapsed,
  isOverlay,
  onToggleCollapsed,
  onCloseMobile,
  onNewChat,
}: {
  collapsed: boolean
  isOverlay: boolean
  onToggleCollapsed: () => void
  onCloseMobile: () => void
  onNewChat?: () => void | Promise<void>
}) {
  const { user, logout } = useAuth()
  const { sessions, loading: sessionsLoading } = useChatSessions()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const showLabels = isOverlay || !collapsed
  const activeChatId = location.pathname.startsWith('/chat/')
    ? location.pathname.slice('/chat/'.length).split('/')[0]
    : null
  const recentSessions = sessions.slice(0, 20)

  function handleToggle() {
    if (isOverlay) {
      onCloseMobile()
      return
    }
    onToggleCollapsed()
  }

  return (
    <>
      <div
        className={`flex h-11 shrink-0 items-center ${
          showLabels ? 'justify-between px-4' : 'justify-center px-2'
        }`}
      >
        {showLabels && (
          <Link to="/chat" className="text-sm font-medium text-foreground">
            Hawkbot
          </Link>
        )}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={
            isOverlay
              ? 'Close sidebar'
              : collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
          }
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-accent-subtle hover:text-foreground"
        >
          {isOverlay ? (
            <PanelLeftClose className="size-4" strokeWidth={1.75} />
          ) : collapsed ? (
            <PanelLeft className="size-4" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="size-4" strokeWidth={1.75} />
          )}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        <SidebarItem
          icon={MessageSquarePlus}
          label="New chat"
          collapsed={!showLabels}
          onClick={() => {
            void onNewChat?.()
            if (isOverlay) onCloseMobile()
          }}
        />
        <SidebarItem
          icon={Search}
          label="Search chats"
          collapsed={!showLabels}
          onClick={() => {
            if (isOverlay) onCloseMobile()
            if (!user) {
              navigate('/login', { state: { from: '/search' } })
              return
            }
            navigate('/search')
          }}
        />
        {user && showLabels && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
            <p className="px-2.5 text-xs font-medium text-muted">Recents</p>
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {sessionsLoading && recentSessions.length === 0 ? (
                <p className="px-2.5 py-1 text-xs text-muted">Loading...</p>
              ) : recentSessions.length === 0 ? (
                <p className="px-2.5 py-1 text-xs text-muted">No chats yet</p>
              ) : (
                recentSessions.map((session) => {
                  const isActive = activeChatId === session.id
                  return (
                    <Link
                      key={session.id}
                      to={`/chat/${session.id}`}
                      onClick={() => {
                        if (isOverlay) onCloseMobile()
                      }}
                      className={`block rounded-lg px-2.5 py-2 transition-colors ${
                        isActive
                          ? 'bg-accent-subtle text-foreground'
                          : 'text-foreground hover:bg-accent-subtle'
                      }`}
                    >
                      <p className="truncate text-sm">{session.title}</p>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="relative shrink-0 border-t border-border px-2 py-3">
        {user ? (
          <>
            <button
              type="button"
              title={!showLabels ? userLabel(user) : undefined}
              onClick={() => showLabels && setMenuOpen((value) => !value)}
              className={`flex w-full items-center rounded-lg py-1.5 transition-colors hover:bg-accent-subtle ${
                showLabels ? 'gap-2.5 px-2' : 'justify-center px-2'
              }`}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium text-foreground">
                {userInitials(user)}
              </div>
              {showLabels && (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-foreground">
                      {userLabel(user)}
                    </p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <ChevronsUpDown
                    className="size-4 shrink-0 text-muted"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </>
              )}
            </button>

            {showLabels && menuOpen && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  void logout().then(() => navigate('/chat'))
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-accent-subtle"
              >
                <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                Sign out
              </button>
            )}
          </>
        ) : (
          <div
            className={`flex w-full items-center rounded-lg py-1.5 ${
              showLabels ? 'gap-2.5 px-2' : 'justify-center px-2'
            }`}
          >
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium text-foreground"
              title={!showLabels ? 'Guest' : undefined}
            >
              GU
            </div>
            {showLabels && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-foreground">Guest</p>
                <Link
                  to="/login"
                  className="truncate text-xs text-link hover:text-link-hover hover:underline"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export function SidebarProvider({
  children,
  onNewChat,
}: {
  children: ReactNode
  onNewChat?: () => void | Promise<void>
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMdUp, setIsMdUp] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MD_MEDIA).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(MD_MEDIA)
    const onChange = () => {
      const matches = media.matches
      setIsMdUp(matches)
      if (matches) setMobileOpen(false)
    }

    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  const toggleMobile = useCallback(() => {
    setMobileOpen((value) => !value)
  }, [])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const isOverlay = !isMdUp

  return (
    <SidebarContext.Provider value={{ mobileOpen, toggleMobile }}>
      <div className="relative flex h-svh overflow-hidden bg-background">
        <aside
          aria-hidden={isOverlay ? !mobileOpen : undefined}
          className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-background md:relative md:transition-[width] md:duration-300 md:ease-in-out max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[70] max-md:w-52 max-md:shadow-xl max-md:transition-transform max-md:duration-300 max-md:ease-in-out ${
            mobileOpen
              ? 'max-md:translate-x-0'
              : 'max-md:pointer-events-none max-md:-translate-x-full'
          } ${collapsed ? 'md:w-14' : 'md:w-52'}`}
        >
          <SidebarPanel
            collapsed={collapsed}
            isOverlay={isOverlay}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
            onCloseMobile={closeMobile}
            onNewChat={onNewChat}
          />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>

        {isOverlay && (
          <button
            type="button"
            aria-label="Close sidebar"
            aria-hidden={!mobileOpen}
            tabIndex={mobileOpen ? 0 : -1}
            onClick={closeMobile}
            className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ease-in-out md:hidden ${
              mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />
        )}
      </div>
    </SidebarContext.Provider>
  )
}

export function SidebarTrigger() {
  const { mobileOpen, toggleMobile } = useSidebar()

  return (
    <button
      type="button"
      onClick={toggleMobile}
      aria-label={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
      aria-expanded={mobileOpen}
      className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-accent-subtle hover:text-foreground md:hidden"
    >
      {mobileOpen ? (
        <PanelLeftClose className="size-4" strokeWidth={1.75} />
      ) : (
        <PanelLeft className="size-4" strokeWidth={1.75} />
      )}
    </button>
  )
}
