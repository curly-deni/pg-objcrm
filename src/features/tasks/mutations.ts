import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type TaskInput = {
  object_id: string
  title: string
  description: string | null
  assignee_id: string
}

function useRefreshTaskData() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['objects'] }),
      queryClient.invalidateQueries({ queryKey: ['task-history'] }),
    ])
  }
}

export function useSaveTask(taskId?: string) {
  const refresh = useRefreshTaskData()
  return useMutation({
    mutationFn: async (values: TaskInput) => {
      const request = taskId
        ? supabase
            .from('tasks')
            .update({
              title: values.title,
              description: values.description,
              assignee_id: values.assignee_id,
            })
            .eq('id', taskId)
            .select()
            .single()
        : supabase.from('tasks').insert(values).select().single()
      const { data, error } = await request
      if (error) throw error
      return data
    },
    onSuccess: refresh,
  })
}

export function useTransitionTask() {
  const refresh = useRefreshTaskData()
  return useMutation({
    mutationFn: async (values: {
      taskId: string
      status: 'in_progress' | 'in_review' | 'accepted' | 'rework'
      comment?: string
    }) => {
      const { data, error } = await supabase.rpc('transition_task', {
        p_task_id: values.taskId,
        p_new_status: values.status,
        ...(values.comment ? { p_comment: values.comment } : {}),
      })
      if (error) throw error
      return data
    },
    onSuccess: refresh,
  })
}

export function useArchiveTask() {
  const refresh = useRefreshTaskData()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.rpc('archive_task', {
        p_task_id: taskId,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}
