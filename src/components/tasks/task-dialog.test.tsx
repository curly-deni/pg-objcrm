import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveTask } from '@/features/tasks/mutations'
import { useExecutors } from '@/features/tasks/queries'
import { TaskDialog } from './task-dialog'

vi.mock('@/features/tasks/mutations', () => ({ useSaveTask: vi.fn() }))
vi.mock('@/features/tasks/queries', () => ({ useExecutors: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mutateAsync = vi.fn()

describe('TaskDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSaveTask).mockReturnValue({ mutateAsync } as never)
    vi.mocked(useExecutors).mockReturnValue({
      data: [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Анна' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Илья' },
      ],
      isLoading: false,
      error: null,
    } as never)
  })

  it('requires a title and an executor', async () => {
    const user = userEvent.setup()
    render(<TaskDialog objectId="object-1" />)
    await user.click(screen.getByRole('button', { name: 'Новая задача' }))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByText('Введите название')).toBeInTheDocument()
    expect(screen.getAllByText('Выберите исполнителя')).toHaveLength(2)
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('trims the title and converts a blank description to null', async () => {
    const user = userEvent.setup()
    render(<TaskDialog objectId="object-1" />)
    await user.click(screen.getByRole('button', { name: 'Новая задача' }))
    await user.type(screen.getByLabelText('Название'), '  Проверить щиток  ')
    await user.type(screen.getByLabelText('Описание'), '   ')
    await user.selectOptions(
      screen.getByLabelText('Исполнитель'),
      '22222222-2222-4222-8222-222222222222',
    )
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      title: 'Проверить щиток',
      description: null,
      assignee_id: '22222222-2222-4222-8222-222222222222',
      object_id: 'object-1',
    })
  })

  it('locks reassignment when a task is already in progress', async () => {
    const user = userEvent.setup()
    render(
      <TaskDialog
        objectId="object-1"
        task={{
          id: 'task-1',
          object_id: 'object-1',
          title: 'Проверить щиток',
          description: null,
          assignee_id: '11111111-1111-4111-8111-111111111111',
          created_by: 'manager-1',
          status: 'in_progress',
          created_at: '2026-01-01T00:00:00Z',
          deleted_at: null,
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Изменить задачу' }))

    expect(screen.getByLabelText('Исполнитель')).toBeDisabled()
    expect(
      screen.getByText(
        'Переназначение доступно в статусе «Новая» или «На доработке».',
      ),
    ).toBeInTheDocument()
  })
})
