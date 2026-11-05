import type { Database } from '@/types/database'
import i18n from '@/i18n'

export type TaskStatus = Database['public']['Enums']['task_status']

export function statusLabel(status: TaskStatus) {
  return i18n.t(`status.${status}`)
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : i18n.t('common.actionFailed')
}
