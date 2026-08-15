import { createInterface } from 'node:readline';
import { TunnelManager, type TunnelSpec } from './manager.js';
import { launchHttp, httpHints } from './commands/http.js';
import { launchTcp, tcpHints } from './commands/tcp.js';
import { launchWs, wsHints } from './commands/ws.js';
import { voleServer } from './session.js';

type Spec = TunnelSpec<Spec>;

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const LOGO = [
  '██╗   ██╗  ██████╗  ██╗      ███████╗',
  '██║   ██║ ██╔═══██╗ ██║      ██╔════╝',
  '██║   ██║ ██║   ██║ ██║      █████╗  ',
  '╚██╗ ██╔╝ ██║   ██║ ██║      ██╔══╝  ',
  ' ╚████╔╝  ╚██████╔╝ ███████╗ ███████╗',
  '  ╚═══╝    ╚═════╝  ╚══════╝ ╚══════╝',
];

function banner(): void {
  console.clear();
  console.log(`${CYAN}${LOGO.join('\n')}${RESET}`);
  console.log(`\n${DIM}  self-hosted tunnels · server ${voleServer()}${RESET}`);
  console.log(`${DIM}  type 'help' for commands, Ctrl+C or 'exit' to quit${RESET}\n`);
}

export type Command =
  | { action: 'open'; kind: 'http' | 'tcp' | 'ws'; port: number }
  | { action: 'stop'; port: number }
  | { action: 'list' }
  | { action: 'help' }
  | { action: 'exit' }
  | { action: 'none' };

export function parseCommand(line: string): Command {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { action: 'none' };
  const [cmd, arg] = parts;
  switch (cmd) {
    case 'http':
    case 'tcp':
    case 'ws': {
      const port = Number(arg);
      if (!Number.isInteger(port) || port < 1 || port > 65535) return { action: 'help' };
      return { action: 'open', kind: cmd, port };
    }
    case 'stop': {
      const port = Number(arg);
      if (!Number.isInteger(port) || port < 1 || port > 65535) return { action: 'help' };
      return { action: 'stop', port };
    }
    case 'list':
    case 'ls':
      return { action: 'list' };
    case 'exit':
    case 'quit':
    case 'q':
      return { action: 'exit' };
    case 'help':
    case 'h':
      return { action: 'help' };
    default:
      return { action: 'help' };
  }
}

export function startRepl(): void {
  const manager = new TunnelManager<Spec>();
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'vole> ' });

  rl.on('line', (line) => {
    void handleCommand(manager, parseCommand(line));
    rl.prompt();
  });
  rl.on('close', () => shutdown(manager));
  rl.on('SIGINT', () => shutdown(manager));
  console.clear();
  banner();
  rl.prompt();
}

async function handleCommand(manager: TunnelManager<Spec>, cmd: Command): Promise<void> {
  switch (cmd.action) {
    case 'open': {
      const launch =
        cmd.kind === 'http' ? launchHttp : (p: number) => (cmd.kind === 'tcp' ? launchTcp(p) : launchWs(p));
      const hints = cmd.kind === 'http' ? httpHints : cmd.kind === 'tcp' ? tcpHints : wsHints;
      manager.addTunnel({
        id: `${cmd.kind}-${cmd.port}`,
        kind: cmd.kind,
        port: cmd.port,
        launch: () => launch(cmd.port),
        onReady: (id, handle) => {
          console.log(`${GREEN}> ${handle.url}${RESET}${DIM} → http://localhost:${cmd.port}${RESET}`);
          for (const h of hints(handle.url, cmd.port)) console.log(`${DIM}  ${h}${RESET}`);
        },
        onError: (id, err) => console.error(`[${id}] error: ${err.message}`),
      });
      manager.start();
      break;
    }
    case 'stop': {
      const hit = manager.statuses().find((s) => s.id.endsWith(`-${cmd.port}`));
      if (!hit) {
        console.log(`no tunnel on port ${cmd.port}`);
        break;
      }
      await manager.close(hit.id);
      console.log(`closed ${hit.id}`);
      break;
    }
    case 'list': {
      const rows = manager.statuses();
      if (rows.length === 0) {
        console.log('no tunnels — run `http <port>`, `tcp <port>` or `ws <port>`');
        break;
      }
      for (const s of rows) console.log(`${s.id.padEnd(10)} ${s.state.padEnd(8)} ${s.url ?? ''}`);
      break;
    }
    case 'help':
      console.log(`commands:
  http <port>   open an http tunnel to localhost:<port>
  tcp <port>    bridge a tcp port
  ws <port>     proxy websocket messages
  stop <port>   close the tunnel on that port
  list          show tunnels
  exit          close everything and quit`);
      break;
    case 'exit':
      shutdown(manager);
      break;
    case 'none':
      break;
  }
}

function shutdown(manager: TunnelManager<Spec>): void {
  void manager.closeAll().then(() => {
    console.log(`closed ${manager.count()} tunnel(s)`);
    process.exit(0);
  });
}