# Vole

Self-hosted HTTP/TCP/WS tunnel service (an ngrok alternative) on pure serverless AWS — no EC2, no containers. A CLI opens a public URL per tunnel; requests to that URL reach your local server.

```
browser ──> https://<subdomain>.vole.free-bert.online ──> CloudFront ──> relay Lambda (streaming)
                                               │
                          wss://api.vole.free-bert.online/dev ──> WS API Gateway ──> ws-handler Lambda
                                                       │                    │
                                                       │              CLI: `vole http 3000`
                                                       ▼
                                               DynamoDB (users, tokens, connections, tunnels, logs)
```

## Architecture

| Component                              | Where                               | Role                                                                                                               |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --- | ------------------------ |
| WS API Gateway + Lambda (`ws-handler`) | `infra/lib/lambdas/ws-handler/`     | CLI control plane: auth via token, tunnels, byte routing for tcp/ws                                                |
| Relay Lambda (streaming URL)           | `infra/lib/lambdas/relay-handler/`  | HTTP requests: subdomain → tunnel → agent response (300ms poll, 504 on timeout); serves `*.vole.free-bert.online` via CloudFront |
| Auth REST Lambda                       | `infra/lib/lambdas/auth-handler/`   | JWT auth, `/tokens` CRUD, `/connections`, `/logs`, `/admin/*`                                                      |
| DynamoDB                               | 5 tables                            | users, tokens, connections, tunnels, logs (TTL'd)                                                                  |
| UI                                     | `ui/` (React, S3 + CloudFront apex) | dashboard: tokens, connections, logs, admin panel                                                                  |
| CLI                                    | `cli/` (Bun, single-file bundle)    | `vole http                                                                                                         | tcp | ws <port>`, multi-tunnel |

## Prerequisites

- Node.js 22+ (CLI), Bun (builds, tests), AWS CLI with credentials, AWS CDK (`npm i -g aws-cdk`)

## Deploy

### 1. Infrastructure

```bash
cd infra
cdk bootstrap        # first time only
ADMIN_IDENTIFIERS=you@example.com cdk deploy
```

`ADMIN_IDENTIFIERS` is a comma-separated list of emails/phones that get the admin role (default `keeperoleg26@gmail.com`). Note the stack outputs — you need `UiDistributionDomain` and `TunnelDistributionDomain` next.

### 2. DNS (Route 53, manual)

The code uses `vole.free-bert.online` + wildcard `*.vole.free-bert.online` (UI, tunnels) and `api.vole.free-bert.online` (WebSocket API). With `HOSTED_ZONE_ID` set, CDK creates the ACM validation CNAMEs and all alias records automatically — skip to section 3.

1. Create the certificate: the deploy prints ACM validation CNAME values — add these **CNAME records** first and only then finish any pending steps.
2. Add **A record** (aliases) — automatic if `HOSTED_ZONE_ID` is set (see CI/CD):
   - `vole.free-bert.online` → CloudFront distribution `UiDistributionDomain`
   - `*.vole.free-bert.online` (wildcard) → distribution `TunnelDistributionDomain`

### 3. UI

```bash
./scripts/deploy-ui.sh
```

Builds the dashboard, syncs it to S3 and invalidates CloudFront.

### 4. CLI

Anywhere (published to npm by CI):

```bash
sudo npm i -g vole-tunell
```

From the repo (development):

```bash
cd cli && npm run build       # → cli/dist/vole.js
sudo npm i -g ./cli           # global `vole` (local workspace build)
```

```bash
vole authtoken <token>                        # token from the dashboard
vole http 3000                                # → https://<subdomain>.vole.free-bert.online
vole http 3000 tcp 5000 ws 8080               # several tunnels in one process
```

TCP/WS tunnels attach as real sockets: `websocat wss://api.vole.free-bert.online/dev?tunnel=<subdomain>` (or any WebSocket client).

## CI/CD

`.github/workflows/deploy.yml` runs on pushes to `main`: check (tests + synth),
then — only when `v<version>` (from `cli/package.json`) is NOT tagged yet —
`cdk deploy`, UI deploy, `npm publish` of `vole-tunell`, and the release tag.
Bump the version and push to release: `npm version patch -w cli && git push`.

| Setting                        | Value                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Secret `AWS_ACCESS_KEY_ID`     | IAM user access key (see below)                                                   |
| Secret `AWS_SECRET_ACCESS_KEY` | matching secret key                                                               |
| Secret `NPM_TOKEN`             | npm registry token with **publish** rights (`npm token create --type automation`) |
| Secret `ADMIN_IDENTIFIERS`     | admin emails/phones (comma-separated; default `keeperoleg26@gmail.com`)           |
| Variable `HOSTED_ZONE_ID`      | Route 53 zone ID (`Z...`) — CDK then creates ACM validation CNAME + `vole.`/`*.vole.` alias records automatically |
| Variable `AWS_REGION`          | deploy region (default `eu-west-1`)                                               |

`NPM_TOKEN` is optional — without it CI deploys AWS but skips publishing.
The IAM user needs `AdministratorAccess` (or scoped: CloudFormation, S3,
CloudFront, Lambda, DynamoDB, API Gateway, Secrets Manager, Route 53, ACM).
If `HOSTED_ZONE_ID` is not set, the DNS records need a one-time manual setup
after the first deploy — see "2. DNS" above.

## Walkthrough

1. Open `https://vole.free-bert.online` → register (email or phone + password)
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
