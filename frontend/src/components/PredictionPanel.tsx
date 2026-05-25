import type { Prediction } from '../api';

interface PredictionPanelProps {
  predictions: Prediction[];
  totalSpins: number;
  minSpinsRequired: number;
  loading?: boolean;
}

const REASON_ICONS: Record<string, string> = {
  bias: '📊',       // statistical bias
  markov: '🔗',     // transition chain
  sector: '🎯',     // sector
  gap: '⏰',        // overdue
  frequency: '🔥',  // hot recently
  pattern: '📈',    // pattern match
  // legacy keys (in case old predictions are cached)
  neighbor: '👥',
  trend: '📈',
};

const REASON_LABELS: Record<string, string> = {
  bias: 'Viés estatístico',
  markov: 'Cadeia de Markov',
  sector: 'Setor quente',
  gap: 'Atrasado',
  frequency: 'Frequência recente',
  pattern: 'Padrão de cor',
  neighbor: 'Vizinhos',
  trend: 'Tendência',
};

function colorHex(color: string): string {
  switch (color) {
    case 'red':
      return '#c8102e';
    case 'black':
      return '#1a1a1a';
    case 'green':
      return '#047857';
    default:
      return '#1a1a1a';
  }
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#1a1a1a',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              width: 36,
              height: 11,
              borderRadius: 4,
              background: '#1a1a1a',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function PredictionPanel({
  predictions,
  totalSpins,
  minSpinsRequired,
  loading = false,
}: PredictionPanelProps) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Leitura do histórico</h2>
        <span style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>
          análise estatística — não é estratégia garantida
        </span>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : totalSpins < minSpinsRequired ? (
        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
          Registre pelo menos {minSpinsRequired} giros para ver a análise.
        </p>
      ) : predictions.length === 0 ? (
        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
          Sem dados suficientes para destacar números.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {predictions.map((p, idx) => (
            <div
              key={p.number}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                position: 'relative',
              }}
            >
              <span
                title={`Posição #${idx + 1}`}
                style={{
                  position: 'absolute',
                  top: -6,
                  left: -6,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#c9a96e',
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  zIndex: 1,
                }}
              >
                {idx + 1}
              </span>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: colorHex(p.color),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  color: '#fff',
                  border: '2px solid #c9a96e',
                  boxShadow: '0 0 10px rgba(201, 169, 110, 0.5)',
                }}
              >
                {p.number}
              </div>
              <span style={{ fontSize: 13, color: '#c9a96e', fontWeight: 600 }}>
                {Math.round(p.confidence_score * 100)}%
              </span>
              <div style={{ display: 'flex', gap: 3, fontSize: '0.95rem' }}>
                {p.reasons.slice(0, 4).map((r) =>
                  REASON_ICONS[r] ? (
                    <span key={r} title={REASON_LABELS[r] ?? r}>
                      {REASON_ICONS[r]}
                    </span>
                  ) : null
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
