---
phase: 03-ws-control
plan: 02
subsystem: control-plane
tags: [lambda, websocket, dynamodb, apigateway]
completed: 2026-08-15
requires: [03-01]
provides:
  - ws-handler: $connect token auth, $disconnect cleanup, $default frame routing
affects:
  - Phase 4 (relay posts request frames to connections; tunnel rows land in ConnectionsTable)
  - Phase 7 (dashboard connections table reads ConnectionsTable)
tech-stack:
  added: [@aws-sdk/client-apigatewaymanagementapi (devDep, externalized)]
  patterns:
    - token auth via tokenHashIndex at $connect
    - TTL 12h zombie cleanup + lastSeenAt refresh on activity
    - GoneException → delete connection row
key-files:
  created: [infra/lib/lambdas/ws-handler/index.ts]
---

# Phase 3 Plan 2: WS Control Plane Handler Summary

ws-handler implements all three WS routes: $connect validates ?token= against tokenHashIndex, rejects blocked users (and deletes their token), registers connection with 12h TTL; $disconnect deletes the row; $default parses frames — HELLO→READY (version-checked), PING→PONG, PONG→touch, malformed/unsupported→error frame (connection kept alive).

## Decisions Made

- Blocked user's token deleted at connect attempt (kill switch)
- lastSeenAt + expiresAt refreshed on every frame; TTL = zombie cleanup ceiling
- malformed frame → error frame, connection stays up (don't kick clients on one bad message)
- postToConnection endpoint built from event.requestContext.domainName/stage

## Deviations from Plan

None.

## Verification Results

- tsc clean, bun test green (auth core unaffected), cdk synth exit 0
- Integration pending user deploy: probe + row lifecycle (`aws dynamodb get-item`)
