---
phase: 01-foundation
plan: 01
subsystem: infrastructure
tags: [cdk, dynamodb, apigateway, cloudfront, lambda, s3, monorepo]
completed: 2026-08-15
requires: []
provides:
  - npm-workspaces monorepo (infra, cli, ui, shared)
  - Full CDK stack structure with stub Lambda handlers
  - 5 DynamoDB tables with TTL
affects:
  - Phase 2 (Auth) — auth-handler Lambda wired to HttpApi, tokens table ready
  - Phase 3 (WS Control Plane) — WS API routes wired to ws-handler
  - Phase 4 (HTTP Relay) — relay Function URL + wildcard CF distribution ready
  - Phase 8 (Dashboard UI) — UI bucket + apex distribution ready
tech-stack:
  added: [aws-cdk-lib, constructs, ts-node]
  patterns:
    - npm workspaces monorepo
    - Single CDK stack defining full architecture with stub handlers
    - Stub-before-implement: resources exist and wire before logic lands
key-files:
  created:
    - infra/lib/vole-stack.ts
    - infra/lib/lambdas/ws-handler/index.ts
    - infra/lib/lambdas/relay-handler/index.ts
    - infra/lib/lambdas/auth-handler/index.ts
    - infra/bin/vole-app.ts
    - infra/cdk.json
    - package.json, tsconfig.base.json, README.md
    - shared/src/index.ts, cli/package.json, ui/package.json
---

# Phase 1 Plan 1: Foundation Summary

Monorepo scaffold + complete CDK stack structure (VoleStack): 5 DynamoDB tables,
WS API Gateway with connect/disconnect/default routes, relay Lambda + streaming
Function URL, HttpApi with /health, UI S3 bucket, 2 CloudFront distributions
(apex UI + wildcard tunnels), ACM cert — all wired, synth verified.

## Decisions Made

- **Name: Vole** (user asked for a name "on my taste") — tunnel-digging rodent; `vole.sh`, `*.vole.sh`
- **nodejs22.x** runtime (nodejs20 deprecated as of 2026-04-30; CDK warned, switched)
- **Runtime 30s** ws/auth handlers; relay 15 min (response streaming ceiling)
- **TTL** on connections + logs; PAY_PER_REQUEST everywhere
- **OAC S3 origin** for UI distribution; relay origin is HTTPS-only HttpOrigin to Function URL
- **ACM DNS validation** — records pending; owner adds to Route 53 manually
- Deploy is user-run: no AWS credentials in this environment (per user decision)

## Deviations from Plan

None — plan executed exactly as written, except Task 3 (deploy) deferred to user:
- Task 1: monorepo scaffold — done, commit `12176a8`
- Task 2: CDK stack structure — done, commit `5841f14`
- Task 3: bootstrap + deploy — **deferred to user** (owner deploys manually, no AWS creds in env)

## Authentication Gates

1. Task 3: AWS credentials
   - No credentials configured in environment
   - User will deploy themselves (`cd infra && npm run deploy`)
   - Verification: `aws dynamodb list-tables` shows 5 tables

## Verification Results

- `npm install` at root: clean, 0 vulnerabilities
- `cdk synth`: exit 0, template contains:
  - 5 DynamoDB tables (TTL on Connections + Logs)
  - 4 Lambda functions (nodejs22.x)
  - 1 Function URL (streaming)
  - 4 routes: $connect, $disconnect, $default, GET /health
  - 2 API Gateway APIs (WS + HTTP), 2 CloudFront distributions, 1 S3 bucket, 1 ACM cert

## Next Phase Readiness

- Phase 2 (Auth) can start: auth-handler stub exists, tokens table + tokenHashIndex ready
- Route 53: owner must add ACM validation CNAMEs (vole.sh + *.vole.sh) before DNS works
