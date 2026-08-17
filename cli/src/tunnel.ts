import { randomUUID } from 'node:crypto';
import {
  encodeFrame,
  parseFrame,
  helloFrame,
  pingFrame,
  responseFrame,
  dataFrame,
  type Frame,
  type HttpRequestPayload,
  type HttpResponsePayload,
} from '@tunell/shared';
import { splitBody } from '@tunell/shared';
import { PROTOCOL_VERSION } from '@tunell/shared';

export interface TunnelOptions {
  server: string;
  token: string;
  type: 'http' | 'tcp' | 'ws';
  localPort: number;
  readyTimeoutMs?: number;
  onRequest?: (request: HttpRequestPayload, reply: (resp: HttpResponsePayload) => Promise<void>) => Promise<void>;
  onData?: (n: number, dataB64: string) => void;
}

export class TunnelSession {
  private ws: WebSocket;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private writeQueue: Promise<void> = Promise.resolve();
  private chunks = new Map<string, Map<number, string>>();
  private openResolve: ((t: { subdomain: string; url: string }) => void) | undefined;
  private openReject: ((err: Error) => void) | undefined;
  private readonly opts: TunnelOptions;
  readonly openPromise: Promise<{ subdomain: string; url: string }>;
  subdomain: string | undefined;

  constructor(opts: TunnelOptions) {
    this.opts = opts;
    this.ws = new WebSocket(`${opts.server.replace(/^http/, 'ws')}?token=${encodeURIComponent(opts.token)}`);
    this.openPromise = new Promise((resolve, reject) => {
      this.openResolve = resolve;
      this.openReject = reject;
    });

    const readyTimeout = setTimeout(() => {
      this.openReject?.(new Error(`cannot reach ${opts.server} — check your network or config`));
    }, opts.readyTimeoutMs ?? 15_000);
    this.openPromise.finally(() => clearTimeout(readyTimeout)).catch(() => {});

    this.ws.onopen = () => {
      this.send(helloFrame(PROTOCOL_VERSION));
      this.heartbeat = setInterval(() => this.send(pingFrame()), 240_000);
    };

    this.ws.onmessage = (ev: any) => {
      let frame: Frame;
      try {
        frame = parseFrame(String(ev.data));
      } catch {
        return;
      }
      void this.dispatch(frame);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.openReject?.(new Error(`connection to ${opts.server} closed`));
    };

    this.ws.onerror = () => {
      this.openReject?.(new Error(`cannot reach ${opts.server} — check your network or config`));
    };
  }

  async dispatch(frame: any): Promise<void> {
    switch (frame.t) {
      case 'ready':
        this.send(encodeFrame('tunnel-open', 'open-1', { type: this.opts.type, localPort: this.opts.localPort }));
        break;
      case 'tunnel-open':
        this.subdomain = frame.d.subdomain;
        this.openResolve?.({ subdomain: frame.d.subdomain, url: frame.d.url });
        break;
      case 'request': {
        const d = frame.d as HttpRequestPayload;
        if (!this.opts.onRequest) break;
        let body = d.bodyB64;
        if (d.chunkTotal && d.chunkTotal > 1) {
          body = await this.waitChunks(frame.id, d.chunkTotal);
        }
        if (body !== undefined) d.bodyB64 = body;
        await this.opts.onRequest(d, (resp) => this.reply(frame.id, resp));
        break;
      }
      case 'data': {
        const d = frame.d;
        if (typeof d.n !== 'number' || typeof d.data !== 'string') return;
        if (this.opts.onData) {
          this.opts.onData(d.n, d.data);
          break;
        }
        let list = this.chunks.get(frame.id);
        if (!list) {
          list = new Map();
          this.chunks.set(frame.id, list);
        }
        list.set(d.n, d.data);
        break;
      }
      case 'error': {
        const message = frame.d?.error ?? 'server error';
        this.openReject?.(new Error(message));
        console.error(`server error: ${message}`);
        break;
      }
      default:
        break;
    }
  }

  waitChunks(id: string, total: number): Promise<string> {
    return new Promise((resolve) => {
      const check = () => {
        const list = this.chunks.get(id);
        if (list && list.size >= total) {
          const parts: string[] = [];
          for (let n = 0; n < total; n++) {
            const part = list.get(n);
            if (part === undefined) {
              setTimeout(check, 10);
              return;
            }
            parts.push(part);
          }
          this.chunks.delete(id);
          resolve(parts.join(''));
          return;
        }
        setTimeout(check, 10);
      };
      check();
    });
  }

  async reply(id: string, resp: HttpResponsePayload): Promise<void> {
    const chunks = splitBody(resp.bodyB64 ?? '');
    if (chunks.length > 1) {
      const { bodyB64, ...rest } = resp;
      void bodyB64;
      await this.send(responseFrame(id, { ...rest, chunkTotal: chunks.length }));
      for (let n = 0; n < chunks.length; n++) {
        await this.send(dataFrame(id, n, chunks[n]));
      }
    } else {
      await this.send(responseFrame(id, resp));
    }
  }

  sendData(n: number, dataB64: string): Promise<void> {
    return this.send(dataFrame(randomUUID(), n, dataB64));
  }

  send(message: string | Frame): Promise<void> {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.writeQueue = this.writeQueue.then(() => {
      this.ws.send(payload);
    });
    return this.writeQueue;
  }

  async close(): Promise<void> {
    this.stopHeartbeat();
    if (this.subdomain) {
      await this.send(encodeFrame('tunnel-close', 'close-1', { subdomain: this.subdomain }));
    }
    this.ws.close();
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
  }
}
