# Spec: Release Control Agent

## Objective

Add a sixth persistent Buzz agent, `@ReleaseHelper`, to a private
`#release-control` channel. An authorized employee can start a modeled release,
watch its pipeline through real Omnigent asynchronous tool activity, approve the
finish step in a later signed Buzz message, and see the resulting staging URL.
The helper delegates a staging smoke check to `@NetworkOps` through a real signed
Buzz mention, so the second agent runs independently and reports back in the
same thread.

Success means the user can demonstrate all of the following without a mock chat
client: signed human trigger, ACP turn, Omnigent async tool dispatch, ACP
`session/update` activity, human approval boundary, signed agent-to-agent
mention, independent second-agent turn, and signed threaded responses.

## Tech Stack

- Native Buzz Desktop and pinned upstream `buzz-acp`
- Local Buzz relay with Nostr/NIP-OA identities and private membership
- TypeScript ACP bridge over NDJSON stdio
- Local Omnigent server/host over HTTP and SSE
- Copilot or Gemini Omnigent harness
- Deterministic Python tools labeled `SYNTHETIC_MODELED_DATA`

## Commands

- Build: `npm run build`
- Node tests: `npm test`
- Python tests: `python3 -m unittest mastercard_tools.test_tools`
- Run: `npm run demo`
- Health: `curl -fsS http://127.0.0.1:8014/health`
- Release surface health: `curl -fsS http://127.0.0.1:8015/health`

## Project Structure

- `src/platform/provider-profiles.ts` — agent and tool contract
- `src/platform/buzz-seed.ts` — private channel, identities, membership, scripts
- `src/platform/platform-run.ts` — listener catalog and author allowlists
- `src/omnigent-client.ts` — Omnigent SSE to ACP activity mapping
- `src/acp-server.ts` — ACP `session/update` notifications
- `mastercard_tools/tools.py` — deterministic release/pipeline evidence
- `test/` and `mastercard_tools/test_tools.py` — contract and behavior tests
- `docs/DEMO_SCENARIOS.md` — presenter sequence

## Code Style

Use existing named exports, additive TypeScript types, boundary validation, and
deterministic results. ACP updates use a discriminated union:

```ts
type OmnigentActivity =
  | { type: 'tool_started'; callId: string; name: string }
  | { type: 'tool_completed'; callId: string }
```

## Testing Strategy

- Unit-test the modeled release states, stage URL, approval requirement, and
  rejection of unknown releases.
- Contract-test rendered agent YAML for `async: true` only on ReleaseHelper and
  for the correct local tool callables.
- Test Buzz identity migration so an existing local community keeps every key
  while gaining the new release identity.
- Test private channel membership and cross-agent allowlists.
- Test Omnigent function-call SSE events become ACP `tool_call` and
  `tool_call_update` notifications without exposing tool results.
- Run the full Node and Python suites, then verify the live listener/channel map.

## Boundaries

- Always: keep collaboration, signing, membership, ACP, sessions, model harness,
  async dispatch, and agent-to-agent handoff real.
- Always: label all pipeline values and URLs as synthetic modeled data.
- Ask first: any real CI/CD connector, external deployment, or production write.
- Never: treat ACP streaming notifications as durable Buzz messages.
- Never: finish a release in response to the initial start request; a later
  signed employee message must explicitly approve it.
- Never: replace or rotate existing generated Buzz identities during migration.

## Protocol Contract

ACP `session/update` notifications are transient activity for the active turn.
The bridge emits `tool_call` and `tool_call_update` from Omnigent SSE function
call events, alongside existing `agent_message_chunk` updates. Durable progress,
approval, delegation, and outcomes remain signed Buzz messages.

Agent-to-agent coordination is not a private bridge shortcut: ReleaseHelper
publishes a structured `@NetworkOps` mention in `#release-control`. The relay
delivers it to NetworkOps' upstream ACP listener, which runs its own Omnigent
turn and calls back by mentioning `@ReleaseHelper` in the same Buzz thread.

## Success Criteria

1. Status reports six private channels and six listeners.
2. `@ReleaseHelper` appears as an owner-attested remote agent in native Buzz.
3. A start request calls the modeled async pipeline watcher and returns a
   candidate URL plus `AWAITING_HUMAN_APPROVAL`.
4. The Buzz agent activity transcript receives ACP tool-start/tool-complete
   notifications during the turn.
5. Only a later explicit finish message calls the modeled finish tool and
   returns a staged deployment.
6. ReleaseHelper mentions NetworkOps; NetworkOps independently verifies the
   modeled stage and mentions ReleaseHelper on completion.
7. Existing Buzz identity keys survive the additive release-agent migration.
8. Candidate/stage URLs resolve on port `8015`, remain gated before finish,
   and report production traffic as false after the modeled deployment.

## Open Questions

Real pipeline providers, approval systems, and deployment credentials are
intentionally deferred. Their future adapters must preserve this contract.
