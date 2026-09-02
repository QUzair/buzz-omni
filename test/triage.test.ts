import assert from 'node:assert/strict'
import test from 'node:test'
import { runTriage } from '../src/demo/triage.js'
import { getWorkspace, runChannelWorkflow } from '../src/demo/workspace.js'

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

test('models five Mastercard channels with different employee-led workflows', () => {
  const workspace = getWorkspace()

  assert.equal(workspace.organization, 'Mastercard')
  assert.deepEqual(workspace.channels.map((channel) => channel.id), [
    'network-operations',
    'fraud-intelligence',
    'tokenization-launch',
    'merchant-growth',
    'customer-triage',
  ])
  assert.equal(workspace.channels.every((channel) => channel.messages.filter((message) => message.kind === 'employee').length >= 3), true)
  assert.equal(workspace.channels.every((channel) => channel.suggestedPrompt.startsWith('@')), true)
  assert.equal(workspace.disclaimer.includes('Fictitious'), true)
})

test('runs channel-specific agents and mock tools with safe approval gates', () => {
  const network = runChannelWorkflow('network-operations', '@NetworkOps Compare authorization health and prepare an incident update.')
  const threat = runChannelWorkflow('fraud-intelligence', '@ThreatIntel Investigate the card-testing cluster and prepare controls.')
  const tokens = runChannelWorkflow('tokenization-launch', '@TokenOps Check launch readiness for the wallet token rollout.')
  const growth = runChannelWorkflow('merchant-growth', '@GrowthInsights Explain the approval-rate change and propose a test.')

  assert.equal(network.agent, 'Network Operations')
  assert.equal(network.tools.some((tool) => tool.name === 'compare_authorization_rates'), true)
  assert.equal(threat.tools.some((tool) => tool.status === 'approval_required'), true)
  assert.equal(tokens.agent, 'Tokenization Launch')
  assert.equal(tokens.tools.some((tool) => tool.name === 'check_token_requestor_readiness'), true)
  assert.equal(growth.agent, 'Growth Insights')
  assert.equal(growth.tools.some((tool) => tool.name === 'draft_experiment_brief'), true)
  assert.equal([network, threat, tokens, growth].every((result) => result.tools.every((tool) => tool.mock)), true)
})
