import { redirect } from '@tanstack/react-router'
import type { RouterContext } from '@/types/router'

export function requireAuth(context: RouterContext, href: string) {
  if (
    !context.auth.user ||
    (!context.auth.profile && context.auth.status !== 'profile_loading')
  ) {
    throw redirect({ to: '/login', search: { redirect: href } })
  }
}

export function safeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : '/'
  } catch {
    return '/'
  }
}
