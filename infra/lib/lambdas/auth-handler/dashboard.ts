export interface TunnelRow {
  subdomain?: string;
  type?: string;
  localPort?: number;
  createdAt?: number;
}

export interface LogRow {
  requestId?: string;
  method?: string;
  path?: string;
  status?: string;
  statusCode?: number;
  createdAt?: number;
  completedAt?: number;
}

export function listConnections(rows: TunnelRow[]): Array<{ subdomain: string; type?: string; localPort?: number; createdAt?: number; status: string }> {
  return [...rows]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .map((t) => ({
      subdomain: t.subdomain ?? '',
      type: t.type,
      localPort: t.localPort,
      createdAt: t.createdAt,
      status: 'active',
    }));
}

export function logSummary(
  rows: LogRow[],
  limit = 50,
): Array<{ requestId: string; method?: string; path?: string; status?: string; statusCode?: number; latency?: number; time?: number }> {
  return [...rows]
    .sort((a, b) => (b.completedAt ?? b.createdAt ?? 0) - (a.completedAt ?? a.createdAt ?? 0))
    .slice(0, limit)
    .map((r) => ({
      requestId: r.requestId ?? '',
      method: r.method,
      path: r.path,
      status: r.status,
      statusCode: r.statusCode,
      latency: r.completedAt !== undefined && r.createdAt !== undefined ? r.completedAt - r.createdAt : undefined,
      time: r.completedAt ?? r.createdAt,
    }));
}