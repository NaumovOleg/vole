import { loadConfig } from '../config.js';
import { TunnelSession } from '../tunnel.js';
import type { HttpRequestPayload, HttpResponsePayload } from '@tunell/shared';

const DEFAULT_SERVER = 'wss://api.vole.sh/dev';

export async function runHttp(args: string[]): Promise<void> {
  const port = Number(args[0]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('usage: vole http <port>');
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
    type: 'http',
    localPort: port,
    onRequest: (request, reply) => forward(request, reply, port),
  });

  const info = await session.openPromise;
  console.log(`Vole ready: ${info.url}`);
  console.log(`Forwarding http://localhost:${port} -> ${info.url}`);

  process.on('SIGINT', async () => {
    await session.close();
    process.exit(0);
  });
}

async function forward(
  request: HttpRequestPayload,
  reply: (resp: HttpResponsePayload) => Promise<void>,
  port: number,
): Promise<void> {
  const method = request.method ?? 'GET';
  const body = request.bodyB64 ? Buffer.from(request.bodyB64, 'base64') : undefined;
  try {
    const resp = await fetch(`http://localhost:${port}${request.path ?? '/'}`, {
      method,
      headers: request.headers,
      body,
      redirect: 'manual',
    });
    const text = await resp.text();
    const headers: Record<string, string> = {};
    resp.headers.forEach((value, key) => {
      headers[key] = value;
    });
    await reply({
      statusCode: resp.status,
      headers,
      bodyB64: Buffer.from(text).toString('base64'),
    });
  } catch (err: any) {
    console.error(`forward failed: ${err?.message ?? err}`);
    await reply({
      statusCode: 502,
      headers: { 'content-type': 'text/plain' },
      bodyB64: Buffer.from(`proxy error: ${err?.message ?? err}`).toString('base64'),
    });
  }
}
