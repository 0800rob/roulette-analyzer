import { NumberFrequency } from '../api';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

interface Props {
  frequencies: NumberFrequency[];
  totalSpins: number;
}

export default function HeatMap({ frequencies, totalSpins }: Props) {
  // Layout: same as roulette board
  const rows = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  ];

  const maxCount = Math.max(...frequencies.map(f => f.count), 1);

  const getHeatColor = (number: number) => {
    const freq = frequencies.find(f => f.number === number);
    const count = freq?.count ?? 0;
    const intensity = count / maxCount; // 0 to 1

    // Expected probability for european roulette: 1/37 ≈ 2.7%
    const expected = totalSpins / 37;
    const deviation = count / Math.max(expected, 1);

    if (deviation > 1.5) return `rgba(231, 76, 60, ${0.4 + intensity * 0.6})`; // Hot - red
    if (deviation < 0.5) return `rgba(52, 152, 219, ${0.3 + (1 - intensity) * 0.5})`; // Cold - blue
    return `rgba(255, 255, 255, ${0.1 + intensity * 0.3})`; // Normal
  };

  const getBaseColor = (n: number) => {
    if (n === 0) return '#27ae60';
    return RED_NUMBERS.has(n) ? '#c0392b' : '#2c3e50';
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: '#888' }}>
        <span>🔴 Acima do esperado</span>
        <span>🔵 Abaixo do esperado</span>
        <span>⚪ Normal</span>
      </div>

      {/* Zero */}
      <div
        style={{
          background: getHeatColor(0),
          border: `2px solid ${getBaseColor(0)}`,
          borderRadius: 6,
          padding: '8px',
          textAlign: 'center',
          marginBottom: 4,
          fontSize: 13,
          fontWeight: 'bold',
        }}
      >
        0 ({frequencies.find(f => f.number === 0)?.count ?? 0}x)
      </div>

      {/* Grid */}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3, marginBottom: 3 }}>
          {row.map(n => {
            const freq = frequencies.find(f => f.number === n);
            return (
              <div
                key={n}
                style={{
                  background: getHeatColor(n),
                  border: `2px solid ${getBaseColor(n)}`,
                  borderRadius: 4,
                  padding: '6px 2px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 'bold',
                }}
              >
                <div>{n}</div>
                <div style={{ fontSize: 9, opacity: 0.8 }}>{freq?.count ?? 0}x</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
