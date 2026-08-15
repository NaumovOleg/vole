import { describe, expect, test } from 'bun:test';
import * as net from 'node:net';
import { ByteBridge } from './bridge';

function until(fn: () => boolean, ms = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (fn()) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - start > ms) {
        clearInterval(iv);
        reject(new Error('timeout'));
      }
    }, 5);
  });
}

async function pair(): Promise<{ server: net.Server; remote: net.Socket; client: net.Socket }> {
  const server = net.createServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address() as net.AddressInfo;
  const serverConnected = new Promise<net.Socket>((r) => server.once('connection', r));
  const client = net.connect(addr.port, '127.0.0.1');
  const clientConnected = new Promise<void>((r) => client.once('connect', r));
  const remote = await serverConnected;
  await clientConnected;
  return { server, remote, client };
}

describe('ByteBridge', () => {
  test('server bytes arrive as send() calls with correct base64', async () => {
    const { server, remote, client } = await pair();
    const sent: Array<{ n: number; dataB64: string }> = [];
    new ByteBridge({ socket: client, send: (n, dataB64) => sent.push({ n, dataB64 }) });
    remote.write('hello world');
    await until(() => sent.length >= 1);
    expect(sent[0]).toEqual({ n: 0, dataB64: Buffer.from('hello world').toString('base64') });
    client.destroy();
    remote.destroy();
    server.close();
  });

  test('writeData delivers exact bytes to the server', async () => {
    const { server, remote, client } = await pair();
    const out: Buffer[] = [];
    remote.on('data', (c: Buffer) => out.push(c));
    const bridge = new ByteBridge({ socket: client, send: () => {} });
    bridge.writeData(0, Buffer.from('payload bytes').toString('base64'));
    await until(() => Buffer.concat(out).toString() === 'payload bytes');
    client.destroy();
    remote.destroy();
    server.close();
  });

  test('300KB binary buffer round-trips intact in both directions', async () => {
    const { server, remote, client } = await pair();
    const orig = Buffer.alloc(300 * 1024);
    for (let i = 0; i < orig.length; i++) orig[i] = i % 256;
    const sent: Array<{ n: number; dataB64: string }> = [];
    const bridge = new ByteBridge({ socket: client, send: (n, dataB64) => sent.push({ n, dataB64 }) });
    remote.on('data', (c: Buffer) => remote.write(c));
    const CHUNK = 64 * 1024;
    let n = 0;
    for (let off = 0; off < orig.length; off += CHUNK) {
      bridge.writeData(n++, orig.subarray(off, off + CHUNK).toString('base64'));
    }
    await until(() => {
      const joined = Buffer.concat(sent.map((s) => Buffer.from(s.dataB64, 'base64')));
      return joined.length >= orig.length;
    });
    const joined = Buffer.concat(sent.map((s) => Buffer.from(s.dataB64, 'base64')));
    expect(joined.equals(orig)).toBe(true);
    expect(sent.map((s) => s.n)).toEqual(sent.map((_, i) => i));
    client.destroy();
    remote.destroy();
    server.close();
  });

  test('onError fires on socket error', async () => {
    const { server, remote, client } = await pair();
    let err: Error | undefined;
    new ByteBridge({ socket: client, send: () => {}, onError: (e) => (err = e) });
    client.destroy(Object.assign(new Error('boom'), {}));
    await until(() => err !== undefined);
    expect(err!.message).toBe('boom');
    remote.destroy();
    server.close();
  });

  test('onClose fires on socket close', async () => {
    const { server, remote, client } = await pair();
    let closed = false;
    new ByteBridge({ socket: client, send: () => {}, onClose: () => (closed = true) });
    client.destroy();
    await until(() => closed);
    remote.destroy();
    server.close();
  });
});