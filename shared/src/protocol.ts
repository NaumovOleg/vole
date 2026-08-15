import { randomUUID } from 'node:crypto';

export const FRAME_TYPES = [
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
] as const;

export type FrameType = (typeof FRAME_TYPES)[number];

export interface Frame<T = unknown> {
  t: FrameType;
  id: string;
  d?: T;
}

export function encodeFrame<T>(t: FrameType, id: string, d?: T): string {
  return JSON.stringify(d === undefined ? { t, id } : { t, id, d });
}

export function parseFrame<T = unknown>(raw: string): Frame<T> {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('invalid frame');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !FRAME_TYPES.includes(parsed.t) ||
    typeof parsed.id !== 'string' ||
    parsed.id.length === 0
  ) {
    throw new Error('invalid frame');
  }
  return { t: parsed.t, id: parsed.id, ...(parsed.d !== undefined ? { d: parsed.d } : {}) } as Frame<T>;
}

export function helloFrame(version: number): Frame<{ version: number }> {
  return { t: 'hello', id: randomUUID(), d: { version } };
}

export function readyFrame(): Frame {
  return { t: 'ready', id: randomUUID() };
}

export function pingFrame(): Frame {
  return { t: 'ping', id: randomUUID() };
}

export function pongFrame(id: string): Frame {
  return { t: 'pong', id };
}

export function errorFrame(id: string, error: string): Frame<{ error: string }> {
  return { t: 'error', id, d: { error } };
}

export interface HttpRequestPayload {
  method: string;
  path: string;
  query?: string;
  headers?: Record<string, string>;
  bodyB64?: string;
  chunkTotal?: number;
}

export interface HttpResponsePayload {
  statusCode: number;
  headers?: Record<string, string>;
  bodyB64?: string;
  chunkTotal?: number;
}

export interface DataPayload {
  n: number;
  data: string;
}

export function requestFrame(
  id: string,
  d: HttpRequestPayload,
): Frame<HttpRequestPayload> {
  return { t: 'request', id, d };
}

export function responseFrame(
  id: string,
  d: HttpResponsePayload,
): Frame<HttpResponsePayload> {
  return { t: 'response', id, d };
}

export function dataFrame(id: string, n: number, data: string): Frame<DataPayload> {
  return { t: 'data', id, d: { n, data } };
}
