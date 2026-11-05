import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/auth-provider'
import { ArchiveButton } from '@/components/layout/archive-button'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from '@/components/layout/page-state'
import { StatusBadge } from '@/components/layout/status-badge'
import { TaskActions } from '@/components/tasks/task-actions'
import { TaskDialog } from '@/components/tasks/task-dialog'
import { useObject } from '@/features/objects/queries'
import { useExecutors, useTask, useTaskHistory } from '@/features/tasks/queries'
import { formatDate, statusLabel } from '@/lib/format'

export const Route = createFileRoute('/_authenticated/tasks/$taskId')({
  component: TaskDetailPage,
})

function TaskDetailPage() {
  const { t } = useTranslation()
  const { taskId } = Route.useParams()
  const { user, profile } = useAuth()
  const task = useTask(taskId)
  const object = useObject(task.data?.object_id ?? '')
  const history = useTaskHistory(taskId)
  const executors = useExecutors()
  const manager = profile?.role === 'manager'

  if (task.isLoading) return <LoadingState label={t('common.loadingTask')} />
  if (task.error)
    return <ErrorState error={task.error} retry={() => void task.refetch()} />
  if (!task.data)
    return (
      <EmptyState
        title={t('tasks.unavailable')}
        description={t('tasks.unavailableDescription')}
      />
    )

  const currentTask = task.data
  const archived = currentTask.deleted_at !== null
  const executorName = executors.data?.find(
    (executor) => executor.id === currentTask.assignee_id,
  )?.name

  return (
    <div className="w-full min-w-0">
      <Breadcrumbs
        items={
          object.data
            ? [
                { label: t('breadcrumbs.objects'), to: '/objects' },
                {
                  label: object.data.name,
                  to: '/objects/$objectId',
                  objectId: currentTask.object_id,
                },
                { label: currentTask.title },
              ]
            : [
                { label: t('breadcrumbs.objects'), to: '/objects' },
                { label: currentTask.title },
              ]
        }
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {currentTask.title}
            </h1>
            <StatusBadge status={currentTask.status} />
            {archived && (
              <span className="text-muted-ink text-xs">
                {t('tasks.archived')}
              </span>
            )}
          </div>
          {object.data && (
            <p className="text-muted-ink mt-2 text-sm">{object.data.address}</p>
          )}
        </div>
        {manager && !archived && (
          <div className="flex flex-wrap gap-2">
            <TaskDialog objectId={currentTask.object_id} task={currentTask} />
            <ArchiveButton id={currentTask.id} kind="task" />
          </div>
        )}
      </header>
      {currentTask.description && (
        <section className="mt-6 w-full">
          <h2 className="text-sm font-semibold">{t('tasks.description')}</h2>
          <p className="text-muted-ink mt-2 text-sm leading-6 whitespace-pre-wrap">
            {currentTask.description}
          </p>
        </section>
      )}
      <div className="bg-muted-surface mt-6 flex flex-wrap gap-x-6 gap-y-3 rounded-lg p-4 text-sm">
        <div className="text-muted-ink flex items-center gap-2">
          <UserRound className="size-4" />
          {executorName ??
            (currentTask.assignee_id === user?.id
              ? profile?.name
              : t('tasks.assignee'))}
        </div>
        <div className="text-muted-ink flex items-center gap-2">
          <CalendarDays className="size-4" />
          {t('tasks.created', { date: formatDate(currentTask.created_at) })}
        </div>
      </div>
      {!archived && (
        <div className="mt-5">
          <TaskActions taskId={currentTask.id} status={currentTask.status} />
        </div>
      )}
      <section className="mt-10 w-full">
        <h2 className="text-base font-semibold">{t('tasks.history')}</h2>
        <p className="text-muted-ink mt-1 text-sm">
          {t('tasks.historySummary')}
        </p>
        {history.isLoading ? (
          <LoadingState />
        ) : history.error ? (
          <ErrorState
            error={history.error}
            retry={() => void history.refetch()}
          />
        ) : !history.data?.length ? (
          <p className="text-muted-ink mt-5 text-sm">
            {t('tasks.historyEmpty')}
          </p>
        ) : (
          <ol className="mt-5 space-y-0">
            {history.data.map((entry, index) => {
              const actorName =
                entry.actor_id === user?.id
                  ? profile?.name
                  : (executors.data?.find(
                      (executor) => executor.id === entry.actor_id,
                    )?.name ?? t('tasks.createdBy'))
              return (
                <li
                  key={entry.id}
                  className="relative flex gap-4 pb-7 last:pb-0"
                >
                  <span className="relative flex w-3 shrink-0 justify-center">
                    <span className="bg-accent ring-sheet relative z-10 mt-1 size-2.5 rounded-full ring-4" />
                    {index < history.data!.length - 1 && (
                      <span className="bg-line absolute top-3 bottom-0 w-px" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {entry.old_status
                          ? `${statusLabel(entry.old_status)} → `
                          : ''}
                        {statusLabel(entry.new_status)}
                      </p>
                      <time className="text-muted-ink text-xs">
                        {formatDate(entry.created_at)}
                      </time>
                    </div>
                    <p className="text-muted-ink mt-1 text-xs">{actorName}</p>
                    {entry.comment && (
                      <p className="bg-muted-surface mt-2 rounded-md px-3 py-2 text-sm whitespace-pre-wrap">
                        {entry.comment}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
