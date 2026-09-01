import assert from 'node:assert/strict'
import test from 'node:test'
import { readConfig } from '../src/config.js'

test('accepts HTTPS Omnigent servers and local HTTP development', () => {
  assert.equal(readConfig({ OMNIGENT_BASE_URL: 'https://omni.example', OMNIGENT_AGENT_ID: 'ag_1' }).omnigentBaseUrl, 'https://omni.example')
  assert.equal(readConfig({ OMNIGENT_BASE_URL: 'http://localhost:8000', OMNIGENT_AGENT_ID: 'ag_1' }).omnigentBaseUrl, 'http://localhost:8000')
})

test('rejects cleartext remote Omnigent servers', () => {
  assert.throws(() => readConfig({ OMNIGENT_BASE_URL: 'http://omni.example', OMNIGENT_AGENT_ID: 'ag_1' }), /HTTPS/)
})
