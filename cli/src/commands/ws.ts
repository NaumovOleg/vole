import { TunnelSession } from '../tunnel.js';
import { WsBridge } from '../ws-bridge.js';
import type { TunnelHandle } from '../manager.js';
import { voleServer, voleToken, attachUrl } from '../session.js';

export function launchWs(port: number): Promise<TunnelHandle> {
  const session = new TunnelSession({
    server: voleServer(),
    token: voleToken(),
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

  let bridge: WsBridge | undefined;
  let pending: Array<{ n: number; dataB64: string }> = [];
  return session.openPromise.then((info) => {
    const url = attachUrl(info.subdomain);
    return new Promise<TunnelHandle>((resolve, reject) => {
      const localWs = new WebSocket(`ws://127.0.0.1:${port}`);
      localWs.onopen = () => {
        bridge = new WsBridge({
          localWs,
          send: (n, dataB64) => void session.sendData(n, dataB64),
          onClose: () => console.error(`[ws:${port}] tunnel closed`),
        });
        for (const f of pending) bridge.writeData(f.n, f.dataB64);
        pending = [];
        resolve({
          url,
          close: async () => {
            localWs.close();
            await session.close();
          },
        });
      };
      localWs.onerror = () => reject(new Error(`no local WebSocket server on port ${port}`));
    });
  });
}

export function wsHints(url: string): string[] {
  return [`remote: new WebSocket('${url}')`];
}