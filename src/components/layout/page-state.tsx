import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div className="text-muted-ink flex min-h-48 items-center justify-center gap-2 text-sm">
      <LoaderCircle className="size-4 animate-spin" />
      {label ?? t('common.loading')}
    </div>
  )
}

export function ErrorState({
  error,
  retry,
}: {
  error: unknown
  retry?: () => void
}) {
  const { t } = useTranslation()
  const message =
    error instanceof Error ? error.message : t('common.loadFailed')
  return (
    <div className="border-line bg-muted-surface rounded-lg border p-4">
      <p className="text-negative text-sm">{message}</p>
      {retry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-control-line rounded-lg border border-dashed px-5 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-ink mt-1 text-sm">{description}</p>
    </div>
  )
}
