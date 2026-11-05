import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const result = spawnSync(
  'npm',
  ['exec', '--', 'supabase', 'status', '--output', 'json'],
  { encoding: 'utf8' },
)

if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const status = JSON.parse(result.stdout)
const values = {
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
}

if (
  Object.values(values).some(
    (value) => typeof value !== 'string' || value.length === 0,
  )
) {
  throw new Error('Supabase CLI did not return its local API URL and keys')
}

const file = Object.entries(values)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n')
await writeFile('.env.local', `${file}\n`, { mode: 0o600 })
console.log('Wrote local Supabase configuration to the ignored .env.local file')
