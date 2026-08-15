# Plan Summary 05-04 — `vole ws <port>`

**Status:** Done
**Commit:** 63d657a

## What was built

- `cli/src/ws-bridge.ts` — `WsBridge`: local WS message (text/binary) → seq'd base64
  `send()`, `writeData(n, b64)` → binary send to local server, close → onClose
- `cli/src/ws-bridge.test.ts` — 4 tests against a real local WS server
- `cli/src/commands/ws.ts` — `vole ws <port>`: deferred local WS connect with
  pending-frame buffer (handles remote-data-before-local-open race), attach URL +
  `new WebSocket(...)` hint, error frame on local failure
- index.ts routes `ws`

## Deviations

- Bun 1.3.14 ships no `WebSocketServer` in `'bun'` package — tests use Bun's
  built-in `ws` polyfill (same API, no new dependency).

## Follow-ups

- WS message framing: all remote bytes are forwarded as binary frames; text-type
  preservation deferred (v1 byte-level proxy).