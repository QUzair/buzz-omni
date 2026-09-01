export type TriageRoute = 'fraud-review' | 'payments-ops' | 'account-support'

export type MockToolRun = {
  name: string
  label: string
  status: 'completed' | 'approval_required'
  output: string
  mock: true
}

export type TriageResult = {
  id: string
  route: TriageRoute
  agent: string
  priority: 'P1' | 'P2' | 'P3'
  summary: string
  answer: string
  nextStep: string
  actionLabel: string
  tools: MockToolRun[]
  durationMs: number
}

export const TRIAGE_AGENTS = [
  {
    id: 'triage-coordinator',
    name: 'Triage Coordinator',
    handle: '@Triage',
    role: 'Classifies requests, gathers safe context, and dispatches a specialist.',
    tools: ['get_customer_profile', 'lookup_recent_transactions', 'check_payment_rails'],
  },
  {
    id: 'fraud-review',
    name: 'Fraud Review',
    handle: '@FraudReview',
    role: 'Assesses suspicious activity and prepares approval-gated controls.',
    tools: ['lookup_recent_transactions', 'freeze_card_preview', 'create_escalation_preview'],
  },
  {
    id: 'payments-ops',
    name: 'Payments Operations',
    handle: '@PaymentsOps',
    role: 'Diagnoses transfer, settlement, and card-payment issues.',
    tools: ['check_payment_rails', 'lookup_transfer', 'create_escalation_preview'],
  },
] as const

const mock = (name: string, label: string, output: string, status: MockToolRun['status'] = 'completed'): MockToolRun => ({
  name,
  label,
  output,
  status,
  mock: true,
})

export function runTriage(message: string): TriageResult {
  const normalized = message.toLowerCase()
  if (/not mine|fraud|stolen|unknown charge|charged (twice|three times)|duplicate/.test(normalized)) {
    return {
      id: 'turn_mock_1042',
      route: 'fraud-review',
      agent: 'Fraud Review',
      priority: 'P1',
      summary: 'Possible duplicate and unauthorized card activity',
      answer: 'I found two likely duplicate card authorizations, including one the customer does not recognize. I prepared case MOCK-FRD-1042 and a card-freeze action for human approval. No account change has been made.',
      nextStep: 'Review the prepared card freeze and fraud escalation',
      actionLabel: 'Open approval',
      durationMs: 842,
      tools: [
        mock('get_customer_profile', 'Customer profile', 'Identity verified · Card ending 4242 · Account in good standing'),
        mock('lookup_recent_transactions', 'Recent transactions', '3 × €84.20 at Northstar Market · 2 share the same merchant reference'),
        mock('freeze_card_preview', 'Card freeze preview', 'Prepared only — execution requires a human approval', 'approval_required'),
        mock('create_escalation_preview', 'Escalation preview', 'MOCK-FRD-1042 · Fraud queue · 15-minute response target'),
      ],
    }
  }

  if (/transfer|payment|settlement|pending|supplier|payout/.test(normalized)) {
    return {
      id: 'turn_mock_2088',
      route: 'payments-ops',
      agent: 'Payments Operations',
      priority: 'P2',
      summary: 'Delayed outbound transfer',
      answer: 'The simulation shows the transfer accepted by our mock ledger but waiting on the external rail. I prepared escalation MOCK-PAY-2088; no payment was retried or changed.',
      nextStep: 'Review the payment-rail evidence and prepared escalation',
      actionLabel: 'Open escalation',
      durationMs: 614,
      tools: [
        mock('get_customer_profile', 'Customer profile', 'Business account verified · No account restrictions'),
        mock('lookup_transfer', 'Transfer lookup', 'TRX-MOCK-8821 · Pending · submitted 24h 12m ago'),
        mock('check_payment_rails', 'Payment rail status', 'SEPA mock rail degraded · next status window 14:30 UTC'),
        mock('create_escalation_preview', 'Escalation preview', 'MOCK-PAY-2088 · Payments operations queue'),
      ],
    }
  }

  return {
    id: 'turn_mock_3011',
    route: 'account-support',
    agent: 'Triage Coordinator',
    priority: 'P3',
    summary: 'General account-support request',
    answer: 'I classified this as a general account request. The mock profile is healthy, and I would ask one clarifying question before dispatching a specialist.',
    nextStep: 'Add the missing account or issue detail',
    actionLabel: 'Add context',
    durationMs: 318,
    tools: [mock('get_customer_profile', 'Customer profile', 'Identity verified · Account in good standing')],
  }
}
