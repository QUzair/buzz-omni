import assert from 'node:assert/strict'
import test from 'node:test'
import { runTriage } from '../src/demo/triage.js'

test('routes suspicious card charges to fraud with mock evidence and an approval gate', () => {
  const result = runTriage('My card was charged three times and two were not mine.')

  assert.equal(result.route, 'fraud-review')
  assert.equal(result.priority, 'P1')
  assert.deepEqual(result.tools.map((tool) => tool.name), [
    'get_customer_profile',
    'lookup_recent_transactions',
    'freeze_card_preview',
    'create_escalation_preview',
  ])
  assert.equal(result.tools.every((tool) => tool.mock === true), true)
  assert.match(result.answer, /approval/i)
  assert.match(result.answer, /MOCK-FRD-1042/)
  assert.match(result.nextStep, /card freeze/i)
  assert.equal(result.actionLabel, 'Open approval')
})

test('routes transfer delays to payments operations without claiming a real action', () => {
  const result = runTriage('Our supplier transfer is still pending after 24 hours.')

  assert.equal(result.route, 'payments-ops')
  assert.equal(result.priority, 'P2')
  assert.match(result.answer, /simulation/i)
  assert.equal(result.tools.some((tool) => tool.name === 'check_payment_rails'), true)
  assert.match(result.nextStep, /payment-rail/i)
  assert.equal(result.actionLabel, 'Open escalation')
})
