# Vole

Self-hosted HTTP/TCP/WS tunnel service (an ngrok alternative) on pure serverless AWS — no EC2, no containers. A CLI opens a public URL per tunnel; requests to that URL reach your local server.

```
browser ──> https://<subdomain>.vole.sh ──> CloudFront ──> relay Lambda (streaming)
                                               │
                          wss://api.vole.sh/dev ──> WS API Gateway ──> ws-handler Lambda
                                                       │                    │
                                                       │              CLI: `vole http 3000`
                                                       ▼
                                               DynamoDB (users, tokens, connections, tunnels, logs)
```

## Architecture

| Component | Where | Role |
|-----------|-------|------|
| WS API Gateway + Lambda (`ws-handler`) | `infra/lib/lambdas/ws-handler/` | CLI control plane: auth via token, tunnels, byte routing for tcp/ws |
| Relay Lambda (streaming URL) | `infra/lib/lambdas/relay-handler/` | HTTP requests: subdomain → tunnel → agent response (300ms poll, 504 on timeout); serves `*.vole.sh` via CloudFront |
| Auth REST Lambda | `infra/lib/lambdas/auth-handler/` | JWT auth, `/tokens` CRUD, `/connections`, `/logs`, `/admin/*` |
| DynamoDB | 5 tables | users, tokens, connections, tunnels, logs (TTL'd) |
| UI | `ui/` (React, S3 + CloudFront apex) | dashboard: tokens, connections, logs, admin panel |
| CLI | `cli/` (Bun, single-file bundle) | `vole http|tcp|ws <port>`, multi-tunnel |

## Prerequisites

- Node.js 22+ (CLI), Bun (builds, tests), AWS CLI with credentials, AWS CDK (`npm i -g aws-cdk`)

## Deploy

### 1. Infrastructure

```bash
cd infra
cdk bootstrap        # first time only
ADMIN_IDENTIFIERS=you@example.com cdk deploy
```

`ADMIN_IDENTIFIERS` is a comma-separated list of emails/phones that get the admin role (default `admin@vole.sh`). Note the stack outputs — you need `UiDistributionDomain` and `TunnelDistributionDomain` next.

### 2. DNS (Route 53, manual)

You need a hosted zone for your domain (the code uses `vole.sh`; change `domain` in `infra/lib/vole-stack.ts` if yours differs).

1. Create the certificate: the deploy prints ACM validation CNAME values — add these **CNAME records** first and only then finish any pending steps.
2. Add **A record** (aliases):
   - `vole.sh` (apex) → CloudFront distribution `UiDistributionDomain`
   - `*.vole.sh` (wildcard) → distribution `TunnelDistributionDomain`

### 3. UI

```bash
./scripts/deploy-ui.sh
```

Builds the dashboard, syncs it to S3 and invalidates CloudFront.

### 4. CLI

From the repo (npm publishing comes later):

```bash
cd cli && npm run build       # → cli/dist/vole.js
sudo npm i -g ./cli           # global `vole` (local workspace build)
```

```bash
vole authtoken <token>                        # token from the dashboard
vole http 3000                                # → https://<subdomain>.vole.sh
vole http 3000 tcp 5000 ws 8080               # several tunnels in one process
```

TCP/WS tunnels attach as real sockets: `websocat wss://api.vole.sh/dev?tunnel=<subdomain>` (or any WebSocket client).

## Walkthrough

1. Open `https://vole.sh` → register (email or phone + password)
2. Create an API token (shown once — copy it)
3. `vole authtoken <token> && vole http 3000`
4. Visit the printed URL → your local server responds; the request appears under **Request logs**
5. Admin (identifier in `ADMIN_IDENTIFIERS`): **Users** section → Block kills the user's tunnels/connections and revokes their tokens

## Development

```bash
bun test                 # per dir: shared/, infra/, cli/
cd infra && npx tsc --noEmit && npx cdk synth
cd ui && npx tsc --noEmit && npm run build
```

Tests live in `*/test/` folders (bun test). Monorepo: `shared/` (protocol + chunking), `infra/` (CDK + lambdas), `cli/` (client), `ui/` (dashboard), `scripts/` (deploy).