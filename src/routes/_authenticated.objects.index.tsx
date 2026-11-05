import { createFileRoute, Link } from '@tanstack/react-router'
import { MapPin, PackageOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ObjectDialog } from '@/components/objects/object-dialog'
import { ErrorState, LoadingState } from '@/components/layout/page-state'
import { StatusBadge } from '@/components/layout/status-badge'
import { useObjects } from '@/features/objects/queries'
import { useTasks } from '@/features/tasks/queries'
import { useAuth } from '@/auth/auth-provider'

export const Route = createFileRoute('/_authenticated/objects/')({
  component: ObjectsPage,
})

function ObjectsPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const objects = useObjects()
  const tasks = useTasks()
  const manager = profile?.role === 'manager'

  if (objects.isLoading || tasks.isLoading)
    return <LoadingState label={t('common.loadingObjects')} />
  if (objects.error)
    return (
      <ErrorState error={objects.error} retry={() => void objects.refetch()} />
    )
  if (tasks.error)
    return <ErrorState error={tasks.error} retry={() => void tasks.refetch()} />

  const counts = new Map<string, Map<string, number>>()
  for (const task of tasks.data ?? []) {
    const objectCounts = counts.get(task.object_id) ?? new Map<string, number>()
    objectCounts.set(task.status, (objectCounts.get(task.status) ?? 0) + 1)
    counts.set(task.object_id, objectCounts)
  }

  return (
    <div className="w-full min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('objects.title')}
          </h1>
          <p className="text-muted-ink mt-1 text-sm">{t('objects.summary')}</p>
        </div>
        {manager && <ObjectDialog />}
      </header>
      {!objects.data?.length ? (
        <div className="border-control-line mt-8 rounded-xl border border-dashed px-6 py-16 text-center">
          <PackageOpen className="text-muted-ink mx-auto size-8" />
          <p className="mt-3 text-sm font-medium">{t('objects.emptyTitle')}</p>
          <p className="text-muted-ink mt-1 text-sm">
            {manager ? t('objects.emptyManager') : t('objects.emptyExecutor')}
          </p>
          {manager && (
            <div className="mt-4">
              <ObjectDialog triggerLabel={t('objects.create')} />
            </div>
          )}
        </div>
      ) : (
        <div className="divide-rule mt-7 divide-y border-y">
          {objects.data.map((object) => {
            const objectTasks = counts.get(object.id)
            const taskCount = Array.from(objectTasks?.values() ?? []).reduce(
              (total, count) => total + count,
              0,
            )
            const activeStatuses = [
              'new',
              'in_progress',
              'in_review',
              'rework',
            ] as const
            return (
              <Link
                key={object.id}
                to="/objects/$objectId"
                params={{ objectId: object.id }}
                className="group hover:bg-muted-surface flex flex-wrap items-center justify-between gap-4 px-3 py-5 transition-colors focus-visible:relative focus-visible:z-10"
              >
                <div className="min-w-0">
                  <h2 className="group-hover:text-accent truncate text-base font-semibold">
                    {object.name}
                  </h2>
                  <p className="text-muted-ink mt-1 flex items-center gap-1.5 text-sm">
                    <MapPin className="size-3.5 shrink-0" />
                    {object.address}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                  <span className="text-muted-ink text-sm">
                    {t('objects.taskCount', { count: taskCount })}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeStatuses
                      .filter((status) => objectTasks?.get(status))
                      .map((status) => (
                        <StatusBadge key={status} status={status} />
                      ))}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <p className="text-muted-ink mt-3 text-right text-xs">
        {t('objects.count', { count: objects.data?.length ?? 0 })}
      </p>
    </div>
  )
}
