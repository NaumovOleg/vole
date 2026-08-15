---
phase: 03-ws-control
plan: 01
subsystem: protocol
tags: [tdd, websocket, frames, shared]
completed: 2026-08-15
requires: []
provides:
  - shared/src/protocol.ts — frame types, encode/parse, helpers
affects:
  - 03-02 (ws-handler parses frames)
  - Phase 4 (CLI + relay use request/response/data frames)
tech-stack:
  added: [none — node:crypto only]
  patterns: [shared protocol contract for Lambda (Node) + CLI (Bun)]
key-files:
  created: [shared/src/protocol.ts, shared/src/protocol.test.ts]
---

# Phase 3 Plan 1: Frame Protocol Summary

Typed WS frame protocol {t, id, d} with 10 types (hello, ready, ping, pong, tunnel-open, tunnel-close, request, response, data, error). Strict parseFrame rejects malformed input; forward-compat tolerated. Helpers for all frame kinds.

## Decisions Made

- Protocol in shared/ workspace — single source of truth for Bun CLI and Node Lambda
- Frames carry explicit ids (correlate requests later, phase 4)
- Malformed frames are errors, never silently dropped

## Deviations from Plan

- RED and GREEN committed together in `e7eec70` (test file staging mistake) — tests still prove behavior

## Verification Results

- bun test: 15 pass (types contract, round-trips, malformed rejections, helpers)
