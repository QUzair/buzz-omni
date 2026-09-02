# Buzz → self-hosted Omnigent

A minimal proof of concept for invoking an Omnigent agent from an `@mention` in Buzz. It uses no cloud sandbox provider: the Omnigent server and host run on hardware you control, and the included agent uses macOS's built-in Seatbelt sandbox.

```text
Buzz Desktop
  └─ buzz-acp (mentions, channel queue, shared context)
       └─ buzz-omnigent-acp (this ACP-over-stdio bridge)
            └─ your Omnigent server
                 └─ your Omnigent host/runner
                      └─ macOS Seatbelt sandbox → Codex agent
```

The bridge creates one external-host Omnigent session for each ACP session, forwards the Buzz thread, streams the response, and publishes the final answer back to the triggering thread.

## Local triage demo

The repository also includes a zero-credential demo with three triage agents and deterministic mock tools. Both services bind to loopback only:

```bash
npm install
npm run demo
```

- Buzz-faithful collaboration client: `http://127.0.0.1:8008/?demo=1`
- Buzz Agents setup: `http://127.0.0.1:8008/?view=agents`
- Self-hosted Omnigent-shaped mock runtime: `http://127.0.0.1:8009`

Try the fraud route or open `http://127.0.0.1:8008/?demo=1&scenario=payments` for payments operations. The setup includes a Triage Coordinator, Fraud Review, and Payments Operations agent. Every tool is explicitly labeled as mock, mutations are previews only, and the fraud card-freeze step requires human approval.

The local shell follows the upstream Buzz desktop layout: native-style window chrome, the yellow-to-blue workspace sidebar, dense channel messages, a bottom composer, and a dedicated Agents view. Agent routing and mock-tool activity remain inside the conversation instead of occupying a separate operations dashboard.

## Prerequisites

- macOS and Node.js 20.11+
- Buzz Desktop with `buzz` and `buzz-acp` available
- Omnigent installed locally
- A Codex credential available to the Omnigent host process

No Daytona, E2B, Modal, Docker, or public callback URL is involved.

## 1. Install the bridge

```bash
npm install
npm test
npm link
```

`npm link` places `buzz-omnigent-acp` on `PATH` so Buzz can launch it as a custom harness.

## 2. Start your Omnigent server and host

From this repository, start Omnigent on loopback and register the included agent:

```bash
pip install omnigent
export OPENAI_API_KEY='...'

omnigent server \
  --host 127.0.0.1 \
  --port 6767 \
  --agent "$PWD/agents/market-strategy.yaml"
```

In a second terminal, attach this Mac as an Omnigent execution host:

```bash
omnigent host http://127.0.0.1:6767 --background
omnigent host status --server http://127.0.0.1:6767 --json
```

Copy `host_id` from the status output. Open `http://127.0.0.1:6767`, find `masscard_market_strategy`, and copy its agent ID. Choose an existing absolute directory on this Mac for agent work; for a disposable POC, create a dedicated empty directory.

The YAML in [`agents/market-strategy.yaml`](./agents/market-strategy.yaml) explicitly selects `darwin_seatbelt`, limits writes to the session workspace, and blocks network access from sandboxed OS tools. Model API access remains in the Omnigent/Codex harness process.

To run the host on another Mac you own, run `omnigent host https://your-own-omnigent-server --background` there and use that host's ID and workspace path. Use HTTPS whenever the server is not loopback-only.

## 3. Register the custom harness in Buzz

In Buzz Desktop, open **Settings → Agent runtimes → Add custom harness** and enter:

- ID: `omnigent`
- Label: `MassCard Omnigent`
- Command: `buzz-omnigent-acp`
- Environment:
  - `OMNIGENT_BASE_URL=http://127.0.0.1:6767`
  - `OMNIGENT_AGENT_ID=ag_…`
  - `OMNIGENT_HOST_ID=<host_id from the status command>`
  - `OMNIGENT_WORKSPACE=/absolute/path/to/agent-workspace`

The equivalent JSON is in [`config/buzz-custom-harness.example.json`](./config/buzz-custom-harness.example.json).

Create a Buzz agent using the **MassCard Omnigent** runtime, add it to a channel, then send:

```text
@Market Strategy compare Germany and France for our first launch.
```

Buzz detects the mention, serializes turns per channel, and supplies thread context. The bridge asks Omnigent to bind the session to your configured host, waits for the sandboxed turn, then posts a threaded Buzz reply.

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `OMNIGENT_BASE_URL` | yes | Omnigent API URL. Non-loopback URLs must use HTTPS. |
| `OMNIGENT_AGENT_ID` | yes | Registered Omnigent agent ID. |
| `OMNIGENT_HOST_ID` | yes | UUID of the host/runner machine you control. |
| `OMNIGENT_WORKSPACE` | yes | Absolute workspace path on that host. |
| `OMNIGENT_API_TOKEN` | no | Bearer-token override; otherwise the bridge reads Omnigent's local token store. |
| `BUZZ_CLI` | no | Buzz executable; defaults to `buzz`. |
| `BRIDGE_MAX_PROMPT_BYTES` | no | Maximum ACP prompt size; defaults to 128 KiB. |
| `BRIDGE_TURN_TIMEOUT_MS` | no | Hard turn deadline; defaults to 15 minutes. |

## POC boundaries

- One ACP session maps to one self-hosted Omnigent session; Buzz owns per-channel serialization.
- Answers are posted after the turn completes. ACP deltas are emitted for observability but are not posted as partial messages.
- Interactive Omnigent approvals are not bridged; the demo agent must not require an approval UI.
- Token refresh and Omnigent-session cleanup are not automated yet.
- The sample agent targets macOS. On a Linux host, change the sandbox type to Omnigent's `linux_bwrap` and install its local OS prerequisite.

## Security notes

- Buzz content is length-limited and forwarded only as user input.
- Channel UUIDs and reply event IDs are structurally validated.
- Buzz publishing uses an argument array and stdin, never a shell.
- Host ID and workspace are explicit; the bridge cannot ask Omnigent to provision vendor infrastructure.
- The workspace must be absolute, remote cleartext HTTP is rejected, and server error bodies are not exposed.

## Upstream contracts

- [Buzz custom ACP harness and mention lifecycle](https://github.com/block/buzz/blob/main/crates/buzz-acp/README.md)
- [Buzz CLI message publishing](https://github.com/block/buzz/blob/main/crates/buzz-cli/README.md)
- [Omnigent external hosts](https://github.com/omnigent-ai/omnigent/blob/main/README.md#connect-another-machine)
- [Omnigent agent YAML and OS sandbox](https://github.com/omnigent-ai/omnigent/blob/main/docs/AGENT_YAML_SPEC.md#os-environment-os_env)
- [Omnigent session API](https://github.com/omnigent-ai/omnigent/blob/main/openapi.json)
