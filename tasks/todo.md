# Release Control Agent Tasks

- [x] Task 1: Lock the release contract with failing tests
  - Acceptance: catalog, async ACP activity, identity migration, and modeled
    release behavior are expressed as tests that fail before implementation.
  - Verify: `npm test`; `python3 -m unittest mastercard_tools.test_tools`.
  - Files: `test/*.test.ts`, `mastercard_tools/test_tools.py`.

- [x] Task 2: Add the release agent and safe identity migration
  - Acceptance: ReleaseHelper has a stable key, signed directory entry, private
    channel, multiple employees, and NetworkOps bot collaborator membership.
  - Verify: full Node suite and generated runtime catalog assertions.
  - Files: `src/platform/buzz-secrets.ts`, `src/platform/buzz-seed.ts`,
    `src/platform/platform-run.ts`, related tests.

- [x] Task 3: Add modeled async release tools and ACP activity
  - Acceptance: async pipeline watch, approval-gated finish, stage verification,
    and ACP tool activity updates pass tests without exposing tool output.
  - Verify: full Node and Python suites.
  - Files: `mastercard_tools/tools.py`, `src/platform/provider-profiles.ts`,
    `src/omnigent-client.ts`, `src/acp-server.ts`, related tests.

- [x] Task 4: Document and exercise the demo
  - Acceptance: README, architecture, vision, ADR, and runbook describe the
    exact human → release helper → NetworkOps sequence and protocol boundary.
  - Verify: `npm run build`, live status health, relay membership inspection.
  - Files: `README.md`, `docs/*.md`, `docs/decisions/0002-*.md`.
