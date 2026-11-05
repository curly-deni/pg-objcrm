import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/auth-provider'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useObject, useObjects } from './queries'
import { useArchiveObject, useSaveObject } from './mutations'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: mocks }))
vi.mock('@/auth/auth-provider', () => ({ useAuth: vi.fn() }))

function queryResult(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn(() => query),
    insert: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error })),
    single: vi.fn(async () => ({ data, error })),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  }
  return query
}

describe('object queries and mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'manager-1' } } as never)
  })

  it('loads the active object list newest first', async () => {
    const query = queryResult([{ id: 'object-1', name: 'Дом' }])
    mocks.from.mockReturnValue(query)
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useObjects(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('objects')
    expect(query.select).toHaveBeenCalledWith('*')
    expect(query.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    })
    expect(result.current.data).toEqual([{ id: 'object-1', name: 'Дом' }])
  })

  it('loads a single object and returns null when it is not visible', async () => {
    const query = queryResult(null)
    mocks.from.mockReturnValue(query)
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useObject('hidden-object'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(query.eq).toHaveBeenCalledWith('id', 'hidden-object')
    expect(result.current.data).toBeNull()
  })

  it('keeps queries disabled until a user exists', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as never)
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useObjects(), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates and edits objects with the requested payloads', async () => {
    const query = queryResult({ id: 'object-1' })
    mocks.from.mockReturnValue(query)
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useSaveObject(), { wrapper })
    await result.current.mutateAsync({ name: 'Дом', address: 'Москва' })

    expect(query.insert).toHaveBeenCalledWith({
      name: 'Дом',
      address: 'Москва',
    })
    expect(query.single).toHaveBeenCalledOnce()

    const updateQuery = queryResult({ id: 'object-1' })
    mocks.from.mockReturnValue(updateQuery)
    const edit = renderHook(() => useSaveObject('object-1'), { wrapper })
    await edit.result.current.mutateAsync({
      name: 'Новый дом',
      address: 'Адрес',
    })
    expect(updateQuery.update).toHaveBeenCalledWith({
      name: 'Новый дом',
      address: 'Адрес',
    })
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 'object-1')
  })

  it('archives objects through the authorized RPC and exposes failures', async () => {
    mocks.rpc.mockResolvedValueOnce({ error: null })
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useArchiveObject(), { wrapper })
    await result.current.mutateAsync('object-1')
    expect(mocks.rpc).toHaveBeenCalledWith('archive_object', {
      p_object_id: 'object-1',
    })

    mocks.rpc.mockResolvedValueOnce({ error: new Error('Active tasks remain') })
    await expect(result.current.mutateAsync('object-1')).rejects.toThrow(
      'Active tasks remain',
    )
  })
})
