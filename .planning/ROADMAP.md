# Tunell Roadmap

## Overview

Tunell delivers a self-hosted ngrok alternative on pure serverless AWS:
CLI (Bun/npm) tunnels local HTTP/TCP/WS traffic to public URLs via WS API
Gateway + Lambda + DynamoDB, with CloudFront wildcard subdomains, a React
dashboard, and CDK infrastructure. 10 phases, 36 v1 requirements, goal
backward success criteria.

## Phases

| Phase | Goal | Reqs | Dependencies |
|-------|------|------|--------------|
| 1 - Foundation | CDK project deploys with all data storage ready | 2 | — |
| 2 - Auth | Users create accounts and manage access tokens | 5 | 1 |
| 3 - WS Control Plane | CLI establishes and maintains authenticated WS connections | 5 | 2 |
| 4 - HTTP Tunnel End-to-End | `tunell http 3000` serves the local app at a public URL | 11 | 1, 3 |
| 5 - TCP & WS Tunnels | TCP and WebSocket traffic tunnels through | 3 | 4 |
| 6 - CLI Multi-Tunnel & Polish | One CLI runs several tunnels with clear feedback | 2 | 4 |
| 7 - Dashboard API | All dashboard actions available as authenticated REST endpoints | 1 | 2, 3 |
| 8 - Dashboard UI | User manages tunnels and inspects traffic from the browser | 5 | 7 |
| 9 - Admin Panel | Owner manages users and access | 3 | 2, 8 |
| 10 - Deployment & Docs | Anyone can deploy and operate the service | 2 | 1, 4, 8 |

### Phase 1: Foundation

**Goal:** A CDK project deploys a serverless app with all data storage ready.

**Requirements:** INFRA-01, INFRA-03

**Success Criteria:**
1. `cdk deploy` on an empty AWS account creates DynamoDB tables (users, tokens, connections, tunnels, logs) and base resources without errors
2. Repo has a monorepo layout (infra/, cli/, ui/, shared/) with consistent scripts
3. Logs/connections tables have TTL enabled
4. Local dev workflow documented in README

### Phase 2: Auth

**Goal:** Users can create accounts and manage access tokens.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05

**Success Criteria:**
1. User registers with email OR phone + password
2. User logs in and receives a JWT that authenticates protected endpoints
3. User creates API tokens; revoked tokens stop working immediately
4. Passwords stored hashed; no plaintext in DB or logs

### Phase 3: WS Control Plane

**Goal:** CLI establishes and maintains authenticated WS connections.

**Requirements:** CORE-01, CORE-06, PROTO-01, PROTO-03

**Success Criteria:**
1. CLI authenticates on $connect; invalid token rejected
2. Connection registered in DynamoDB on connect, removed on disconnect
3. Heartbeat frames exchanged; connection survives >15 min idle
4. Frame protocol negotiated (HELLO/READY) with typed frames

### Phase 4: HTTP Tunnel End-to-End

**Goal:** `tunell http 3000` serves the local app at a public URL.

**Requirements:** CORE-02, CORE-03, CORE-04, CORE-05, CLI-01, CLI-02, CLI-03, INFRA-02, PROTO-02, PROTO-04

**Success Criteria:**
1. `tunell authtoken <token>` then `tunell http 3000` prints `https://userX.tunell.com`
2. curl to that URL returns exactly what the local server returns (method, headers, body)
3. 10 concurrent requests all succeed
4. 1MB response body round-trips intact (chunked)
5. Slow local server → caller gets 504, connection stays healthy

### Phase 5: TCP & WS Tunnels

**Goal:** TCP and WebSocket traffic tunnels through.

**Requirements:** CLI-04, CLI-05, PROTO-01 (DATA frames)

**Success Criteria:**
1. `tunell tcp <port>` forwards arbitrary byte streams bidirectionally
2. `tunell ws <port>` proxies WS handshake + messages to a local WS server
3. Binary payloads round-trip without corruption

