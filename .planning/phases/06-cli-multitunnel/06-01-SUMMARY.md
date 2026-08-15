# Plan Summary 06-01 — TunnelManager + multi-arg CLI

**Status:** Done
**Commit:** 08b8df6

## What was built

- `cli/src/manager.ts` — `TunnelManager<T>`: pending/starting/ready/failed/closed
  lifecycle, per-tunnel failure isolation, `closeAll()` (idempotent), launch via
  injected factories
- `cli/src/manager.test.ts` — 6 tests
- Commands refactored to launch factories → `TunnelHandle {url, close}`:
  `launchHttp/launchTcp/launchWs` (+ kind-specific hint fns)
- `cli/src/session.ts` — shared server/token/attachUrl helpers (dedup DEFAULT_SERVER)
- `cli/src/index.ts` — multi-arg parsing: `vole http 3000 tcp 5000 ws 8080`,
  per-tunnel error lines, SIGINT → closeAll

## Deviations

- URL fabricated by manager in draft — replaced with real `TunnelHandle.url`
  from the launch factory (server-provided).

## Follow-ups

- Error message polish + exit codes in 06-02.