import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { errorMessage, formatDate, statusLabel } from './format'

describe('format helpers', () => {
  it.each([
    ['new', 'Новая'],
    ['in_progress', 'В работе'],
    ['in_review', 'На проверке'],
    ['accepted', 'Принята'],
    ['rework', 'На доработке'],
  ] as const)('translates status %s', (status, label) => {
    expect(statusLabel(status)).toBe(label)
  })

  it.each([
    [0, '0 задач'],
    [1, '1 задача'],
    [2, '2 задачи'],
    [5, '5 задач'],
    [11, '11 задач'],
    [21, '21 задача'],
    [22, '22 задачи'],
    [25, '25 задач'],
  ])('uses Russian plural forms for %i tasks', (count, expected) => {
    expect(i18n.t('objects.taskCount', { count })).toBe(expected)
  })

  it('formats a date with the active locale', () => {
    expect(formatDate('2026-01-02T12:30:00.000Z')).toContain('2026')
  })

  it('uses the actual error message and a localized fallback', () => {
    expect(errorMessage(new Error('Permission denied'))).toBe(
      'Permission denied',
    )
    expect(errorMessage('offline')).toBe(
      'Не удалось выполнить действие. Попробуйте ещё раз.',
    )
  })
})
