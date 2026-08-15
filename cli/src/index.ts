import { runAuthtoken } from './commands/authtoken.js';
import { launchHttp, httpHints } from './commands/http.js';
import { launchTcp, tcpHints } from './commands/tcp.js';
import { launchWs, wsHints } from './commands/ws.js';
import { TunnelManager } from './manager.js';
import { startRepl } from './repl.js';
import { voleToken } from './session.js';

const args = process.argv.slice(2);

switch (args[0]) {
  case 'authtoken':
    runAuthtoken(args.slice(1));
    break;
  case 'http':
  case 'tcp':
  case 'ws':
    runTunnels();
    break;
  case undefined:
    if (!tokenOk()) break;
    startRepl();
    break;
  case 'help':
  case '--help':
  case '-h':
    printUsage();
    break;
  default:
    console.error(`unknown command: ${args[0]}`);
    printUsage();
    process.exit(2);
}

function runTunnels(): void {
  const pairs = parsePairs(args);
  if (!tokenOk()) return;
  const manager = new TunnelManager();
  for (const [kind, port] of pairs) {
    const launch =
      kind === 'http' ? launchHttp : (p: number) => (kind === 'tcp' ? launchTcp(p) : launchWs(p));
    const hints = kind === 'http' ? httpHints : kind === 'tcp' ? tcpHints : wsHints;
    manager.addTunnel({
      id: `${kind}-${port}`,
      kind,
      port,
      launch: () => launch(port),
      onReady: (id, handle) => {
        console.log(`Vole ready: ${handle.url}`);
        for (const h of hints(handle.url, port)) console.log(h);
      },
      onError: (id, err) => console.error(`[${id}] error: ${err.message}`),
    });
  }
  manager.start();
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  function shutdown(): void {
    void manager.closeAll().then(() => {
      console.log(`closed ${manager.count()} tunnel(s)`);
      process.exit(0);
    });
  }
}

function tokenOk(): boolean {
  if (voleToken()) return true;
  console.error('no token — run `vole authtoken <token>` first');
  process.exit(2);
}

function parsePairs(args: string[]): Array<[string, number]> {
  const pairs: Array<[string, number]> = [];
  for (let i = 0; i < args.length; i += 2) {
    const kind = args[i];
    const raw = args[i + 1];
    const port = Number(raw);
    if (!['http', 'tcp', 'ws'].includes(kind) || !Number.isInteger(port) || port < 1 || port > 65535) {
      console.error(`invalid tunnel spec: ${raw === undefined ? kind : `${kind} ${raw}`}`);
      printUsage();
      process.exit(2);
    }
    pairs.push([kind, port]);
  }
  return pairs;
}

function printUsage(): void {
  console.log(`vole — self-hosted tunnel client

Usage:
  vole                                  interactive console (type commands below)
  vole authtoken <token> [wss-server-url]   save your API token
  vole <kind> <port> [<kind> <port> ...]    open one or more tunnels

Kinds: http | tcp | ws

Interactive commands:
  http <port> / tcp <port> / ws <port>  open a tunnel
  stop <port>                           close that tunnel
  list / exit                           show tunnels / quit

Examples:
  vole authtoken vole_abc123 wss://xxxx.execute-api.us-east-1.amazonaws.com/dev
  vole http 3000
  vole http 3000 tcp 5000 ws 8080`);
}