# ADR-0001: Separate Buzz Collaboration from Omnigent Execution

## Status

Accepted

## Date

2026-09-02

## Context

The POC needs to demonstrate several employees steering persistent agents through a real Buzz client while all agent execution remains locally governed. The integration must avoid modifying upstream Buzz or Omnigent, avoid a managed sandbox provider, preserve stable agent identities, and allow the underlying model harness to change.

Putting execution logic directly into the collaboration client would couple Buzz UI and identity concerns to model, sandbox, and tool concerns. Building a visually similar web client would demonstrate only a mock. Calling Omnigent independently for each employee would lose the shared-session property at the center of the vision.

## Decision

Use Buzz as the collaboration plane, Omnigent as the execution plane, and a repository-owned ACP bridge as the translation boundary.

One upstream `buzz-acp` process listens for each persistent agent identity. It owns mention detection, recent channel context, allowlisted steering, deduplication, and per-channel session serialization. The repository bridge maps that ACP session to a registered Omnigent agent on an explicit local host, streams the turn to completion, and returns the final response for signed publication to the originating Buzz thread.

Agent definitions, provider selection, tool schemas, prompt policy, and Seatbelt configuration are rendered for Omnigent. Human membership, channel history, mentions, and threaded replies remain in Buzz.

## Alternatives considered

### Build a Buzz-looking web demo

- Fast to style and script.
- Does not prove Buzz identity, membership, signatures, ACP behavior, or client compatibility.
- Rejected because it obscures the architecture the POC is meant to validate.

### Couple Buzz Desktop directly to Omnigent APIs

- Removes one process boundary.
- Requires upstream client changes and makes Buzz understand Omnigent session/runtime details.
- Rejected because it violates execution portability and makes upgrades expensive.

### Use a managed sandbox platform

- Reduces local setup work.
- Adds a third-party execution dependency and weakens the self-hosted story.
- Rejected for this POC. Omnigent runs on the local host with macOS Seatbelt.

### Create one Omnigent session per employee

- Simple request routing.
- Fragments context and produces multiple copies of what should be one team agent.
- Rejected because multi-human shared steering is the core product behavior.

### Make every channel message trigger execution

- Keeps the agent constantly active.
- Creates noise, unpredictable cost, and accidental turns during ordinary human discussion.
- Rejected in favor of context events plus explicit mention-triggered execution events.

## Consequences

Positive:

- Buzz and Omnigent can be pinned and upgraded independently.
- The same Buzz identity can switch between Copilot and Gemini profiles.
- Shared session behavior is explicit and testable.
- Local runtime and sandbox boundaries remain visible.
- The gateway is small enough to replace with a future native remote-agent provider without changing the collaboration model.

Trade-offs:

- The local POC runs one listener process per agent identity.
- First-run Buzz Desktop enrollment needs the user’s public key and a one-time community join.
- Model inference is external when Copilot or Gemini is selected, even though orchestration and tools are local.
- Membership-scoped Buzz channels are not presented as end-to-end encrypted.
- Production identity, policy, audit, high availability, and data-connector controls remain future work.
