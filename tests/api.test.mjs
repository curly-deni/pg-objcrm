import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { before, after } from 'node:test'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

const demoUsers = JSON.parse(readFileSync('seed.json', 'utf8'))
const users = {
  manager: demoUsers.users.find((user) => user.role === 'manager'),
  executorA: demoUsers.users.filter((user) => user.role === 'executor')[0],
  executorB: demoUsers.users.filter((user) => user.role === 'executor')[1],
}

const signedInClient = () =>
  createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
const manager = signedInClient()
const executorA = signedInClient()
const executorB = signedInClient()
let managerId
let executorAId
let executorBId
let objectA
let taskA
let taskB

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

const rejected = async (operation, codes = []) => {
  const result = await operation
  assert.ok(
    result.error || (Array.isArray(result.data) && result.data.length === 0),
    'Expected access to be denied',
  )
  if (codes.length)
    assert.ok(
      codes.includes(result.error?.code),
      `Unexpected error code ${result.error?.code}`,
    )
  return result
}

const transition = (client, taskId, status, comment = null) =>
  client.rpc('transition_task', {
    p_task_id: taskId,
    p_new_status: status,
    p_comment: comment,
  })

before(async () => {
  assert.ok(url && anonKey, 'Run npm run local:configure first')
  for (const user of Object.values(users))
    assert.ok(user?.email && user?.password, 'Run npm run demo:configure first')

  managerId = unwrap(await manager.auth.signInWithPassword(users.manager)).user
    .id
  executorAId = unwrap(await executorA.auth.signInWithPassword(users.executorA))
    .user.id
  executorBId = unwrap(await executorB.auth.signInWithPassword(users.executorB))
    .user.id

  objectA = unwrap(
    await manager
      .from('objects')
      .insert({ name: 'API test object', address: 'API test address' })
      .select('id')
      .single(),
  )
  taskA = unwrap(
    await manager
      .from('tasks')
      .insert({
        object_id: objectA.id,
        title: 'API task A',
        assignee_id: executorAId,
      })
      .select('id')
      .single(),
  )
  taskB = unwrap(
    await manager
      .from('tasks')
      .insert({
        object_id: objectA.id,
        title: 'API task B',
        assignee_id: executorBId,
      })
      .select('id')
      .single(),
  )
})

after(async () => {
  if (taskA?.id) await manager.rpc('archive_task', { p_task_id: taskA.id })
  if (taskB?.id) await manager.rpc('archive_task', { p_task_id: taskB.id })
  if (objectA?.id)
    await manager.rpc('archive_object', { p_object_id: objectA.id })
  await Promise.all([
    manager.auth.signOut(),
    executorA.auth.signOut(),
    executorB.auth.signOut(),
  ])
})

test('manager sees all active data and executors see only assigned tasks and objects', async () => {
  const managerTasks = unwrap(
    await manager.from('tasks').select('id').in('id', [taskA.id, taskB.id]),
  )
  assert.equal(managerTasks.length, 2)
  assert.deepEqual(
    unwrap(
      await executorA.from('tasks').select('id').in('id', [taskA.id, taskB.id]),
    ).map((row) => row.id),
    [taskA.id],
  )
  assert.deepEqual(
    unwrap(
      await executorB.from('tasks').select('id').in('id', [taskA.id, taskB.id]),
    ).map((row) => row.id),
    [taskB.id],
  )
  assert.deepEqual(
    unwrap(
      await executorA.from('objects').select('id').eq('id', objectA.id),
    ).map((row) => row.id),
    [objectA.id],
  )
  assert.deepEqual(
    unwrap(
      await executorB.from('objects').select('id').eq('id', objectA.id),
    ).map((row) => row.id),
    [objectA.id],
  )
  assert.deepEqual(
    unwrap(
      await manager
        .from('profiles')
        .select('id')
        .in('id', [executorAId, executorBId]),
    )
      .map((row) => row.id)
      .sort(),
    [executorAId, executorBId].sort(),
  )
  assert.deepEqual(
    unwrap(
      await executorA
        .from('profiles')
        .select('id')
        .in('id', [managerId, executorBId]),
    ),
    [],
  )
  assert.deepEqual(
    unwrap(
      await executorA
        .from('task_status_history')
        .select('new_status')
        .eq('task_id', taskA.id),
    ).map((row) => row.new_status),
    ['new'],
  )

  const secondObject = unwrap(
    await manager
      .from('objects')
      .insert({ name: 'Private test object', address: 'Another address' })
      .select('id')
      .single(),
  )
  assert.deepEqual(
    unwrap(
      await executorA.from('objects').select('id').eq('id', secondObject.id),
    ),
    [],
  )
  await manager.rpc('archive_object', { p_object_id: secondObject.id })
})

