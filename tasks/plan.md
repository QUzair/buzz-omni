# Implementation Plan: Release Control Agent

## Overview

Build a release-control vertical slice on the existing local Buzz + Omnigent
platform: safe identity migration, a private channel and remote agent, modeled
async pipeline tools, ACP activity translation, cross-agent delegation, and a
presenter-ready runbook.

## Architecture Decisions

- ACP updates carry transient execution activity; Buzz messages carry durable
  collaboration and approvals.
- Agent-to-agent work travels through signed Buzz mentions and independent ACP
  listeners, preserving identity and auditability.
- Release mutations remain modeled and require a later employee approval event.
- Existing identity state is migrated additively instead of regenerated.

## Task List

### Phase 1: Contract and safety

- [x] Add failing tests for the new agent/tool/channel catalog.
- [x] Add a failing identity-state migration test.
- [x] Add failing ACP activity translation tests.

### Checkpoint: Contract

- [x] New tests fail for the intended missing behavior.

### Phase 2: End-to-end feature

- [x] Implement additive identity migration and release channel seeding.
- [x] Implement modeled release watch, finish, and stage-verification tools.
- [x] Render ReleaseHelper with Omnigent async builtins enabled.
- [x] Translate Omnigent function-call SSE events into ACP session updates.
- [x] Permit the explicit ReleaseHelper ↔ NetworkOps signed handoff.

### Checkpoint: Feature

- [x] Full Node and Python suites pass.
- [x] Generated YAML contains the intended async/tool contracts.

### Phase 3: Demo and live verification

- [x] Record the protocol decision and update architecture/vision/runbook.
- [x] Restart the single-command platform and verify six healthy listeners.
- [x] Verify the private release channel and both bot memberships on the relay.

### Checkpoint: Complete

- [x] All implementation success criteria are evidenced; native client discovery
  awaits the operator's `BUZZ_DESKTOP_PUBKEY` enrollment.
- [x] Git diff contains no secrets or unrelated changes.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing identities are regenerated | High | Additive migration test before implementation |
| ACP activity is mistaken for durable chat | Medium | Document and test the transport split |
| Agent callback loops | Medium | Explicit two-agent allowlists and role prompts |
| Model invents deployment facts | High | Required deterministic tools and synthetic labels |
| Finish runs without approval | High | Separate finish tool and later-message prompt rule |

## Open Questions

No blocker for the POC. Real CI/CD and production approval connectors remain
out of scope.
