# Plan Summary 07-02 — Dashboard routes

**Status:** Done
**Commit:** 0cad5fe

## What was built

- `GET /connections`: requireAuth → Query TunnelsTable userIdIndex → listConnections
- `GET /logs`: requireAuth → own tunnels' connectionIds → parallel Query LOGS_TABLE
  (Limit 100 each) → logSummary cap 50
- No new infra — routes added to the existing auth-handler (token CRUD already
  lived there from phase 2)

## Deviations

- None (0 new AWS resources for the whole phase).

## Follow-ups

- UI consumes these endpoints in phase 8.