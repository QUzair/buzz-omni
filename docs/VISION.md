# Vision: Shared AI Colleagues with Governed Execution

## North star

> Buzz is the shared human–agent collaboration plane. Omnigent is the governed agent execution plane.

People collaborate with persistent agent identities in Buzz. The models, tools, sandboxes, policies, sessions, and execution lifecycle behind those identities live in Omnigent. A small Mastercard-owned gateway translates collaboration into execution without coupling either upstream project to the other.

The organizational primitive is not “a person talking to their assistant.” It is:

```text
multiple people ↔ one persistent team agent ↔ one governed execution plane
```

The agent’s social identity and decision history remain with the team even when its model, harness, toolset, or execution host changes.

## The problem

Most enterprise agent experiences create isolated, person-specific chat sessions. That fragments context, hides disagreements, and makes the agent feel like an individual productivity tool rather than an accountable team participant.

Operational teams need a different model:

- several employees can steer the same agent session;
- human discussion updates context without waking the agent on every message;
- explicit mentions trigger serialized, auditable turns;
- tools execute inside a controlled runtime rather than the collaboration client;
- recommendations and write-like actions stop at clear human approval boundaries;
- the visible agent identity survives changes in the underlying model or harness.

## Product thesis

Buzz answers: **who is collaborating, where, and around what?**

Omnigent answers: **how does the agent execute safely?**

The gateway answers: **how does a shared conversation become a governed agent turn?**

That separation lets Buzz remain independent of whether an agent uses Copilot, Gemini, Codex, Claude, an internal model, or a future local endpoint. Omnigent owns execution portability; Buzz owns the human and social protocol.

## Experience principles

### Shared steering, not parallel private chats

Maya, Elena, Jon, and Priya discuss evidence in one Buzz channel. A mention such as `@TokenLaunch` appends the triggering request and recent channel context to the same persistent Omnigent session. The response returns to the originating Buzz thread so the team can inspect, challenge, and refine it together.

### Context and execution are different events

Ordinary channel messages contribute context. An explicit agent mention is an execution event. This keeps the agent informed without making it noisy.

### One mutable session means one turn at a time

The gateway deduplicates Buzz event IDs and serializes turns per agent/channel session. Concurrent mentions do not race against shared state. Deliberate branching and multi-agent review are later capabilities, not accidental behavior.

### Identity is stable; execution is portable

The Buzz agent owns a cryptographic identity and an owner attestation. Its Omnigent definition can switch harnesses without changing the handle employees mention or the channel history they rely on.

### Evidence before recommendation

Each specialist must invoke its named tool before making an operational claim. Tool failures produce an explicit “evidence unavailable” response, not invented facts. All current datasets are visibly marked `SYNTHETIC_MODELED_DATA`.

### Humans retain consequential authority

The POC can diagnose, compare, summarize, and preview. It does not route traffic, restrict merchants, advance launches, change settlement state, or grant compliance approval. Those actions remain outside the demo and require authorized human workflows.

## What this repository proves

The local POC demonstrates the complete collaboration-to-execution loop on one Mac:

1. a fictitious employee publishes a signed Buzz mention;
2. an upstream `buzz-acp` listener recognizes the persistent agent identity;
3. the repository bridge maps the Buzz session to Omnigent;
4. the local Omnigent host starts or resumes the governed session;
5. the selected Copilot or Gemini harness calls a scenario-specific modeled tool;
6. the agent publishes a signed threaded reply back to Buzz.

The demo uses the real Buzz Desktop app, relay, signatures, membership model, ACP listener, Omnigent server, Omnigent host, model harness, sandbox, and session API. Only the Mastercard people, incidents, metrics, accounts, and tool data are modeled.

## Near-term roadmap

### POC — local proof, implemented here

- one self-hosted Buzz community with five membership-scoped channels;
- five persistent agent identities and five concurrent ACP listeners;
- shared sessions steered by several signed employee identities;
- a local Omnigent server/host with macOS Seatbelt isolation;
- switchable Copilot and Gemini harness profiles;
- synthetic, approval-safe operational tools.

### Pilot — governed internal evaluation

- enterprise identity mapping and employee lifecycle integration;
- durable event-to-turn correlation and an operator audit view;
- policy-backed tool authorization and explicit approval callbacks;
- observability, retention, backup, and recovery controls;
- approved internal data connectors with data-classification enforcement;
- multiple real Buzz clients representing separate employees.

### Platform — portable shared agent runtime

- remote execution hosts and workload placement policies;
- centrally managed agent catalog and versioned tool contracts;
- intentional session branching, reviewer agents, and convergence workflows;
- reaction-driven approval and escalation semantics;
- model routing that can include approved local or private endpoints.

## POC success criteria

The POC is successful when a reviewer can see, without relying on a mock frontend, that:

- several employee identities share one Buzz channel with a persistent agent;
- an explicit mention creates a real Omnigent turn;
- the expected named tool is visible in the resulting session evidence;
- the answer is posted to the correct Buzz thread and labeled synthetic;
- the runtime can switch providers without changing the Buzz agent identity;
- every consequential recommendation ends at a human decision boundary.

## Non-goals

This repository is not a Mastercard production deployment, a real operational data connector, an autonomous control system, an end-to-end encrypted messaging claim, or a production identity/governance implementation. It is a locally runnable architectural proof with truthful component boundaries.
