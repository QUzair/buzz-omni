# Environment and Local Operations

## Configuration flow

`npm run setup` creates `.env` from `.env.example` if it does not already exist. The file is mode `0600` and ignored by Git. `npm run demo` loads it automatically.

Explicit shell environment variables override values in `.env`. This is useful for one-off provider switches:

```bash
MODEL_PROVIDER=gemini GEMINI_API_KEY='rotated-key' npm run demo
```

The loader accepts blank lines, comments, `NAME=value`, and single- or double-quoted values. Malformed entries fail startup with a line number instead of being silently ignored.

## User-configurable variables

| Variable | Default | Secret | Purpose |
| --- | --- | --- | --- |
| `MODEL_PROVIDER` | `copilot` | no | Selects `copilot` or `gemini` for all five generated Omnigent agent profiles. |
| `BUZZ_DESKTOP_PUBKEY` | unset | no | Enrolls an existing Buzz Desktop identity in the relay and seeded private channels. Must be 64 hexadecimal characters. |
| `GEMINI_API_KEY` | unset | **yes** | Required only when `MODEL_PROVIDER=gemini`. Passed to Omnigent through the process environment and never written into agent YAML. |
| `OPEN_BUZZ_DESKTOP` | `true` | no | Opens `/Applications/Buzz.app` after all services and listeners are ready. |
| `BRIDGE_MAX_PROMPT_BYTES` | `131072` | no | Maximum Buzz context payload accepted by the ACP bridge. Must be a positive integer. |
| `BRIDGE_TURN_TIMEOUT_MS` | `900000` | no | Hard Omnigent turn deadline in milliseconds. Must be a positive integer. |

Do not set `BUZZ_PRIVATE_KEY`, `BUZZ_RELAY_PRIVATE_KEY`, `OMNIGENT_AGENT_ID`, `OMNIGENT_HOST_ID`, or `OMNIGENT_WORKSPACE` manually for the integrated platform. Those values are generated or resolved internally for each listener.

## Buzz Desktop public key

In Buzz Desktop, open **Settings → Profile → Identity** and copy the public key. Do not reveal or copy the private key.

Place the public key in `.env`:

```dotenv
BUZZ_DESKTOP_PUBKEY=your-64-character-public-key
```

The platform adds that identity to the relay and all five private channels. Membership persists in the local Buzz Docker volume. If Buzz Desktop creates a new identity, update the value and restart the platform.

## Copilot mode

Copilot uses Omnigent’s native `github-copilot-sdk` harness. `npm run setup` installs the SDK package and bundled backing server through Omnigent’s `copilot` extra. Authentication falls back to the local `gh` CLI login unless a supported token environment variable is provided externally.

```dotenv
MODEL_PROVIDER=copilot
OPEN_BUZZ_DESKTOP=true
```

Run `npm run doctor` to verify that the CLI and all local runtime prerequisites are available.

## Gemini mode

Gemini uses Omnigent’s native Antigravity SDK harness:

```dotenv
MODEL_PROVIDER=gemini
GEMINI_API_KEY=replace-with-a-new-key
```

Never commit `.env`, paste a production key into chat, or reuse a key that has been exposed. Revoke exposed keys and issue a new one before running the platform.

## Fixed loopback ports

| Port | Component |
| ---: | --- |
| `8010` | Buzz HTTP/WebSocket relay |
| `8011` | Buzz readiness endpoint |
| `8012` | Buzz Prometheus metrics |
| `8013` | Omnigent API and optional runtime inspection UI |
| `8014` | Read-only platform status page |

The ports are intentionally fixed for a predictable POC and all bind to `127.0.0.1`. Startup fails closed if a required port is unavailable.

## Generated internal state

`npm run setup` and `npm run demo` generate secrets and runtime state only below `.local/`. The repository `.gitignore` excludes that directory, `.env`, Python bytecode, build output, and logs.

Generated values include employee and agent keypairs, relay signing material, database credentials, owner attestations, channel IDs, Omnigent agent IDs, and host IDs. None belong in `.env.example` or source control.

## Operations

```bash
# Validate tools and configuration without starting a second platform
npm run doctor

# Start the integrated platform
npm run demo

# Run code verification
npm test
python3 -m unittest mastercard_tools.test_tools
```

Stop the foreground platform with `Ctrl-C`. The orchestrator terminates Omnigent, all five ACP listeners, and the Docker Compose services. Persistent local volumes and `.local/` state remain for the next run.

Useful diagnostics:

```bash
curl -fsS http://127.0.0.1:8011/_readiness
curl -fsS http://127.0.0.1:8014/health
ls .local/logs
```

If Buzz cannot see the community, confirm the relay is healthy, the public key in `.env` matches Buzz Desktop, and the community URL is exactly `http://127.0.0.1:8010`.
