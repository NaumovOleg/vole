import { connect } from 'node:net';
import { TunnelSession } from '../tunnel.js';
import { ByteBridge } from '../bridge.js';
import type { TunnelHandle } from '../manager.js';
import { voleServer, voleToken, attachUrl } from '../session.js';

export function launchTcp(port: number): Promise<TunnelHandle> {
  const session = new TunnelSession({
    server: voleServer(),
    token: voleToken(),
    type: 'tcp',
    localPort: port,
    onData: (n, dataB64) => bridge?.writeData(n, dataB64),
  });

  let bridge: ByteBridge | undefined;
  return session.openPromise.then((info) => {
    const url = attachUrl(info.subdomain);
    return new Promise<TunnelHandle>((resolve, reject) => {
      const socket = connect({ port, host: '127.0.0.1' });
      socket.once('error', () => reject(new Error(`local port ${port} is not listening`)));
      socket.once('connect', () => {
        bridge = new ByteBridge({
          socket,
          send: (n, dataB64) => void session.sendData(n, dataB64),
          onClose: () => console.error(`[tcp:${port}] tunnel closed`),
        });
        resolve({
          url,
          close: async () => {
            socket.destroy();
            await session.close();
          },
        });
      });
    });
  });
}

export function tcpHints(url: string): string[] {
  return [`remote: websocat ${url}`];
}