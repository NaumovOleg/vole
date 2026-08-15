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
```

Remote side:

```bash
# tcp: attach to the tunnel as a raw socket client
websocat wss://<server-host>/dev?tunnel=<subdomain>

# ws: attach as a WebSocket client
new WebSocket('wss://<server-host>/dev?tunnel=<subdomain>')
```

## Config

Stored at `~/.vole/config.json` (mode 0600): `{ "token": "...", "server": "wss://..." }`.
