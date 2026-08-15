import { describe, expect, test } from 'bun:test';
import {
  FRAME_TYPES,
  parseFrame,
  encodeFrame,
  helloFrame,
  readyFrame,
  pingFrame,
  pongFrame,
  errorFrame,
  requestFrame,
  responseFrame,
  dataFrame,
} from './protocol';

describe('frame types', () => {
  test('exactly the contract set', () => {
    expect(FRAME_TYPES).toEqual([
      'hello',
      'ready',
      'ping',
      'pong',
      'tunnel-open',
      'tunnel-close',
      'request',
      'response',
      'data',
      'error',
    ]);
  });
});

describe('encode/parse round-trip', () => {
  test('minimal frame', () => {
    const raw = encodeFrame('ping', 'id1');
    expect(parseFrame(raw)).toEqual({ t: 'ping', id: 'id1' });
  });

  test('frame with payload', () => {
    const raw = encodeFrame('hello', 'id2', { version: 1 });
    expect(parseFrame(raw)).toEqual({ t: 'hello', id: 'id2', d: { version: 1 } });
  });
});

describe('parseFrame rejects malformed input', () => {
  test('non-JSON', () => {
    expect(() => parseFrame('not json')).toThrow();
  });

  test('missing t', () => {
    expect(() => parseFrame('{"id":"x"}')).toThrow();
  });

  test('unknown type', () => {
    expect(() => parseFrame('{"t":"teleport","id":"x"}')).toThrow();
  });

  test('missing id', () => {
    expect(() => parseFrame('{"t":"ping"}')).toThrow();
  });

  test('non-string id', () => {
    expect(() => parseFrame('{"t":"ping","id":7}')).toThrow();
  });

  test('empty id', () => {
    expect(() => parseFrame('{"t":"ping","id":""}')).toThrow();
  });
});

describe('forward compatibility', () => {
  test('unknown payload fields tolerated', () => {
    const frame = parseFrame('{"t":"hello","id":"x","d":{"version":1,"future":"y"},"extra":1}');
    expect(frame.t).toBe('hello');
    expect((frame.d as any).future).toBe('y');
  });
});

describe('helpers', () => {
  test('helloFrame carries version', () => {
    expect(helloFrame(1)).toEqual({ t: 'hello', id: expect.any(String), d: { version: 1 } });
  });

  test('readyFrame', () => {
    expect(readyFrame().t).toBe('ready');
  });

  test('pingFrame', () => {
    expect(pingFrame().t).toBe('ping');
  });

  test('pongFrame echoes id', () => {
    expect(pongFrame('abc')).toEqual({ t: 'pong', id: 'abc' });
  });

  test('errorFrame carries message', () => {
    const f = errorFrame('abc', 'boom');
    expect(f.t).toBe('error');
    expect((f.d as any).error).toBe('boom');
  });
});

describe('http frames', () => {
  test('requestFrame single-shot with bodyB64', () => {
    const f = requestFrame('r1', {
      method: 'POST',
      path: '/api',
      query: 'a=1',
      headers: { 'content-type': 'application/json' },
      bodyB64: Buffer.from('{"x":1}').toString('base64'),
    });
    expect(f.t).toBe('request');
    expect(f.id).toBe('r1');
    const d = f.d as any;
    expect(d.method).toBe('POST');
    expect(d.path).toBe('/api');
    expect(d.query).toBe('a=1');
    expect(d.headers['content-type']).toBe('application/json');
    expect(d.bodyB64).toBe(Buffer.from('{"x":1}').toString('base64'));
  });

  test('requestFrame chunked — no bodyB64, has chunkTotal', () => {
    const f = requestFrame('r2', { method: 'GET', path: '/big', chunkTotal: 3 });
    const d = f.d as any;
    expect(d.bodyB64).toBeUndefined();
    expect(d.chunkTotal).toBe(3);
  });

  test('responseFrame with status and body', () => {
    const f = responseFrame('r3', {
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      bodyB64: 'aGVsbG8=',
    });
    expect(f.t).toBe('response');
    expect(f.id).toBe('r3');
    expect((f.d as any).statusCode).toBe(200);
    expect((f.d as any).bodyB64).toBe('aGVsbG8=');
  });

  test('responseFrame chunked — chunkTotal present', () => {
    const f = responseFrame('r4', { statusCode: 200, chunkTotal: 2 });
    expect((f.d as any).chunkTotal).toBe(2);
  });

  test('dataFrame carries index and payload', () => {
    const f = dataFrame('r5', 2, 'ZGF0YQ==');
    expect(f.t).toBe('data');
    expect((f.d as any).n).toBe(2);
    expect((f.d as any).data).toBe('ZGF0YQ==');
  });
});
