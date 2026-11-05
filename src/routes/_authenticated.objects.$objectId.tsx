import { createFileRoute } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/auth-provider'
import { ArchiveButton } from '@/components/layout/archive-button'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/layout/page-state'
import { TaskDialog } from '@/components/tasks/task-dialog'
import { TaskList } from '@/components/tasks/task-list'
import { ObjectDialog } from '@/components/objects/object-dialog'
import { useObject } from '@/features/objects/queries'
import { useTasks } from '@/features/tasks/queries'

export const Route = createFileRoute('/_authenticated/objects/$objectId')({
  component: ObjectDetailPage,
})

function ObjectDetailPage() {
  const { t } = useTranslation()
  const { objectId } = Route.useParams()
  const { profile } = useAuth()
  const object = useObject(objectId)
  const tasks = useTasks({ objectId })
  const manager = profile?.role === 'manager'

  if (object.isLoading)
    return <LoadingState label={t('common.loadingObject')} />
  if (object.error)
    return (
      <ErrorState error={object.error} retry={() => void object.refetch()} />
    )
  if (!object.data)
    return (
      <EmptyState
        title={t('objects.unavailable')}
        description={t('objects.unavailableDescription')}
      />
    )

  return (
    <div className="w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: t('breadcrumbs.objects'), to: '/objects' },
          { label: object.data.name },
        ]}
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {object.data.name}
          </h1>
          <p className="text-muted-ink mt-2 flex items-center gap-1.5 text-sm">
            <MapPin className="size-4" />
            {object.data.address}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {manager && (
            <>
              <ObjectDialog object={object.data} />
              <ArchiveButton id={object.data.id} kind="object" />
            </>
          )}
        </div>
      </header>
      <section className="mt-9 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('tasks.title')}</h2>
            <p className="text-muted-ink mt-0.5 text-sm">
              {t('tasks.objectSummary')}
            </p>
          </div>
          {manager && <TaskDialog objectId={object.data.id} />}
        </div>
        {tasks.error ? (
          <ErrorState error={tasks.error} retry={() => void tasks.refetch()} />
        ) : !tasks.isLoading && !tasks.data?.length ? (
          <EmptyState
            title={t('tasks.emptyTitle')}
            description={
              manager ? t('tasks.emptyManager') : t('tasks.emptyExecutor')
            }
          />
        ) : (
          <TaskList
            tasks={tasks.data}
            showObject={false}
            isLoading={tasks.isLoading}
            error={tasks.error}
            onRetry={() => void tasks.refetch()}
          />
        )}
      </section>
    </div>
  )
}
