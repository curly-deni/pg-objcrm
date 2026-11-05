import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const run = (args) =>
  new Promise((resolve) => {
    const child = spawn(npm, args, { stdio: 'inherit' })
    child.once('exit', (code) => resolve(code ?? 1))
  })

const resetCode = await run(['run', 'supabase:reset'])
if (resetCode !== 0) process.exit(resetCode)

const configureCode = await run(['run', 'local:configure'])
if (configureCode !== 0) process.exit(configureCode)

const demoConfigCode = await run(['run', 'demo:configure'])
if (demoConfigCode !== 0) process.exit(demoConfigCode)

const seedCode = await run(['run', 'demo:seed'])
if (seedCode !== 0) process.exit(seedCode)
