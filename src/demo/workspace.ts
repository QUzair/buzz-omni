import { runTriage, type MockToolRun, type TriageResult } from './triage.js'

export type ChannelId = 'network-operations' | 'fraud-intelligence' | 'tokenization-launch' | 'merchant-growth' | 'customer-triage'

type EmployeeMessage = {
  kind: 'employee'
  employee: string
  initials: string
  role: string
  time: string
  body: string
  tone: 'blue' | 'green' | 'peach' | 'violet' | 'gold'
}

export type WorkspaceChannel = {
  id: ChannelId
  name: string
  group: string
  purpose: string
  unread: number
  agentId: string
  agentHandle: string
  suggestedPrompt: string
  messages: EmployeeMessage[]
}

export type ChannelWorkflowResult = Omit<TriageResult, 'route'> & { route: ChannelId }

const employee = (employeeName: string, initials: string, role: string, time: string, body: string, tone: EmployeeMessage['tone']): EmployeeMessage => ({
  kind: 'employee', employee: employeeName, initials, role, time, body, tone,
})

const channels: WorkspaceChannel[] = [
  {
    id: 'network-operations', name: 'network-operations', group: 'Payment network', unread: 4,
    purpose: 'Coordinate authorization health and regional incidents.', agentId: 'network-operations', agentHandle: '@NetworkOps',
    suggestedPrompt: '@NetworkOps Compare authorization health by region, isolate the likely fault domain, and draft an incident update. Do not change traffic.',
    messages: [
      employee('Maya Patel', 'MP', 'Network Duty Manager', '09:14 AM', 'Issuer monitoring shows an 8% authorization dip across two European corridors. No broad availability alert yet.', 'blue'),
      employee('Jon Bell', 'JB', 'Site Reliability Engineer', '09:16 AM', 'Edge latency is normal. The change lines up with yesterday’s routing configuration, but correlation is not causation.', 'green'),
      employee('Elena Rossi', 'ER', 'Regional Operations Lead', '09:18 AM', '@NetworkOps compare the affected corridors with baseline, exclude planned issuer maintenance, and prepare an incident update. Read-only checks only.', 'peach'),
      employee('Maya Patel', 'MP', 'Network Duty Manager', '09:19 AM', 'If confidence is below 80%, keep this at investigation status and list what an operator should verify next.', 'blue'),
    ],
  },
  {
    id: 'fraud-intelligence', name: 'fraud-intelligence', group: 'Safety & security', unread: 7,
    purpose: 'Connect fraud analysts and cyber teams around emerging payment threats.', agentId: 'threat-intelligence', agentHandle: '@ThreatIntel',
    suggestedPrompt: '@ThreatIntel Investigate the card-testing cluster, correlate merchant-domain signals, and prepare a control rule for approval. Do not block anything.',
    messages: [
      employee('Aisha Khan', 'AK', 'Fraud Strategy Director', '10:02 AM', 'We have a burst of low-value approvals across newly seen merchant descriptors. Losses are still low, but the velocity pattern is unusual.', 'violet'),
      employee('Theo Martin', 'TM', 'Cyber Threat Analyst', '10:05 AM', 'Two associated domains were registered this week and share infrastructure with a prior skimming campaign.', 'green'),
      employee('Camila Santos', 'CS', 'Issuer Risk Partner', '10:07 AM', '@ThreatIntel quantify the cluster, separate issuer configuration from merchant threat signals, and prepare—not execute—a candidate control.', 'gold'),
      employee('Aisha Khan', 'AK', 'Fraud Strategy Director', '10:08 AM', 'Route the proposal to me and Theo for dual review. Preserve the evidence trail for issuer communications.', 'violet'),
    ],
  },
  {
    id: 'tokenization-launch', name: 'tokenization-launch', group: 'Digital payments', unread: 2,
    purpose: 'Steer token-requestor certification and wallet launch readiness.', agentId: 'tokenization-launch', agentHandle: '@TokenOps',
    suggestedPrompt: '@TokenOps Check token-requestor readiness, identify missing certification evidence, and draft a launch checklist. Do not approve the launch.',
    messages: [
      employee('Nora Okafor', 'NO', 'Product Launch Lead', '11:21 AM', 'The wallet partner wants to move the pilot forward by three days. Product configuration is complete, but I want the evidence checked independently.', 'peach'),
      employee('Daniel Cho', 'DC', 'Tokenization Engineer', '11:24 AM', 'Provisioning and lifecycle tests passed in the mock environment. Device-binding evidence is the item I am least certain about.', 'blue'),
      employee('Priya Nair', 'PN', 'Compliance Program Manager', '11:26 AM', '@TokenOps check readiness against the launch gate, call out missing certification artifacts, and draft owners. No launch approval.', 'green'),
      employee('Nora Okafor', 'NO', 'Product Launch Lead', '11:27 AM', 'Use “conditional” if any evidence is missing; the date should not drive the recommendation.', 'peach'),
    ],
  },
  {
    id: 'merchant-growth', name: 'merchant-growth', group: 'Commercial growth', unread: 3,
    purpose: 'Turn approval and decline signals into merchant experiments.', agentId: 'growth-insights', agentHandle: '@GrowthInsights',
    suggestedPrompt: '@GrowthInsights Explain the approval-rate change by segment and draft a measurable experiment. Keep all figures labeled as simulated.',
    messages: [
      employee('Sofia Alvarez', 'SA', 'Merchant Growth Lead', '01:04 PM', 'Our simulated marketplace cohort is converting better, yet authorization approval is down 2.1 points week over week.', 'gold'),
      employee('Liam Murphy', 'LM', 'Data Scientist', '01:07 PM', 'The decline is concentrated in cross-border first-time buyers. Sample size is large enough to inspect, not enough to claim causality.', 'blue'),
      employee('Grace Kim', 'GK', 'Customer Success Partner', '01:09 PM', '@GrowthInsights separate mix shift from issuer declines and draft one measurable test the merchant team can review.', 'violet'),
      employee('Sofia Alvarez', 'SA', 'Merchant Growth Lead', '01:10 PM', 'Include a guardrail for fraud rate and make it explicit that the figures are demo data.', 'gold'),
    ],
  },
  {
    id: 'customer-triage', name: 'customer-triage', group: 'Issuer support', unread: 6,
    purpose: 'Triage issuer-reported card and money-movement issues.', agentId: 'triage-coordinator', agentHandle: '@Triage',
    suggestedPrompt: '@Triage My card was charged three times and two were not mine. Investigate and prepare an escalation; do not change the account.',
    messages: [
      employee('Alice Lane', 'AL', 'Issuer Support Manager', '02:21 PM', 'We are seeing duplicate card-charge reports from one issuer support queue. Can we get a quick evidence summary?', 'blue'),
      employee('Bob Okafor', 'BO', 'Payments Support Analyst', '02:23 PM', 'The demo status page is green. Reports appear concentrated around one merchant reference.', 'green'),
      employee('Carol Adams', 'CA', 'Customer Resolution Lead', '02:24 PM', '@Triage investigate the duplicate and unrecognized activity, then prepare an escalation. Do not freeze a card without approval.', 'peach'),
      employee('Alice Lane', 'AL', 'Issuer Support Manager', '02:25 PM', 'Keep customer-facing language separate from the internal evidence summary.', 'blue'),
    ],
  },
]

