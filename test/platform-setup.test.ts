import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { prepareEnvironmentFile } from '../src/platform/platform-setup.js'

test('creates a private .env from the repository template on first setup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'buzz-platform-setup-'))
  const template = join(directory, '.env.example')
  const target = join(directory, '.env')
  try {
    await writeFile(template, 'MODEL_PROVIDER=copilot\n', 'utf8')
    const result = await prepareEnvironmentFile(template, target)

    assert.equal(result.created, true)
    assert.equal(await readFile(target, 'utf8'), 'MODEL_PROVIDER=copilot\n')
    assert.equal((await stat(target)).mode & 0o777, 0o600)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('never overwrites an existing .env', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'buzz-platform-setup-'))
  const template = join(directory, '.env.example')
  const target = join(directory, '.env')
  try {
    await writeFile(template, 'MODEL_PROVIDER=copilot\n', 'utf8')
    await writeFile(target, 'MODEL_PROVIDER=gemini\n', { encoding: 'utf8', mode: 0o600 })
    const result = await prepareEnvironmentFile(template, target)

    assert.equal(result.created, false)
    assert.equal(await readFile(target, 'utf8'), 'MODEL_PROVIDER=gemini\n')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
