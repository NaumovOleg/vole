# Plan Summary 05-01 — Routing core (TDD)

**Status:** Done
**Commit:** d99eb5b

## What was built

- `infra/lib/lambdas/ws-handler/routing.ts` — pure, AWS-free routing helpers:
  - `isProxyConnection` / `byteStreamTunnel` / `proxyTarget` / `forwardBytesToAgent`
  - `nextSeq` (wrap-safe sequence counter)
  - `classifyDataFrame` → 'proxy-to-agent' | 'agent-bytes' | 'http-chunk' | 'ignore'
- `infra/test/routing.test.ts` — 15 unit tests

## Deviations

- None.

## Follow-ups

- ws-handler gains proxy routes in 05-02.