test('executors cannot edit profiles, objects, assignments, or task history', async () => {
  await rejected(
    executorA
      .from('profiles')
      .update({ role: 'manager' })
      .eq('id', executorAId)
      .select('id'),
  )
  await rejected(
    executorA
      .from('objects')
      .insert({ name: 'Forbidden', address: 'Forbidden' }),
  )
  await rejected(
    executorA
      .from('objects')
      .update({ name: 'Forbidden' })
      .eq('id', objectA.id)
      .select('id'),
  )
  await rejected(
    executorA.from('objects').delete().eq('id', objectA.id).select('id'),
  )
  await rejected(
    executorA.from('tasks').insert({
      object_id: objectA.id,
      title: 'Forbidden',
      assignee_id: executorAId,
    }),
  )
  await rejected(
    executorA
      .from('tasks')
      .update({ assignee_id: executorBId })
      .eq('id', taskA.id)
      .select('id'),
  )
  await rejected(
    executorA
      .from('tasks')
      .update({ assignee_id: executorAId })
      .eq('id', taskB.id)
      .select('id'),
  )
  await rejected(executorA.from('tasks').select('id').eq('id', taskB.id))
  await rejected(
    executorA.from('task_status_history').select('id').eq('task_id', taskB.id),
  )
  await rejected(
    executorA.from('task_status_history').insert({
      task_id: taskA.id,
      actor_id: executorAId,
      new_status: 'accepted',
    }),
  )
  const initialHistory = unwrap(
    await manager
      .from('task_status_history')
      .select('id')
      .eq('task_id', taskA.id)
      .single(),
  )
  await rejected(
    executorA
      .from('task_status_history')
      .update({ comment: 'Tampered' })
      .eq('id', initialHistory.id)
      .select('id'),
  )
  await rejected(
    executorA
      .from('task_status_history')
      .delete()
      .eq('id', initialHistory.id)
      .select('id'),
  )
})

test('task authors, assignee roles, and direct status changes are protected', async () => {
  const created = unwrap(
    await manager
      .from('tasks')
      .select('created_by, status')
      .eq('id', taskA.id)
      .single(),
  )
  assert.equal(created.created_by, managerId)
  assert.equal(created.status, 'new')
  const initialHistory = unwrap(
    await manager
      .from('task_status_history')
      .select('actor_id, old_status, new_status')
      .eq('task_id', taskA.id)
      .single(),
  )
  assert.deepEqual(initialHistory, {
    actor_id: managerId,
    old_status: null,
    new_status: 'new',
  })
  await rejected(
    manager.from('tasks').insert({
      object_id: '00000000-0000-0000-0000-000000000001',
      title: 'Missing object',
      assignee_id: executorAId,
    }),
  )
  await rejected(
    manager.from('tasks').insert({
      object_id: objectA.id,
      title: 'Manager cannot execute',
      assignee_id: managerId,
    }),
  )
  await rejected(
    manager.from('tasks').insert({
      object_id: objectA.id,
      title: 'Fake author',
      assignee_id: executorAId,
      created_by: executorBId,
    }),
  )
  await rejected(
    manager.from('tasks').update({ status: 'accepted' }).eq('id', taskA.id),
  )
  await rejected(
    manager
      .from('tasks')
      .update({ created_by: executorBId })
      .eq('id', taskA.id)
      .select('id'),
  )
  await rejected(manager.from('tasks').delete().eq('id', taskA.id).select('id'))
  const unchanged = unwrap(
    await manager.from('tasks').select('status').eq('id', taskA.id).single(),
  )
  assert.equal(unchanged.status, 'new')

  await rejected(
    manager.from('task_status_history').insert({
      task_id: taskA.id,
      actor_id: managerId,
      new_status: 'accepted',
    }),
  )
  await rejected(
    manager
      .from('task_status_history')
      .update({ comment: 'Tampered by manager' })
      .eq('task_id', taskA.id)
      .select('id'),
  )
  await rejected(
    manager
      .from('task_status_history')
      .delete()
      .eq('task_id', taskA.id)
      .select('id'),
  )
})

