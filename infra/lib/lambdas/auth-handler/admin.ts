import { normalizeIdentifier } from './core';

export function isAdmin(identifier: string | undefined, adminIdentifiers: string | undefined): boolean {
  if (!identifier || !adminIdentifiers) return false;
  const normalized = normalizeIdentifier(identifier);
  return adminIdentifiers
    .split(',')
    .map((s) => normalizeIdentifier(s))
    .some((a) => a === normalized);
}

export function buildUserList(rows: any[]): { userId: string; identifier: string; blocked: boolean; createdAt: number }[] {
  return rows
    .map((u) => ({ userId: u.userId, identifier: u.identifier, blocked: u.blocked === true, createdAt: u.createdAt ?? 0 }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function adminRevokePlan(
  tunnels: any[],
  connections: any[],
  userId: string,
): { connectionIds: string[]; subdomains: string[] } {
  const connectionIds = new Set<string>();
  const subdomains = new Set<string>();
  for (const t of tunnels) {
    if (t.userId !== userId) continue;
    subdomains.add(t.subdomain);
    if (t.connectionId) connectionIds.add(t.connectionId);
    if (t.proxyConnectionId) connectionIds.add(t.proxyConnectionId);
  }
  for (const c of connections) {
    if (c.userId === userId) connectionIds.add(c.connectionId);
  }
  return {
    connectionIds: [...connectionIds],
    subdomains: [...subdomains],
  };
}