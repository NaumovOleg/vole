import { describe, expect, test } from 'bun:test';
import { CHUNK_SIZE, splitBody, assembleBody } from './chunks';

const b64 = (buf: Buffer) => buf.toString('base64');

describe('splitBody', () => {
  test('chunks stay within base64 size budget', () => {
    const body = b64(Buffer.alloc(500 * 1024, 7));
    const chunks = splitBody(body);
    expect(chunks.length).toBeGreaterThan(1);
    const frameBudget = Math.ceil((CHUNK_SIZE * 4) / 3) + 4096;
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(frameBudget);
    }
  });

  test('round-trips large body', () => {
    const original = Buffer.alloc(300 * 1024);
    for (let i = 0; i < original.length; i++) original[i] = i % 256;
    const chunks = splitBody(original.toString('base64'));
    const reassembled = Buffer.from(assembleBody(chunks), 'base64');
    expect(reassembled.equals(original)).toBe(true);
  });

  test('empty body → no chunks', () => {
    expect(splitBody('')).toEqual([]);
  });

  test('exact boundary → one chunk', () => {
    const body = b64(Buffer.alloc(CHUNK_SIZE, 1));
    expect(splitBody(body)).toHaveLength(1);
  });

  test('just over boundary → two chunks', () => {
    const body = b64(Buffer.alloc(CHUNK_SIZE + 1, 1));
    expect(splitBody(body)).toHaveLength(2);
  });

  test('tiny body single chunk', () => {
    const chunks = splitBody('aGVsbG8=');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('aGVsbG8=');
  });
});

describe('assembleBody', () => {
  test('empty list → empty string', () => {
    expect(assembleBody([])).toBe('');
  });

  test('concatenates in order', () => {
    expect(assembleBody(['aGVs', 'bG8='])).toBe('aGVsbG8=');
  });
});
