# Phase 9: Admin Panel

## Goal

Owner manages users and access.

## Requirements

ADMIN-01, ADMIN-02, ADMIN-03.

## Success Criteria

1. Admin has elevated role; regular users get 403 on admin endpoints
2. User list renders email, status, created date
3. Blocking a user kills their WS connections and rejects their tokens

## Design

- **Role by flag (ADMIN-01):** no role column, no migration. `ADMIN_IDENTIFIERS`
  env on the auth-handler (comma-separated emails/phones, CDK prop, default
  `admin@vole.sh`). A user whose normalized identifier is in the list is an
  admin; `isAdmin(identifier)` is pure and computed per request from the JWT
  payload (the JWT already carries `identifier`).
- **New endpoints (all in auth-handler, +3 routes, 0 new resources):**
  - `GET /admin/users` — `Scan` users table, sorted by createdAt desc:
    `{ userId, identifier, blocked, createdAt }`
  - `POST /admin/users/{userId}/block` — set `blocked=true`, delete all tokens
    (page through userIdIndex → BatchWrite), delete tunnels rows, and
    `DeleteConnection` on ApiGatewayManagementApi for every live connection of
    the user (agent tunnels + proxy connections + agent conns w/o tunnel —
    found via Scan on ConnectionsTable filtered by userId)
  - `POST /admin/users/{userId}/unblock` — set `blocked=false`
- **WS already rejects blocked users** on `$connect` (token deleted). Extra
  guard: `openTunnel` checks `users.blocked` once per tunnel-open and replies
  with an error frame — closes the "already-connected user opens a tunnel after
  being blocked" hole.
- **IAM:** `authHandler` gets `grantManageConnections` (needs execute-api for
  DeleteConnection) + `Scan` rights on ConnectionsTable (already granted
  read/write on all tables).
- **UI:** token create consumed; dashboard gets an "Users" admin section
  (table: identifier, status, created, block/unblock button) visible only when
  `me()` reports `role: 'admin'`.

## Waves

| Wave | Plans | Why |
|------|-------|-----|
| 1 | 09-01 admin API (role gate, endpoints, WS kill) | Backend, testable |
| 2 | 09-02 admin UI panel | Depends on 09-01 API |

## Acceptance

1. Non-admin user gets 403 on all /admin/* routes
2. Block deletes tokens + tunnels and kills live WS connections
3. Blocked user cannot open new tunnels; existing agent sees frames die
4. Admin section renders only for admins; block/unblock round-trips
5. `cd infra && npx tsc --noEmit && cdk synth` and `bun test` green