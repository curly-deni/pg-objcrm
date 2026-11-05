import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/auth-provider'
import { StatusBadge } from '@/components/layout/status-badge'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/layout/page-state'
import { useExecutors } from '@/features/tasks/queries'
import { formatDate } from '@/lib/format'
import type { Database } from '@/types/database'

type TaskRow = Database['public']['Tables']['tasks']['Row']
type ObjectRow = Database['public']['Tables']['objects']['Row']

export function TaskList({
  tasks,
  objects,
  showObject = true,
  showAssignee,
  isLoading,
  error,
  onRetry,
}: {
  tasks?: TaskRow[]
  objects?: ObjectRow[]
  showObject?: boolean
  showAssignee?: boolean
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const displayAssignee = showAssignee ?? profile?.role === 'manager'
  const desktopColumns =
    showObject && displayAssignee
      ? 'md:grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_minmax(130px,1fr)_auto]'
      : showObject || displayAssignee
        ? 'md:grid-cols-[minmax(220px,2fr)_minmax(130px,1fr)_auto]'
        : 'md:grid-cols-[minmax(0,1fr)_auto]'
  const executors = useExecutors()
  const objectNames = new Map(
    objects?.map((object) => [object.id, object.name]),
  )
  const executorNames = new Map(
    executors.data?.map((executor) => [executor.id, executor.name]),
  )

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} retry={onRetry} />
  if (!tasks?.length)
    return (
      <EmptyState
        title={t('tasks.emptyTitle')}
        description={t('tasks.emptyDescription')}
      />
    )

  return (
    <div>
      <div
        className={`text-muted-ink grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 py-3 text-xs font-medium ${desktopColumns}`}
      >
        <span>{t('table.task')}</span>
        {showObject && (
          <span className="hidden md:block">{t('table.object')}</span>
        )}
        {displayAssignee && (
          <span className="hidden md:block">{t('table.assignee')}</span>
        )}
        <span>{t('table.status')}</span>
      </div>
      {tasks.map((task, index) => (
        <Link
          key={task.id}
          to="/tasks/$taskId"
          params={{ taskId: task.id }}
          className={`hover:bg-muted-surface grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3 py-3 transition-colors focus-visible:relative focus-visible:z-10 ${desktopColumns} ${index > 0 ? 'border-rule border-t' : ''}`}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {task.title}
            </span>
            <span className="text-muted-ink mt-0.5 block text-xs md:hidden">
              {showObject
                ? `${objectNames.get(task.object_id) ?? t('table.object')} — `
                : ''}
              {formatDate(task.created_at)}
            </span>
          </span>
          {showObject && (
            <span className="text-muted-ink hidden truncate text-sm md:block">
              {objectNames.get(task.object_id) ?? t('table.object')}
            </span>
          )}
          {displayAssignee && (
            <span className="text-muted-ink hidden truncate text-sm md:block">
              {executorNames.get(task.assignee_id) ?? t('table.assignee')}
            </span>
          )}
          <span className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            <ArrowUpRight className="text-muted-ink hidden size-4 md:block" />
          </span>
        </Link>
      ))}
    </div>
  )
}
