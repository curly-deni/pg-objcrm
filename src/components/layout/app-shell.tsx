import { useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Building2, ClipboardList, LogOut, Menu, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/auth-provider'
import { Button } from '@/components/ui/button'

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const { t } = useTranslation()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const navigation = [
    { to: '/objects', label: t('nav.objects'), icon: Building2 },
    ...(profile?.role === 'executor'
      ? [{ to: '/my-tasks', label: t('nav.myTasks'), icon: ClipboardList }]
      : []),
  ] as const

  return (
    <div className="bg-sheet min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      {menuOpen && (
        <button
          className="bg-ink/30 fixed inset-0 z-10 md:hidden"
          aria-label={t('nav.closeMenu')}
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`border-line bg-ground fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r p-5 transition-transform md:sticky md:top-0 md:h-screen md:w-auto md:translate-x-0 ${menuOpen ? 'visible translate-x-0' : 'invisible -translate-x-full md:visible md:translate-x-0'}`}
      >
        <div className="flex items-center justify-between">
          <Link
            to="/objects"
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-2"
            onClick={() => setMenuOpen(false)}
          >
            <span className="bg-accent text-paper-highlight grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums">
              2B
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {t('brand.name')}
              </span>
              <span className="text-muted-ink block truncate text-xs">
                {t('brand.product')}
              </span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={t('nav.closeMenu')}
            onClick={() => setMenuOpen(false)}
          >
            <X />
          </Button>
        </div>

        <nav className="mt-10 space-y-1" aria-label={t('nav.primary')}>
          <p className="text-muted-ink mb-2 px-3 text-xs font-medium">
            {t('nav.work')}
          </p>
          {navigation.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${active ? 'bg-active-surface text-ink font-medium' : 'text-muted-ink hover:bg-active-surface hover:text-ink'}`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-line mt-auto border-t pt-4">
          <p className="truncate px-3 text-sm font-medium">{profile?.name}</p>
          <p className="text-muted-ink mt-0.5 px-3 text-xs">
            {profile?.role === 'manager' ? t('nav.manager') : t('nav.executor')}
          </p>
          <Button
            variant="ghost"
            className="text-muted-ink mt-4 w-full justify-start gap-3 px-3"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-line flex h-12 items-center gap-3 border-b px-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('nav.openMenu')}
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </Button>
          <span className="truncate text-sm font-medium">
            {t('brand.name')}
          </span>
        </header>
        <main className="w-full px-5 py-8 md:px-8 md:py-10 lg:px-10 2xl:px-12">
          {children}
        </main>
      </div>
    </div>
  )
}
