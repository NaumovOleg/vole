import { describe, test, expect } from 'bun:test';
import { TunnelManager, type TunnelHandle, type TunnelSpec } from './manager';

type Spec = TunnelSpec<Spec>;

function spec(id: string, opts?: Partial<Spec>): Spec {
  return {
    id,
    kind: 'http',
    port: 3000,
    launch: async () => ({ url: `https://${id}.vole.sh`, close: async () => {} }),
    onReady: () => {},
    onError: () => {},
    ...opts,
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('TunnelManager', () => {
  test('state transitions pending -> starting -> ready', async () => {
    const m = new TunnelManager<Spec>();
    m.addTunnel(spec('t1'));
    expect(m.state('t1')).toBe('pending');
    m.start();
    expect(m.state('t1')).toBe('starting');
    await tick();
    expect(m.state('t1')).toBe('ready');
  });

  test('failed tunnel does not block others', async () => {
    const m = new TunnelManager<Spec>();
    m.addTunnel(
      spec('bad', {
        launch: async () => {
          throw new Error('port down');
        },
      }),
    );
    m.addTunnel(spec('good'));
    m.start();
    await tick();
    expect(m.state('bad')).toBe('failed');
    expect(m.state('good')).toBe('ready');
  });

  test('onReady called with handle url', async () => {
    const m = new TunnelManager<Spec>();
    const seen: string[] = [];
    m.addTunnel(spec('t1', { onReady: (id, handle) => seen.push(`${id}:${handle.url}`) }));
    m.start();
    await tick();
    expect(seen).toEqual(['t1:https://t1.vole.sh']);
  });

  test('onError receives failure', async () => {
    const m = new TunnelManager<Spec>();
    let got: string | undefined;
    m.addTunnel(
      spec('t1', {
        launch: async () => {
          throw new Error('boom');
        },
        onError: (_id, err) => (got = err.message),
      }),
    );
    m.start();
    await tick();
    expect(got).toBe('boom');
  });

  test('closeAll closes every started tunnel', async () => {
    const m = new TunnelManager<Spec>();
    const closed: string[] = [];
    m.addTunnel(spec('a', { launch: async () => ({ url: 'u1', close: async () => closed.push('a') }) }));
    m.addTunnel(spec('b', { launch: async () => ({ url: 'u2', close: async () => closed.push('b') }) }));
    m.addTunnel(
      spec('c', {
        launch: async () => {
          throw new Error('nope');
        },
      }),
    );
    m.start();
    await tick();
    await m.closeAll();
    expect(closed.sort()).toEqual(['a', 'b']);
  });

  test('closeAll is idempotent', async () => {
    const m = new TunnelManager<Spec>();
    m.addTunnel(spec('a'));
    m.start();
    await tick();
    await m.closeAll();
    await m.closeAll();
    expect(m.state('a')).toBe('closed');
  });

  test('close tears down a single tunnel', async () => {
    const m = new TunnelManager<Spec>();
    const closed: string[] = [];
    m.addTunnel(spec('a', { launch: async () => ({ url: 'u1', close: async () => closed.push('a') }) }));
    m.addTunnel(spec('b', { launch: async () => ({ url: 'u2', close: async () => closed.push('b') }) }));
    m.start();
    await tick();
    await m.close('a');
    expect(closed).toEqual(['a']);
    expect(m.state('a')).toBe('closed');
    expect(m.state('b')).toBe('ready');
  });

  test('close during starting defers to ready-callback check', async () => {
    const m = new TunnelManager<Spec>();
    const closed: string[] = [];
    let resolveLaunch: () => void = () => {};
    m.addTunnel(
      spec('a', {
        launch: () =>
          new Promise((resolve) => {
            resolveLaunch = () =>
              resolve({ url: 'u1', close: async () => closed.push('a') });
          }),
      }),
    );
    m.start();
    await m.close('a');
    resolveLaunch();
    await tick();
    expect(m.state('a')).toBe('closed');
    expect(closed).toEqual(['a']);
  });

  test('statuses lists id, state and url', async () => {
    const m = new TunnelManager<Spec>();
    m.addTunnel(spec('http-3000'));
    m.start();
    await tick();
    expect(m.statuses().map((s) => ({ id: s.id, state: s.state, url: s.url }))).toEqual([
      { id: 'http-3000', state: 'ready', url: 'https://http-3000.vole.sh' },
    ]);
  });
});