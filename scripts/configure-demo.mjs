import { randomBytes } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'

try {
  await access('seed.json')
  console.log('seed.json already exists; left unchanged')
} catch {
  const config = JSON.parse(await readFile('seed.example.json', 'utf8'))
  for (const user of config.users)
    user.password = randomBytes(24).toString('base64url')
  await writeFile('seed.json', `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  })
  console.log(
    'Created seed.json with private local passwords. Edit it to change demo emails or passwords.',
  )
}
