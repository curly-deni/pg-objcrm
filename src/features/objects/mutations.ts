import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ObjectInput = { name: string; address: string }

export function useSaveObject(objectId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: ObjectInput) => {
      const request = objectId
        ? supabase
            .from('objects')
            .update(values)
            .eq('id', objectId)
            .select()
            .single()
        : supabase.from('objects').insert(values).select().single()
      const { data, error } = await request
      if (error) throw error
      return data
    },
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['objects'] }),
  })
}

export function useArchiveObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (objectId: string) => {
      const { error } = await supabase.rpc('archive_object', {
        p_object_id: objectId,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['objects'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ])
    },
  })
}
