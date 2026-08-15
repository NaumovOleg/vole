import { describe, test, expect } from 'bun:test';
import { isAdmin, buildUserList, adminRevokePlan } from '../lib/lambdas/auth-handler/admin';

describe('isAdmin', () => {
  test('matches exact identifier in csv', () => {
    expect(isAdmin('admin@vole.sh', 'admin@vole.sh, boss@vole.sh')).toBe(true);
  });

  test('normalizes both sides', () => {
    expect(isAdmin('Admin@Vole.sh ', 'ADMIN@vole.sh')).toBe(true);
    expect(isAdmin('+7 900 123-45-67', '+79001234567, other@x.io')).toBe(true);
  });

  test('false when not listed or list empty', () => {
    expect(isAdmin('user@x.io', 'admin@vole.sh')).toBe(false);
    expect(isAdmin('user@x.io', '')).toBe(false);
    expect(isAdmin('user@x.io', undefined)).toBe(false);
  });
});

describe('buildUserList', () => {
  test('maps and sorts by createdAt desc', () => {
    const rows = [
      { userId: 'a', identifier: 'a@x.io', blocked: true, createdAt: 100, extra: 1 },
      { userId: 'b', identifier: 'b@x.io', blocked: false, createdAt: 300 },
      { userId: 'c', identifier: 'c@x.io', createdAt: 200 },
    ];
    expect(buildUserList(rows)).toEqual([
      { userId: 'b', identifier: 'b@x.io', blocked: false, createdAt: 300 },
      { userId: 'c', identifier: 'c@x.io', blocked: false, createdAt: 200 },
      { userId: 'a', identifier: 'a@x.io', blocked: true, createdAt: 100 },
    ]);
  });

  test('empty input', () => {
    expect(buildUserList([])).toEqual([]);
  });
});

describe('adminRevokePlan', () => {
  test('collects agent tunnels, proxy connections and plain connections', () => {
    const tunnels = [
      { subdomain: 's1', connectionId: 'agent-a', proxyConnectionId: 'proxy-1', userId: 'u' },
      { subdomain: 's2', connectionId: 'agent-a', userId: 'u' },
      { subdomain: 'other', connectionId: 'agent-x', userId: 'other' },
    ];
    const connections = [
      { connectionId: 'conn-1', userId: 'u' },
      { connectionId: 'conn-2', userId: 'other' },
    ];
    expect(adminRevokePlan(tunnels, connections, 'u')).toEqual({
      connectionIds: ['agent-a', 'proxy-1', 'conn-1'],
      subdomains: ['s1', 's2'],
    });
  });

  test('dedupes and tolerates tunnels without connection fields', () => {
    const tunnels = [
      { subdomain: 's1', connectionId: 'agent-a', proxyConnectionId: 'proxy-1', userId: 'u' },
      { subdomain: 's3', userId: 'u' },
      { subdomain: 's4', userId: 'u' },
    ];
    expect(adminRevokePlan(tunnels, [], 'u')).toEqual({
      connectionIds: ['agent-a', 'proxy-1'],
      subdomains: ['s1', 's3', 's4'],
    });
  });
});