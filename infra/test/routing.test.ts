import { describe, test, expect } from 'bun:test';
import {
  isProxyConnection,
  byteStreamTunnel,
  proxyTarget,
  nextSeq,
  forwardBytesToAgent,
  classifyDataFrame,
} from '../lib/lambdas/ws-handler/routing';

describe('isProxyConnection', () => {
  test('true when role is proxy', () => {
    expect(isProxyConnection({ role: 'proxy' })).toBe(true);
  });
  test('false for agent or absent role', () => {
    expect(isProxyConnection({})).toBe(false);
    expect(isProxyConnection({ role: 'agent' })).toBe(false);
  });
});

describe('byteStreamTunnel', () => {
  test('tcp and ws are byte-stream', () => {
    expect(byteStreamTunnel({ type: 'tcp' })).toBe(true);
    expect(byteStreamTunnel({ type: 'ws' })).toBe(true);
  });
  test('http is not', () => {
    expect(byteStreamTunnel({ type: 'http' })).toBe(false);
  });
});

describe('proxyTarget', () => {
  const tunnels = [
    { subdomain: 'u-aaaa', connectionId: 'conn-1', type: 'http' },
    { subdomain: 'u-bbbb', connectionId: 'conn-2', type: 'tcp' },
  ];
  test('finds tunnel by subdomain', () => {
    expect(proxyTarget('u-bbbb', tunnels)).toEqual(tunnels[1]);
  });
  test('undefined when missing', () => {
    expect(proxyTarget('u-zzzz', tunnels)).toBeUndefined();
  });
});

describe('nextSeq', () => {
  test('increments', () => {
    expect(nextSeq(0)).toBe(1);
    expect(nextSeq(41)).toBe(42);
  });
  test('wraps at MAX_SAFE_INTEGER', () => {
    expect(nextSeq(Number.MAX_SAFE_INTEGER)).toBe(0);
  });
});

describe('forwardBytesToAgent', () => {
  const tunnels = [{ subdomain: 'u-aaaa', connectionId: 'conn-1' }];
  test('agent connectionId from proxy row', () => {
    expect(forwardBytesToAgent({ role: 'proxy', tunnelSubdomain: 'u-aaaa' }, tunnels)).toBe('conn-1');
  });
  test('undefined for unknown tunnel', () => {
    expect(forwardBytesToAgent({ role: 'proxy', tunnelSubdomain: 'nope' }, tunnels)).toBeUndefined();
  });
  test('undefined for non-proxy row', () => {
    expect(forwardBytesToAgent({ role: 'agent' }, tunnels)).toBeUndefined();
  });
});

describe('classifyDataFrame', () => {
  test('proxy row -> proxy-to-agent', () => {
    expect(classifyDataFrame({ role: 'proxy', tunnelSubdomain: 'u' }, { type: 'tcp' })).toBe('proxy-to-agent');
  });
  test('agent with byte-stream tunnel -> agent-bytes', () => {
    expect(classifyDataFrame({ role: 'agent' }, { type: 'ws' })).toBe('agent-bytes');
  });
  test('agent with http tunnel -> http-chunk', () => {
    expect(classifyDataFrame({ role: 'agent' }, { type: 'http' })).toBe('http-chunk');
  });
  test('unknown shapes -> ignore', () => {
    expect(classifyDataFrame({}, undefined)).toBe('ignore');
    expect(classifyDataFrame(undefined, undefined)).toBe('ignore');
  });
});
