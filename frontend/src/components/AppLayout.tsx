import { Outlet, useNavigate } from 'react-router-dom'
import { ChatSessionsProvider, clearLastSessionId } from '../hooks/useChatSessions'
import { SidebarProvider } from './Sidebar'

function AppLayoutInner() {
  const navigate = useNavigate()

  return (
    <SidebarProvider
      onNewChat={() => {
        clearLastSessionId()
        navigate('/chat', { state: { reset: Date.now() } })
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
