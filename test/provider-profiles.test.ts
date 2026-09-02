import assert from 'node:assert/strict'
import test from 'node:test'
import { agentDefinitions, renderAgentSpec, resolveProvider } from '../src/platform/provider-profiles.js'

test('Gemini profile selects the native Antigravity harness without embedding a credential', () => {
  const yaml = renderAgentSpec(agentDefinitions[0]!, resolveProvider('gemini'))

  assert.match(yaml, /executor:\n  harness: antigravity/)
  assert.match(yaml, /model: gemini-3\.5-flash/)
  assert.match(yaml, /api_key: \$\{GEMINI_API_KEY\}/)
  assert.doesNotMatch(yaml, /AQ\.|AIza/)
})

test('Copilot profile selects Omnigent native Copilot SDK harness', () => {
  const yaml = renderAgentSpec(agentDefinitions[0]!, resolveProvider('copilot'))

  assert.match(yaml, /executor:\n  harness: copilot/)
  assert.doesNotMatch(yaml, /api_key:/)
  assert.doesNotMatch(yaml, /COPILOT_GITHUB_TOKEN/)
  assert.doesNotMatch(yaml, /harness: antigravity/)
})

test('every provider retains the same sandbox and modeled tool contract', () => {
  for (const providerName of ['gemini', 'copilot'] as const) {
    const yaml = renderAgentSpec(agentDefinitions[0]!, resolveProvider(providerName))
    assert.match(yaml, /type: darwin_seatbelt/)
    assert.match(yaml, /allow_network: false/)
    assert.match(yaml, /callable: mastercard_tools\.tools\.compare_authorization_health/)
    assert.match(yaml, /MUST call compare_authorization_health/)
    assert.match(yaml, /Never substitute built-in SQL, shell, filesystem, web, or todo tools/)
    assert.match(yaml, /SYNTHETIC_MODELED_DATA/)
    assert.doesNotMatch(yaml, /spec_version:/)
  }
})

test('ReleaseHelper enables Omnigent async dispatch and keeps finish human-gated', () => {
  const release = agentDefinitions.find((agent) => agent.slug === 'release-helper')
  assert.ok(release)
  const yaml = renderAgentSpec(release, resolveProvider('copilot'))

  assert.match(yaml, /callable: mastercard_tools\.tools\.watch_release_pipeline/)
  assert.match(yaml, /callable: mastercard_tools\.tools\.finish_release_pipeline/)
  assert.match(yaml, /async: true/)
  assert.match(yaml, /sys_read_inbox/)
  assert.match(yaml, /later signed employee message/)
  assert.match(yaml, /@NetworkOps/)

  const nonRelease = renderAgentSpec(agentDefinitions[0]!, resolveProvider('copilot'))
  assert.match(nonRelease, /async: false/)
})

test('NetworkOps can perform the delegated staging verification and call back', () => {
  const yaml = renderAgentSpec(agentDefinitions[0]!, resolveProvider('copilot'))
  assert.match(yaml, /callable: mastercard_tools\.tools\.verify_stage_deployment/)
  assert.match(yaml, /@ReleaseHelper/)
})

test('unknown providers fail closed', () => {
  assert.throws(() => resolveProvider('other'), /gemini or copilot/)
})

test('the demo catalog contains distinct triage specialists', () => {
  assert.deepEqual(agentDefinitions.map(({ slug }) => slug), [
    'network-operations',
    'fraud-review',
    'tokenization-readiness',
    'settlement-support',
    'compliance-review',
    'release-helper',
  ])
})
