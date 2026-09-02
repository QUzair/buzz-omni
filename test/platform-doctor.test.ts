import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectPlatformConfiguration } from '../src/platform/platform-doctor.js'

test('reports a ready Copilot configuration without exposing environment values', () => {
  const report = inspectPlatformConfiguration({
    MODEL_PROVIDER: 'copilot',
    BUZZ_DESKTOP_PUBKEY: '12'.repeat(32),
    OPEN_BUZZ_DESKTOP: 'true',
  })

  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.warnings, [])
  assert.equal(report.provider, 'copilot')
  assert.doesNotMatch(JSON.stringify(report), /121212121212/)
})

test('warns when first-run Buzz Desktop enrollment is not configured', () => {
  const report = inspectPlatformConfiguration({ MODEL_PROVIDER: 'copilot' })

  assert.deepEqual(report.errors, [])
  assert.match(report.warnings.join('\n'), /BUZZ_DESKTOP_PUBKEY/)
})

test('reports invalid provider configuration as a doctor error', () => {
  const report = inspectPlatformConfiguration({ MODEL_PROVIDER: 'gemini' })

  assert.match(report.errors.join('\n'), /GEMINI_API_KEY/)
})
