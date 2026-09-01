# Buzz → Omnigent ACP bridge

A minimal proof of concept that lets a Buzz user `@mention` an agent and run that turn in a server-managed Omnigent sandbox.

```text
Buzz Desktop
  └─ buzz-acp (identity, mentions, channel queue, shared context)
       └─ buzz-omnigent-acp (this project; ACP over stdio)
            └─ Omnigent session API + SSE
                 └─ managed Daytona/Modal/Islo/E2B sandbox
                      └─ Codex agent
```

The bridge creates one Omnigent session for each ACP session, forwards the complete Buzz thread prompt, streams the response, and publishes the final answer back to the triggering Buzz thread with `buzz messages send`.

## Prerequisites

- Node.js 20.11+
- Buzz Desktop with the `buzz` and `buzz-acp` binaries available
- An Omnigent server configured for a managed sandbox provider
- A model credential available to the sandbox provider

## 1. Install the bridge

```bash
npm install
npm test
npm link
```

`npm link` puts `buzz-omnigent-acp` on your `PATH`, which lets Buzz launch it as a custom harness.

## 2. Start Omnigent with a managed sandbox

The included example uses Daytona. Install Omnigent with that provider, expose the server at a public HTTPS URL that the sandbox can dial back to, and set secrets in the server process—not in YAML:

```bash
pip install 'omnigent[daytona]'

export DAYTONA_API_KEY='...'
export OPENAI_API_KEY='...'

omnigent server \
  --host 0.0.0.0 \
  --port 8000 \
  --config ./config/omnigent-daytona.example.yaml \
  --agent ./agents/market-strategy.yaml
```

Set `sandbox.server_url` in the config to the public HTTPS address before starting. The server automatically pre-registers the agent passed with `--agent`. Sign in and copy its `ag_…` ID from the Omnigent UI.

Authenticate the local machine once; the bridge reads the unexpired JWT from Omnigent's user-only token store:

```bash
omnigent login https://your-omnigent.example
```

You can instead set `OMNIGENT_API_TOKEN` in the Buzz harness environment. Do not place the token in the checked-in example.

## 3. Register the custom harness in Buzz

In Buzz Desktop, open **Settings → Agent runtimes → Add custom harness** and enter:

- ID: `omnigent`
- Label: `MassCard Omnigent`
- Command: `buzz-omnigent-acp`
- Environment:
  - `OMNIGENT_BASE_URL=https://your-omnigent.example`
  - `OMNIGENT_AGENT_ID=ag_…`
  - `OMNIGENT_SANDBOX_PROVIDER=daytona`

The equivalent JSON is in [`config/buzz-custom-harness.example.json`](./config/buzz-custom-harness.example.json).

Create a Buzz agent using the **MassCard Omnigent** runtime, add it to a channel, then send:

```text
@Market Strategy compare Germany and France for our first launch.
```

Buzz detects the Nostr `p`-tag mention, serializes turns per channel, and supplies the thread context. The bridge creates a managed Omnigent session, waits for the sandboxed turn, then posts the answer as a threaded Buzz reply.

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `OMNIGENT_BASE_URL` | yes | Omnigent API base URL. Remote URLs must use HTTPS; local HTTP is allowed. |
| `OMNIGENT_AGENT_ID` | yes | Registered Omnigent `ag_…` agent ID. |
| `OMNIGENT_SANDBOX_PROVIDER` | no | Managed provider override, such as `daytona` or `modal`. |
| `OMNIGENT_WORKSPACE_URL` | no | Git URL (optionally `#branch`) cloned into the managed sandbox. |
| `OMNIGENT_API_TOKEN` | no | Bearer token override. Otherwise the bridge reads `~/.omnigent/auth_tokens.json`. |
| `BUZZ_CLI` | no | Buzz executable; defaults to `buzz`. |
| `BRIDGE_MAX_PROMPT_BYTES` | no | Maximum accepted ACP prompt size; defaults to 128 KiB. |
| `BRIDGE_TURN_TIMEOUT_MS` | no | Hard turn deadline; defaults to 15 minutes. |

## POC boundaries

- One ACP session maps to one managed Omnigent session; Buzz owns per-channel serialization.
- The final answer is posted after the turn completes. ACP deltas are emitted for observability but are not posted as partial Buzz messages.
- Interactive Omnigent elicitations/approvals are not bridged in this POC; configure the agent so its policies do not require an approval UI for the demonstrated turn.
- Token refresh is not implemented in the bridge. Run `omnigent login` again if the stored JWT expires.
- Deleting the Buzz agent does not yet delete its Omnigent managed sessions. Clean them up in Omnigent after a demo.

## Security notes

- Untrusted Buzz content is length-limited and forwarded only as user input.
- Channel UUIDs and reply event IDs are parsed from Buzz's structural context and validated before use.
- Buzz publishing uses an argument array and stdin, never a shell, preventing command injection through model output.
- Remote Omnigent URLs must use HTTPS. Secrets are neither logged nor committed.
- The Omnigent server, not this bridge, provisions the sandbox and injects model credentials. Managed sandboxes authenticate back with a per-launch token.

## Upstream contracts

This POC follows the current upstream interfaces:

- [Buzz custom ACP harness and mention lifecycle](https://github.com/block/buzz/blob/main/crates/buzz-acp/README.md)
- [Buzz CLI message publishing](https://github.com/block/buzz/blob/main/crates/buzz-cli/README.md)
- [Omnigent agent YAML](https://github.com/omnigent-ai/omnigent/blob/main/docs/AGENT_YAML_SPEC.md)
- [Omnigent managed sandbox deployment](https://github.com/omnigent-ai/omnigent/blob/main/deploy/README.md#run-hosts-in-cloud-sandboxes)
- [Omnigent OpenAPI contract](https://github.com/omnigent-ai/omnigent/blob/main/openapi.json)
