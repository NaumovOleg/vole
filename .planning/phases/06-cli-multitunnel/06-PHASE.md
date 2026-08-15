# Phase 6: CLI Multi-Tunnel & Polish

## Goal

One CLI process runs several tunnels simultaneously with clear feedback and
graceful errors.

## Requirements

CLI-06 (multiple tunnels from one CLI process), CLI-07 (graceful error messages:
bad token, no network).

## Success Criteria

1. 2+ tunnels (http+tcp) active from one process simultaneously
2. Each tunnel has independent URL and state
3. Errors (bad token, port busy, no network) produce human-readable messages
4. Ctrl+C gracefully closes tunnels and disconnects

## Design

- **One session, many bridges.** Currently `vole http/tcp/ws <port>` creates a
  single TunnelSession per invocation. Multi-tunnel needs a session per connection
  + per-tunnel stream dispatch. Since the server allows **one tunnel per WS
  connection** ("tunnel already open on this connection"), each tunnel gets its
  own TunnelSession on the same process — one WS connection per tunnel, all async.
- **`vole` with multiple args:** `vole http 3000 http 4000 tcp 5000` starts them
  all; each opens its own session and prints its own URL as it becomes ready.
- **Error handling (CLI-07):** normalize failure paths:
  - no token / bad token → `error: invalid token — run 'vole authtoken <token>'` (exit 2)
  - server unreachable (WS 'error' before ready, with timeout) → `error: cannot reach <server> — check network or config` (exit 1)
  - local port busy/refused (socket 'error') → per-tunnel `error: local port <port> not listening` — tunnel fails, others keep running
  - one tunnel dying never takes down the process
- **Signals:** SIGINT/SIGTERM → close every session → exit 0 (with message).
- **Registry:** simple `TunnelManager` holding sessions + per-tunnel error/setup
  state; no framework.

## Waves

| Wave | Plans | Why |
|------|-------|-----|
| 1 | 06-01 multi-tunnel manager (TDD) | Foundation: registry + lifecycle |
| 2 | 06-02 error polish + signals (TDD) | Depends on 06-01 |

## Acceptance

1. `vole http 3000 http 4000` prints two URLs, both tunnels serve traffic
2. `vole tcp 9999` with nothing listening → clear message, exit 1
3. `vole http 3000` without token → `run 'vole authtoken'` hint, exit 2
4. WS server down → clear network error, exit 1
5. Ctrl+C closes all sessions, exit 0
6. `cd cli && bun test && npx tsc --noEmit` green