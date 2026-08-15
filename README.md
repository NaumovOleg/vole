# Vole — HTTP Tunnel Service (ngrok alternative)

Vole is a self-hosted tunnel service: a small burrowing creature that digs
you a tunnel to your local machine. CLI (Bun, npm-installable) tunnels local
HTTP/TCP/WS traffic to public URLs via WS API Gateway + Lambda + DynamoDB —
pure serverless AWS, no containers.

## Monorepo Layout

| Workspace | Purpose |
|-----------|---------|
| `infra/`  | AWS CDK stack (full structure: DynamoDB, WS API, Lambda, CloudFront, S3) |
| `cli/`    | `vole` CLI (Bun) — published to npm |
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
- S3 bucket + CloudFront: UI at `vole.sh`, tunnels at `*.vole.sh`

## Manual Steps (owner)

- Route 53: add DNS records for `vole.sh` and `*.vole.sh` (ACM cert validation + CloudFront aliases)
- `cdk bootstrap` once per AWS account
