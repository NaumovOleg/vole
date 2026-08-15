---
phase: 03-ws-control
plan: 03
subsystem: tooling
tags: [bun, websocket, probe, integration]
completed: 2026-08-15
requires: [03-02]
provides:
  - infra/scripts/ws-probe.ts — integration client (happy + reject paths)
affects:
  - Phase 4 CLI reuses the same protocol + connect flow
tech-stack:
  added: [none — Bun global WebSocket]
key-files:
  created: [infra/scripts/ws-probe.ts]
---

# Phase 3 Plan 3: WS Probe Summary

Bun WS probe: connects with ?token=, HELLO→READY, sends 2 PINGs expecting PONGs → exit 0; `--expect-reject` asserts the handshake closes with an invalid token; 30s timeout guard.

## Decisions Made

- Bun's global WebSocket — zero deps
- Probe doubles as the reference client for the CLI (phase 4)

## Deviations from Plan

None.

## Verification Results

- Usage path verified locally (exit 2 with no args); tsc clean
- Full integration pending user deploy:
  `bun run scripts/ws-probe.ts <wss-url> <token>` → READY ✓ + PONG ✓
  `bun run scripts/ws-probe.ts <wss-url> bogus --expect-reject` → closed as expected
