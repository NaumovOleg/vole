# Tunell State

## Project Reference

- **Core value:** A solo developer runs `tunell http 3000`, receives a public URL, and HTTP requests to that URL reach their local server — pure serverless AWS, no containers.
- **Current focus:** Phase 1 (Foundation) — CDK project that deploys DynamoDB and base infra.

## Current Position

**Phase:** 1 — Foundation
**Plan:** not yet planned
**Status:** ready for `/gsd:plan-phase 1`
**Progress:** [██████████░░░░░░░░░░] 0/10 phases complete

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements | 36 v1 |
| Phases | 10 |
| Coverage | 36/36 mapped |

## Accumulated Context

### Decisions

- No EC2/Fargate/containers — Lambda + API Gateway + DynamoDB + S3 + CloudFront only
- TCP tunnels = byte-stream over WS (no raw TCP ingress); remote client uses websocat
- WS frames ≤128KB → chunked frame protocol
- Subdomains: CloudFront wildcard `*.tunell.com`, auto-assigned (user1, user2…), Route 53 manual
- Auth: custom Lambda + JWT (email or phone), no Cognito
- CLI: Bun, `npm install -g tunell`
- Domain placeholder: `tunell.com` (owner configures DNS manually)
- v1 CLI: http/tcp/ws + multiple tunnels; no reconnect, no vanity subdomains (v2)
- Dashboard: tokens + connections + request logs; admin: user list + block/revoke
- Mode: YOLO, Depth: Comprehensive, Execution: Parallel

### Technical Constraints

- API Gateway WS idle timeout → CLI heartbeat PING/PONG required
- Lambda WS frame ~128KB → chunking protocol (PROTO-02)
- Lambda timeout 15 min → request relay timeout budget

### Todos

- (none)

### Blockers

- (none)

## Session Continuity

**Last session:** 2026-08-15 — Project initialized: PROJECT.md, config, requirements (36), roadmap (10 phases).

**Next session commands:**
1. `/gsd:plan-phase 1` — Foundation plan
2. `/gsd:progress` — current state
