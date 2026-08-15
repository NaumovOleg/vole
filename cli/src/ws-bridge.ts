export interface WsBridgeOptions {
  localWs: WebSocket;
  send: (n: number, dataB64: string) => void;
  onError?: (err: any) => void;
  onClose?: () => void;
}

export class WsBridge {
  private seq = 0;
  private readonly opts: WsBridgeOptions;

  constructor(opts: WsBridgeOptions) {
    this.opts = opts;
    opts.localWs.onmessage = (ev: MessageEvent) => {
      this.opts.send(this.seq, toBuffer(ev.data).toString('base64'));
      this.seq++;
    };
    opts.localWs.onclose = () => this.opts.onClose?.();
    opts.localWs.onerror = (err: any) => this.opts.onError?.(err);
  }

  writeData(_n: number, dataB64: string): void {
    this.opts.localWs.send(Buffer.from(dataB64, 'base64'));
  }
}

function toBuffer(data: string | Uint8Array | ArrayBuffer): Buffer {
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  return Buffer.from(data);
}