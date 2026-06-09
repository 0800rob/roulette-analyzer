import { ChaseHistoryItem, ChaseHistoryResponse } from '../api';
import { getNumberColor } from '../constants';

interface Props {
  history: ChaseHistoryResponse | null;
}

function fillColor(num: number): string {
  switch (getNumberColor(num)) {
    case 'red':
      return '#c8102e';
    case 'black':
      return '#1a1a1a';
    case 'green':
      return '#047857';
  }
}

function Bubble({ num, size = 22 }: { num: number; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: fillColor(num),
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size > 24 ? 12 : 10,
        border: '1px solid rgba(255,255,255,0.18)',
        flexShrink: 0,
      }}
    >
      {num}
    </span>
  );
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HistoryRow({ item }: { item: ChaseHistoryItem }) {
  const accent = '#c9a96e';
  const isGreen = item.status === 'resolved';
  const stateBg = isGreen ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255,255,255,0.02)';
  const stateBorder = isGreen ? '#22c55e' : '#444';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: stateBg,
        border: `1px solid ${stateBorder}`,
        borderRadius: 4,
        fontSize: 12,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ color: accent, fontWeight: 700, minWidth: 44 }}>
        {item.strategy.toUpperCase()}
      </span>

      <span style={{ color: '#888', display: 'flex', gap: 6, alignItems: 'center' }}>
        Disparou em
        {item.started_spin_number !== null && item.started_spin_number !== undefined && (
          <Bubble num={item.started_spin_number} />
        )}
      </span>

      {/* status pill */}
      <span
        style={{
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 99,
          border: `1px solid ${isGreen ? '#22c55e' : '#666'}`,
          color: isGreen ? '#22c55e' : '#888',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        {isGreen ? '🎯 green' : 'aguardando…'}
      </span>

      {isGreen && item.resolved_spin_number !== null && item.resolved_spin_number !== undefined && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e' }}>
          → caiu em <Bubble num={item.resolved_spin_number} size={26} />
          <span style={{ color: '#22c55e', fontWeight: 700 }}>
            em {item.spins_followed} {item.spins_followed === 1 ? 'giro' : 'giros'}
          </span>
        </span>
      )}

      {!isGreen && (
        <span style={{ color: '#888' }}>
          seguindo há {item.spins_followed} giros
        </span>
      )}

      <span style={{ color: '#555', marginLeft: 'auto', fontSize: 11 }}>
        {fmtTime(item.started_at)}
        {isGreen && item.resolved_at && (
          <> · {fmtDuration(item.started_at, item.resolved_at)}</>
        )}
      </span>
    </div>
  );
}

function StratBadge({
  label,
  accent,
  greens,
  avg,
}: {
  label: string;
  accent: string;
  greens: number;
  avg: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 160,
        border: `1px solid ${accent}`,
        borderRadius: 6,
        padding: '8px 12px',
      }}
    >
      <div style={{ color: accent, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ marginTop: 2, fontSize: 13 }}>
        <strong style={{ color: '#22c55e' }}>{greens}</strong>{' '}
        <span style={{ color: '#888' }}>greens</span>
        {greens > 0 && (
          <>
            <span style={{ color: '#666' }}> · </span>
            <span style={{ color: '#ddd' }}>{avg.toFixed(1)}</span>
            <span style={{ color: '#888' }}> giros médios</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChaseHistoryPanel({ history }: Props) {
  if (!history) {
    return null;
  }

  const items = history.items;
  const str1 = history.summary.str1 ?? { greens: 0, avg_spins_to_green: 0 };

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <h2 style={{ margin: 0, marginBottom: 10 }}>📜 Histórico de gatilhos</h2>

      {/* Summary line */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <StratBadge
          label="STR 1 — RUGAL"
          accent="#c9a96e"
          greens={str1.greens}
          avg={str1.avg_spins_to_green}
        />
      </div>

      {/* Rows */}
      {items.length === 0 ? (
        <p style={{ color: '#666', fontSize: 12, margin: 0 }}>
          Nenhum gatilho registrado ainda.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {items.map((it) => (
            <HistoryRow key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
