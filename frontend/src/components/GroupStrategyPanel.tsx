import type { GroupStrategyResponse } from '../api';
import { getNumberColor } from '../constants';

interface Props {
  strategy: GroupStrategyResponse | null;
  loading?: boolean;
  window: number;
  onWindowChange: (next: number) => void;
}

function colorHex(num: number): string {
  switch (getNumberColor(num)) {
    case 'red':
      return '#c8102e';
    case 'black':
      return '#1a1a1a';
    case 'green':
      return '#047857';
  }
}

function NumBubble({
  num,
  size = 32,
  highlight,
}: {
  num: number;
  size?: number;
  highlight?: 'hit' | 'neighbour' | 'triple';
}) {
  const border =
    highlight === 'hit'
      ? '2px solid #00d4ff'
      : highlight === 'neighbour'
      ? '1px solid rgba(0, 212, 255, 0.5)'
      : highlight === 'triple'
      ? '2px solid #c9a96e'
      : '1px solid rgba(255,255,255,0.15)';

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colorHex(num),
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size > 30 ? 13 : 11,
        border,
        boxShadow:
          highlight === 'hit'
            ? '0 0 8px rgba(0, 212, 255, 0.7)'
            : undefined,
      }}
    >
      {num}
    </span>
  );
}

export default function GroupStrategyPanel({
  strategy,
  loading,
  window,
  onWindowChange,
}: Props) {
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
        <h2 style={{ margin: 0 }}>Estratégia de grupos</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#888' }}>Janela:</span>
          <input
            type="number"
            min={3}
            max={20}
            value={window}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isNaN(v)) onWindowChange(Math.max(3, Math.min(20, v)));
            }}
            style={{ width: 60, padding: '4px 8px', fontSize: 13 }}
          />
        </div>
      </div>

      {loading && (
        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>Calculando...</p>
      )}

      {!loading && (!strategy || !strategy.triggered) && (
        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
          Aguardando: nenhuma sequência de 3+ giros do mesmo grupo foi
          quebrada nos últimos {strategy?.window ?? window} resultados.
        </p>
      )}

      {!loading && strategy && strategy.triggered && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Sequence + sum breakdown */}
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              Sequência ({strategy.triple.length} giros) do grupo{' '}
              <strong style={{ color: '#c9a96e' }}>{strategy.group_label}</strong>
              {' '}(janela: {strategy.window})
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {strategy.triple.map((n, i) => (
                <span
                  key={`t-${i}-${n}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <NumBubble num={n} size={32} highlight="triple" />
                  <small style={{ color: '#666' }}>
                    →{strategy.digital_roots[i]}
                  </small>
                </span>
              ))}
              <span style={{ color: '#c9a96e', fontWeight: 700 }}>
                = {strategy.sum}
              </span>
            </div>
          </div>

          {/* Hit numbers */}
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              Jogada (3 cheios)
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {strategy.hit_numbers.map((n) => (
                <NumBubble key={`hit-${n}`} num={n} size={42} highlight="hit" />
              ))}
            </div>
          </div>

          {/* Neighbours per hit */}
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              Vizinhos na race (1 de cada lado)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {strategy.hit_numbers.map((hit) => (
                <div key={`row-${hit}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <NumBubble num={hit} size={28} highlight="hit" />
                  <span style={{ color: '#666', fontSize: 12 }}>→</span>
                  {(strategy.neighbours[String(hit)] ?? []).map((n, i) => (
                    <NumBubble key={`n-${hit}-${i}-${n}`} num={n} size={28} highlight="neighbour" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
