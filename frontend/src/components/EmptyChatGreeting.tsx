import type { User } from '../api/auth'
import { userLabel } from '../hooks/useAuth'

function buildGreetings(user: User | null): string[] {
  const name = user ? userLabel(user) : null
  const firstName = name?.split(/\s+/)[0] ?? null

  const personalized: string[] = []
  if (name) {
    personalized.push(`How can I help you today, ${name}?`)
    personalized.push(`Welcome back, ${firstName ?? name}`)
    personalized.push(`What's on your mind, ${firstName ?? name}?`)
    personalized.push(`Good to see you, ${firstName ?? name}.`)
    personalized.push(`What are we working on today, ${firstName ?? name}?`)
  }

  const general = [
    'How can I help you today?',
    'Ready when you are.',
    'What would you like to explore?',
    'Ask me anything.',
    'Where should we start?',
    'What can I help you with?',
  ]

  return [...personalized, ...general]
}

let pageGreeting: string | null = null

function getPageGreeting(user: User | null): string {
  if (pageGreeting === null) {
    const options = buildGreetings(user)
    pageGreeting = options[Math.floor(Math.random() * options.length)]!
  }
  return pageGreeting
}

type EmptyChatGreetingProps = {
  user: User | null
}

export function EmptyChatGreeting({ user }: EmptyChatGreetingProps) {
  return (
    <h1 className="max-w-xl text-balance text-center font-serif text-3xl tracking-tight text-foreground md:text-4xl">
      {getPageGreeting(user)}
    </h1>
  )
}
