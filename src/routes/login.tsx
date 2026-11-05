import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { safeReturnPath } from '@/auth/route-guards'
import { useAuth } from '@/auth/auth-provider'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/format'

const schema = z.object({
  email: z.email(i18n.t('login.invalidEmail')),
  password: z.string().min(1, i18n.t('login.requiredPassword')),
})
type LoginValues = z.infer<typeof schema>

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const search = Route.useSearch()
  const auth = useAuth()
  const [serverError, setServerError] = useState('')
  const [pendingReturn, setPendingReturn] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (!pendingReturn || auth.status !== 'ready') return

    router.history.replace(pendingReturn)
    void router.invalidate()
    setPendingReturn(null)
  }, [auth.status, pendingReturn, router])

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setServerError('')
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setServerError(errorMessage(error))
      return
    }
    setPendingReturn(safeReturnPath(search.redirect))
  })

  return (
    <main className="bg-ground grid min-h-screen place-items-center p-5">
      <section className="border-line bg-sheet w-full max-w-sm rounded-2xl border p-7">
        <div className="flex items-center gap-3">
          <span className="bg-accent text-paper-highlight grid size-10 place-items-center rounded-lg text-sm font-semibold tabular-nums">
            2B
          </span>
          <div>
            <p className="text-sm font-semibold">2B Studio</p>
            <p className="text-muted-ink text-xs">{t('brand.product')}</p>
          </div>
        </div>
        <h1 className="mt-8 text-xl font-semibold">{t('login.title')}</h1>
        <p className="text-muted-ink mt-1 text-sm">{t('login.summary')}</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => void onSubmit(event)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('login.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              {...form.register('email')}
              aria-invalid={Boolean(form.formState.errors.email)}
            />
            {form.formState.errors.email && (
              <p className="text-negative text-xs">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('login.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
              aria-invalid={Boolean(form.formState.errors.password)}
            />
            {form.formState.errors.password && (
              <p className="text-negative text-xs">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
          {serverError && (
            <p role="alert" className="text-negative text-sm">
              {serverError}
            </p>
          )}
          <Button
            className="w-full"
            type="submit"
            disabled={form.formState.isSubmitting || pendingReturn !== null}
          >
            {pendingReturn
              ? t('login.loadingProfile')
              : form.formState.isSubmitting
                ? t('login.submitting')
                : t('login.submit')}
          </Button>
        </form>
      </section>
    </main>
  )
}
