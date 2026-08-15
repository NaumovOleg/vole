import type { Socket } from 'node:net';

export interface BridgeOptions {
  socket: Socket;
  send: (n: number, dataB64: string) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export class ByteBridge {
  private seq = 0;
  private readonly opts: BridgeOptions;

  constructor(opts: BridgeOptions) {
    this.opts = opts;
    opts.socket.setNoDelay(true);
    opts.socket.on('data', (chunk: Buffer) => {
      this.opts.send(this.seq, chunk.toString('base64'));
      this.seq++;
    });
    opts.socket.on('error', (err: Error) => this.opts.onError?.(err));
    opts.socket.on('close', () => this.opts.onClose?.());
  }

  writeData(_n: number, dataB64: string): void {
    this.opts.socket.write(Buffer.from(dataB64, 'base64'));
  }
}