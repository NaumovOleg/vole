# Phase 5: TCP & WS Tunnels

## Goal

`vole tcp <port>` and `vole ws <port>` forward arbitrary byte streams and WebSocket
traffic through the tunnel to public endpoints. Binary payloads round-trip uncorrupted.

## Requirements

CLI-04 (`vole tcp <port>` — TCP-over-WS tunnel), CLI-05 (`vole ws <port>` — WS proxy),
PROTO-01 (DATA frames).

## Success Criteria

1. `vole tcp <port>` forwards arbitrary byte streams bidirectionally
2. `vole ws <port>` proxies WS traffic to a local WS server
3. Binary payloads round-trip without corruption

## Design Decisions

- **Public endpoint:** `wss://api.vole.sh/dev?tunnel=<subdomain>` — the `*.vole.sh`
  wildcard is occupied by CloudFront → relay (HTTP-only). The WS API Gateway is the
  only public WS-capable endpoint, so non-HTTP tunnels attach there via query param.
  Remote clients: `websocat wss://api.vole.sh/dev?tunnel=u-xxxx` for TCP; a browser
  or ws client with the same URL for WS. **Deviations from roadmap:** pretty
  subdomain URLs for TCP/WS deferred (needs wildcard routing to two targets).
- **Proxy connections are unauthenticated** — the subdomain is the capability
  (matches how the tunnel already gates access). No token in URL.
- **Connection row** gains `role: 'proxy'` + `tunnelSubdomain`; agent connections
  unchanged (role default 'agent').
- **Byte forwarding:** proxy WS message (text or binary) → `data` frame to agent
  connection (base64, `{n, data}`). Agent `data` frame from a tcp/ws tunnel →
  raw bytes to the tunnel's proxy. HTTP tunnels keep the existing storeChunk path.
- **Binary:** WS API configured with `binaryMediaTypes: ['application/octet-stream']`;
  handler posts raw Uint8Array to proxies (binary frame); incoming binary arrives
  as base64 in event body (isBase64Encoded).
- **Sequence `n`** per direction for ordering guarantees and debugging.
- Relay is NOT involved — TCP/WS bypass the HTTP relay entirely.

## Waves

| Wave | Plans | Why |
|------|-------|-----|
| 1 | 05-01 routing core (TDD) | Independent foundation |
| 2 | 05-02 ws-handler + CDK, 05-03 CLI tcp, 05-04 CLI ws | Depend on 05-01, independent of each other |

## Acceptance

1. Proxy $connect with `?tunnel=<existing-tcp-or-ws-tunnel>` registers role=proxy;
   unknown subdomain → rejected
2. Bytes from proxy reach agent CLI and hit the local TCP socket / WS server; replies
   return through the same path
3. Binary payloads (0x00..0xFF, >1MB) round-trip intact
4. Disconnect of proxy or agent cleans up; agent disconnect closes its tunnels
5. `cd shared && bun test`, `cd infra && bun test && npx tsc --noEmit && cdk synth`,
   `cd cli && npx tsc --noEmit` all green
