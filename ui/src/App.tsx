import { useEffect, useState } from 'react';
import AuthScreen from './AuthScreen';
import Dashboard from './Dashboard';
import { api, clearJwt } from './api';

export default function App() {
  const [user, setUser] = useState<{ userId: string; identifier: string; role?: string } | null | undefined>(undefined);

  useEffect(() => {
    if (!localStorage.getItem('vole_jwt')) {
      setUser(null);
      return;
    }
    api
      .me()
      .then((d) => setUser({ userId: d.userId, identifier: d.identifier, role: d.role }))
      .catch(() => {
        clearJwt();
        setUser(null);
      });
  }, []);

  if (user === undefined) return <div className="app-loader">Loading…</div>;
  if (user === null) return <AuthScreen onAuthed={(u) => setUser(u)} />;
  return (
    <Dashboard
      user={user}
      onLogout={() => {
        clearJwt();
        setUser(null);
      }}
    />
  );
}