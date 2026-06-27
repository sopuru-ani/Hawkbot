import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

type AuthPageProps = {
  mode: 'login' | 'register'
}

export function AuthPage({ mode }: AuthPageProps) {
  const { theme, setTheme } = useTheme()
  const { user, loading, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/chat'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (mode === 'login') {
        await login({ email, password })
      } else {
        await register({
          email,
          password,
          display_name: displayName.trim() || undefined,
        })
      }
      navigate(from, { replace: true })
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Something went wrong.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center justify-end px-4 md:px-6">
        <ThemeSwitcher theme={theme} onChange={setTheme} />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <h1 className="text-lg font-medium text-foreground">
            {mode === 'login' ? 'Sign in to Hawkbot' : 'Create an account'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'login'
              ? 'Use your email and password to continue.'
              : 'Register to save chats and search your history.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'register' && (
              <label className="block">
                <span className="mb-1.5 block text-sm text-foreground">Display name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2"
                  placeholder="Optional"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm text-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2"
              />
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <Link
              to={mode === 'login' ? '/register' : '/login'}
              state={location.state}
              className="font-medium text-link hover:text-link-hover hover:underline"
            >
              {mode === 'login' ? 'Register' : 'Sign in'}
            </Link>
          </p>

          <p className="mt-3 text-center text-sm text-muted">
            <Link to="/chat" className="text-link hover:text-link-hover hover:underline">
              Continue as guest
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
