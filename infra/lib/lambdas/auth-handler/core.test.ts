import { describe, expect, test } from 'bun:test';
import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  hashToken,
  normalizeIdentifier,
  validateIdentifier,
} from './core';

describe('passwords', () => {
  test('hash differs from plaintext', () => {
    const hash = hashPassword('correct horse battery');
    expect(hash).not.toBe('correct horse battery');
  });

  test('correct password verifies', () => {
    const hash = hashPassword('s3cret!');
    expect(verifyPassword('s3cret!', hash)).toBe(true);
  });

  test('wrong password rejected', () => {
    const hash = hashPassword('right');
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  test('unique salt — two hashes differ', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });
});

describe('jwt', () => {
  const secret = 'test-secret';

  test('signs and verifies round-trip with payload', async () => {
    const token = await signJwt({ userId: 'u1' }, secret, { expiresInSec: 3600 });
    const payload = await verifyJwt(token, secret);
    expect(payload.userId).toBe('u1');
  });

  test('rejects wrong secret', async () => {
    const token = await signJwt({ userId: 'u1' }, secret, { expiresInSec: 3600 });
    expect(verifyJwt(token, 'other-secret')).rejects.toThrow();
  });

  test('rejects expired token', async () => {
    const token = await signJwt({ userId: 'u1' }, secret, { expiresInSec: -10 });
    expect(verifyJwt(token, secret)).rejects.toThrow();
  });
});

describe('token hashing', () => {
  test('is sha256 hex, deterministic, one-way', () => {
    const hash = hashToken('vole_abc123');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('vole_abc123')).toBe(hash);
    expect(hashToken('vole_abc123')).not.toBe('vole_abc123');
  });
});

describe('identifier normalization', () => {
  test('email trimmed and lowercased', () => {
    expect(normalizeIdentifier('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  test('phone digits only', () => {
    expect(normalizeIdentifier('+7 912 123-45-67')).toBe('79121234567');
  });
});

describe('identifier validation', () => {
  test('accepts valid email', () => {
    expect(validateIdentifier('foo@bar.com')).toBe(true);
  });

  test('accepts valid phone', () => {
    expect(validateIdentifier('+79121234567')).toBe(true);
  });

  test('rejects garbage', () => {
    expect(validateIdentifier('abc')).toBe(false);
  });

  test('rejects empty', () => {
    expect(validateIdentifier('')).toBe(false);
  });

  test('rejects too-short phone', () => {
    expect(validateIdentifier('12345')).toBe(false);
  });
});
