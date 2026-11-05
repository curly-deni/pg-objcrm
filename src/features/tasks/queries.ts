import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { supabase } from '@/lib/supabase'

export function useTasks(
  filters: { objectId?: string; assigneeId?: string } = {},
) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', user?.id, filters],
    enabled: Boolean(user),
    queryFn: async () => {
      let request = supabase
        .from('tasks')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (filters.objectId) request = request.eq('object_id', filters.objectId)
      if (filters.assigneeId)
        request = request.eq('assignee_id', filters.assigneeId)
      const { data, error } = await request
      if (error) throw error
      return data
    },
  })
}

export function useTask(taskId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', user?.id, taskId],
    enabled: Boolean(user && taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useTaskHistory(taskId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['task-history', user?.id, taskId],
    enabled: Boolean(user && taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_status_history')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useExecutors() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['executors', profile?.id],
    enabled: profile?.role === 'manager',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'executor')
        .order('name')
      if (error) throw error
      return data
    },
  })
}
