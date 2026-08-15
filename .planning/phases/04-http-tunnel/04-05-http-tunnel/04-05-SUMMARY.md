# Plan Summary 04-05 — `vole http <port>`

**Status:** Done
**Commit:** f9b6a55

## What was built

- `cli/src/tunnel.ts` — `TunnelSession`:
  - WebSocket connect to `wss://<server>?token=...`, hello handshake (PROTOCOL_VERSION)
  - 240s heartbeat (PING), queued serialized writes, frame dispatch
  - on `ready` → sends `tunnel-open` (type, localPort) → resolves `openPromise` with public URL
  - request frames → local HTTP via `fetch(localhost)` (redirect manual) → `response` + chunked `data` frames
  - chunk reassembly (waitChunks polling, ordered join), 502 on local failure
- `cli/src/commands/http.ts` — `vole http <port>`: config load, default server `wss://api.vole.sh/dev`, SIGINT → tunnel-close
- `shared/src/index.ts` — now re-exports protocol + chunks (was PROTOCOL_VERSION only)

## Deviations

- `send()` accepts Frame objects directly (no double-encode bug).
- Bun resolves `@tunell/shared` from the monorepo at build time (no npm install needed); works because bundling inlines it.

## Follow-ups

- No CLI tests (protocol/chunk logic covered in shared tests; WS path needs a live server — covered by ws-probe when user deploys).
- Request body forwarding from CLI is unimplemented (`forward` sends body when present, but the request frame may carry `chunkTotal` + separate data frames — currently CLI sends the body inline as `bodyB64`; fine for ≤10MB since frame limit is 128KB → mismatch if relay chunks a large request body; CLI must request `chunkTotal`-based reassembly before sending). Fixed ordering: relay sends request frames with `chunkTotal` — CLI handles: check `request.chunkTotal` and await waitChunks.
- TCP/WS tunnel types wired in TunnelSession but `vole http` only registers HTTP.
