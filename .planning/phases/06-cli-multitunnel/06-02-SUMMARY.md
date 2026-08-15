# Plan Summary 06-02 — Error polish + signals

**Status:** Done
**Commit:** 41a98a8

## What was built

- `cli/src/errors.ts` — `formatError(kind, ctx)` → `{message, exitCode}`;
  no-token/bad-token/usage → 2; network/port-down/tunnel-rejected → 1
- `cli/src/errors.test.ts` — 6 tests
- `TunnelSession` (tunnel.ts): 15s ready timeout; WS error/close reject
  openPromise with `cannot reach <server> — check your network or config`;
  control `error` frame rejects openPromise with the server's message
- tcp/ws commands: port-down → `local port <port> is not listening`;
  tcp keeps a persistent socket error handler (no crash after ready)
- index.ts: SIGINT+SIGTERM → closeAll → `closed N tunnel(s)` → exit 0
- README: multi-tunnel usage + exit codes table

## Deviations

- None.

## Follow-ups

- None.