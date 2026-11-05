import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { AuthProvider, useAuth } from '@/auth/auth-provider'
import { queryClient } from '@/lib/query-client'
import { router } from '@/router'
import '@/i18n'
import '@/index.css'

function RoutedApp() {
  const auth = useAuth()

  useEffect(() => {
    void router.invalidate()
  }, [auth.user?.id, auth.profile?.role, auth.status])

  return <RouterProvider router={router} context={{ auth }} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoutedApp />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
