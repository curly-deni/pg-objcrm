import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState, ErrorState, LoadingState } from './page-state'

describe('page states', () => {
  it('supports a custom loading message', () => {
    render(<LoadingState label="Загружаем объект…" />)
    expect(screen.getByText('Загружаем объект…')).toBeInTheDocument()
  })

  it('shows an error message and lets the user retry', () => {
    const retry = vi.fn()
    render(<ErrorState error={new Error('Сервер недоступен')} retry={retry} />)

    expect(screen.getByText('Сервер недоступен')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('uses a generic localized message for unknown errors', () => {
    render(<ErrorState error={{ reason: 'unknown' }} />)
    expect(screen.getByText('Не удалось загрузить данные.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the supplied empty state copy', () => {
    render(<EmptyState title="Пусто" description="Добавьте запись." />)
    expect(screen.getByText('Пусто')).toBeInTheDocument()
    expect(screen.getByText('Добавьте запись.')).toBeInTheDocument()
  })
})
