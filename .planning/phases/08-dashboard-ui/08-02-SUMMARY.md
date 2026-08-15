# Plan Summary 08-02 — Dashboard panels

**Status:** Done
**Commit:** 01b1321

## What was built

- `ui/src/Dashboard.tsx`:
  - Tokens: list (id prefix, created), Create token → raw token shown once in a
    highlight box with Copy (navigator.clipboard), per-row Revoke
  - Connections: table (subdomain link, type, local port, status, created)
  - Logs: table (method, path, status, code, latency, time) with empty states
- All panels load in parallel on mount; 401 → auth screen (via App)

## Deviations

- None.

## Follow-ups

- Auto-refresh + relative times in 08-03.