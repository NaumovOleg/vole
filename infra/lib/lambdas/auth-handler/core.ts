import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export async function signJwt(
  payload: Record<string, string>,
  secret: string,
  opts: { expiresInSec: number },
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + opts.expiresInSec)
    .sign(key);
}

export async function verifyJwt(token: string, secret: string): Promise<Record<string, string>> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload as Record<string, string>;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/[^\d+]/g, '').replace(/^\+/, '');
}

export function validateIdentifier(identifier: string): boolean {
  const normalized = normalizeIdentifier(identifier);
  if (EMAIL_RE.test(normalized)) return true;
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function generateToken(): { raw: string; hash: string } {
  const raw = 'vole_' + randomBytes(32).toString('base64url');
  return { raw, hash: hashToken(raw) };
}
