import { useState, useEffect, useCallback } from 'react';
import {
  Session,
  AuthUser,
  authMe,
  setToken,
  getSessions,
  createSession,
  deleteSession,
} from './api';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';
import LicenseExpired from './components/LicenseExpired';
import AdminPanel from './components/AdminPanel';

type View = 'home' | 'session' | 'admin';

function isLicenseValid(user: AuthUser | null): boolean {
  if (!user) return false;
  if (!user.is_active) return false;
  if (user.is_admin) return true;
  if (!user.expires_at) return false;
  return new Date(user.expires_at).getTime() > Date.now();
}

function App() {
  const [me, setMe] = useState<AuthUser | null | undefined>(undefined); // undefined = loading
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('home');
  const [newName, setNewName] = useState('');
  const [newCasino, setNewCasino] = useState('');

  const refreshMe = useCallback(async () => {
    try {
      const r = await authMe();
      setMe(r.data);
    } catch {
      setMe(null);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const r = await getSessions();
      setSessions(r.data);
    } catch (e) {
      console.error('loadSessions', e);
    }
  }, []);

  // On boot: try to load /me using whatever token is in localStorage
  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // Listen for global auth/license events triggered by the api interceptor.
  useEffect(() => {
    const onAuth = () => setMe(null);
    const onLicense = () => refreshMe();
    window.addEventListener('auth-required', onAuth);
    window.addEventListener('license-expired', onLicense);
    return () => {
      window.removeEventListener('auth-required', onAuth);
      window.removeEventListener('license-expired', onLicense);
    };
  }, [refreshMe]);

  // When auth changes to a valid user with a license, load sessions
  useEffect(() => {
    if (me && isLicenseValid(me)) {
      loadSessions();
    }
  }, [me, loadSessions]);

  const handleLogout = () => {
    setToken(null);
    setMe(null);
    setActiveSession(null);
    setView('home');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await createSession(newName, newCasino || undefined);
    setSessions([res.data, ...sessions]);
    setActiveSession(res.data);
    setView('session');
    setNewName('');
    setNewCasino('');
  };

  const handleDelete = async (id: number) => {
    await deleteSession(id);
    setSessions(sessions.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setView('home');
    }
  };

  // ----- Boot loading -----
  if (me === undefined) {
    return (
      <div className="container" style={{ marginTop: 60 }}>
        <p style={{ color: '#888' }}>Carregando…</p>
      </div>
    );
  }

  // ----- Not logged in -----
  if (me === null) {
    return <AuthScreen onAuthenticated={refreshMe} />;
  }

  // ----- Logged in but no valid license -----
  if (!isLicenseValid(me)) {
    return (
      <LicenseExpired
        email={me.email}
        expiresAt={me.expires_at}
        onLogout={handleLogout}
      />
    );
  }

  // ----- Admin panel -----
  if (view === 'admin') {
    return <AdminPanel onClose={() => setView('home')} />;
  }

  // ----- Session detail -----
  if (view === 'session' && activeSession) {
    return (
      <div className="container">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setActiveSession(null);
              setView('home');
              loadSessions();
            }}
            className="btn-secondary"
          >
            ← Voltar às sessões
          </button>
          <span style={{ marginLeft: 'auto', color: '#888', fontSize: 12 }}>
            {me.email}
          </span>
          {me.is_admin && (
            <button onClick={() => setView('admin')} className="btn-secondary">
              🛠️ Admin
            </button>
          )}
          <button onClick={handleLogout} className="btn-danger">
            Sair
          </button>
        </div>
        <Dashboard session={activeSession} />
      </div>
    );
  }

  // ----- Home (sessions list) -----
  return (
    <div className="container">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h1 style={{ margin: 0 }}>🎰 Roulette Analyzer</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#888', fontSize: 12 }}>{me.email}</span>
          {me.is_admin && (
            <button onClick={() => setView('admin')} className="btn-secondary">
              🛠️ Admin
            </button>
          )}
          <button onClick={handleLogout} className="btn-danger">
            Sair
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Nova sessão</h2>
        <div className="session-form">
          <input
            placeholder="Nome da sessão"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <input
            placeholder="Casino (opcional)"
            value={newCasino}
            onChange={(e) => setNewCasino(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button onClick={handleCreate} className="btn-primary">
            Criar sessão
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Sessões</h2>
        {sessions.length === 0 ? (
          <p style={{ color: '#888', marginTop: 8 }}>Nenhuma sessão criada ainda.</p>
        ) : (
          <div style={{ marginTop: 12 }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: '#0a0a0a',
                  borderRadius: 4,
                  marginBottom: 8,
                  border: '1px solid #2a2a2a',
                }}
              >
                <div>
                  <strong style={{ color: '#c9a96e' }}>{s.name}</strong>
                  {s.casino && (
                    <span style={{ color: '#888', marginLeft: 8 }}>({s.casino})</span>
                  )}
                  <span style={{ color: '#666', marginLeft: 12, fontSize: 13 }}>
                    {s.spin_count} giros
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      setActiveSession(s);
                      setView('session');
                    }}
                    className="btn-secondary"
                  >
                    Abrir
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="btn-danger">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
