export interface Row {
  role?: string;
  tunnelSubdomain?: string;
}

export interface TunnelRow {
  subdomain: string;
  connectionId: string;
  type?: string;
}

export function isProxyConnection(connRow: Row | undefined): boolean {
  return connRow?.role === 'proxy';
}

export function byteStreamTunnel(tunnelRow: TunnelRow | undefined): boolean {
  return tunnelRow?.type === 'tcp' || tunnelRow?.type === 'ws';
}

export function proxyTarget(subdomain: string, tunnels: TunnelRow[]): TunnelRow | undefined {
  return tunnels.find((t) => t.subdomain === subdomain);
}

export function nextSeq(prev: number): number {
  return prev >= Number.MAX_SAFE_INTEGER ? 0 : prev + 1;
}

export function forwardBytesToAgent(connRow: Row | undefined, tunnels: TunnelRow[]): string | undefined {
  if (!connRow || !isProxyConnection(connRow) || !connRow.tunnelSubdomain) return undefined;
  return tunnels.find((t) => t.subdomain === connRow.tunnelSubdomain)?.connectionId;
}

export type DataRoute = 'proxy-to-agent' | 'agent-bytes' | 'http-chunk' | 'ignore';

export function classifyDataFrame(connRow: Row | undefined, tunnelRow: TunnelRow | undefined): DataRoute {
  if (isProxyConnection(connRow)) return 'proxy-to-agent';
  if (!connRow || connRow.role === 'agent' || connRow.role === undefined) {
    if (byteStreamTunnel(tunnelRow)) return 'agent-bytes';
    if (tunnelRow?.type === 'http') return 'http-chunk';
  }
  return 'ignore';
}