test('anonymous clients cannot read CRM records or call protected RPCs', async () => {
  const anonymous = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await rejected(anonymous.from('objects').select('id'))
  await rejected(anonymous.from('tasks').select('id'))
  await rejected(anonymous.from('profiles').select('id'))
  await rejected(
    anonymous.rpc('transition_task', {
      p_task_id: taskA.id,
      p_new_status: 'in_progress',
    }),
  )
})

test('a signed-in user without an administrative profile cannot see or change CRM data', async () => {
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert.ok(adminKey, 'Run npm run local:configure first')
  const admin = createClient(url, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const password = randomBytes(24).toString('base64url')
  const { data, error } = await admin.auth.admin.createUser({
    email: `no-profile-${randomBytes(8).toString('hex')}@objcrm.demo`,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const profileless = signedInClient()
  try {
    unwrap(
      await profileless.auth.signInWithPassword({
        email: data.user.email,
        password,
      }),
    )
    assert.deepEqual(unwrap(await profileless.from('objects').select('id')), [])
    assert.deepEqual(unwrap(await profileless.from('tasks').select('id')), [])
    await rejected(transition(profileless, taskA.id, 'in_progress'))
  } finally {
    await profileless.auth.signOut()
    await admin.auth.admin.deleteUser(data.user.id)
  }
})

test('a complete task workflow writes exactly one history row per successful transition', async () => {
  const beforeHistory = unwrap(
    await manager
      .from('task_status_history')
      .select('id')
      .eq('task_id', taskA.id),
  )
  const invalid = await transition(manager, taskA.id, 'accepted')
  assert.ok(invalid.error)
  const emptyRework = await transition(manager, taskA.id, 'rework', '   ')
  assert.ok(emptyRework.error)
  const impersonated = await transition(executorB, taskA.id, 'in_progress')
  assert.ok(impersonated.error)
  const stillNew = unwrap(
    await manager.from('tasks').select('status').eq('id', taskA.id).single(),
  )
  assert.equal(stillNew.status, 'new')
  assert.equal(
    unwrap(
      await manager
        .from('task_status_history')
        .select('id')
        .eq('task_id', taskA.id),
    ).length,
    beforeHistory.length,
  )

  const results = await Promise.all([
    transition(executorA, taskA.id, 'in_progress'),
    transition(executorA, taskA.id, 'in_progress'),
  ])
  assert.equal(results.filter((result) => !result.error).length, 1)
  await transition(executorA, taskA.id, 'in_review').then(unwrap)
  await transition(
    manager,
    taskA.id,
    'rework',
    'Add the inspection notes.',
  ).then(unwrap)
  await transition(executorA, taskA.id, 'in_progress').then(unwrap)
  await transition(executorA, taskA.id, 'in_review').then(unwrap)
  await transition(manager, taskA.id, 'accepted').then(unwrap)

  const finalTask = unwrap(
    await manager.from('tasks').select('status').eq('id', taskA.id).single(),
  )
  const history = unwrap(
    await manager
      .from('task_status_history')
      .select('*')
      .eq('task_id', taskA.id)
      .order('created_at'),
  )
  assert.equal(finalTask.status, 'accepted')
  assert.equal(history.length - beforeHistory.length, 6)
  assert.deepEqual(
    history.slice(-6).map((row) => [row.old_status, row.new_status]),
    [
      ['new', 'in_progress'],
      ['in_progress', 'in_review'],
      ['in_review', 'rework'],
      ['rework', 'in_progress'],
      ['in_progress', 'in_review'],
      ['in_review', 'accepted'],
    ],
  )
  assert.equal(history.at(-4).comment, 'Add the inspection notes.')
})

test('manager edits records and may reassign only new or rework tasks', async () => {
  const editedObject = unwrap(
    await manager
      .from('objects')
      .update({ name: 'Edited API object', address: 'Updated address' })
      .eq('id', objectA.id)
      .select('name, address')
      .single(),
  )
  assert.deepEqual(editedObject, {
    name: 'Edited API object',
    address: 'Updated address',
  })

  unwrap(
    await manager
      .from('tasks')
      .update({ title: 'Edited API task', description: 'Updated details' })
      .eq('id', taskB.id),
  )
  unwrap(
    await manager
      .from('tasks')
      .update({ assignee_id: executorAId })
      .eq('id', taskB.id),
  )
  assert.deepEqual(
    unwrap(await executorB.from('tasks').select('id').eq('id', taskB.id)),
    [],
  )
  assert.equal(
    unwrap(
      await executorA
        .from('tasks')
        .select('title, description, assignee_id')
        .eq('id', taskB.id)
        .single(),
    ).title,
    'Edited API task',
  )

  await transition(executorA, taskB.id, 'in_progress').then(unwrap)
  await rejected(
    manager
      .from('tasks')
      .update({ assignee_id: executorBId })
      .eq('id', taskB.id)
      .select('id'),
  )
  assert.equal(
    unwrap(
      await manager
        .from('tasks')
        .select('assignee_id')
        .eq('id', taskB.id)
        .single(),
    ).assignee_id,
    executorAId,
  )

  await transition(executorA, taskB.id, 'in_review').then(unwrap)
  await rejected(
    manager
      .from('tasks')
      .update({ assignee_id: executorBId })
      .eq('id', taskB.id)
      .select('id'),
  )
  await transition(manager, taskB.id, 'rework', 'Add a meter photo.').then(
    unwrap,
  )
  unwrap(
    await manager
      .from('tasks')
      .update({ assignee_id: executorBId })
      .eq('id', taskB.id),
  )
  await transition(executorB, taskB.id, 'in_progress').then(unwrap)
  assert.deepEqual(
    unwrap(
      await executorA
        .from('task_status_history')
        .select('id')
        .eq('task_id', taskB.id),
    ),
    [],
  )
  assert.deepEqual(
    unwrap(
      await executorB
        .from('task_status_history')
        .select('new_status')
        .eq('task_id', taskB.id),
    ).map((row) => row.new_status),
    ['new', 'in_progress', 'in_review', 'rework', 'in_progress'],
  )
})

test('archiving tasks preserves history and removes their objects from executor lists', async () => {
  const historyBeforeArchive = unwrap(
    await manager
      .from('task_status_history')
      .select('id')
      .eq('task_id', taskA.id),
  )
  const blockedObjectArchive = await manager.rpc('archive_object', {
    p_object_id: objectA.id,
  })
  assert.ok(blockedObjectArchive.error)
  unwrap(await manager.rpc('archive_task', { p_task_id: taskA.id }))
  assert.deepEqual(
    unwrap(await executorA.from('tasks').select('id').eq('id', taskA.id)),
    [],
  )
  assert.deepEqual(
    unwrap(await executorA.from('objects').select('id').eq('id', objectA.id)),
    [],
  )
  assert.equal(
    unwrap(
      await manager
        .from('task_status_history')
        .select('id')
        .eq('task_id', taskA.id),
    ).length,
    historyBeforeArchive.length,
  )
  const archivedTransition = await transition(manager, taskA.id, 'new')
  assert.ok(archivedTransition.error)
})
