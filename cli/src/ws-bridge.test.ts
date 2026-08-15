import { describe, expect, test } from 'bun:test';
import { WebSocketServer } from 'ws';
import { WsBridge } from './ws-bridge';

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

async function pair(): Promise<{ wss: WebSocketServer; localWs: any; client: WebSocket }> {
  const wss = new WebSocketServer({ port: 0, hostname: '127.0.0.1' });
  const port = wss.address().port;
  const serverConnected = new Promise<any>((r) => wss.on('connection', r));
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  const clientOpen = new Promise<void>((r) => {
    client.onopen = () => r();
  });
  const localWs = await serverConnected;
  await clientOpen;
  return { wss, localWs, client };
}

describe('WsBridge', () => {
  test('text message arrives as send() with base64 of the utf8 text', async () => {
    const { wss, localWs, client } = await pair();
    const sent: Array<{ n: number; dataB64: string }> = [];
    new WsBridge({ localWs, send: (n, dataB64) => sent.push({ n, dataB64 }) });
    client.send('hello world');
    await until(() => sent.length >= 1);
    expect(sent[0]).toEqual({ n: 0, dataB64: Buffer.from('hello world').toString('base64') });
    localWs.close();
    client.close();
    wss.close();
  });

  test('binary message arrives as send() with exact base64', async () => {
    const { wss, localWs, client } = await pair();
    const bytes = new Uint8Array(256);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i;
    const sent: Array<{ n: number; dataB64: string }> = [];
    new WsBridge({ localWs, send: (n, dataB64) => sent.push({ n, dataB64 }) });
    client.send(bytes);
    await until(() => sent.length >= 1);
    expect(sent[0]).toEqual({ n: 0, dataB64: Buffer.from(bytes).toString('base64') });
    expect(Buffer.from(sent[0].dataB64, 'base64').equals(Buffer.from(bytes))).toBe(true);
    localWs.close();
    client.close();
    wss.close();
  });

  test('writeData delivers decoded bytes to the client as a message', async () => {
    const { wss, localWs, client } = await pair();
    const received: Array<string | Uint8Array> = [];
    client.onmessage = (ev: MessageEvent) => {
      received.push(ev.data);
    };
    const bridge = new WsBridge({ localWs, send: () => {} });
    bridge.writeData(0, Buffer.from('hello').toString('base64'));
    await until(() => received.length >= 1);
    const got = received[0];
    expect(typeof got === 'string' ? Buffer.from(got) : Buffer.from(got)).toEqual(Buffer.from('hello'));
    localWs.close();
    client.close();
    wss.close();
  });

  test('onClose fires when the server closes the socket', async () => {
    const { wss, localWs, client } = await pair();
    let closed = false;
    new WsBridge({ localWs, send: () => {}, onClose: () => (closed = true) });
    localWs.close();
    await until(() => closed);
    client.close();
    wss.close();
  });
});