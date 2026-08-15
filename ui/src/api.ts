const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function request(method: string, path: string, body?: unknown): Promise<any> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const jwt = localStorage.getItem('vole_jwt');
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (identifier: string, password: string) =>
    request('POST', '/auth/register', { identifier, password }),
  login: (identifier: string, password: string) =>
    request('POST', '/auth/login', { identifier, password }),
  me: () => request('GET', '/auth/me'),
  listTokens: () => request('GET', '/tokens'),
  createToken: () => request('POST', '/tokens'),
  revokeToken: (tokenId: string) => request('DELETE', `/tokens/${tokenId}`),
  connections: () => request('GET', '/connections'),
  logs: () => request('GET', '/logs'),
  adminUsers: () => request('GET', '/admin/users'),
  adminSetBlocked: (userId: string, blocked: boolean) =>
    request('POST', `/admin/users/${userId}/${blocked ? 'block' : 'unblock'}`),
};

export function saveJwt(token: string): void {
  localStorage.setItem('vole_jwt', token);
}

export function clearJwt(): void {
  localStorage.removeItem('vole_jwt');
}