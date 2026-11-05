import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Toaster } from '@/components/ui/sonner'
import { ErrorState } from '@/components/layout/page-state'
import type { RouterContext } from '@/types/router'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  ),
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto max-w-xl p-8">
      <ErrorState error={error} retry={reset} />
    </main>
  ),
})

function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section>
        <h1 className="text-xl font-semibold">{t('common.notFound')}</h1>
        <p className="text-muted-ink mt-2 text-sm">
          {t('common.notFoundDescription')}
        </p>
        <a
          className="text-accent mt-4 inline-block text-sm font-medium"
          href="/objects"
        >
          {t('common.backToObjects')}
        </a>
      </section>
    </main>
  )
}
