---
phase: 02-auth
plan: 03
subsystem: auth
tags: [tokens, dynamodb, gsi]
completed: 2026-08-15
requires: [02-02]
provides:
  - POST/GET/DELETE /tokens (create/list/revoke)
  - tokensTable userIdIndex GSI
affects:
  - Phase 3 (WS $connect validates token via tokenHashIndex)
tech-stack:
  patterns: [full-token-shown-once contract, ownership check on revoke]
key-files:
  modified: [infra/lib/vole-stack.ts, infra/lib/lambdas/auth-handler/index.ts]
---

# Phase 2 Plan 3: Tokens API Summary

Token management endpoints (implemented in handler commit `1923d48` per plan 02-02 merge deviation): POST /tokens generates `vole_` + 32B base64url, persists only sha256 hash, returns full token once (201); GET /tokens lists caller's tokens via userIdIndex (never hashes); DELETE /tokens/{id} checks ownership (403 cross-user, 404 missing) and deletes the row — revocation is immediate because phase 3's WS auth looks up by hash.

## Decisions Made

- Token shown once; only hash stored (hashToken from core)
- Revoke = hard delete; no revoke flag — lookups fail instantly

## Deviations from Plan

- Handler code landed in 02-02 commit (shared file); this plan delivered the userIdIndex GSI (`00ee985`) + verification

## Verification Results

- cdk synth: tokens table has tokenHashIndex + userIdIndex
- Integration verification pending user deploy: create → full token once; list → own only; revoke → 204 then gone; cross-user delete → 403
