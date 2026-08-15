# Vole CLI

Self-hosted HTTP tunnel client (ngrok alternative on AWS). Built with Bun,
runs on plain Node 22+ (bundled single file).

## Install

```bash
npm install -g vole
```

From the repo (development):

```bash
cd cli && npm run build && node dist/vole.js --help
```

## Commands

```bash
vole authtoken <token> [wss-server-url]   # save token (+ optional WS server URL)
vole http <port>                          # open HTTP tunnel to localhost:<port>
vole tcp <port>                           # bridge a TCP port to a local server
vole ws <port>                            # proxy WebSocket messages to a local server
vole http 3000 tcp 5000 ws 8080           # several tunnels in one process
```

Remote side:

```bash
# tcp: attach to the tunnel as a raw socket client
websocat wss://<server-host>/dev?tunnel=<subdomain>

# ws: attach as a WebSocket client
new WebSocket('wss://<server-host>/dev?tunnel=<subdomain>')
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Clean shutdown (Ctrl+C / SIGTERM) |
| 1 | Runtime failure (network, local port down, tunnel rejected) |
| 2 | Usage / config error (no or bad token, malformed args) |

## Config

Stored at `~/.vole/config.json` (mode 0600): `{ "token": "...", "server": "wss://..." }`.
