import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/auth-provider'
import { ErrorState, LoadingState } from '@/components/layout/page-state'
import { TaskList } from '@/components/tasks/task-list'
import { useObjects } from '@/features/objects/queries'
import { useTasks } from '@/features/tasks/queries'

export const Route = createFileRoute('/_authenticated/my-tasks')({
  component: MyTasksPage,
})

function MyTasksPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const tasks = useTasks({ assigneeId: user?.id })
  const objects = useObjects()

  if (tasks.isLoading || objects.isLoading)
    return <LoadingState label={t('common.loadingMyTasks')} />
  if (tasks.error)
    return <ErrorState error={tasks.error} retry={() => void tasks.refetch()} />
  if (objects.error)
    return (
      <ErrorState error={objects.error} retry={() => void objects.refetch()} />
    )

  return (
    <div className="w-full min-w-0">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('tasks.myTitle')}
        </h1>
        <p className="text-muted-ink mt-1 text-sm">{t('tasks.mySummary')}</p>
        <p className="mt-4 text-sm">
          {t('tasks.executorName', { name: profile?.name })}
        </p>
      </header>
      <section className="mt-6">
        <TaskList tasks={tasks.data} objects={objects.data} />
      </section>
    </div>
  )
}
