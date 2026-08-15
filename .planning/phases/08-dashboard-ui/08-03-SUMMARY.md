# Plan Summary 08-03 — Polish: refresh + relative time

**Status:** Done
**Commit:** 30e07d6

## What was built

- Auto-refresh of tokens/connections/logs every 10s (setInterval), paused when the
  tab is hidden, no overlap while a request is in flight
- Relative timestamps ("2m ago") that tick while the tab is visible; absolute time
  in the `title` tooltip
- Error banner that disappears on next successful poll
- Empty states: "No tokens yet", "No connections", "No requests logged"

## Deviations

- None.

## Follow-ups

- Visual QA against the mock API verified: login, token create (+ raw token box
  with Copy), revoke, connections and logs rendering. Live QA requires a real
  deploy (user's responsibility, see 05+ summaries).