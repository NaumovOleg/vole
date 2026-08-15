---
phase: 02-auth
plan: 02
subsystem: auth
tags: [cdk, nodejsfunction, http-api, secretsmanager, dynamodb]
completed: 2026-08-15
requires: [02-01]
provides:
  - auth-handler Lambda: register, login, me (JWT-protected)
  - CDK: NodejsFunction bundling, identifierIndex GSI, JwtSecret, /auth/* routes
affects:
  - 02-03 (tokens — folded into this handler, GSI remains)
  - Phase 3 (ws-handler reuses token hash lookup pattern)
tech-stack:
  added: [esbuild, @aws-sdk/client-dynamodb, @aws-sdk/client-secrets-manager, @aws-sdk/lib-dynamodb (devDeps, externalized)]
  patterns:
    - NodejsFunction + esbuild bundling with @aws-sdk/* externalized to Lambda runtime
    - JWT secret cached at cold start from SecretsManager
    - Single Lambda router on method+path
key-files:
  created: [infra/lib/lambdas/auth-handler/index.ts]
  modified: [infra/lib/vole-stack.ts, infra/package.json]
---

# Phase 2 Plan 2: Auth Handler Summary

Implemented auth-handler Lambda (router on `METHOD path`): POST /auth/register (identifier validation, 409 on duplicate, bcrypt hash), POST /auth/login (identifierIndex lookup, uniform 401, JWT 24h), GET /auth/me (Bearer required). CDK: switched all handlers to NodejsFunction (esbuild), added identifierIndex GSI, JwtSecret SecretsManager with cold-start cache, 3 new HttpApi routes.

## Decisions Made

- **NodejsFunction + esbuild** — bundles bcryptjs/jose per handler; @aws-sdk/* externalized (Lambda runtime builtin)
- **JWT secret** in SecretsManager, read once at cold start, cached in module scope
- **Uniform 401** on login failure (no user enumeration); blocked users rejected at login
- **`blocked: false` field** added on user creation — phase 9 admin uses it

## Deviations from Plan

- **[Merge]** Plan 02-03 handler work (POST/GET/DELETE /tokens) was implemented in the same commit as the router (`1923d48`) — same file, one coherent router. GSI for tokens (userIdIndex) committed separately in 02-03.

## Verification Results

- tsc --noEmit: clean (after adding AWS SDK devDeps for types)
- bun test: 15 pass
- cdk synth: template has identifierIndex + tokenHashIndex + userIdIndex GSIs, 7 routes, JwtSecret
