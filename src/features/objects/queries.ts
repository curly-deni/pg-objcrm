import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { supabase } from '@/lib/supabase'

export function useObjects() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['objects', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useObject(objectId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['objects', user?.id, objectId],
    enabled: Boolean(user && objectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .eq('id', objectId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
