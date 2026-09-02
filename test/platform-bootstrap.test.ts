import assert from 'node:assert/strict'
import test from 'node:test'
import { BUZZ_SOURCE_COMMIT, OMNIGENT_SOURCE_COMMIT } from '../src/platform/platform-bootstrap.js'

test('pins the actual Buzz and Omnigent source revisions used by the platform', () => {
  assert.match(BUZZ_SOURCE_COMMIT, /^[0-9a-f]{40}$/)
  assert.match(OMNIGENT_SOURCE_COMMIT, /^[0-9a-f]{40}$/)
  assert.notEqual(BUZZ_SOURCE_COMMIT, OMNIGENT_SOURCE_COMMIT)
})
