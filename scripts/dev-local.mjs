import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
let active
let shuttingDown = false

const run = (args) => {
  const child = spawn(npm, args, { stdio: 'inherit' })
  active = child
  return new Promise((resolve) =>
    child.once('exit', (code) => resolve(code ?? 1)),
  )
}

const stop = () => {
  if (active && !shuttingDown) active.kill('SIGINT')
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

try {
  const startCode = await run(['run', 'supabase:start'])
  if (startCode !== 0) process.exitCode = startCode
  else {
    const configureCode = await run(['run', 'local:configure'])
    if (configureCode !== 0) process.exitCode = configureCode
    else {
      const devCode = await run(['run', 'dev'])
      if (devCode !== 0) process.exitCode = devCode
    }
  }
} finally {
  shuttingDown = true
  const child = spawn(npm, ['run', 'supabase:stop'], { stdio: 'inherit' })
  await new Promise((resolve) => child.once('exit', resolve))
}
