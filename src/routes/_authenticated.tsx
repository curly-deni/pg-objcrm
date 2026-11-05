import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AppShell } from '@/components/layout/app-shell'
import { LoadingState } from '@/components/layout/page-state'
import { requireAuth } from '@/auth/route-guards'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => requireAuth(context, location.href),
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { auth } = Route.useRouteContext()
  const { t } = useTranslation()

  if (!auth.profile) {
    return (
      <main className="bg-ground grid min-h-screen place-items-center p-6">
        <LoadingState label={t('common.loadingProfile')} />
      </main>
    )
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
