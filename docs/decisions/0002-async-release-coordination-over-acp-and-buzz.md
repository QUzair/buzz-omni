# ADR-0002: Separate ACP Activity from Durable Release Coordination

## Status

Accepted

## Date

2026-09-02

## Context

The release demonstration needs to show three related behaviors without implying a real CI/CD integration: asynchronous pipeline work, a human-controlled finish gate, and one agent asking another agent to verify staging. Buzz and ACP expose different kinds of protocol state, so treating either as the complete workflow record would blur important boundaries.

ACP `session/update` messages are tied to a live prompt and are suitable for progress such as tool start and completion. They are not durable channel events and do not independently prove who approved a consequential step. A direct in-process call from ReleaseHelper to NetworkOps would execute quickly, but it would bypass Buzz identities, channel membership, signatures, threading, and the second agent's listener/session lifecycle.

## Decision

Use ACP updates only for transient, redacted execution activity. The bridge maps Omnigent function-call lifecycle items to ACP `tool_call` and `tool_call_update` notifications and never copies function arguments or output into those notifications.

Use signed Buzz events for every durable coordination milestone:

- the employee's initial `@ReleaseHelper` trigger;
- ReleaseHelper's candidate URL and explicit approval request;
- a later, separate signed employee message approving release finish;
- the modeled deployment result;
- ReleaseHelper's structured `@NetworkOps` delegation;
- NetworkOps' signed `@ReleaseHelper` verification callback;
- ReleaseHelper's final summary.

The finish tool accepts the later Buzz event ID as approval evidence. It changes only the synthetic loopback surface on port `8015`; no CI/CD, cloud, or production system is connected.

Agent-to-agent coordination travels through the same real Buzz relay path as human-to-agent coordination. Both agents are bot members of `#release-control`, each listener explicitly allowlists the peer public key, and each mention creates an independent ACP and Omnigent turn.

## Alternatives considered

### Put all progress into Buzz messages

- Produces durable visibility.
- Creates noisy intermediate chat events and loses ACP's native live activity semantics.
- Rejected for tool lifecycle; only meaningful milestones become Buzz messages.

### Treat ACP updates as the release audit record

- Keeps workflow state near execution.
- ACP activity is transient and does not provide a durable signed human approval event.
- Rejected because approvals and outcomes belong in the collaboration record.

### Call NetworkOps directly from the bridge or Python tool

- Avoids a relay round trip.
- Erases agent identity, membership, signature, listener, and session boundaries.
- Rejected because the demo is meant to prove genuine agent-to-agent collaboration.

### Poll a pipeline on a background timer

- Resembles a continuously watching release bot.
- Adds lifecycle and recovery complexity that is unnecessary for a bounded local POC.
- Rejected in favor of Omnigent's native async tool dispatch initiated by an explicit human mention.

## Consequences

Positive:

- The UI can show live activity without leaking tool payloads into the protocol stream.
- Human authority is evidenced by a distinct signed event.
- Agent delegation is observable and independently executable.
- The future replacement of modeled tools with approved adapters does not change the collaboration contract.

Trade-offs:

- A complete release thread contains several turns and can take longer than a direct function chain.
- Prompt policy must prevent callback loops and preserve the separate finish gate.
- The port `8015` state is intentionally ephemeral and resets when the local platform restarts.
- Production-grade workflow recovery, durable job queues, CI/CD adapters, and enterprise approval systems remain out of scope.
