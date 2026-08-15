import { describe, test, expect } from 'bun:test';
import { formatError } from './errors';

describe('formatError', () => {
  test('no token -> authtoken hint, exit 2', () => {
    const e = formatError('no-token');
    expect(e.message).toContain('authtoken');
    expect(e.exitCode).toBe(2);
  });

  test('bad token -> authtoken hint, exit 2', () => {
    const e = formatError('bad-token');
    expect(e.message).toContain('authtoken');
    expect(e.exitCode).toBe(2);
  });

  test('network -> includes server, exit 1', () => {
    const e = formatError('network', { server: 'wss://api.vole.sh/dev' });
    expect(e.message).toContain('wss://api.vole.sh/dev');
    expect(e.message).toContain('network');
    expect(e.exitCode).toBe(1);
  });

  test('port-down -> includes port, exit 1', () => {
    const e = formatError('port-down', { port: 9999 });
    expect(e.message).toContain('9999');
    expect(e.message).toContain('not listening');
    expect(e.exitCode).toBe(1);
  });

  test('tunnel-rejected -> server message, exit 1', () => {
    const e = formatError('tunnel-rejected', { message: 'subdomain collision, retry' });
    expect(e.message).toContain('subdomain collision, retry');
    expect(e.exitCode).toBe(1);
  });

  test('usage -> exit 2', () => {
    const e = formatError('usage');
    expect(e.exitCode).toBe(2);
  });
});