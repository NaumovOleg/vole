import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

interface Token {
  tokenId: string;
  createdAt: number;
}

interface Connection {
  subdomain: string;
  type?: string;
  localPort?: number;
  createdAt?: number;
  status: string;
}

interface Log {
  requestId: string;
  method?: string;
  path?: string;
  status?: string;
  statusCode?: number;
  latency?: number;
  time?: number;
}

interface AdminUser {
  userId: string;
  identifier: string;
  blocked: boolean;
  createdAt: number;
}

export default function Dashboard({
  user,
  onLogout,
}: {
  user: { userId: string; identifier: string; role?: string };
  onLogout: () => void;
}) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [freshToken, setFreshToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = user.role === 'admin';

  const load = useCallback(async () => {
    try {
      const [t, c, l, a] = await Promise.all([
        api.listTokens(),
        api.connections(),
        api.logs(),
        isAdmin ? api.adminUsers() : Promise.resolve({ users: [] }),
      ]);
      setTokens(t.tokens ?? []);
      setConnections(c.connections ?? []);
      setLogs(l.logs ?? []);
      setUsers(a.users ?? []);
      setError('');
    } catch (err: any) {
      setError(err.message ?? String(err));
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 10_000);
    return () => clearInterval(timer);
  }, [load]);

  async function createToken() {
    setBusy(true);
    try {
      const d = await api.createToken();
      setFreshToken(d.token);
      await load();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(tokenId: string) {
    try {
      await api.revokeToken(tokenId);
      await load();
    } catch (err: any) {
      setError(err.message ?? String(err));
    }
  }

  async function setBlocked(u: AdminUser, blocked: boolean) {
    setBusy(true);
    try {
      await api.adminSetBlocked(u.userId, blocked);
      await load();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dash">
      <header>
        <h1>Vole — {user.identifier}</h1>
        <button onClick={onLogout}>Log out</button>
      </header>

      {error && <div className="error banner">{error}</div>}

      <section>
        <h2>API tokens</h2>
        <button onClick={createToken} disabled={busy}>
          {busy ? '…' : 'Create token'}
        </button>
        {freshToken && (
          <div className="fresh-token">
            <code>{freshToken}</code>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(freshToken);
              }}
            >
              Copy
            </button>
          </div>
        )}
        {tokens.length === 0 ? (
          <p className="empty">No tokens yet — create one to use with the CLI.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.tokenId}>
                  <td>
                    <code>{t.tokenId.slice(0, 8)}…</code>
                  </td>
                  <td>{relativeTime(t.createdAt)}</td>
                  <td>
                    <button className="small" onClick={() => revoke(t.tokenId)}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Connections</h2>
        {connections.length === 0 ? (
          <p className="empty">No active tunnels — run `vole http 3000` from the CLI.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Subdomain</th>
                <th>Type</th>
                <th>Local port</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.subdomain}>
                  <td>
                    <a href={`https://${c.subdomain}.vole.sh`} target="_blank" rel="noreferrer">
                      {c.subdomain}
                    </a>
                  </td>
                  <td>{c.type}</td>
                  <td>{c.localPort}</td>
                  <td>
                    <span className="status active">active</span>
                  </td>
                  <td title={fullTime(c.createdAt)}>{relativeTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isAdmin && (
        <section>
          <h2>Users</h2>
          {users.length === 0 ? (
            <p className="empty">No users yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Identifier</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId}>
                    <td>{u.identifier}</td>
                    <td>
                      <span className={`status ${u.blocked ? 'blocked' : 'active'}`}>
                        {u.blocked ? 'blocked' : 'active'}
                      </span>
                    </td>
                    <td title={fullTime(u.createdAt)}>{relativeTime(u.createdAt)}</td>
                    <td>
                      <button className="small" disabled={busy} onClick={() => setBlocked(u, !u.blocked)}>
                        {u.blocked ? 'Unblock' : 'Block'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section>
        <h2>Request logs</h2>
        {logs.length === 0 ? (
          <p className="empty">No requests logged yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Code</th>
                <th>Latency</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.requestId}>
                  <td>{l.method}</td>
                  <td>{l.path}</td>
                  <td>{l.status}</td>
                  <td>{l.statusCode ?? ''}</td>
                  <td>{l.latency !== undefined ? `${l.latency}ms` : ''}</td>
                  <td>{relativeTime(l.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function relativeTime(ts?: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fullTime(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : '';
}