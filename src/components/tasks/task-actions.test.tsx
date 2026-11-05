import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/auth-provider'
import { useTransitionTask } from '@/features/tasks/mutations'
import { TaskActions } from './task-actions'

vi.mock('@/auth/auth-provider', () => ({ useAuth: vi.fn() }))
vi.mock('@/features/tasks/mutations', () => ({ useTransitionTask: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mutateAsync = vi.fn()
const setRole = (role: 'manager' | 'executor' | null) => {
  vi.mocked(useAuth).mockReturnValue({
    profile: role ? ({ role } as never) : null,
  } as never)
}

describe('TaskActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTransitionTask).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never)
  })

  it.each([
    ['new', 'Взять в работу', 'in_progress'],
    ['rework', 'Взять в работу', 'in_progress'],
    ['in_progress', 'Отправить на проверку', 'in_review'],
  ] as const)(
    'shows executor action for %s and performs the allowed transition',
    async (status, label, nextStatus) => {
      setRole('executor')
      const user = userEvent.setup()
      render(<TaskActions taskId="task-1" status={status} />)

      await user.click(screen.getByRole('button', { name: label }))

      expect(mutateAsync).toHaveBeenCalledWith({
        taskId: 'task-1',
        status: nextStatus,
        comment: undefined,
      })
    },
  )

  it('does not show transition actions to an executor after review', () => {
    setRole('executor')
    const { container } = render(
      <TaskActions taskId="task-1" status="in_review" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('lets a manager accept a task in review', async () => {
    setRole('manager')
    const user = userEvent.setup()
    render(<TaskActions taskId="task-1" status="in_review" />)

    await user.click(screen.getByRole('button', { name: 'Принять задачу' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: 'accepted',
      comment: undefined,
    })
  })

  it('requires a non-empty comment before returning a task for rework', async () => {
    setRole('manager')
    const user = userEvent.setup()
    render(<TaskActions taskId="task-1" status="in_review" />)

    await user.click(
      screen.getByRole('button', { name: 'Вернуть на доработку' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Вернуть на доработку' }),
    )

    expect(
      await screen.findByText('Напишите, что нужно доработать.'),
    ).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('sends the manager comment when returning a task for rework', async () => {
    setRole('manager')
    const user = userEvent.setup()
    render(<TaskActions taskId="task-1" status="in_review" />)

    await user.click(
      screen.getByRole('button', { name: 'Вернуть на доработку' }),
    )
    await user.type(
      screen.getByLabelText('Что нужно доработать?'),
      'Добавить фото счётчика',
    )
    await user.click(
      screen.getByRole('button', { name: 'Вернуть на доработку' }),
    )

    expect(mutateAsync).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: 'rework',
      comment: 'Добавить фото счётчика',
    })
  })

  it('shows no actions after a task is accepted', () => {
    setRole('manager')
    const { container } = render(
      <TaskActions taskId="task-1" status="accepted" />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
