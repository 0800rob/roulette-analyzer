import React from 'react';
import { BETTING_TABLE_ROWS, getNumberColor } from '../constants';

export interface BettingTableProps {
  onSelect: (number: number) => void;
  disabled?: boolean;
  lastNumber?: number | null;
  predictedNumbers?: number[];
  /** Numbers highlighted by the user's group strategy (3 hits + neighbours). */
  strategyMarkedNumbers?: number[];
  /** Subset of strategyMarkedNumbers that are the 3 primary hits (drawn stronger). */
  strategyHitNumbers?: number[];
}

/** Inject the keyframe animation for predicted-cell pulsing glow. */
const GLOW_ID = 'betting-table-predicted-glow';
function ensureGlowAnimation(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(GLOW_ID)) return;
  const style = document.createElement('style');
  style.id = GLOW_ID;
  style.textContent = `
    @keyframes bettingTablePredictedGlow {
      0%, 100% { box-shadow: inset 0 0 0 2px #c9a96e, 0 0 4px 1px #c9a96e; }
      50%      { box-shadow: inset 0 0 0 2px #c9a96e, 0 0 14px 4px #c9a96e; }
    }
    @keyframes bettingTableStrategyHit {
      0%, 100% { box-shadow: inset 0 0 0 3px #00d4ff, 0 0 6px 2px #00d4ff; }
      50%      { box-shadow: inset 0 0 0 3px #00d4ff, 0 0 18px 6px #00d4ff; }
    }
    @keyframes bettingTableStrategyMark {
      0%, 100% { box-shadow: inset 0 0 0 2px #00d4ff; }
      50%      { box-shadow: inset 0 0 0 2px #00d4ff, 0 0 10px 2px rgba(0,212,255,0.7); }
    }
  `;
  document.head.appendChild(style);
}

/** Bg color for inside (number) cells — Evolution style: red/black/green flat. */
function cellBg(num: number): string {
  switch (getNumberColor(num)) {
    case 'red':
      return '#c8102e';
    case 'black':
      return '#1a1a1a';
    case 'green':
      return '#047857';
  }
}

export const BettingTable: React.FC<BettingTableProps> = ({
  onSelect,
  disabled = false,
  lastNumber = null,
  predictedNumbers = [],
  strategyMarkedNumbers = [],
  strategyHitNumbers = [],
}) => {
  ensureGlowAnimation();
  const predictedSet = new Set(predictedNumbers);
  const strategySet = new Set(strategyMarkedNumbers);
  const hitSet = new Set(strategyHitNumbers);

  const click = (n: number) => {
    if (!disabled) onSelect(n);
  };

  // ---- shared cell styles ----------------------------------------------
  const baseCell: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid #ffffff',
    userSelect: 'none',
    minHeight: 38,
  };

  const cellHighlightStyle = (n: number): React.CSSProperties => {
    if (lastNumber === n) {
      return {
        boxShadow: 'inset 0 0 0 2px #ffd700, 0 0 8px 2px #ffd700',
        zIndex: 3,
      };
    }
    if (hitSet.has(n)) {
      return {
        animation: 'bettingTableStrategyHit 1.2s ease-in-out infinite',
        zIndex: 3,
      };
    }
    if (strategySet.has(n)) {
      return {
        animation: 'bettingTableStrategyMark 1.5s ease-in-out infinite',
        zIndex: 2,
      };
    }
    if (predictedSet.has(n)) {
      return {
        animation: 'bettingTablePredictedGlow 1.5s ease-in-out infinite',
        zIndex: 2,
      };
    }
    return {};
  };

  const rankBadge = (n: number): React.ReactNode => {
    // Strategy hit badge takes priority over predicted-rank
    if (hitSet.has(n)) {
      return (
        <span
          style={{
            position: 'absolute',
            top: -7,
            right: -7,
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            borderRadius: 9,
            background: '#00d4ff',
            color: '#000',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          ★
        </span>
      );
    }
    if (!predictedSet.has(n)) return null;
    const rank = predictedNumbers.indexOf(n) + 1;
    return (
      <span
        style={{
          position: 'absolute',
          top: -7,
          right: -7,
          minWidth: 18,
          height: 18,
          padding: '0 4px',
          borderRadius: 9,
          background: '#c9a96e',
          color: '#000',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      >
        {rank}
      </span>
    );
  };

  // ---- outside bet cell styles -----------------------------------------
  const outsideCell: React.CSSProperties = {
    ...baseCell,
    fontSize: '0.8rem',
    background: '#0e3b2c',
    minHeight: 32,
  };

  return (
    <div
      style={{
        background: '#0e3b2c',
        border: '2px solid #c9a96e',
        borderRadius: 4,
        padding: 10,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      data-testid="betting-table"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '54px repeat(12, 1fr) 54px',
          gridTemplateRows: 'repeat(3, 38px) 32px 32px',
          gap: 0,
        }}
      >
        {/* Zero — spans 3 rows on the left */}
        <div
          onClick={() => click(0)}
          style={{
            ...baseCell,
            ...cellHighlightStyle(0),
            gridRow: '1 / 4',
            gridColumn: 1,
            backgroundColor: cellBg(0),
            fontSize: '1.1rem',
            borderTopLeftRadius: 60,
            borderBottomLeftRadius: 60,
          }}
          data-testid="cell-0"
        >
          0
          {rankBadge(0)}
        </div>

        {/* 3×12 number grid */}
        {BETTING_TABLE_ROWS.map((row, rowIdx) =>
          row.map((num) => (
            <div
              key={num}
              onClick={() => click(num)}
              style={{
                ...baseCell,
                ...cellHighlightStyle(num),
                gridRow: rowIdx + 1,
                backgroundColor: cellBg(num),
              }}
              data-testid={`cell-${num}`}
            >
              {num}
              {rankBadge(num)}
            </div>
          ))
        )}

        {/* Column bets — 2:1 on the right, three rows */}
        {[1, 2, 3].map((row) => (
          <div
            key={`col-${row}`}
            style={{ ...outsideCell, gridRow: row, gridColumn: 14, minHeight: 38 }}
          >
            2:1
          </div>
        ))}

        {/* Dozen bets row — 4 columns each */}
        {(['1st 12', '2nd 12', '3rd 12'] as const).map((label, i) => (
          <div
            key={`doz-${i}`}
            style={{ ...outsideCell, gridRow: 4, gridColumn: `${2 + i * 4} / ${6 + i * 4}` }}
          >
            {label}
          </div>
        ))}

        {/* Even-money row — 6 cells of 2 columns each */}
        {(['1-18', 'EVEN', 'RED', 'BLACK', 'ODD', '19-36'] as const).map((label, i) => {
          const isRed = label === 'RED';
          const isBlack = label === 'BLACK';
          return (
            <div
              key={`em-${i}`}
              style={{
                ...outsideCell,
                gridRow: 5,
                gridColumn: `${2 + i * 2} / ${4 + i * 2}`,
                background: isRed ? '#c8102e' : isBlack ? '#1a1a1a' : '#0e3b2c',
                color: '#fff',
              }}
            >
              {isRed ? '◆' : isBlack ? '◆' : label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BettingTable;
