import { fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/auth-provider'
import { useExecutors } from '@/features/tasks/queries'
import { TaskList } from './task-list'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    params?: unknown
  }) => (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
    >
      {children}
    </a>
  ),
}))
vi.mock('@/auth/auth-provider', () => ({ useAuth: vi.fn() }))
vi.mock('@/features/tasks/queries', () => ({ useExecutors: vi.fn() }))

const task = {
  id: 'task-1',
  object_id: 'object-1',
  title: 'Заменить смеситель',
  description: null,
  assignee_id: 'executor-1',
  created_by: 'manager-1',
  status: 'new' as const,
  created_at: '2026-01-01T10:00:00.000Z',
  deleted_at: null,
}

describe('TaskList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useExecutors).mockReturnValue({
      data: [{ id: 'executor-1', name: 'Анна' }],
    } as never)
  })

  it('shows the assignee column for managers', () => {
    vi.mocked(useAuth).mockReturnValue({
      profile: { role: 'manager' },
    } as never)
    render(
      <TaskList
        tasks={[task]}
        objects={[{ id: 'object-1', name: 'Дом у парка' } as never]}
      />,
    )

    expect(screen.getByText('Анна')).toBeInTheDocument()
    expect(screen.getByText('Дом у парка')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Заменить смеситель/ }),
    ).toHaveAttribute('href', '/tasks/$taskId')
  })

  it('does not expose the assignee column to executors', () => {
    vi.mocked(useAuth).mockReturnValue({
      profile: { role: 'executor' },
    } as never)
    render(<TaskList tasks={[task]} showObject={false} />)

    expect(screen.queryByText('Исполнитель')).not.toBeInTheDocument()
    expect(screen.queryByText('Анна')).not.toBeInTheDocument()
  })

  it('renders loading, empty and retryable error states', () => {
    vi.mocked(useAuth).mockReturnValue({
      profile: { role: 'manager' },
    } as never)
    const { rerender } = render(<TaskList isLoading />)
    expect(screen.getByText('Загружаем…')).toBeInTheDocument()

    rerender(<TaskList tasks={[]} />)
    expect(screen.getByText('Задач пока нет')).toBeInTheDocument()

    const onRetry = vi.fn()
    rerender(<TaskList error={new Error('Нет связи')} onRetry={onRetry} />)
    expect(screen.getByText('Нет связи')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