const mock = (name: string, label: string, output: string, status: MockToolRun['status'] = 'completed'): MockToolRun => ({ name, label, output, status, mock: true })

const workflows: Record<Exclude<ChannelId, 'customer-triage'>, ChannelWorkflowResult> = {
  'network-operations': {
    id: 'turn_mock_net_4102', route: 'network-operations', agent: 'Network Operations', priority: 'P1', durationMs: 726,
    summary: 'Regional authorization degradation isolated for operator review',
    answer: 'The simulation isolates the dip to two routing cohorts after excluding planned issuer maintenance. Edge health is normal; the strongest lead is a configuration mismatch, at 76% confidence. I kept the event in investigation status and made no traffic change.',
    nextStep: 'Have the duty manager compare the routing diff and approve escalation status', actionLabel: 'Review incident',
    tools: [
      mock('check_network_health', 'Network health', 'Edge latency normal · no broad availability event'),
      mock('compare_authorization_rates', 'Authorization comparison', 'Two EU corridors −8.0% vs 28-day baseline · simulated data'),
      mock('exclude_planned_maintenance', 'Maintenance calendar', 'One issuer window excluded · remaining signal persists'),
      mock('draft_incident_update', 'Incident update', 'MOCK-NET-4102 · Investigation · no traffic change'),
    ],
  },
  'fraud-intelligence': {
    id: 'turn_mock_threat_5127', route: 'fraud-intelligence', agent: 'Threat Intelligence', priority: 'P1', durationMs: 918,
    summary: 'Card-testing cluster linked to suspicious merchant-domain signals',
    answer: 'The simulated cluster contains 184 low-value attempts across 27 accounts. Domain signals increase the likelihood of coordinated card testing. I prepared a narrow velocity control for dual review; nothing has been blocked.',
    nextStep: 'Fraud and cyber reviewers inspect the evidence and candidate control', actionLabel: 'Open dual review',
    tools: [
      mock('detect_card_testing_cluster', 'Cluster detection', '184 attempts · 27 demo accounts · 11-minute window'),
      mock('scan_merchant_domain', 'Merchant-domain intelligence', '2 newly registered domains · shared mock infrastructure'),
      mock('correlate_issuer_controls', 'Issuer configuration', 'No common issuer rule change found'),
      mock('prepare_control_rule', 'Control preview', 'Narrow velocity rule prepared · requires dual approval', 'approval_required'),
    ],
  },
  'tokenization-launch': {
    id: 'turn_mock_token_6204', route: 'tokenization-launch', agent: 'Tokenization Launch', priority: 'P2', durationMs: 667,
    summary: 'Wallet pilot is conditionally ready with one certification gap',
    answer: 'Provisioning and lifecycle checks pass in the simulation, but device-binding evidence is incomplete. The launch gate remains conditional. I drafted owners and due dates but did not approve or reschedule the launch.',
    nextStep: 'Tokenization engineering supplies device-binding evidence for compliance review', actionLabel: 'View launch gate',
    tools: [
      mock('check_token_requestor_readiness', 'Token requestor readiness', 'Provisioning pass · lifecycle pass · device binding incomplete'),
      mock('verify_certification_evidence', 'Certification evidence', '7 of 8 mock artifacts present'),
      mock('assess_launch_gate', 'Launch gate', 'Conditional · evidence gap blocks final approval'),
      mock('draft_launch_checklist', 'Launch checklist', 'Owners and target dates prepared · no launch approval'),
    ],
  },
  'merchant-growth': {
    id: 'turn_mock_growth_7318', route: 'merchant-growth', agent: 'Growth Insights', priority: 'P3', durationMs: 583,
    summary: 'Cross-border mix explains most of the simulated approval-rate shift',
    answer: 'The simulated analysis attributes roughly 1.4 of the 2.1-point decline to a larger share of cross-border first-time buyers. Issuer soft declines explain most of the remainder. I drafted a controlled retry-messaging experiment with fraud-rate and complaint guardrails.',
    nextStep: 'Data science validates the cohort definition before merchant review', actionLabel: 'Open experiment',
    tools: [
      mock('segment_approval_rates', 'Segment analysis', 'Cross-border first-time buyers: −4.8 pts · simulated'),
      mock('compare_decline_reasons', 'Decline reasons', 'Soft declines +31% within affected cohort'),
      mock('estimate_mix_effect', 'Mix-shift estimate', '1.4 of 2.1 points explained · non-causal estimate'),
      mock('draft_experiment_brief', 'Experiment brief', 'Two-cell messaging test · fraud and complaint guardrails'),
    ],
  },
}

export function getWorkspace() {
  return {
    organization: 'Mastercard',
    workspace: 'Commerce Operations',
    disclaimer: 'Fictitious employees, conversations, accounts, and operational data for demonstration only.',
    channels,
  }
}

export function runChannelWorkflow(channelId: string, message: string): ChannelWorkflowResult {
  if (channelId === 'customer-triage') return { ...runTriage(message), route: 'customer-triage' }
  if (!(channelId in workflows)) throw new Error('Unknown workflow channel')
  return workflows[channelId as Exclude<ChannelId, 'customer-triage'>]
}
