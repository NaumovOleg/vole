# Vole State

## Project Reference

- **Core value:** A solo developer runs `vole http 3000`, receives a public URL, and HTTP requests to that URL reach their local server — pure serverless AWS, no containers.
- **Current focus:** Phase 1 (Foundation) — done, deploy pending (user deploys manually).

## Current Position

**Phase:** 1 — Foundation
**Plan:** 01 — complete (deploy deferred to user)
**Status:** Phase done; ready for `/gsd:plan-phase 2`
**Progress:** [█░░░░░░░░░░░░░░░░░░░] 1/10 phases planned+executed (deploy pending)

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements | 36 v1 |
| Phases | 10 |
| Coverage | 36/36 mapped |
| Plans complete | 1 |

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

**Last session:** 2026-08-15 — Phase 1 Foundation planned and executed (synth verified); deploy deferred to user (`cd infra && npm run deploy`).

**Next session commands:**
1. `/gsd:plan-phase 2` — Auth (custom Lambda + JWT, email/phone)
2. `/gsd:progress` — current state
