import { getNumberColor } from '../constants';

interface HistoryGridProps {
  /** Spin numbers ordered oldest -> newest. Latest is highlighted. */
  numbers: number[];
  /** Columns in the grid. Defaults to 12 to mirror Evolution's UI. */
  columns?: number;
  /** Maximum spins to show. Older ones are dropped. Defaults to 11×12 = 132. */
  maxSpins?: number;
}

function cellBg(num: number): string {
  switch (getNumberColor(num)) {
    case 'red':
      return '#1a0808';   // very dark red bg
    case 'black':
      return '#0a0a0a';   // near-black bg
    case 'green':
      return '#062b1f';   // dark green bg
  }
}

function textColor(num: number): string {
  switch (getNumberColor(num)) {
    case 'red':
      return '#e94560';
    case 'black':
      return '#e8e8e8';
    case 'green':
      return '#22c55e';
  }
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

/**
 * Grid of recent spins, mirroring the layout in the upper-right of Evolution's
 * Auto-Roulette UI: small cells with thin borders, the latest spin highlighted
 * with a filled colored background and a slightly larger font.
 */
export default function HistoryGrid({
  numbers,
  columns = 12,
  maxSpins = 132,
}: HistoryGridProps) {
  if (numbers.length === 0) {
    return (
      <p style={{ color: '#666', fontSize: 12, margin: 0 }}>
        Sem giros registrados ainda.
      </p>
    );
  }

  // Newest first
  const newestFirst = [...numbers].reverse().slice(0, maxSpins);
  const latest = newestFirst[0];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 1,
        background: '#1a1a1a',
        padding: 1,
        borderRadius: 4,
      }}
      data-testid="history-grid"
    >
      {newestFirst.map((n, i) => {
        const isLatest = i === 0;
        return (
          <div
            key={`${i}-${n}`}
            style={{
              minHeight: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: isLatest ? 14 : 11,
              background: isLatest ? fillColor(n) : cellBg(n),
              color: isLatest ? '#fff' : textColor(n),
              border: '1px solid #2a2a2a',
            }}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
}
