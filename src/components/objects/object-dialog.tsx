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
import type { Database } from '@/types/database'
import { errorMessage } from '@/lib/format'
import { useSaveObject } from '@/features/objects/mutations'

type ObjectRow = Database['public']['Tables']['objects']['Row']
type Values = { name: string; address: string }

export function ObjectDialog({
  object,
  triggerLabel,
}: {
  object?: ObjectRow
  triggerLabel?: string
}) {
  const { t } = useTranslation()
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('validation.requiredName'))
          .max(160, t('validation.nameLimit160')),
        address: z
          .string()
          .trim()
          .min(1, t('validation.requiredAddress'))
          .max(300, t('validation.addressLimit300')),
      }),
    [t],
  )
  const [open, setOpen] = useState(false)
  const save = useSaveObject(object?.id)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: object?.name ?? '', address: object?.address ?? '' },
  })

  useEffect(() => {
    if (open)
      form.reset({ name: object?.name ?? '', address: object?.address ?? '' })
  }, [open, object, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
      toast.success(object ? t('objectForm.saved') : t('objectForm.created'))
      setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          {triggerLabel ??
            (object ? t('objectForm.edit') : t('objectForm.create'))}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {object ? t('objectForm.edit') : t('objectForm.create')}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="object-name">{t('objectForm.name')}</Label>
            <Input
              id="object-name"
              autoFocus
              {...form.register('name')}
              aria-invalid={Boolean(form.formState.errors.name)}
            />
            {form.formState.errors.name && (
              <p className="text-negative text-xs">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="object-address">{t('objectForm.address')}</Label>
            <Input
              id="object-address"
              {...form.register('address')}
              aria-invalid={Boolean(form.formState.errors.address)}
            />
            {form.formState.errors.address && (
              <p className="text-negative text-xs">
                {form.formState.errors.address.message}
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
            <Button type="submit" disabled={form.formState.isSubmitting}>
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
