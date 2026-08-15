# Vole State

## Project Reference

- **Core value:** A solo developer runs `vole http 3000`, receives a public URL, and HTTP requests to that URL reach their local server — pure serverless AWS, no containers.
- **Current focus:** All 10 phases complete (code). Remaining: user-owned deploy per README.

## Current Position

**Phase:** 10 — Deployment & Docs
**Plan:** 10-02 — complete
**Status:** Project complete (code); deployment run is user-owned
**Progress:** [████████████████████] 10/10 phases (code complete, deploy pending)

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements | 36 v1 |
| Phases | 10 |
| Coverage | 36/36 mapped |
| Plans complete | 30 |

## Accumulated Context

### Decisions

- **Name: Vole** — `vole.sh`, `*.vole.sh` (chosen by Claude on user's request)
- No EC2/Fargate/containers — Lambda + API Gateway + DynamoDB + S3 + CloudFront only
- TCP tunnels = byte-stream over WS (no raw TCP ingress); remote client uses websocat
- WS frames ≤128KB → chunked frame protocol
- Subdomains: CloudFront wildcard `*.vole.sh`, auto-assigned (user1, user2…), Route 53 manual
- Auth: custom Lambda + JWT (email or phone), no Cognito
- CLI: Bun, `npm install -g vole`
- v1 CLI: http/tcp/ws + multiple tunnels; no reconnect, no vanity subdomains (v2)
- Dashboard: tokens + connections + request logs; admin: user list + block/revoke
- Mode: YOLO, Depth: Comprehensive, Execution: Parallel
- Phase 1 defines FULL CDK structure with stub Lambda handlers; logic lands in later phases
- UI served at apex `vole.sh`, tunnels at `*.vole.sh` (wildcard matches only subdomains, not apex)
- Lambda runtime nodejs22.x (nodejs20 deprecated)
- **User deploys CDK manually** — no AWS credentials in this environment
- Frame protocol: typed {t, id, d}, 10 types, lives in shared/ (one contract for CLI + Lambda)
- WS $connect auth: token hash lookup via tokenHashIndex; blocked user's token deleted at connect
- Connection TTL 12h, refreshed on frame activity; malformed frames → error frame, connection kept
- Relay lookup: subdomain → tunnel (userIdIndex GSI) → active connection
- Relay reads WS API endpoint from env (`WS_ENDPOINT`) — Lambda URL event has no WS domainName
- Tunnel/connection rows TTL'd; stale tunnels cleaned by relay on lookup miss
- 10MB request body cap; chunked request data frames (90KB chunks); 30s relay poll → 504
- Relay uses RESPONSE_STREAM (Lambda URL streaming) with Readable body
- CLI: Node 22+ global WebSocket, bun build single-file (node:dist/vole.js), `@tunell/shared` bundled in
- CLI config at ~/.vole/config.json (0600); default WS server wss://api.vole.sh/dev
- TCP/WS tunnels bypass the relay: attach at `wss://api.vole.sh/dev?tunnel=<subdomain>`
  (wildcard .vole.sh is CloudFront→relay, HTTP-only; WS API is the only public WS endpoint)
- Proxy connections are unauthenticated — subdomain is the capability
- Connection rows: role 'agent' (default) | 'proxy' + tunnelSubdomain; tunnel row stores proxyConnectionId
- Byte routing: proxy msg → data frame to agent; agent data (tcp/ws) → raw binary WS to proxy (binaryMediaTypes)
- Subdomains: 7 hex chars of uuid + unix-seconds as digits a-j (0-9→a-j) — monotonic time ~guarantees
  uniqueness, no lookup/loop; CAS put as rare-collision guard (error frame)
- CLI byte bridge: ByteBridge (tcp, socket) / WsBridge (ws, message-level); seq'd base64 data frames
- Multi-tunnel: TunnelManager (launch factories → TunnelHandle{url, close}; per-tunnel failure isolation);
  `vole http 3000 tcp 5000 ws 8080` one process; TunnelSession ready timeout 15s (openPromise rejects)
- Exit codes: 0 clean (SIGINT/SIGTERM → closeAll), 1 runtime, 2 usage/config; errors.ts formatter
- UI: Vite + React 18, no router (two-screen switch), no UI library — plain dark CSS
- Token shown ONCE after creation in a highlight box + Copy (navigator.clipboard); Revoke per row
- Dashboard auto-refresh 10s: paused on hidden tab, no overlap while a request is in flight
- API base: `VITE_API_URL` env with relative-path fallback (UI could be served from the API domain)
- Repo quirks: bun put all deps in root `node_modules/` (`ui/node_modules` empty) → `npm run dev`
  in `ui/` fails; run vite directly: `/Users/oleg/Documents/projects/http-tunell/node_modules/.bin/vite`.
  CDK: keep exactly ONE lockfile in repo root — NodejsFunction bundling fails on
  multiple lock files (bun.lock was removed; package-lock.json tracked)
- Admin role = env flag `ADMIN_IDENTIFIERS` (csv of identifiers, default `admin@vole.sh`,
  override: `ADMIN_IDENTIFIERS=...` env at deploy) — no role column/migration;
  `isAdmin` computed from JWT identifier per request; `me()` returns `role`
- `/admin/users` (Scan) + `/admin/users/{id}/block|unblock`; block tears down:
  tokens + tunnel rows (paged BatchWrite), live WS connections
  (`DeleteConnection`, Gone tolerated — Scan ConnectionsTable, no userIdIndex)
- WS extra guard: `openTunnel` rejects blocked users (blocked after connect
  can't open new tunnels); `$connect` already deletes blocked user's token
- UI: `loadMe()` single source of truth for user + role — runs on mount and
  after login/register (login response has no identifier)
- Deploy: `scripts/deploy-ui.sh` (build → s3 sync --delete → cloudfront
  invalidation, ids from CDK outputs via describe-stacks); stack exposes
  UiDistributionId output; README covers full deploy incl. manual Route 53
- Known warnings (deferred): CDK S3Origin deprecation (→S3BucketOrigin in next
  major), BinaryMediaTypes property override acknowledged in synth; bun.lock is
  untracked — do NOT commit it while package-lock.json is tracked (CDK fails on
  two lockfiles)

### Technical Constraints

- API Gateway WS idle timeout → CLI heartbeat PING/PONG required
- Lambda WS frame ~128KB → chunking protocol (PROTO-02)
- Lambda timeout 15 min → request relay timeout budget
- ACM DNS validation pending: owner must add CNAME records for vole.sh + *.vole.sh in Route 53

### Todos

- (none)

### Blockers

- (none — deploy is user-owned)

## Session Continuity

**Last session:** 2026-08-15 — Phases 8-10 completed. Phase 8 Dashboard UI (`77d5dce`, `01b1321`, `30e07d6`); Phase 9 Admin Panel (`276166d`, `07f1a2b`, `5889c30` — env-flag role, /admin/users, block kills WS+token+тunnels, admin UI, me()-after-login fix); Phase 10 Deployment & Docs (`d40e317` deploy-ui.sh, `4b6b4cd` root README). QA on mock API covered login, tokens, connections, logs, admin block round-trip. Final gates: 92 tests green (shared 28, infra 43, cli 21), tsc clean, cdk synth ok, ui build ok. **All 10 phases complete — deploy is user-owned (README walkthrough).**

**Next session commands:**
1. `/gsd:progress` — current state
2. Deploy runbook: `cd infra && cdk bootstrap && ADMIN_IDENTIFIERS=you@example.com cdk deploy`, Route 53 (ACM CNAMEs, apex+wildcard A records), `./scripts/deploy-ui.sh`, `cd cli && npm run build`
