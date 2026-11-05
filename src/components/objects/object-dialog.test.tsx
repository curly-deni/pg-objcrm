import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveObject } from '@/features/objects/mutations'
import { ObjectDialog } from './object-dialog'

vi.mock('@/features/objects/mutations', () => ({ useSaveObject: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mutateAsync = vi.fn()

describe('ObjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSaveObject).mockReturnValue({ mutateAsync } as never)
  })

  it('validates required fields without calling the save mutation', async () => {
    const user = userEvent.setup()
    render(<ObjectDialog />)
    await user.click(screen.getByRole('button', { name: 'Новый объект' }))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByText('Введите название')).toBeInTheDocument()
    expect(await screen.findByText('Введите адрес')).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('trims input and saves a new object', async () => {
    const user = userEvent.setup()
    render(<ObjectDialog />)
    await user.click(screen.getByRole('button', { name: 'Новый объект' }))
    await user.type(screen.getByLabelText('Название'), '  Дом у парка  ')
    await user.type(screen.getByLabelText('Адрес'), '  Лесная, 8  ')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      name: 'Дом у парка',
      address: 'Лесная, 8',
    })
  })
})
