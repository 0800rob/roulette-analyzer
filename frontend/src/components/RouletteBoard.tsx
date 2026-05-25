const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

interface Props {
  onSelect: (number: number) => void;
  disabled: boolean;
}

export default function RouletteBoard({ onSelect, disabled }: Props) {
  const getColor = (n: number) => {
    if (n === 0) return '#27ae60';
    return RED_NUMBERS.has(n) ? '#c0392b' : '#2c3e50';
  };

  // Layout: 3 rows x 12 columns + zero
  const rows = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  ];

  return (
    <div>
      {/* Zero button */}
      <button
        onClick={() => onSelect(0)}
        disabled={disabled}
        style={{
          background: getColor(0),
          color: '#fff',
          width: '100%',
          padding: '10px',
          marginBottom: 4,
          fontSize: 16,
          fontWeight: 'bold',
        }}
      >
        0
      </button>

      {/* Number grid */}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3, marginBottom: 3 }}>
          {row.map(n => (
            <button
              key={n}
              onClick={() => onSelect(n)}
              disabled={disabled}
              style={{
                background: getColor(n),
                color: '#fff',
                padding: '10px 0',
                fontSize: 13,
                fontWeight: 'bold',
                minWidth: 0,
              }}
            >
              {n}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
