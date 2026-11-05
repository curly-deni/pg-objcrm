import { createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import type { AuthContextValue } from '@/auth/auth-provider'

const emptyAuth: AuthContextValue = {
  user: null,
  profile: null,
  status: 'loading',
  error: null,
  signOut: async () => {},
  retry: async () => {},
}

export const router = createRouter({ routeTree, context: { auth: emptyAuth } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
