import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useArchiveObject } from '@/features/objects/mutations'
import { useArchiveTask } from '@/features/tasks/mutations'
import { errorMessage } from '@/lib/format'

export function ArchiveButton({
  id,
  kind,
}: {
  id: string
  kind: 'object' | 'task'
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const archiveObject = useArchiveObject()
  const archiveTask = useArchiveTask()
  const isPending = archiveObject.isPending || archiveTask.isPending

  const onConfirm = async () => {
    try {
      if (kind === 'object') await archiveObject.mutateAsync(id)
      else await archiveTask.mutateAsync(id)
      toast.success(
        kind === 'object'
          ? t('archive.objectSuccess')
          : t('archive.taskSuccess'),
      )
      setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{t('archive.button')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('archive.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {kind === 'object'
              ? t('archive.objectDescription')
              : t('archive.taskDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            {isPending ? t('archive.pending') : t('archive.button')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
