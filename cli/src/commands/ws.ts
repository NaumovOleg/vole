import { loadConfig } from '../config.js';
import { TunnelSession } from '../tunnel.js';
import { WsBridge } from '../ws-bridge.js';
import { encodeFrame } from '@tunell/shared';

const DEFAULT_SERVER = 'wss://api.vole.sh/dev';

export async function runWs(args: string[]): Promise<void> {
  const port = Number(args[0]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('usage: vole ws <port>');
    process.exit(2);
  }
  const config = loadConfig();
  if (!config.token) {
    console.error('no token — run `vole authtoken <token>` first');
    process.exit(2);
  }

  let bridge: WsBridge | undefined;
  let pending: Array<{ n: number; dataB64: string }> = [];

  const session = new TunnelSession({
    server: config.server ?? DEFAULT_SERVER,
    token: config.token,
    type: 'ws',
    localPort: port,
    onData: (n, dataB64) => {
      if (bridge) {
        bridge.writeData(n, dataB64);
      } else {
        pending.push({ n, dataB64 });
      }
    },
  });

  const info = await session.openPromise;
  const attachUrl = `wss://${(config.server ?? DEFAULT_SERVER).replace(/^wss?:\/\//, '')}?tunnel=${info.subdomain}`;
  console.log(`Vole ready: ${attachUrl}`);
  console.log(`remote: new WebSocket('${attachUrl}')`);

  const localWs = new WebSocket(`ws://127.0.0.1:${port}`);
  localWs.onopen = () => {
    bridge = new WsBridge({
      localWs,
      send: (n, dataB64) => void session.sendData(n, dataB64),
      onError: (err: any) => {
        void session.send(encodeFrame('error', 'ws-err', { error: err?.message ?? String(err) }));
        console.error(`local ws error: ${err?.message ?? err}`);
        process.exit(1);
      },
    });
    for (const f of pending) bridge.writeData(f.n, f.dataB64);
    pending = [];
  };
  localWs.onerror = (err: any) => {
    void session.send(encodeFrame('error', 'ws-err', { error: err?.message ?? String(err) }));
    console.error(`local ws error: ${err?.message ?? err}`);
    process.exit(1);
  };

  process.on('SIGINT', async () => {
    localWs.close();
    await session.close();
    process.exit(0);
  });
}