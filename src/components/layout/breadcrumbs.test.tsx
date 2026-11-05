import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Breadcrumbs } from './breadcrumbs'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    params?: { objectId?: string }
  }) => (
    <a
      href={to}
      data-object-id={params?.objectId}
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

describe('Breadcrumbs', () => {
  it('links back through an object to the current task', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Объекты', to: '/objects' },
          { label: 'Дом у парка', to: '/objects/$objectId', objectId: 'obj-1' },
          { label: 'Заменить смеситель' },
        ]}
      />,
    )

    expect(
      screen.getByRole('navigation', { name: 'Хлебные крошки' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Объекты' })).toHaveAttribute(
      'href',
      '/objects',
    )
    expect(screen.getByRole('link', { name: 'Дом у парка' })).toHaveAttribute(
      'href',
      '/objects/$objectId',
    )
    expect(screen.getByRole('link', { name: 'Дом у парка' })).toHaveAttribute(
      'data-object-id',
      'obj-1',
    )
    expect(screen.getByText('Заменить смеситель')).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders a single current crumb without inventing a link', () => {
    render(<Breadcrumbs items={[{ label: 'Объекты' }]} />)
    expect(screen.getByText('Объекты')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
