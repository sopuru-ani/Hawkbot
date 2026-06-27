import { Outlet, useNavigate } from 'react-router-dom'
import { ChatSessionsProvider, useChatSessions } from '../hooks/useChatSessions'
import { SidebarProvider } from './Sidebar'

function AppLayoutInner() {
  const navigate = useNavigate()
  const { createSession } = useChatSessions()

  return (
    <SidebarProvider
      onNewChat={async () => {
        const session = await createSession()
        navigate(`/chat/${session.id}`)
      }}
    >
      <Outlet />
    </SidebarProvider>
  )
}

export function AppLayout() {
  return (
    <ChatSessionsProvider>
      <AppLayoutInner />
    </ChatSessionsProvider>
  )
}
