import { useEffect, useState, useCallback } from 'react';
import { AdminUser, adminListUsers, adminGrantDays, adminSetActive } from '../api';

interface Props {
  onClose: () => void;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (d.getTime() < Date.now()) {
    return `expirou em ${d.toLocaleDateString()}`;
  }
  const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return `${diffDays} dias restantes (até ${d.toLocaleDateString()})`;
}

export default function AdminPanel({ onClose }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const r = await adminListUsers();
      setUsers(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const grant = async (userId: number, days: number) => {
    setBusy(userId);
    try {
      await adminGrantDays(userId, days);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (u: AdminUser) => {
    setBusy(u.id);
    try {
      await adminSetActive(u.id, !u.is_active);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>🛠️ Administração</h1>
        <button onClick={onClose} className="btn-secondary">
          Voltar
        </button>
      </div>

      <div className="card">
        <h2>Usuários ({users.length})</h2>

        {loading ? (
          <p style={{ color: '#888' }}>Carregando…</p>
        ) : users.length === 0 ? (
          <p style={{ color: '#888' }}>Nenhum usuário cadastrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#0a0a0a',
                  border: '1px solid #2a2a2a',
                  borderRadius: 4,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 600 }}>
                    {u.email}
                    {u.is_admin && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: '#c9a96e',
                          color: '#000',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        ADMIN
                      </span>
                    )}
                    {!u.is_active && (
                      <span style={{ marginLeft: 8, color: '#e94560', fontSize: 11 }}>
                        DESATIVADO
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    {u.session_count} sessões · {formatExpiry(u.expires_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => grant(u.id, 7)}
                    disabled={busy === u.id || u.is_admin}
                    className="btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    +7 dias
                  </button>
                  <button
                    onClick={() => grant(u.id, 30)}
                    disabled={busy === u.id || u.is_admin}
                    className="btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    +30 dias
                  </button>
                  <button
                    onClick={() => grant(u.id, 90)}
                    disabled={busy === u.id || u.is_admin}
                    className="btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    +90 dias
                  </button>
                  <button
                    onClick={() => grant(u.id, 365)}
                    disabled={busy === u.id || u.is_admin}
                    className="btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    +1 ano
                  </button>
                  <button
                    onClick={() => grant(u.id, -9999)}
                    disabled={busy === u.id || u.is_admin}
                    className="btn-danger"
                    style={{ fontSize: 12 }}
                  >
                    Revogar
                  </button>
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={busy === u.id || u.is_admin}
                    className="btn-danger"
                    style={{ fontSize: 12 }}
                  >
                    {u.is_active ? 'Desativar' : 'Ativar'}
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
