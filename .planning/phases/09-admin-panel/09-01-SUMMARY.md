# Plan Summary 09-01 — Admin API

**Status:** Done
**Commit:** 276166d

## What was built

- `infra/lib/lambdas/auth-handler/admin.ts` — pure helpers (TDD, 7 tests):
  - `isAdmin(identifier, csv)` — env-flag role via `ADMIN_IDENTIFIERS`
    (normalizeIdentifier both sides), no role column, no migration
  - `buildUserList(rows)` — mapped, sorted createdAt desc
  - `adminRevokePlan(tunnels, connections, userId)` — unique connectionIds +
    subdomains to tear down
- `infra/lib/lambdas/auth-handler/index.ts`:
  - `requireAdmin` → 403 for non-admins; `me()` now returns `role`
  - `GET /admin/users` (Scan), `POST /admin/users/{id}/block|unblock`
  - block: delete tokens + tunnel rows (paged BatchWrite via shared
    `deleteRowsByUserId`), `DeleteConnection` on API GW for every live
    connection (agent tunnels, proxy conns, plain conns via Scan)
- `infra/lib/lambdas/ws-handler/index.ts` — `openTunnel` rejects blocked users
  (closes the "already-connected user opens a tunnel" hole)
- `infra/lib/vole-stack.ts` — `ADMIN_IDENTIFIERS` env (default
  `admin@vole.sh`, override via process env), `grantManageConnections(authHandler)`

## Deviations

- `me()` returns `role` (union: 'admin' | 'user') — needed by 09-02 UI.

## Follow-ups

- 09-02 consumes the endpoints from the UI.