import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: ({ context }) => {
    throw redirect({
      to: context.auth.profile?.role === 'manager' ? '/objects' : '/my-tasks',
    })
  },
})
