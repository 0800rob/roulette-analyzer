import { useState } from 'react';
import { authLogin, authRegister, setToken } from '../api';

interface Props {
  onAuthenticated: () => void;
}

type Mode = 'login' | 'register';

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fn = mode === 'login' ? authLogin : authRegister;
      const r = await fn(email.trim(), password);
      setToken(r.data.access_token);
      onAuthenticated();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string | { message?: string } } } })?.response?.data
          ?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : typeof detail === 'object' && detail !== null
          ? (detail.message ?? 'Erro')
          : 'Falha na autenticação';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: 60 }}>
      <h1>🎰 Roulette Analyzer</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={mode === 'login' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={mode === 'register' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="Senha (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && (
            <div
              style={{
                color: '#e94560',
                background: '#2a1010',
                border: '1px solid #4a1a1a',
                borderRadius: 4,
                padding: '6px 10px',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 11, color: '#666', lineHeight: 1.6 }}>
          Esta é uma ferramenta de análise estatística do histórico de giros.
          Não garante resultados de aposta. Roleta é jogo de azar — use com
          responsabilidade.
        </p>
      </div>
    </div>
  );
}
