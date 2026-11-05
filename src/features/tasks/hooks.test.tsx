import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/auth-provider'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useExecutors, useTask, useTaskHistory, useTasks } from './queries'
import { useArchiveTask, useSaveTask, useTransitionTask } from './mutations'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: mocks }))
vi.mock('@/auth/auth-provider', () => ({ useAuth: vi.fn() }))

function queryResult(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    update: vi.fn(() => query),
    insert: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error })),
    single: vi.fn(async () => ({ data, error })),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  }
  return query
}

describe('task queries and mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'executor-1' },
      profile: { id: 'manager-1', role: 'manager' },
    } as never)
  })

  it('applies task filters and excludes archived records', async () => {
    const query = queryResult([{ id: 'task-1' }])
    mocks.from.mockReturnValue(query)
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(
      () => useTasks({ objectId: 'object-1', assigneeId: 'executor-1' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('tasks')
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
    expect(query.eq).toHaveBeenCalledWith('object_id', 'object-1')
    expect(query.eq).toHaveBeenCalledWith('assignee_id', 'executor-1')
  })

  it('loads a task and its history in chronological order', async () => {
    const taskQuery = queryResult({ id: 'task-1' })
    const historyQuery = queryResult([{ new_status: 'new' }])
    mocks.from.mockReturnValueOnce(taskQuery).mockReturnValueOnce(historyQuery)
    const { wrapper } = createQueryWrapper()
    const task = renderHook(() => useTask('task-1'), { wrapper })
    const history = renderHook(() => useTaskHistory('task-1'), { wrapper })

    await waitFor(() => expect(task.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(history.result.current.isSuccess).toBe(true))
    expect(taskQuery.eq).toHaveBeenCalledWith('id', 'task-1')
    expect(historyQuery.eq).toHaveBeenCalledWith('task_id', 'task-1')
    expect(historyQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    })
  })

  it('fetches executors only for a manager', async () => {
    const query = queryResult([{ id: 'executor-1', name: 'Анна' }])
    mocks.from.mockReturnValue(query)
    const { wrapper } = createQueryWrapper()
    const managers = renderHook(() => useExecutors(), { wrapper })
    await waitFor(() => expect(managers.result.current.isSuccess).toBe(true))
    expect(query.eq).toHaveBeenCalledWith('role', 'executor')
    expect(query.order).toHaveBeenCalledWith('name')

    vi.mocked(useAuth).mockReturnValue({
      profile: { id: 'executor-1', role: 'executor' },
    } as never)
    const executor = renderHook(() => useExecutors(), { wrapper })
    expect(executor.result.current.fetchStatus).toBe('idle')
    expect(mocks.from).toHaveBeenCalledOnce()
  })

  it('creates and edits task fields without changing protected fields', async () => {
    const createQuery = queryResult({ id: 'task-1' })
    mocks.from.mockReturnValueOnce(createQuery)
    const { wrapper } = createQueryWrapper()
    const create = renderHook(() => useSaveTask(), { wrapper })
    await create.result.current.mutateAsync({
      object_id: 'object-1',
      title: 'Проверить дверь',
      description: null,
      assignee_id: 'executor-1',
    })
    expect(createQuery.insert).toHaveBeenCalledWith({
      object_id: 'object-1',
      title: 'Проверить дверь',
      description: null,
      assignee_id: 'executor-1',
    })

    const editQuery = queryResult({ id: 'task-1' })
    mocks.from.mockReturnValueOnce(editQuery)
    const edit = renderHook(() => useSaveTask('task-1'), { wrapper })
    await edit.result.current.mutateAsync({
      object_id: 'ignored-object',
      title: 'Исправить дверь',
      description: 'Описание',
      assignee_id: 'executor-2',
    })
    expect(editQuery.update).toHaveBeenCalledWith({
      title: 'Исправить дверь',
      description: 'Описание',
      assignee_id: 'executor-2',
    })
    expect(editQuery.eq).toHaveBeenCalledWith('id', 'task-1')
  })

  it('uses transition and archive RPCs and returns API errors to callers', async () => {
    const { wrapper } = createQueryWrapper()
    const transition = renderHook(() => useTransitionTask(), { wrapper })
    mocks.rpc.mockResolvedValueOnce({
      data: { status: 'in_review' },
      error: null,
    })
    await transition.result.current.mutateAsync({
      taskId: 'task-1',
      status: 'in_review',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('transition_task', {
      p_task_id: 'task-1',
      p_new_status: 'in_review',
    })

    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('Denied') })
    await expect(
      transition.result.current.mutateAsync({
        taskId: 'task-1',
        status: 'in_review',
      }),
    ).rejects.toThrow('Denied')

    const archive = renderHook(() => useArchiveTask(), { wrapper })
    mocks.rpc.mockResolvedValueOnce({ error: null })
    await archive.result.current.mutateAsync('task-1')
    expect(mocks.rpc).toHaveBeenLastCalledWith('archive_task', {
      p_task_id: 'task-1',
    })
  })
})
