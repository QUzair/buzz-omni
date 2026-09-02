# Local Buzz + Omnigent Mastercard POC

This repository runs the actual [Buzz](https://github.com/block/buzz) relay/CLI/ACP stack and the actual [Omnigent](https://github.com/omnigent-ai/omnigent) server/host stack on one Mac. The demo surface is the installed Buzz Desktop client. Omnigent is the local agent runtime behind it, not a replacement chat UI.

![Buzz Desktop showing a real TokenLaunch thread](artifacts/buzz-tokenization-launch.png)

The operational evidence returned by the agent tools is deliberately synthetic. The collaboration transport, Nostr identities and signatures, membership-scoped channels, owner-attested agent identities, ACP listeners, Omnigent sessions, model harness, sandbox, tool calls, and threaded Buzz replies are live components.

## Architecture

```text
Buzz Desktop on macOS
  └─ local Buzz relay :8010
       └─ one upstream buzz-acp listener per agent/channel
            └─ ACP-over-stdio bridge in this repository
                 └─ local Omnigent server :8013
                      └─ local Omnigent host/runner
                           └─ macOS Seatbelt sandbox
                                └─ Copilot SDK or Gemini harness
                                     └─ modeled Mastercard tool
                                          └─ signed threaded reply to Buzz
```

No Daytona, E2B, Modal, hosted sandbox, public callback, or fake Buzz web client is used. The selected model provider still receives model prompts; the execution host, sandbox, tools, Buzz data, and Omnigent control plane stay local.

## Run it

Prerequisites:

- macOS with Buzz Desktop installed
- Node.js 20.11+, Docker Desktop, Rust/Cargo, Git, and `uv`
- for the default provider, an authenticated local GitHub Copilot CLI

Copy only the **public key** from **Buzz → Settings → Profile → Identity**. Never copy or expose the private key.

```bash
npm install
npm run platform:bootstrap
BUZZ_DESKTOP_PUBKEY=<64-character-public-key> MODEL_PROVIDER=copilot npm run demo
```

`platform:bootstrap` is a one-time build/install of the pinned upstream revisions. `npm run demo` is the real platform launcher and is equivalent to `npm run platform:up`.

In Buzz Desktop:

1. Open the profile menu, expand **Community actions**, and choose **Add a community**.
2. Choose **Join an existing community**.
3. Enter `http://127.0.0.1:8010`.
4. Open `#tokenization-launch` or another seeded channel.
5. Mention the channel agent, for example: `@TokenLaunch use check_tokenization_readiness for TR-DEMO-781. Do not grant approval.`

The public-key environment variable enrolls that existing Buzz identity in the relay and all five channels. It is not a secret. Enrollment persists in the local Docker volume, so subsequent runs can omit it unless the Buzz identity changes.

Press `Ctrl-C` in the launcher terminal to stop Omnigent, all ACP listeners, and the local Buzz containers cleanly.

## Switch model harnesses

Copilot is the default and uses the local Copilot CLI/SDK authentication already present on the machine:

```bash
MODEL_PROVIDER=copilot npm run demo
```

Gemini is an alternate Omnigent harness. Keep its key in the calling shell; the platform does not write it to the repository or generated configuration:

```bash
export GEMINI_API_KEY='your-rotated-key'
MODEL_PROVIDER=gemini npm run demo
```

If a key has ever been pasted into a chat or screenshot, revoke it and issue a new one before use.

## Live local ports

| Port | Component |
| ---: | --- |
| `8010` | Buzz HTTP/WebSocket relay |
| `8011` | Buzz readiness endpoint |
| `8012` | Buzz Prometheus metrics |
| `8013` | Omnigent API and optional session inspection UI |
| `8014` | Read-only platform status page |

All published ports bind to `127.0.0.1`.

## Mastercard triage communities

| Buzz channel | Agent | Modeled tool behavior |
| --- | --- | --- |
| `#network-operations` | `@NetworkOps` | Compares authorization health by corridor and isolates likely fault domains. |
| `#fraud-intelligence` | `@FraudReview` | Reviews synthetic suspicious activity and returns approval-gated controls. |
| `#tokenization-launch` | `@TokenLaunch` | Checks certification gates, blockers, owners, and go/no-go status. |
| `#settlement-operations` | `@SettlementOps` | Traces modeled batch variance without changing settlement state. |
| `#compliance-evidence` | `@ComplianceReview` | Inventories synthetic control evidence and distinguishes gaps from failures. |

The seeded employees and conversations are fictitious. Write-like tools produce previews or recommendations only; they do not touch Mastercard systems or grant operational approval.

## What is real and what is modeled

Real:

- upstream Buzz relay, `buzz` CLI, `buzz-acp`, and the installed Buzz Desktop app
- signed Nostr messages, relay membership, private channel membership, and NIP-OA owner attestations
- upstream Omnigent server, SQLite session state, local host/runner, provider harness, and macOS Seatbelt sandbox
- five concurrent agent listeners, session creation, tool dispatch, and signed threaded responses

Modeled:

- Mastercard employees, accounts, corridors, control IDs, and operational scenarios
- Python tool return values in `mastercard_tools/`
- approval and mutation outcomes, which remain non-executing previews

Buzz's private channels are membership-scoped. This POC does not claim end-to-end encryption.

## Reproducibility and state

- Buzz source: `1c8321cd08feb597f8bcff5195c21148fb3e98ed`
- Omnigent source: `f2a670b348f7110bf4ea18b643bcd3852f1d9712`
- Buzz container: `ghcr.io/block/buzz:sha-1c8321c`
- generated identities, local credentials, databases, logs, and workspaces live under ignored `.local/`
- runtime state is written to `.local/platform/runtime-state.json`

The bootstrap verifies the upstream repository before checking out the pinned Buzz commit and installs Omnigent directly from its pinned official repository revision.

## Verification

```bash
npm test
python3 -m unittest mastercard_tools.test_tools
curl -fsS http://127.0.0.1:8011/_readiness
curl -fsS http://127.0.0.1:8014/health
```

The end-to-end path has been exercised with both `@NetworkOps` and `@TokenLaunch`: a signed Buzz mention created a local Omnigent session, invoked the required modeled tool through the Copilot harness, and published a signed reply into the originating Buzz thread.

## Useful files

- `src/platform/platform-bootstrap.ts` — pinned upstream bootstrap
- `src/platform/platform-run.ts` — one-process local orchestrator
- `src/platform/buzz-seed.ts` — identities, private channels, employee messages, and desktop enrollment
- `src/platform/provider-profiles.ts` — Copilot/Gemini Omnigent agent profiles
- `mastercard_tools/tools.py` — explicitly synthetic agent tools
- `artifacts/buzz-tokenization-launch.png` — native Buzz Desktop proof

Upstream contracts: [Buzz ACP lifecycle](https://github.com/block/buzz/tree/main/crates/buzz-acp), [Buzz CLI](https://github.com/block/buzz/tree/main/crates/buzz-cli), [Omnigent agents and hosts](https://github.com/omnigent-ai/omnigent), and the [GitHub Copilot SDK](https://github.com/github/copilot-sdk).
