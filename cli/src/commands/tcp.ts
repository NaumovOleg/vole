import { connect } from 'node:net';
import { loadConfig } from '../config.js';
import { TunnelSession } from '../tunnel.js';
import { ByteBridge } from '../bridge.js';
import { encodeFrame } from '@tunell/shared';

const DEFAULT_SERVER = 'wss://api.vole.sh/dev';

export async function runTcp(args: string[]): Promise<void> {
  const port = Number(args[0]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('usage: vole tcp <port>');
    process.exit(2);
  }
  const config = loadConfig();
  if (!config.token) {
    console.error('no token — run `vole authtoken <token>` first');
    process.exit(2);
  }

  const session = new TunnelSession({
    server: config.server ?? DEFAULT_SERVER,
    token: config.token,
    type: 'tcp',
    localPort: port,
    onData: (n, dataB64) => bridge?.writeData(n, dataB64),
  });

  const info = await session.openPromise;
  const attachUrl = `wss://${(config.server ?? DEFAULT_SERVER).replace(/^wss?:\/\//, '')}?tunnel=${info.subdomain}`;
  console.log(`Vole ready: ${attachUrl}`);
  console.log(`remote: websocat ${attachUrl}`);

  let bridge: ByteBridge | undefined;
  let shuttingDown = false;
  const socket = connect({ port, host: '127.0.0.1' });
  socket.on('connect', () => {
    bridge = new ByteBridge({
      socket,
      send: (n, dataB64) => void session.sendData(n, dataB64),
      onClose: () => {
        if (shuttingDown) return;
        console.error('tunnel closed');
        process.exit(1);
      },
    });
  });
  socket.on('error', (err) => {
    void session.send(encodeFrame('error', 'tcp-err', { error: err.message }));
    console.error(`socket error: ${err.message}`);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    shuttingDown = true;
    socket.destroy();
    await session.close();
    process.exit(0);
  });
}