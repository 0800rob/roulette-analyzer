import type { MonitorStrategyResponse } from '../api';
import { getNumberColor } from '../constants';

interface Props {
  strategy: MonitorStrategyResponse | null;
  loading?: boolean;
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
  highlight?: 'monitor' | 'key';
}) {
  const border =
    highlight === 'monitor'
      ? '2px solid #00d4ff'
      : highlight === 'key'
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
          highlight === 'monitor'
            ? '0 0 8px rgba(0, 212, 255, 0.6)'
            : undefined,
      }}
    >
      {num}
    </span>
  );
}

export default function MonitorStrategyPanel({ strategy, loading }: Props) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>STR 2 — Monitor (cálculos)</h2>

      {loading && (
        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>Calculando...</p>
      )}

      {!loading && (!strategy || (!strategy.triggered && !strategy.awaiting_next)) && (
        <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
          Aguardando: nenhum par consecutivo com diferença de 10 foi
          encontrado no histórico.
        </p>
      )}

      {!loading && strategy && strategy.awaiting_next && strategy.pair && (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
            Par detectado (diff = 10) — aguardando próximo giro
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <NumBubble num={strategy.pair[0]} size={32} highlight="key" />
            <span style={{ color: '#666' }}>→</span>
            <NumBubble num={strategy.pair[1]} size={32} highlight="key" />
            <span style={{ color: '#666', fontSize: 12 }}>
              |{strategy.pair[0]} − {strategy.pair[1]}| = 10
            </span>
          </div>
        </div>
      )}

      {!loading && strategy && strategy.triggered && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Trigger pair */}
          {strategy.pair && strategy.pair.length === 2 && (
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                Gatilho: par com diff = 10
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <NumBubble num={strategy.pair[0]} size={28} highlight="key" />
                <span style={{ color: '#666' }}>→</span>
                <NumBubble num={strategy.pair[1]} size={28} highlight="key" />
                <span style={{ color: '#666', fontSize: 12 }}>
                  |{strategy.pair[0]} − {strategy.pair[1]}| = 10
                </span>
              </div>
            </div>
          )}

          {/* Inputs */}
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              Cálculo: segundo do par → giro seguinte
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <NumBubble num={strategy.second!} size={32} />
              <span style={{ color: '#666' }}>→</span>
              <NumBubble num={strategy.current!} size={32} />
            </div>
          </div>

          {/* Three key calculations */}
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              Cálculos
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 6,
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ color: '#c9a96e', fontWeight: 600 }}>
                  ({strategy.second}+{strategy.current}) mod 36
                </span>{' '}
                = <strong>{strategy.calc1}</strong>
                <div style={{ display: 'inline-flex', gap: 4, marginLeft: 8 }}>
                  {(strategy.associations[String(strategy.calc1)] ?? []).map((n) => (
                    <NumBubble key={`c1-${n}`} num={n} size={22} highlight="key" />
                  ))}
                </div>
              </div>
              <div>
                <span style={{ color: '#c9a96e', fontWeight: 600 }}>
                  |{strategy.second}-{strategy.current}|
                </span>{' '}
                = <strong>{strategy.calc2}</strong>
                <div style={{ display: 'inline-flex', gap: 4, marginLeft: 8 }}>
                  {(strategy.associations[String(strategy.calc2)] ?? []).map((n) => (
                    <NumBubble key={`c2-${n}`} num={n} size={22} highlight="key" />
                  ))}
                </div>
              </div>
              <div>
                <span style={{ color: '#c9a96e', fontWeight: 600 }}>
                  36 - {strategy.calc2}
                </span>{' '}
                = <strong>{strategy.calc3}</strong>
                <div style={{ display: 'inline-flex', gap: 4, marginLeft: 8 }}>
                  {(strategy.associations[String(strategy.calc3)] ?? []).map((n) => (
                    <NumBubble key={`c3-${n}`} num={n} size={22} highlight="key" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Final monitored set */}
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              Números monitorados ({strategy.monitored.length})
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {strategy.monitored.map((n) => (
                <NumBubble key={`mon-${n}`} num={n} size={32} highlight="monitor" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
