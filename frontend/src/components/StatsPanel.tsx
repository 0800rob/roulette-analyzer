import { SessionStats } from '../api';

interface Props {
  stats: SessionStats;
}

export default function StatsPanel({ stats }: Props) {
  return (
    <div style={{ fontSize: 14 }}>
      {/* Colors */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>Cores</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: '#e74c3c' }}>🔴 {stats.colors.red} ({stats.colors.red_pct}%)</span>
          <span style={{ color: '#95a5a6' }}>⚫ {stats.colors.black} ({stats.colors.black_pct}%)</span>
          <span style={{ color: '#2ecc71' }}>🟢 {stats.colors.green} ({stats.colors.green_pct}%)</span>
        </div>
      </div>

      {/* Parity */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>Par / Ímpar</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <span>Par: {stats.parity.even} ({stats.parity.even_pct}%)</span>
          <span>Ímpar: {stats.parity.odd} ({stats.parity.odd_pct}%)</span>
        </div>
      </div>

      {/* Dozens */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>Dúzias</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <span>1ª (1-12): {stats.dozens.first}</span>
          <span>2ª (13-24): {stats.dozens.second}</span>
          <span>3ª (25-36): {stats.dozens.third}</span>
        </div>
      </div>

      {/* Hot/Cold */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>🔥 Quentes</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {stats.hot_cold.hot.map(n => (
            <span key={n.number} style={{
              background: n.color === 'red' ? '#c0392b' : '#2c3e50',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
            }}>
              {n.number} ({n.count}x)
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>❄️ Frios</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {stats.hot_cold.cold.map(n => (
            <span key={n.number} style={{
              background: n.color === 'red' ? '#c0392b' : '#2c3e50',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              opacity: 0.6,
            }}>
              {n.number} ({n.count}x)
            </span>
          ))}
        </div>
      </div>

      {/* Longest streak */}
      {stats.longest_streak.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>🏆 Maior Sequência</h3>
          <span>
            {stats.longest_streak.type === 'color' ? 'Cor' : 'Paridade'}:{' '}
            <strong>{stats.longest_streak.value}</strong> — {stats.longest_streak.length}x seguidos
          </span>
        </div>
      )}
    </div>
  );
}
