---
phase: 05-tcp-ws-tunnels
plan: 02
type: integration
wave: 2
tags: [websocket, proxy, tcp, binary]
completed: 2026-08-15
requires: [05-01]
provides:
  - infra/lib/lambdas/ws-handler/index.ts — proxy ?tunnel= connect + byte routing both directions
  - infra/lib/vole-stack.ts — WebSocketApi binaryMediaTypes (escape hatch: prop not in CfnApiProps)
affects:
  - Phase 5 CLI bridges (05-03/05-04) implement the proxy WS client on the other end
---

# Phase 5 Plan 2: WS-Handler Proxy Connections Summary

Proxy connections attach by subdomain, bytes flow both ways: proxy → agent as JSON data
frames (seq + base64), agent → proxy as raw WS binary frames. Binary media types configured
on the WebSocket API.

## Decisions Made

- Tunnel row stores `proxyConnectionId` (SET on attach, REMOVE on disconnect/GoneException) —
  single source of truth for agent→proxy routing, no GSI needed on connections.
- `clearProxyConnection` uses `ConditionExpression: proxyConnectionId = :pid` so a stale
  disconnect can't clear a newer proxy's id.
- Proxy row kept alive via `touch()` on byte flow (proxy can't use protocol pings — they'd be
  forwarded as bytes).
- CloudFormation escape hatch `addPropertyOverride('BinaryMediaTypes', ...)` — `binaryMediaTypes`
  is not exposed on `WebSocketApi`/`CfnApi` props in CDK 2.265.
- Sequence map in-memory per Lambda instance (ordering hint only, restart-safe).

## Deviations from Plan

- No-agent cleanup also clears `proxyConnectionId` (plan said delete row only; avoids a
  self-healing round-trip on a dead connection).
- Added `touch()` on proxy byte flow (plan silent; otherwise proxy dies at 12h TTL despite
  active traffic).

## Verification Results

- `npx tsc --noEmit` clean
- `bun test` 30/30 green (existing routing tests)
- `npx cdk synth` succeeds; `BinaryMediaTypes: ["application/octet-stream"]` present in template
- End-to-end binary round-trip pending CLI bridges (05-03/05-04)