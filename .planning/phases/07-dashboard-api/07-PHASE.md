# Phase 7: Dashboard API

## Goal

All dashboard actions available as authenticated REST endpoints.

## Requirements

DASH-06.

## Success Criteria

1. REST API with JWT auth: tokens CRUD, connections list, request logs list
2. 401 without valid token; 403 on cross-user access
3. Endpoints query DynamoDB scoped to the authenticated user

## Design

- **Already done (phase 2):** POST/GET `/tokens`, `DELETE /tokens/{tokenId}`,
  `/auth/me` live in the auth-handler on the existing HttpApi. TokensTable has
  `userIdIndex` for listing. Nothing to build there.
- **Gap:** `GET /connections` (own tunnels — subdomain, type, local port) and
  `GET /logs` (recent requests for own tunnels: method, path, status, latency, time).
- **One lambda, not more:** both new endpoints go into the existing auth-handler —
  it already owns JWT auth (`requireAuth`), secret loading, json/httpError helpers.
  Zero new infrastructure (ponytail: no second lambda for 40 lines).
- **Connections = TunnelsTable** rows via `userIdIndex` (tunnel exists while its
  connection is alive — status implicit: 'active').
- **Logs:** LOGS_TABLE keyed (connectionId, requestId); rows carry method, path,
  status ('pending'|'done'), statusCode, createdAt, completedAt. Query own
  tunnels' connectionIds (Limit 100 each), merge, sort by `completedAt ?? createdAt`
  desc, top N (50).
- **Auth:** `requireAuth` as-is; row ownership checked where a row is fetched by
  key (existing revokeToken pattern). Cross-user access → 403.

## Waves

| Wave | Plans | Why |
|------|-------|-----|
| 1 | 07-01 dash core (TDD) | Pure logic first |
| 2 | 07-02 handler routes | Depends on 07-01 |

## Acceptance

1. `GET /connections` with JWT → own tunnels (subdomain, type, localPort, createdAt)
2. `GET /logs` → own tunnels' requests sorted newest-first, capped at 50,
   with method/path/status/statusCode/latency/completedAt
3. No/expired token → 401; deleting another user's token → 403 (existing)
4. `cd infra && bun test && npx tsc --noEmit && npx cdk synth` all green