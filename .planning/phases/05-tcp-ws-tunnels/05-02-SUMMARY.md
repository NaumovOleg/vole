# Plan Summary 05-02 — WS proxy routes + binary media

**Status:** Done
**Commit:** b0a9ce9

## What was built

- ws-handler `$connect`: `?tunnel=<subdomain>` → proxy connection (NO token auth —
  subdomain is the capability); unknown subdomain → 404, http tunnel → 400;
  tunnel row gains `proxyConnectionId`
- `$default`: routing via `classifyDataFrame`:
  - proxy → data frame `{n, data: b64}` to agent (in-memory seq map, `nextSeq`)
  - agent bytes (tcp/ws tunnel) → raw binary WS frame to proxy
  - http agent → existing storeChunk, unchanged
  - protocol frames (hello/tunnel-open) from proxy → error 'protocol violation'
- `$disconnect`: proxy row deleted, `proxyConnectionId` cleared (conditional — stale
  disconnect can't clobber a newer proxy)
- CDK: `BinaryMediaTypes: ['application/octet-stream']` via `addPropertyOverride`
  (prop absent from WebSocketApiProps in CDK 2.265)

## Deviations

- `binaryMediaTypes` needed an escape hatch in CDK — property not exposed yet.

## Follow-ups

- CLI bridges (05-03 tcp, 05-04 ws) on the far side.