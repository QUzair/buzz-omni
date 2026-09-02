#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { agentDefinitions, renderAgentSpec, resolveProvider } from './provider-profiles.js'

export async function renderAgentProfiles(providerName: string, outputRoot: string): Promise<string[]> {
  const provider = resolveProvider(providerName)
  const root = resolve(outputRoot)
  const paths: string[] = []

  for (const agent of agentDefinitions) {
    await mkdir(root, { recursive: true, mode: 0o700 })
    const path = resolve(root, `${agent.slug}.yaml`)
    await writeFile(path, renderAgentSpec(agent, provider), { encoding: 'utf8', mode: 0o600 })
    paths.push(path)
  }

  return paths
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const provider = process.argv[2] || process.env.MODEL_PROVIDER || 'gemini'
  const outputRoot = process.argv[3] || '.local/agents'
  try {
    const paths = await renderAgentProfiles(provider, outputRoot)
    process.stdout.write(`${JSON.stringify({ provider, agents: paths }, null, 2)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not render agent profiles'
    process.stderr.write(`[provider-setup] ${message}\n`)
    process.exitCode = 1
  }
}
