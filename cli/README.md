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
```

## Config

Stored at `~/.vole/config.json` (mode 0600): `{ "token": "...", "server": "wss://..." }`.
