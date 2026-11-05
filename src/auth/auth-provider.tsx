import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { queryClient } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type AuthStatus =
  | 'loading'
  | 'profile_loading'
  | 'ready'
  | 'unauthenticated'
  | 'profile_missing'
  | 'error'

export type AuthContextValue = {
  user: User | null
  profile: Profile | null
  status: AuthStatus
  error: string | null
  signOut: () => Promise<void>
  retry: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const activeUserId = useRef<string | null>(null)
  const sequence = useRef(0)

  const clearUser = useCallback(() => {
    sequence.current += 1
    activeUserId.current = null
    queryClient.clear()
    setUser(null)
    setProfile(null)
    setError(null)
    setStatus('unauthenticated')
  }, [])

  const verifyUser = useCallback(
    async (expectedId: string, isCurrent: () => boolean) => {
      const { data, error: authError } = await supabase.auth.getUser()
      if (!isCurrent()) return

      if (authError) {
        if (authError.status === 401) {
          clearUser()
        } else {
          setError(authError.message)
          setStatus('error')
        }
        return
      }

      if (!data.user || data.user.id !== expectedId) {
        clearUser()
        return
      }

      setUser(data.user)
      const { data: row, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!isCurrent()) return
      if (profileError) {
        setError(profileError.message)
        setStatus('error')
        return
      }

      setProfile(row)
      setStatus(row ? 'ready' : 'profile_missing')
    },
    [clearUser],
  )

  const refresh = useCallback(async () => {
    setError(null)
    setStatus('loading')
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      setError(sessionError.message)
      setStatus('error')
      return
    }
    if (!data.session) {
      clearUser()
      return
    }
    if (activeUserId.current !== data.session.user.id) {
      queryClient.clear()
      activeUserId.current = data.session.user.id
    }
    setStatus('profile_loading')
    const request = ++sequence.current
    await verifyUser(data.session.user.id, () => request === sequence.current)
  }, [clearUser, verifyUser])

  useEffect(() => {
    let mounted = true
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_OUT' || !session) {
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') clearUser()
          return
        }

        if (
          event === 'TOKEN_REFRESHED' &&
          activeUserId.current === session.user.id
        )
          return

        if (activeUserId.current !== session.user.id) {
          queryClient.clear()
          activeUserId.current = session.user.id
          setProfile(null)
        }
        setUser(session.user)
        setError(null)
        setStatus('profile_loading')
        const request = ++sequence.current
        window.setTimeout(() => {
          if (mounted)
            void verifyUser(
              session.user.id,
              () => mounted && request === sequence.current,
            )
        }, 0)
      },
    )

    return () => {
      mounted = false
      sequence.current += 1
      authListener.subscription.unsubscribe()
    }
  }, [clearUser, verifyUser])

  const signOut = useCallback(async () => {
    clearUser()
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setError(signOutError.message)
      setStatus('error')
    }
  }, [clearUser])

  const value = useMemo(
    () => ({ user, profile, status, error, signOut, retry: refresh }),
    [user, profile, status, error, signOut, refresh],
  )

  if (status === 'loading' || (status === 'profile_loading' && !user)) {
    return (
      <main className="text-muted-ink grid min-h-screen place-items-center text-sm">
        {t('auth.checking')}
      </main>
    )
  }

  if (status === 'profile_missing') {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="border-line bg-sheet max-w-md rounded-xl border p-6">
          <h1 className="text-lg font-semibold">{t('auth.profileMissing')}</h1>
          <p className="text-muted-ink mt-2 text-sm">
            {t('auth.profileMissingDescription')}
          </p>
          <button
            className="text-accent mt-5 text-sm font-medium"
            onClick={() => void signOut()}
          >
            {t('nav.logoutAccount')}
          </button>
        </section>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="border-line bg-sheet max-w-md rounded-xl border p-6">
          <h1 className="text-lg font-semibold">{t('auth.sessionError')}</h1>
          <p className="text-muted-ink mt-2 text-sm">
            {error ?? t('auth.connectionError')}
          </p>
          <div className="mt-5 flex gap-4">
            <button
              className="text-accent text-sm font-medium"
              onClick={() => void refresh()}
            >
              {t('auth.retry')}
            </button>
            <button
              className="text-muted-ink text-sm"
              onClick={() => void signOut()}
            >
              {t('nav.logout')}
            </button>
          </div>
        </section>
      </main>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
