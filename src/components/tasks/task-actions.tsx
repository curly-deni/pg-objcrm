import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/auth-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTransitionTask } from '@/features/tasks/mutations'
import { errorMessage } from '@/lib/format'

type ReworkValues = { comment: string }

export function TaskActions({
  taskId,
  status,
}: {
  taskId: string
  status: 'new' | 'in_progress' | 'in_review' | 'accepted' | 'rework'
}) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const reworkSchema = useMemo(
    () =>
      z.object({
        comment: z
          .string()
          .trim()
          .min(1, t('tasks.reworkRequired'))
          .max(2000, t('tasks.reworkLimit')),
      }),
    [t],
  )
  const transition = useTransitionTask()
  const [reworkOpen, setReworkOpen] = useState(false)
  const form = useForm<ReworkValues>({
    resolver: zodResolver(reworkSchema),
    defaultValues: { comment: '' },
  })

  const run = async (
    nextStatus: 'in_progress' | 'in_review' | 'accepted' | 'rework',
    comment?: string,
  ) => {
    try {
      await transition.mutateAsync({ taskId, status: nextStatus, comment })
      toast.success(t('tasks.statusUpdated'))
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    }
  }

  const submitRework = form.handleSubmit(async ({ comment }) => {
    if (await run('rework', comment)) setReworkOpen(false)
  })

  if (
    profile?.role === 'executor' &&
    (status === 'new' || status === 'rework')
  ) {
    return (
      <Button
        disabled={transition.isPending}
        onClick={() => void run('in_progress')}
      >
        {t('tasks.take')}
      </Button>
    )
  }
  if (profile?.role === 'executor' && status === 'in_progress') {
    return (
      <Button
        disabled={transition.isPending}
        onClick={() => void run('in_review')}
      >
        {t('tasks.sendForReview')}
      </Button>
    )
  }
  if (profile?.role === 'manager' && status === 'in_review') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={transition.isPending}
          onClick={() => void run('accepted')}
        >
          {t('tasks.accept')}
        </Button>
        <Button variant="outline" onClick={() => setReworkOpen(true)}>
          {t('tasks.returnForRework')}
        </Button>
        <Dialog
          open={reworkOpen}
          onOpenChange={(open) => {
            setReworkOpen(open)
            if (!open) form.reset()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('tasks.reworkTitle')}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => void submitRework(event)}
            >
              <div className="space-y-1.5">
                <Label htmlFor="rework-comment">
                  {t('tasks.reworkPrompt')}
                </Label>
                <Textarea
                  id="rework-comment"
                  autoFocus
                  rows={4}
                  {...form.register('comment')}
                  aria-invalid={Boolean(form.formState.errors.comment)}
                />
                {form.formState.errors.comment && (
                  <p className="text-negative text-xs">
                    {form.formState.errors.comment.message}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReworkOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={transition.isPending}>
                  {transition.isPending
                    ? t('tasks.reworkSubmitting')
                    : t('tasks.returnForRework')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  return null
}
