# Tunell Requirements

## Core Value

A solo developer runs `tunell http 3000`, receives a public URL, and HTTP
requests to that URL reach their local server — pure serverless AWS, no
containers.

## v1 Requirements

### CORE — Tunnel Loop (the one thing that must work)

| ID | Requirement | Verification |
|----|-------------|--------------|
| CORE-01 | CLI connects to WS API Gateway and authenticates with token | Connection registered in DynamoDB |
| CORE-02 | User receives a public URL on connect | CLI prints `https://user1.tunell.com` |
| CORE-03 | HTTP request to public URL is relayed to connected CLI | Local server receives exact method/headers/body |
| CORE-04 | HTTP response is relayed back to caller | Caller receives exact status/headers/body |
| CORE-05 | Multiple concurrent requests per tunnel work | 10 parallel requests all succeed |
| CORE-06 | Disconnect cleans up connection record | DynamoDB row removed, URL stops resolving |

### CLI — Bun CLI, npm-installable

| ID | Requirement | Verification |
|----|-------------|--------------|
| CLI-01 | Installs via `npm install -g tunell` | Clean install on fresh machine |
| CLI-02 | `tunell authtoken <token>` saves token locally | Config persisted |
| CLI-03 | `tunell http <port>` opens HTTP tunnel | Public URL printed, traffic flows |
| CLI-04 | `tunell tcp <port>` opens TCP-over-WS tunnel | Byte stream bidirectionally forwarded |
| CLI-05 | `tunell ws <port>` proxies incoming WS to local WS server | WS handshake + messages proxied |
| CLI-06 | Multiple tunnels from one CLI process | 2+ tunnels active simultaneously |
| CLI-07 | Graceful error messages (bad token, no network) | Human-readable exit output |

### AUTH — Custom Lambda + JWT

| ID | Requirement | Verification |
|----|-------------|--------------|
| AUTH-01 | Register with email OR phone + password | User created, verification token issued |
| AUTH-02 | Login issues JWT | Token works on authenticated endpoints |
| AUTH-03 | Token management: create/revoke API tokens | Revoked token rejected on WS connect |
| AUTH-04 | Password hashing (bcrypt/argon2) | No plaintext anywhere |
| AUTH-05 | JWT validation on all protected endpoints | 401 on invalid/expired |

### DASH — Dashboard API + React UI

| ID | Requirement | Verification |
|----|-------------|--------------|
| DASH-01 | React app served from S3+CloudFront | Loads via HTTPS |
| DASH-02 | Login/registration pages (email or phone) | Round-trip works |
| DASH-03 | Token management page (create/revoke/copy) | CRUD works via API |
| DASH-04 | Connections table (tunnel, subdomain, status, local port) | Live-ish data from DynamoDB |
| DASH-05 | Request logs table (method, path, status, latency, time) | Recent logs for own tunnels |
| DASH-06 | API: REST endpoints backed by Lambda+DynamoDB | All dashboard actions work |

### ADMIN — Simple admin panel

| ID | Requirement | Verification |
|----|-------------|--------------|
| ADMIN-01 | Admin role (seeded or by flag) | Admin-only endpoints 403 for users |
| ADMIN-02 | User list (email, status, created) | Table renders |
| ADMIN-03 | Block/unblock user, revoke all tokens | Blocked user's WS killed, tokens rejected |

### PROTOCOL — WS framing

| ID | Requirement | Verification |
|----|-------------|--------------|
| PROTO-01 | Frame protocol: type, id, payload (HELLO, REQUEST, RESPONSE, DATA, PING/PONG) | Round-trip works |
| PROTO-02 | Chunking: payloads >128KB split into frames, reassembled | 1MB body round-trips intact |
| PROTO-03 | Heartbeat PING/PONG to survive idle timeout | Connection stays alive >15 min idle |
| PROTO-04 | Request timeout and error propagation | Slow local server → 504 to caller |

### INFRA — CDK

| ID | Requirement | Verification |
|----|-------------|--------------|
| INFRA-01 | Single CDK app deploys: WS API, HTTP relay (Lambda URL), DynamoDB, auth, UI | `cdk deploy` succeeds |
| INFRA-02 | CloudFront wildcard `*.tunell.com` → Lambda URL streaming | Subdomain routing works |
| INFRA-03 | DynamoDB tables with TTL for logs/connections | TTL honored |
| INFRA-04 | Deploy script for UI (build → upload S3 → invalidate) | One command |
| INFRA-05 | Route 53 (manual, documented) | Owner instructions in README |

## v2 (Deferred)

- Auto-reconnect in CLI
- Vanity subdomains (user-chosen names)
- Admin request logs view
- Rate limiting / abuse protection
- Email/phone verification codes
- Web UI live stream of tunnel traffic

## Out of Scope

- Raw TCP ingress (SSH `-p` style) — requires non-Lambda relay
- Any EC2/Fargate/containers
- Multi-region / HA
- Team features
