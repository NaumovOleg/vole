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
