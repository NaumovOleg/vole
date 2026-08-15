# Plan Summary 07-01 — Dashboard mappers (TDD)

**Status:** Done
**Commit:** 4c73c8e

## What was built

- `infra/lib/lambdas/auth-handler/dashboard.ts` — pure mappers:
  - `listConnections(rows)`: strips private fields, sorts createdAt desc, status 'active'
  - `logSummary(rows, limit=50)`: sorts by completedAt ?? createdAt desc, caps,
    latency = completedAt - createdAt (absent for pending)
- `infra/test/dashboard.test.ts` — 6 tests (shape, sorting, capping, missing fields)

## Deviations

- None.

## Follow-ups

- Routes wired in 07-02.