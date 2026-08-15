# Plan Summary 05-03 — `vole tcp <port>`

**Status:** Done
**Commit:** a94752f

## What was built

- `cli/src/bridge.ts` — `ByteBridge`: socket data → seq'd base64 `send()` calls,
  `writeData(n, b64)` → socket bytes, `setNoDelay`, error/close hooks
- `cli/src/bridge.test.ts` — 5 tests (300KB binary round-trip, exact delivery, hooks)
- TunnelSession: `onData` hook + `sendData(n, dataB64)`
- `cli/src/commands/tcp.ts` — `vole tcp <port>`: tunnel-open → net.connect to
  127.0.0.1:<port>, prints `wss://<server>/dev?tunnel=<subdomain>` + websocat hint,
  error frame + SIGINT cleanup (exit codes 2/1/0)
- index.ts routes `tcp`

## Deviations

- None.

## Follow-ups

- None.