### Phase 6: CLI Multi-Tunnel & Polish

**Goal:** One CLI runs several tunnels with clear feedback.

**Requirements:** CLI-06, CLI-07

**Success Criteria:**
1. 2+ tunnels (http+tcp) active from one process simultaneously
2. Each tunnel has independent URL and state
3. Errors (bad token, port busy, no network) produce human-readable messages
4. Ctrl+C gracefully closes tunnels and disconnects

### Phase 7: Dashboard API

**Goal:** All dashboard actions are available as authenticated REST endpoints.

**Requirements:** DASH-06

**Success Criteria:**
1. REST API with JWT auth: tokens CRUD, connections list, request logs list
2. 401 without valid token; 403 on cross-user access
3. Endpoints query DynamoDB scoped to the authenticated user

### Phase 8: Dashboard UI

**Goal:** User manages tunnels and inspects traffic from the browser.

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05

**Success Criteria:**
1. React app loads via HTTPS from S3+CloudFront
2. User registers/logs in, sees tokens, creates and revokes them
3. Connections table shows active tunnels with subdomain and status
4. Logs table shows recent requests (method, path, status, latency)

### Phase 9: Admin Panel

**Goal:** Owner manages users and access.

**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03

**Success Criteria:**
1. Admin has elevated role; regular users get 403 on admin endpoints
2. User list renders email, status, created date
3. Blocking a user kills their WS connections and rejects their tokens

### Phase 10: Deployment & Docs

**Goal:** Anyone can deploy and operate the service.

**Requirements:** INFRA-04, INFRA-05

**Success Criteria:**
1. One command builds + deploys UI to S3 and invalidates CloudFront
2. README documents `cdk deploy`, manual Route 53 setup, `npm install -g tunell`
3. End-to-end walkthrough works: register → token → tunnel → request → logs visible

## Coverage

| Requirement | Phase | Requirement | Phase | Requirement | Phase |
|-------------|-------|-------------|-------|-------------|-------|
| CORE-01 | 3 | AUTH-01 | 2 | DASH-01 | 8 |
| CORE-02 | 4 | AUTH-02 | 2 | DASH-02 | 8 |
| CORE-03 | 4 | AUTH-03 | 2 | DASH-03 | 8 |
| CORE-04 | 4 | AUTH-04 | 2 | DASH-04 | 8 |
| CORE-05 | 4 | AUTH-05 | 2 | DASH-05 | 8 |
| CORE-06 | 3 | ADMIN-01 | 9 | DASH-06 | 7 |
| CLI-01 | 4 | ADMIN-02 | 9 | PROTO-01 | 3 |
| CLI-02 | 4 | ADMIN-03 | 9 | PROTO-02 | 4 |
| CLI-03 | 4 | INFRA-01 | 1 | PROTO-03 | 3 |
| CLI-04 | 5 | INFRA-02 | 4 | PROTO-04 | 4 |
| CLI-05 | 5 | INFRA-03 | 1 | PROTO-05 | — |
| CLI-06 | 6 | INFRA-04 | 10 | PROTO-06 | — |
| CLI-07 | 6 | INFRA-05 | 10 | | |

**Coverage:** 36/36 v1 requirements mapped ✓
**Orphans:** none
**Note:** PROTO-05/06 reserved for future protocol extensions (not v1).

## Progress

| Phase | Status |
|-------|--------|
| 1 - Foundation | Pending |
| 2 - Auth | Pending |
| 3 - WS Control Plane | Pending |
| 4 - HTTP Tunnel End-to-End | Pending |
| 5 - TCP & WS Tunnels | Pending |
| 6 - CLI Multi-Tunnel & Polish | Pending |
| 7 - Dashboard API | Pending |
| 8 - Dashboard UI | Pending |
| 9 - Admin Panel | Pending |
| 10 - Deployment & Docs | Pending |
