# Tunell — HTTP Tunnel Service (ngrok alternative)

## Core Value

A solo developer runs `tunell http 3000` in a terminal, receives a public
URL instantly, and HTTP requests to that URL reach their local server —
self-hosted on AWS with no EC2/Fargate/containers.

## Vision

A personal ngrok-like tunnelling service on pure serverless AWS. The CLI
(Bun, npm-installable) opens a WebSocket to API Gateway. The Gateway accepts
public HTTP requests and relays them to the connected CLI over the WS
channel; responses relay back. Users register in a React dashboard, generate
tokens, and the CLI authenticates with the token. TCP tunnels run as
byte-streams over the same WS channel.

## Architecture

```
tunell CLI ──WS──> WS API Gateway ──events──> Lambda (control plane)
                                                      │
public request ──> CloudFront (*.tunell.com) ──> Lambda (relay)
    Lambda: lookup tunnel in DynamoDB → send frame via WS management API
    CLI: forward to local service → reply → Lambda → HTTP response
```

- **Control plane:** WebSocket API Gateway + Lambda ($connect/$disconnect/$default),
  DynamoDB stores connections and tunnels
- **Data plane:** CloudFront wildcard `*.tunell.com` → Lambda URL (streaming),
  relay over WS management API with chunked frame protocol
- **State:** DynamoDB — users, tokens, connections, tunnels, logs
- **Auth:** custom Lambda + JWT (email or phone signup), no Cognito
- **UI:** React dashboard on S3 + CloudFront: login/registration,
  token management, connection tables, request logs; separate simple admin panel
- **CLI:** Bun, published to npm (`npm install -g tunell`), ngrok-like
  commands: `tunell authtoken <token>`, `tunell http <port>`,
  `tunell tcp <port>`, `tunell ws <port>`
- **IaaC:** AWS CDK (TypeScript)

## Key Constraints

- **No EC2/Fargate/ECS/containers** — Lambda + API Gateway + DynamoDB + S3 +
  CloudFront only
- **TCP tunnels** = byte-stream over the existing WS channel (no raw TCP
  ingress on AWS); remote client must speak WS (e.g. websocat)
- **WS frames ≤128KB** — frame protocol with chunking/ack for large payloads
- **Subdomains:** CloudFront wildcard `*.tunell.com` → per-user subdomain
  `user1.tunell.com`; Route 53 DNS configured manually by owner
- **Keep-alive** pings required to survive API Gateway idle timeout
- User owns `tunell.com` domain (placeholder — Route 53 manual)

## Out of Scope (v1)

- Raw TCP ingress (SSH `-p` style) — needs non-Lambda relay, later
- Web UI for tunnel introspection streaming — logs only
- Rate limiting / abuse protection beyond basic auth
