# Vole State

## Project Reference

- **Core value:** A solo developer runs `vole http 3000`, receives a public URL, and HTTP requests to that URL reach their local server — pure serverless AWS, no containers.
- **Current focus:** Phase 4 (HTTP Tunnel E2E) — code done, integration pending user deploy.

## Current Position

**Phase:** 4 — HTTP Tunnel End-to-End
**Plan:** 04-05 — complete (deploy + integration pending user)
**Status:** Phase done; ready for `/gsd:plan-phase 5`
**Progress:** [████░░░░░░░░░░░░░░░░] 4/10 phases (code complete, deploy pending)

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements | 36 v1 |
| Phases | 10 |
| Coverage | 36/36 mapped |
| Plans complete | 12 |

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

**Last session:** 2026-08-15 — Phases 1-4 planned and executed (foundation, auth, WS control plane, HTTP tunnel E2E: relay + CLI); code synth-verified, integration pending user deploy.

**Next session commands:**
1. `/gsd:plan-phase 5` — dashboard (React UI) + admin
2. `/gsd:progress` — current state
