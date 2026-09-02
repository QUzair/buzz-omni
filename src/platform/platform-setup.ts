#!/usr/bin/env node
import { constants } from 'node:fs'
import { chmod, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { bootstrapPlatform } from './platform-bootstrap.js'
import { runPlatformDoctor } from './platform-doctor.js'
import { loadPlatformEnvironment } from './platform-env.js'

export async function prepareEnvironmentFile(
  templatePath = resolve('.env.example'),
  targetPath = resolve('.env'),
): Promise<{ created: boolean; path: string }> {
  try {
    await copyFile(templatePath, targetPath, constants.COPYFILE_EXCL)
    await chmod(targetPath, 0o600)
    return { created: true, path: targetPath }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return { created: false, path: targetPath }
    }
    throw error
  }
}

async function setupPlatform(): Promise<void> {
  const envFile = await prepareEnvironmentFile()
  process.stdout.write(`${envFile.created ? 'Created' : 'Using existing'} ${envFile.path}\n`)
  const bootstrap = await bootstrapPlatform()
  process.stdout.write(`Pinned Buzz ${bootstrap.buzzCommit.slice(0, 8)} and Omnigent ${bootstrap.omnigentCommit.slice(0, 8)} are installed.\n\n`)
  const loaded = await loadPlatformEnvironment(process.env, envFile.path)
  const okay = await runPlatformDoctor(loaded.environment, loaded.loaded)
  if (!okay) process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupPlatform().catch((error) => {
    const message = error instanceof Error ? error.message : 'Platform setup failed'
    process.stderr.write(`[platform-setup] ${message}\n`)
    process.exitCode = 1
  })
}
