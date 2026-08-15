export interface TunnelHandle {
  url: string;
  close: () => Promise<void>;
}

export interface TunnelSpec<S> {
  id: string;
  kind: string;
  port: number;
  launch: () => Promise<TunnelHandle>;
  onReady: (id: string, handle: TunnelHandle) => void;
  onError: (id: string, err: Error) => void;
}

export type TunnelState = 'pending' | 'starting' | 'ready' | 'failed' | 'closed';

export class TunnelManager<S extends TunnelSpec<S>> {
  private tunnels = new Map<string, S & { state: TunnelState; handle?: TunnelHandle }>();

  addTunnel(spec: S): void {
    this.tunnels.set(spec.id, { ...spec, state: 'pending' });
  }

  state(id: string): TunnelState | undefined {
    return this.tunnels.get(id)?.state;
  }

  start(): void {
    for (const t of this.tunnels.values()) {
      if (t.state !== 'pending') continue;
      t.state = 'starting';
      void t
        .launch()
        .then((handle) => {
          if (t.state === 'closed') {
            void handle.close();
            return;
          }
          t.handle = handle;
          t.state = 'ready';
          t.onReady(t.id, handle);
        })
        .catch((err: Error) => {
          t.state = 'failed';
          t.onError(t.id, err);
        });
    }
  }

  async closeAll(): Promise<void> {
    await Promise.all(
      [...this.tunnels.values()].map(async (t) => {
        if (t.state === 'ready' && t.handle) {
          t.state = 'closed';
          await t.handle.close();
        } else if (t.state === 'starting' || t.state === 'pending') {
          t.state = 'closed';
        }
      }),
    );
  }

  close(id: string): Promise<void> {
    const t = this.tunnels.get(id);
    if (!t) return Promise.resolve();
    t.state = 'closed';
    if (t.handle) return t.handle.close();
    return Promise.resolve();
  }

  statuses(): Array<{ id: string; state: TunnelState; url?: string }> {
    return [...this.tunnels.values()].map((t) => ({ id: t.id, state: t.state, url: t.handle?.url }));
  }

  count(): number {
    return this.tunnels.size;
  }
}