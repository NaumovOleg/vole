---
phase: 02-auth
plan: 01
subsystem: auth
tags: [tdd, bcrypt, jose, jwt, sha256, bun-test]
completed: 2026-08-15
requires: []
provides:
  - core.ts — password hash/verify, JWT sign/verify, token hash/generate, identifier normalize/validate
affects:
  - 02-02 (register/login/me uses core.ts)
  - 02-03 (hashToken used for token storage)
  - Phase 3 (WS $connect token lookup by hash)
tech-stack:
  added: [bcryptjs, jose]
  patterns: [TDD RED-GREEN with bun test, pure security primitives isolated from handler wiring]
key-files:
  created:
    - infra/lib/lambdas/auth-handler/core.ts
    - infra/lib/lambdas/auth-handler/core.test.ts
---

# Phase 2 Plan 1: Auth Core Summary

TDD-built auth primitives: bcryptjs password hashing (cost 10, unique salts), jose HS256 JWT sign/verify with expiry enforcement, sha256 token hashing with `vole_` token generation (32B base64url), email/phone normalization + validation.

## Decisions Made

- **bcryptjs** over argon2/bcrypt-native — pure JS, no native build in Lambda
- **jose** over jsonwebtoken — ESM-native, modern API
- **Token format** `vole_` + 32 random bytes base64url; only sha256 hash persisted
- **Phone normalization** strips everything except digits (leading + dropped); validation 7-15 digits
- **Email normalization** trim + lowercase
- Tests excluded from tsc (`bun:test` types) — bun is the test runner

## Deviations from Plan

None — plan executed exactly as written (RED `899679d`, GREEN `2e3b143`).

## Verification Results

- bun test: 15 pass, 0 fail (passwords, jwt round-trip/wrong-secret/expired, token hash, identifiers)
- tsc --noEmit: clean
