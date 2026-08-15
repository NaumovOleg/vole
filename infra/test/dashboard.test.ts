import { describe, test, expect } from 'bun:test';
import { listConnections, logSummary } from '../lib/lambdas/auth-handler/dashboard';

describe('listConnections', () => {
  test('maps own fields, sorts by createdAt desc', () => {
    const rows = [
      { subdomain: 'a1b2c3d4e5f6g', userId: 'u1', connectionId: 'c1', type: 'http', localPort: 3000, createdAt: 100 },
      { subdomain: 'x1y2z3', userId: 'u1', connectionId: 'c2', type: 'tcp', localPort: 5000, createdAt: 200 },
    ];
    expect(listConnections(rows)).toEqual([
      { subdomain: 'x1y2z3', type: 'tcp', localPort: 5000, createdAt: 200, status: 'active' },
      { subdomain: 'a1b2c3d4e5f6g', type: 'http', localPort: 3000, createdAt: 100, status: 'active' },
    ]);
  });

  test('empty input -> empty array', () => {
    expect(listConnections([])).toEqual([]);
  });
});

describe('logSummary', () => {
  const done = {
    connectionId: 'c1',
    requestId: 'r1',
    method: 'GET',
    path: '/',
    status: 'done',
    statusCode: 200,
    createdAt: 100,
    completedAt: 150,
  };
  const pending = {
    connectionId: 'c1',
    requestId: 'r2',
    method: 'POST',
    path: '/api',
    status: 'pending',
    createdAt: 200,
  };

  test('maps fields incl. latency, sorts by completedAt ?? createdAt desc', () => {
    const logs = logSummary([done, pending]);
    expect(logs).toEqual([
      { requestId: 'r2', method: 'POST', path: '/api', status: 'pending', latency: undefined, time: 200 },
      { requestId: 'r1', method: 'GET', path: '/', status: 'done', statusCode: 200, latency: 50, time: 150 },
    ]);
  });

  test('caps at limit', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      connectionId: 'c1',
      requestId: `r${i}`,
      method: 'GET',
      path: '/',
      status: 'done',
      createdAt: i,
      completedAt: i,
    }));
    const logs = logSummary(rows, 50);
    expect(logs).toHaveLength(50);
    expect(logs[0].time).toBe(59);
  });

  test('empty input -> empty array', () => {
    expect(logSummary([])).toEqual([]);
  });

  test('missing optional fields do not crash', () => {
    const logs = logSummary([{ requestId: 'x' } as any]);
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBeUndefined();
  });
});