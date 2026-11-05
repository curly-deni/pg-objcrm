import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AnchorHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/auth-provider'
import { AppShell } from './app-shell'

const mocks = vi.hoisted(() => ({ useRouterState: vi.fn(), signOut: vi.fn() }))
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
  useRouterState: mocks.useRouterState,
}))
vi.mock('@/auth/auth-provider', () => ({ useAuth: vi.fn() }))

function setProfile(role: 'manager' | 'executor') {
  vi.mocked(useAuth).mockReturnValue({
    profile: { role, name: 'Анна', id: 'user-1' },
    signOut: mocks.signOut,
  } as never)
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useRouterState.mockReturnValue('/objects')
  })

  it('shows the manager navigation, profile, and logout in the sidebar', async () => {
    setProfile('manager')
    const user = userEvent.setup()
    const { container } = render(<AppShell>Список объектов</AppShell>)

    expect(
      screen.getByRole('navigation', { name: 'Основная навигация' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Объекты' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.queryByRole('link', { name: 'Мои задачи' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Постановщик')).toBeInTheDocument()
    expect(container.querySelector('main')).toHaveClass('w-full')

    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('adds executor task navigation and opens the mobile menu', async () => {
    setProfile('executor')
    const user = userEvent.setup()
    render(<AppShell>Мои работы</AppShell>)

    expect(screen.getByRole('link', { name: 'Мои задачи' })).toHaveAttribute(
      'href',
      '/my-tasks',
    )
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }))
    expect(
      screen.getAllByRole('button', { name: 'Закрыть меню' }),
    ).toHaveLength(2)
    expect(screen.getByText('Исполнитель')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Мои задачи' }))
    expect(document.querySelector('aside')).toHaveClass(
      'invisible',
      '-translate-x-full',
    )
  })
})
