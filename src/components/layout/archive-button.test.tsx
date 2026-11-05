import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveButton } from './archive-button'

const mocks = vi.hoisted(() => ({ object: vi.fn(), task: vi.fn() }))
vi.mock('@/features/objects/mutations', () => ({
  useArchiveObject: () => ({ mutateAsync: mocks.object, isPending: false }),
}))
vi.mock('@/features/tasks/mutations', () => ({
  useArchiveTask: () => ({ mutateAsync: mocks.task, isPending: false }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('ArchiveButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for confirmation before archiving a task', async () => {
    const user = userEvent.setup()
    render(<ArchiveButton id="task-1" kind="task" />)

    await user.click(screen.getByRole('button', { name: 'В архив' }))
    expect(
      screen.getByText(
        'Задача скроется из активных списков, история останется.',
      ),
    ).toBeInTheDocument()
    expect(mocks.task).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'В архив' }))

    expect(mocks.task).toHaveBeenCalledWith('task-1')
    expect(mocks.object).not.toHaveBeenCalled()
  })

  it('uses the object archive mutation and keeps the dialog open on error', async () => {
    mocks.object.mockRejectedValueOnce(new Error('Есть активные задачи'))
    const user = userEvent.setup()
    render(<ArchiveButton id="object-1" kind="object" />)

    await user.click(screen.getByRole('button', { name: 'В архив' }))
    expect(
      screen.getByText('У объекта не должно быть активных задач.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'В архив' }))

    expect(mocks.object).toHaveBeenCalledWith('object-1')
    expect(mocks.task).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})
