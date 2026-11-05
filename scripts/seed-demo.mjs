import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const config = JSON.parse(await readFile('seed.json', 'utf8'))
const { users, objects, tasks } = config

assert.ok(url && anonKey && serviceRoleKey, 'Run npm run local:configure first')
assert.equal(users.filter((user) => user.role === 'manager').length, 1)
assert.equal(users.filter((user) => user.role === 'executor').length, 2)
assert.equal(new Set(users.map((user) => user.key)).size, users.length)
assert.equal(new Set(users.map((user) => user.email)).size, users.length)
assert.equal(new Set(objects.map((object) => object.key)).size, objects.length)
assert.equal(new Set(tasks.map((task) => task.key)).size, tasks.length)

const userByKey = new Map(users.map((user) => [user.key, user]))
const managerUser = users.find((user) => user.role === 'manager')
const executors = users.filter((user) => user.role === 'executor')
assert.ok(managerUser, 'seed.json must contain a manager')
assert.ok(objects.length > 0, 'seed.json must contain objects')

for (const user of users) {
  assert.ok(
    user.key && user.email && user.password && user.password.length >= 8,
  )
  assert.ok(user.name && ['manager', 'executor'].includes(user.role))
  assert.ok(
    !user.password.startsWith('replace-with-'),
    `Set a private password for ${user.email} in seed.json`,
  )
}

const objectKeys = new Set(objects.map((object) => object.key))
for (const object of objects)
  assert.ok(
    object.key && object.name && object.address,
    'Every object needs a key, name, and address',
  )

for (const task of tasks) {
  assert.ok(
    task.key && task.title && objectKeys.has(task.object),
    `Invalid object reference in task ${task.key}`,
  )
  assert.ok(
    userByKey.get(task.assignee)?.role === 'executor',
    `Task ${task.key} must be assigned to an executor`,
  )
  assert.ok(
    Array.isArray(task.transitions),
    `Task ${task.key} needs a transitions array`,
  )
  for (const step of task.transitions)
    assert.ok(
      userByKey.has(step.actor) && step.status,
      `Invalid transition in task ${task.key}`,
    )
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const findUser = async (email) => {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error
    const user = data.users.find((item) => item.email === email)
    if (user) return user
    if (data.users.length < 1000) return null
  }
}

const clients = new Map()
const userIds = new Map()
const profiles = []
for (const user of users) {
  let existing = await findUser(user.email)
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
    })
    if (error) throw error
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    })
    if (error) throw error
    existing = data.user
  }

  userIds.set(user.key, existing.id)
  profiles.push({ id: existing.id, name: user.name, role: user.role })
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error)
    throw new Error(`Cannot sign in as ${user.email}: ${error.message}`)
  clients.set(user.key, client)
}

const { error: profileError } = await admin.from('profiles').upsert(profiles)
if (profileError) throw profileError

const manager = clients.get(managerUser.key)
const objectIds = new Map()
for (const object of objects) {
  const { data, error } = await manager
    .from('objects')
    .insert({ name: object.name, address: object.address })
    .select('id')
    .single()
  if (error) throw error
  objectIds.set(object.key, data.id)
}

for (const task of tasks) {
  const { data, error } = await manager
    .from('tasks')
    .insert({
      object_id: objectIds.get(task.object),
      title: task.title,
      description: task.description ?? null,
      assignee_id: userIds.get(task.assignee),
    })
    .select('id')
    .single()
  if (error) throw error

  for (const step of task.transitions) {
    const { error: transitionError } = await clients
      .get(step.actor)
      .rpc('transition_task', {
        p_task_id: data.id,
        p_new_status: step.status,
        p_comment: step.comment ?? null,
      })
    if (transitionError)
      throw new Error(
        `Task ${task.key}, transition ${step.status}: ${transitionError.message}`,
      )
  }
}

console.log(
  `Seeded ${users.length} users, ${objects.length} objects, and ${tasks.length} tasks.`,
)
console.log(`Demo emails: ${users.map((user) => user.email).join(', ')}`)
