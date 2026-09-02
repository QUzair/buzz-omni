# Demo Scenarios and Sequence

This runbook is designed for a 12–15 minute architecture demonstration. The people, identifiers, metrics, and operational evidence are fictitious. The software path is real.

## Before the room joins

1. Complete the one-time setup and configure `.env`.
2. Run `npm run doctor`; every required check should be green.
3. Run `npm run demo` and leave the terminal visible until it reports five private Buzz channels.
4. Confirm [the status page](http://127.0.0.1:8014/) shows Buzz and Omnigent as ready.
5. In Buzz Desktop, join `http://127.0.0.1:8010` once if it is not already listed.
6. Open `#network-operations` and keep the channel list visible.

Do not open the Omnigent UI as the primary experience. Buzz is the collaboration surface. Omnigent is useful only as optional backend evidence after the audience has seen a complete Buzz turn.

## Act 1 — establish the architecture (2 minutes)

Show the five locked Buzz channels and explain:

- employee and agent messages are signed identities on the real local relay;
- several employee personas contribute context in each channel;
- an explicit `@agent` mention triggers execution;
- Omnigent owns the model, sandbox, session, and tools behind that stable Buzz identity;
- every operational result is synthetic and every consequential action remains human-controlled.

Use the status page briefly to show five live listeners, then return to Buzz.

## Act 2 — network incident triage (3 minutes)

- Channel: `#network-operations`
- Employees: Maya Patel, Jon Bell, Elena Rossi
- Agent: `@NetworkOps`
- Required tool: `compare_authorization_health`

Paste:

```text
@NetworkOps use compare_authorization_health for DE and FR, exclude planned maintenance, isolate the likely fault domain, and draft an incident update. Do not change traffic.
```

Expected modeled evidence:

- DE authorization rate `91.8%` versus `96.3%` baseline;
- FR authorization rate `88.1%` versus `95.7%` baseline;
- modeled likely fault domain: issuer-routing corridor configuration;
- confidence `0.82`;
- no traffic mutation.

Narrative point: Maya supplies the signal, Jon contributes an infrastructure observation, and Elena defines the safe decision boundary. The agent works from their shared channel context and posts into the triggering thread.

## Act 3 — approval-gated fraud review (2 minutes)

- Channel: `#fraud-intelligence`
- Employees: Maya Patel, Priya Shah, Elena Rossi
- Agent: `@FraudReview`
- Required tool: `assess_fraud_cluster`

Paste:

```text
@FraudReview assess modeled merchant DEMO-M-204 over 60 minutes. Explain the evidence and propose the approval path. Do not restrict the merchant or change a rule.
```

Expected modeled evidence:

- `1,842` attempted transactions across `1,631` accounts;
- `0.91` low-value ratio;
- high modeled risk;
- recommendation to prepare an approval-gated merchant control review;
- no enforcement action.

Narrative point: the agent can make a risk assessment, but a control change is represented only as a human-owned next step.

## Act 4 — tokenization launch decision (3 minutes)

- Channel: `#tokenization-launch`
- Employees: Priya Shah, Jon Bell, Elena Rossi
- Agent: `@TokenLaunch`
- Required tool: `check_tokenization_readiness`

Paste:

```text
@TokenLaunch use check_tokenization_readiness for TR-DEMO-781. Report the returned gates, owners, blocker, and recommendation only. Do not grant approval.
```

Expected modeled evidence:

- cryptogram validation — passed — Token Engineering;
- lifecycle events — passed — Digital Payments QA;
- token assurance — passed — Risk Product;
- issuer rollback rehearsal — blocked — Issuer Integration;
- recommendation `NO_GO_PENDING_OWNER_APPROVAL`;
- no launch approval.

Narrative point: this is the clearest executive scenario because the agent produces a structured decision artifact while preserving the difference between a recommendation and authority.

## Act 5 — settlement variance (2 minutes)

- Channel: `#settlement-operations`
- Employees: Maya Patel, Jon Bell, Elena Rossi
- Agent: `@SettlementOps`
- Required tool: `investigate_settlement_variance`

Paste:

```text
@SettlementOps investigate modeled batch SET-DEMO-042, quantify the variance, identify the returned cause, and give the next safe verification step. Do not change settlement state.
```

Expected modeled evidence:

- expected amount `€12,884,112.43`;
- reported amount `€12,861,940.18`;
- variance `-€22,172.25`;
- modeled cause: late issuer adjustment file;
- reconciliation pending the next file window.

Narrative point: the agent diagnoses with bounded evidence and explicitly avoids mutating financial state.

## Act 6 — compliance evidence handoff (2 minutes)

- Channel: `#compliance-evidence`
- Employees: Elena Rossi, Priya Shah, Maya Patel
- Agent: `@ComplianceReview`
- Required tool: `lookup_control_evidence`

Paste:

```text
@ComplianceReview use lookup_control_evidence for CTRL-DEMO-17. Distinguish missing evidence from control failure and prepare an owner-ready inventory. This is not legal advice.
```

Expected modeled evidence:

- control: dual approval for high-impact operational changes;
- modeled approval log, change ticket, and rollback record;
- one evidence item nearing its review date;
- no claim of a failed control and no legal conclusion.

Narrative point: the same collaboration architecture supports evidence preparation without pretending the agent is a compliance authority.

## Close — show portability (1 minute)

Return to the terminal and `.env.example`:

- `MODEL_PROVIDER=copilot` selects the native Copilot SDK harness;
- `MODEL_PROVIDER=gemini` plus a fresh `GEMINI_API_KEY` selects the native Gemini/Antigravity harness;
- the Buzz handles, channels, employee experience, tool contracts, and safety rules do not change.

End with the thesis: the team owns a persistent AI colleague in Buzz; Omnigent makes its execution portable and governed.

## Five-minute executive cut

If time is limited:

1. Show the locked channel list and status page.
2. Run only the tokenization scenario.
3. Point out the real threaded reply, synthetic data label, named owners, blocked gate, and no-go recommendation.
4. Show the provider switch in `.env.example`.
5. Close on the collaboration-plane/execution-plane separation.

## Recovery cues

If an agent does not reply:

1. Check `http://127.0.0.1:8014/` for relay, Omnigent, and listener status.
2. Confirm the mention uses the exact visible agent handle.
3. Confirm the employee identity is an allowed channel member.
4. Inspect `.local/logs/buzz-acp-<agent>.log` and `.local/logs/omnigent-server.log`.
5. For Gemini, verify `GEMINI_API_KEY` is a new valid key; never display it to the audience.

Do not substitute the retired fake browser client if the runtime is unavailable. Diagnose the real component boundary or use the already captured native Buzz screenshot in `artifacts/`.
