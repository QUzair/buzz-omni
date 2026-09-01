import assert from 'node:assert/strict'
import test from 'node:test'
import { readConfig } from '../src/config.js'

test('accepts HTTPS Omnigent servers and local HTTP development', () => {
  const shared = { OMNIGENT_AGENT_ID: 'ag_1', OMNIGENT_HOST_ID: '550e8400e29b41d4a716446655440000', OMNIGENT_WORKSPACE: '/srv/omni-agent' }
  assert.equal(readConfig({ ...shared, OMNIGENT_BASE_URL: 'https://omni.example' }).omnigentBaseUrl, 'https://omni.example')
  assert.equal(readConfig({ ...shared, OMNIGENT_BASE_URL: 'http://localhost:8000' }).omnigentBaseUrl, 'http://localhost:8000')
})

test('rejects cleartext remote Omnigent servers', () => {
  assert.throws(() => readConfig({ OMNIGENT_BASE_URL: 'http://omni.example', OMNIGENT_AGENT_ID: 'ag_1', OMNIGENT_HOST_ID: '550e8400-e29b-41d4-a716-446655440000', OMNIGENT_WORKSPACE: '/srv/omni-agent' }), /HTTPS/)
})

test('requires a UUID host id and an absolute host workspace', () => {
  const shared = { OMNIGENT_BASE_URL: 'http://localhost:8000', OMNIGENT_AGENT_ID: 'ag_1' }
  assert.throws(() => readConfig({ ...shared, OMNIGENT_HOST_ID: 'not-a-host', OMNIGENT_WORKSPACE: '/srv/omni-agent' }), /OMNIGENT_HOST_ID/)
  assert.throws(() => readConfig({ ...shared, OMNIGENT_HOST_ID: '550e8400-e29b-41d4-a716-446655440000', OMNIGENT_WORKSPACE: './agent' }), /absolute path/)
})
