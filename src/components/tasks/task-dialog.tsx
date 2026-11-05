import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useExecutors } from '@/features/tasks/queries'
import { useSaveTask } from '@/features/tasks/mutations'
import type { Database } from '@/types/database'
import { errorMessage } from '@/lib/format'

type TaskRow = Database['public']['Tables']['tasks']['Row']
type Values = { title: string; description: string; assignee_id: string }

export function TaskDialog({
  objectId,
  task,
}: {
  objectId: string
  task?: TaskRow
}) {
  const { t } = useTranslation()
  const schema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .trim()
          .min(1, t('validation.requiredName'))
          .max(200, t('validation.titleLimit200')),
        description: z.string().max(5000, t('validation.descriptionLimit5000')),
        assignee_id: z.uuid(t('validation.selectAssignee')),
      }),
    [t],
  )
  const [open, setOpen] = useState(false)
  const executors = useExecutors()
  const save = useSaveTask(task?.id)
  const assigneeCanChange =
    !task || task.status === 'new' || task.status === 'rework'
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      assignee_id: task?.assignee_id ?? '',
    },
  })

  useEffect(() => {
    if (open)
      form.reset({
        title: task?.title ?? '',
        description: task?.description ?? '',
        assignee_id: task?.assignee_id ?? '',
      })
  }, [open, task, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        ...values,
        object_id: objectId,
        description: values.description.trim() || null,
      })
      toast.success(task ? t('taskForm.saved') : t('taskForm.created'))
      setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{task ? t('taskForm.edit') : t('taskForm.create')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {task ? t('taskForm.edit') : t('taskForm.create')}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="task-title">{t('taskForm.title')}</Label>
            <Input
              id="task-title"
              autoFocus
              {...form.register('title')}
              aria-invalid={Boolean(form.formState.errors.title)}
            />
            {form.formState.errors.title && (
              <p className="text-negative text-xs">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">
              {t('taskForm.description')}
            </Label>
            <Textarea
              id="task-description"
              rows={4}
              {...form.register('description')}
              aria-invalid={Boolean(form.formState.errors.description)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-assignee">{t('taskForm.assignee')}</Label>
            {assigneeCanChange && executors.isLoading ? (
              <p className="text-muted-ink text-sm">
                {t('taskForm.loadingAssignees')}
              </p>
            ) : (
              <select
                id="task-assignee"
                className="border-control-line bg-sheet disabled:bg-muted-surface h-9 w-full rounded-md border px-3 text-sm"
                disabled={!assigneeCanChange}
                {...form.register('assignee_id')}
              >
                <option value="">{t('taskForm.selectAssignee')}</option>
                {executors.data?.map((executor) => (
                  <option key={executor.id} value={executor.id}>
                    {executor.name}
                  </option>
                ))}
              </select>
            )}
            {task && !assigneeCanChange && (
              <p className="text-muted-ink text-xs">
                {t('taskForm.assigneeLocked')}
              </p>
            )}
            {form.formState.errors.assignee_id && (
              <p className="text-negative text-xs">
                {form.formState.errors.assignee_id.message}
              </p>
            )}
            {executors.error && (
              <p className="text-negative text-xs">
                {errorMessage(executors.error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || !executors.data?.length}
            >
              {form.formState.isSubmitting
                ? t('taskForm.saving')
                : t('taskForm.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
