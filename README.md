# Tunell

Self-hosted HTTP tunnel service (ngrok alternative) on pure serverless AWS.
CLI (Bun, npm-installable) tunnels local HTTP/TCP/WS traffic to public URLs
via WS API Gateway + Lambda + DynamoDB.

## Monorepo Layout

| Workspace | Purpose |
|-----------|---------|
| `infra/`  | AWS CDK stack (full structure: DynamoDB, WS API, Lambda, CloudFront, S3) |
| `cli/`    | `tunell` CLI (Bun) — published to npm |
| `ui/`     | React dashboard (S3 + CloudFront) |
| `shared/` | Shared types and constants |

## Dev Workflow

```bash
npm install          # install all workspaces at root
npm run build        # build shared + infra
cd infra && npx cdk synth   # validate stack
cd infra && npx cdk deploy  # deploy to AWS (requires credentials + bootstrap)
```

## Infrastructure (cdk deploy)

- 5 DynamoDB tables: users, tokens, connections, tunnels, logs (PAY_PER_REQUEST, TTL on connections/logs)
- WS API Gateway (connect/disconnect/default routes) — CLI control plane
- Relay Lambda + Function URL — public tunnel traffic
- HTTP API — auth/dashboard endpoints
- S3 bucket + CloudFront: UI at `tunell.com`, tunnels at `*.tunell.com`

## Manual Steps (owner)

- Route 53: add DNS records for `tunell.com` and `*.tunell.com` (ACM cert validation + CloudFront aliases)
- `cdk bootstrap` once per AWS account
