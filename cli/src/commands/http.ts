import { TunnelSession } from '../tunnel.js';
import type { TunnelHandle } from '../manager.js';
import type { HttpRequestPayload, HttpResponsePayload } from '@tunell/shared';
import { voleServer, voleToken } from '../session.js';

export function launchHttp(port: number): Promise<TunnelHandle> {
  const session = new TunnelSession({
    server: voleServer(),
    token: voleToken(),
    type: 'http',
    localPort: port,
    onRequest: (request, reply) => forward(request, reply, port),
  });
  return session.openPromise.then((info) => ({
    url: info.url,
    close: () => session.close(),
  }));
}

export function httpHints(url: string, port: number): string[] {
  return [`Forwarding http://localhost:${port} -> ${url}`];
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