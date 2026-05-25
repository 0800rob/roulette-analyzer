interface Props {
  email: string;
  expiresAt: string | null;
  onLogout: () => void;
}

export default function LicenseExpired({ email, expiresAt, onLogout }: Props) {
  const expiry = expiresAt ? new Date(expiresAt).toLocaleString() : null;

  return (
    <div className="container" style={{ maxWidth: 520, marginTop: 60 }}>
      <h1>🎰 Roulette Analyzer</h1>

      <div className="card">
        <h2>Licença expirada</h2>
        <p style={{ marginTop: 12, color: '#ddd', fontSize: 14, lineHeight: 1.5 }}>
          A licença da conta <strong style={{ color: '#c9a96e' }}>{email}</strong>{' '}
          {expiry ? (
            <>
              expirou em <strong>{expiry}</strong>.
            </>
          ) : (
            <>ainda não foi ativada.</>
          )}
        </p>
        <p style={{ marginTop: 12, color: '#888', fontSize: 13 }}>
          Para reativar, entre em contato com o administrador. Em breve teremos
          renovação automática via Mercado Pago.
        </p>

        <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
          <button onClick={onLogout} className="btn-secondary">
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
