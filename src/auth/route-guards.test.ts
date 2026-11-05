import { describe, expect, it } from 'vitest'
import { requireAuth, safeReturnPath } from './route-guards'
import type { RouterContext } from '@/types/router'

const context = (overrides: Partial<RouterContext['auth']> = {}) =>
  ({
    auth: {
      user: null,
      profile: null,
      status: 'unauthenticated',
      error: null,
      signOut: async () => {},
      retry: async () => {},
      ...overrides,
    },
  }) as RouterContext

describe('requireAuth', () => {
  it('redirects unauthenticated visitors to login with the requested URL', () => {
    try {
      requireAuth(context(), '/objects?filter=active')
      throw new Error('Expected a redirect')
    } catch (error) {
      expect(error).toMatchObject({
        options: {
          to: '/login',
          search: { redirect: '/objects?filter=active' },
        },
      })
    }
  })

  it('allows an authenticated user while their profile is loading', () => {
    expect(() =>
      requireAuth(
        context({
          user: { id: 'user-1' } as RouterContext['auth']['user'],
          status: 'profile_loading',
        }),
        '/objects',
      ),
    ).not.toThrow()
  })

  it('blocks an authenticated user without a profile after loading', () => {
    expect(() =>
      requireAuth(
        context({
          user: { id: 'user-1' } as RouterContext['auth']['user'],
          status: 'profile_missing',
        }),
        '/objects',
      ),
    ).toThrow()
  })
})

describe('safeReturnPath', () => {
  it.each([
    ['/objects', '/objects'],
    ['/objects?id=1#tasks', '/objects?id=1#tasks'],
    [undefined, '/'],
    ['objects', '/'],
    ['//attacker.example/path', '/'],
    ['https://attacker.example/path', '/'],
  ])('keeps only same-site absolute paths (%s)', (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected)
  })
})
