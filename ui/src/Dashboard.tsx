export default function Dashboard({ user, onLogout }: { user: { userId: string; identifier: string }; onLogout: () => void }) {
  return (
    <div className="dash">
      <header>
        <h1>Vole — {user.identifier}</h1>
        <button onClick={onLogout}>Log out</button>
      </header>
      <p>Dashboard (phase 08-02).</p>
    </div>
  );
}