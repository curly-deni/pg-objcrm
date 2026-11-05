import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth-provider'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  profileQuery: vi.fn(),
  clear: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.profileQuery }),
      }),
    }),
  },
}))
vi.mock('@/lib/query-client', () => ({ queryClient: { clear: mocks.clear } }))

const user = { id: 'user-1', email: 'test@example.com' } as never
const profile = { id: 'user-1', name: 'Анна', role: 'executor' } as never
let authListener: (event: string, session: unknown) => void

function AuthState() {
  const auth = useAuth()
  return (
    <div>
      <p>{auth.status}</p>
      {auth.profile && <p>{auth.profile.role}</p>}
      <button onClick={() => void auth.signOut()}>Выход тест</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onAuthStateChange.mockImplementation((listener) => {
      authListener = listener
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.getSession.mockResolvedValue({
      data: { session: { user } },
      error: null,
    })
    mocks.getUser.mockResolvedValue({ data: { user }, error: null })
    mocks.profileQuery.mockResolvedValue({ data: profile, error: null })
  })

  it('hides protected children while the initial session is being checked', () => {
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )

    expect(screen.getByText('Проверяем вход…')).toBeInTheDocument()
    expect(screen.queryByText('ready')).not.toBeInTheDocument()
  })

  it('restores the session, verifies the user and loads their profile', async () => {
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    authListener('INITIAL_SESSION', { user })

    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(screen.getByText('executor')).toBeInTheDocument()
    expect(mocks.getUser).toHaveBeenCalledOnce()
    expect(mocks.profileQuery).toHaveBeenCalledOnce()
  })

  it('does not expose the app when an authenticated user has no profile', async () => {
    mocks.profileQuery.mockResolvedValue({ data: null, error: null })
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    authListener('SIGNED_IN', { user })

    expect(await screen.findByText('Профиль не настроен')).toBeInTheDocument()
    expect(screen.queryByText('Выход тест')).not.toBeInTheDocument()
  })

  it('shows a retryable connection error when session verification fails', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 503, message: 'Network unavailable' },
    })
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    authListener('INITIAL_SESSION', { user })

    expect(
      await screen.findByText('Не удалось проверить сессию'),
    ).toBeInTheDocument()
    expect(screen.getByText('Network unavailable')).toBeInTheDocument()
  })

  it('clears an expired session instead of keeping its user visible', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401, message: 'Session expired' },
    })
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    authListener('SIGNED_IN', { user })

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument()
    expect(screen.queryByText('executor')).not.toBeInTheDocument()
  })

  it('retries a profile loading error and recovers the authenticated app', async () => {
    mocks.profileQuery
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Profile unavailable'),
      })
      .mockResolvedValue({ data: profile, error: null })
    const actor = userEvent.setup()
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    authListener('INITIAL_SESSION', { user })
    expect(await screen.findByText('Profile unavailable')).toBeInTheDocument()

    await actor.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(mocks.getSession).toHaveBeenCalledOnce()
    expect(mocks.getUser).toHaveBeenCalledTimes(2)
  })

  it('does not repeat profile requests for a same-user token refresh', async () => {
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    authListener('SIGNED_IN', { user })
    await screen.findByText('ready')
    authListener('TOKEN_REFRESHED', { user })

    expect(mocks.getUser).toHaveBeenCalledOnce()
    expect(mocks.profileQuery).toHaveBeenCalledOnce()
  })

  it('clears user state and query cache on sign out', async () => {
    const actor = userEvent.setup()
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    authListener('SIGNED_IN', { user })
    await screen.findByText('ready')
    await actor.click(screen.getByRole('button', { name: 'Выход тест' }))

    await waitFor(() =>
      expect(screen.queryByText('ready')).not.toBeInTheDocument(),
    )
    expect(mocks.clear).toHaveBeenCalled()
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('reports a failed remote sign out after clearing local data', async () => {
    mocks.signOut.mockResolvedValue({ error: new Error('Sign out failed') })
    const actor = userEvent.setup()
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    authListener('SIGNED_IN', { user })
    await screen.findByText('ready')
    await actor.click(screen.getByRole('button', { name: 'Выход тест' }))

    expect(
      await screen.findByText('Не удалось проверить сессию'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sign out failed')).toBeInTheDocument()
  })
})
