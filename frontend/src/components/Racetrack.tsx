import React from 'react';
import { EUROPEAN_WHEEL_ORDER, getNumberColor } from '../constants';

export interface RacetrackProps {
  onSelect: (number: number) => void;
  disabled?: boolean;
  lastNumber?: number | null;
  predictedNumbers?: number[];
  /** Numbers highlighted by the user's group strategy (3 hits + neighbours). */
  strategyMarkedNumbers?: number[];
  /** The 3 primary "hit" numbers from the strategy (drawn stronger). */
  strategyHitNumbers?: number[];
}

// =============================================================
// Stadium geometry (rounded-rectangle "racetrack")
// =============================================================
//
// Layout (clockwise from top-left, mirrors Evolution's racetrack):
//   - 15 cells on top straight    -> wheel positions 20..34
//   - 3  cells on right semicircle -> wheel positions 35, 36, 0
//   - 15 cells on bottom straight  -> wheel positions 1..15 (drawn right→left)
//   - 4  cells on left semicircle  -> wheel positions 16..19
//
// Sectors (matching the centre labels in the reference image):
//   ZERO       =  7 numbers (Jeu Zéro: 12 35 3 26 0 32 15)
//   VOISINS    = 10 numbers (Voisins minus Jeu Zéro)
//   ORPHELINS  =  8 numbers
//   TIER       = 12 numbers (Tiers du Cylindre)

const W = 900;        // SVG width
const H = 200;        // SVG height
const T = 30;         // cell thickness (height of straights / radial of curves)
const CY = H / 2;
const LEFT_CX = H / 2;
const RIGHT_CX = W - LEFT_CX;
const OUTER_R = H / 2;
const INNER_R = OUTER_R - T;
const STRAIGHT_LEN = RIGHT_CX - LEFT_CX;
const N_STRAIGHT = 15;
const CW = STRAIGHT_LEN / N_STRAIGHT;

// =============================================================
// Pulse animation for predicted cells
// =============================================================

const GLOW_ID = 'racetrack-stadium-glow';
function ensureGlow(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(GLOW_ID)) return;
  const style = document.createElement('style');
  style.id = GLOW_ID;
  style.textContent = `
    @keyframes stadiumGlow {
      0%, 100% { opacity: 0.4; }
      50%      { opacity: 1; }
    }
    .stadium-pulse { animation: stadiumGlow 1.2s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

// =============================================================
// Helpers
// =============================================================

function fillFor(num: number): string {
  switch (getNumberColor(num)) {
    case 'red':
      return '#c8102e';
    case 'black':
      return '#1a1a1a';
    case 'green':
      return '#047857';
  }
}

function polarToCart(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcCellPath(
  cx: number,
  cy: number,
  ir: number,
  or_: number,
  sa: number,
  ea: number
): string {
  const oS = polarToCart(cx, cy, or_, sa);
  const oE = polarToCart(cx, cy, or_, ea);
  const iS = polarToCart(cx, cy, ir, sa);
  const iE = polarToCart(cx, cy, ir, ea);
  const large = ea - sa > Math.PI ? 1 : 0;
  return [
    `M ${oS.x} ${oS.y}`,
    `A ${or_} ${or_} 0 ${large} 1 ${oE.x} ${oE.y}`,
    `L ${iE.x} ${iE.y}`,
    `A ${ir} ${ir} 0 ${large} 0 ${iS.x} ${iS.y}`,
    'Z',
  ].join(' ');
}

// =============================================================
// Cell layout
// =============================================================

interface Cell {
  number: number;
  shape: 'rect' | 'arc';
  rect?: { x: number; y: number; w: number; h: number };
  arcD?: string;
  labelX: number;
  labelY: number;
}

function buildCells(): Cell[] {
  const cells: Cell[] = [];

  // ---- Top straight: positions 20..34, left to right ---------------
  for (let i = 0; i < 15; i++) {
    const number = EUROPEAN_WHEEL_ORDER[20 + i];
    const x = LEFT_CX + i * CW;
    cells.push({
      number,
      shape: 'rect',
      rect: { x, y: 0, w: CW, h: T },
      labelX: x + CW / 2,
      labelY: T / 2,
    });
  }

  // ---- Right curve: positions 35, 36, 0; top→bottom (-π/2 .. π/2) --
  const RC = 3;
  for (let i = 0; i < RC; i++) {
    const sa = -Math.PI / 2 + (i * Math.PI) / RC;
    const ea = sa + Math.PI / RC;
    const ma = (sa + ea) / 2;
    const lr = (INNER_R + OUTER_R) / 2;
    const lp = polarToCart(RIGHT_CX, CY, lr, ma);
    const wheelIdx = i === 0 ? 35 : i === 1 ? 36 : 0;
    cells.push({
      number: EUROPEAN_WHEEL_ORDER[wheelIdx],
      shape: 'arc',
      arcD: arcCellPath(RIGHT_CX, CY, INNER_R, OUTER_R, sa, ea),
      labelX: lp.x,
      labelY: lp.y,
    });
  }

  // ---- Bottom straight: positions 15..1; visually L→R --------------
  // visual idx i  ->  wheel position 15 - i
  for (let i = 0; i < 15; i++) {
    const number = EUROPEAN_WHEEL_ORDER[15 - i];
    const x = LEFT_CX + i * CW;
    cells.push({
      number,
      shape: 'rect',
      rect: { x, y: H - T, w: CW, h: T },
      labelX: x + CW / 2,
      labelY: H - T / 2,
    });
  }

  // ---- Left curve: positions 16..19; bottom→top (π/2 .. 3π/2) ------
  const LC = 4;
  for (let i = 0; i < LC; i++) {
    const sa = Math.PI / 2 + (i * Math.PI) / LC;
    const ea = sa + Math.PI / LC;
    const ma = (sa + ea) / 2;
    const lr = (INNER_R + OUTER_R) / 2;
    const lp = polarToCart(LEFT_CX, CY, lr, ma);
    cells.push({
      number: EUROPEAN_WHEEL_ORDER[16 + i],
      shape: 'arc',
      arcD: arcCellPath(LEFT_CX, CY, INNER_R, OUTER_R, sa, ea),
      labelX: lp.x,
      labelY: lp.y,
    });
  }

  return cells;
}

const CELLS = buildCells();

// =============================================================
// Section dividers (drawn over the inner area)
// =============================================================
//
// TIER | ORPHELINS — diagonal: top after cell "33" (top idx 2), bottom
//                  after cell "27" (bottom idx 4 → x = 5*CW)
// ORPHELINS | VOISINS — vertical at 8*CW
// VOISINS | ZERO — vertical at 13*CW

const DIVIDERS: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  // TIER | ORPHELINS — diagonal
  { x1: LEFT_CX + 3 * CW, y1: T, x2: LEFT_CX + 5 * CW, y2: H - T },
  // ORPHELINS | VOISINS — vertical
  { x1: LEFT_CX + 8 * CW, y1: T, x2: LEFT_CX + 8 * CW, y2: H - T },
  // VOISINS | ZERO — vertical
  { x1: LEFT_CX + 13 * CW, y1: T, x2: LEFT_CX + 13 * CW, y2: H - T },
];

// =============================================================
// Section labels
// =============================================================

const LABELS: Array<{ text: string; x: number; y: number }> = [
  { text: 'TIER', x: LEFT_CX + 1 * CW, y: CY },        // ~140
  { text: 'ORPHELINS', x: LEFT_CX + 6 * CW, y: CY },   // ~324
  { text: 'VOISINS', x: LEFT_CX + 10.5 * CW, y: CY },  // ~492
  { text: 'ZERO', x: RIGHT_CX, y: CY },                // 660 (centred in right curve)
];

// =============================================================
// Component
// =============================================================

export const Racetrack: React.FC<RacetrackProps> = ({
  onSelect,
  disabled = false,
  lastNumber = null,
  predictedNumbers = [],
  strategyMarkedNumbers = [],
  strategyHitNumbers = [],
}) => {
  ensureGlow();
  const predictedSet = new Set(predictedNumbers);
  const strategySet = new Set(strategyMarkedNumbers);
  const hitSet = new Set(strategyHitNumbers);

  const click = (num: number) => {
    if (!disabled) onSelect(num);
  };

  return (
    <div
      style={{
        background: '#0a0f1f',
        borderRadius: 8,
        padding: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      data-testid="racetrack"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        style={{
          maxWidth: W,
          maxHeight: H,
          pointerEvents: disabled ? 'none' : undefined,
          opacity: disabled ? 0.5 : 1,
          transition: 'opacity 0.2s',
        }}
        aria-label="Racetrack estádio com setores TIER, ORPHELINS, VOISINS, ZERO"
      >
        {/* Number cells */}
        {CELLS.map((cell) => {
          const isLast = lastNumber === cell.number;
          const isPredicted = predictedSet.has(cell.number);
          const isStrategyHit = hitSet.has(cell.number);
          const isStrategyMark = strategySet.has(cell.number) && !isStrategyHit;
          const rank = isPredicted ? predictedNumbers.indexOf(cell.number) + 1 : 0;
          const fill = fillFor(cell.number);

          let stroke = '#ffffff';
          let strokeW = 0.7;
          if (isLast) {
            stroke = '#ffd700';
            strokeW = 2.8;
          } else if (isStrategyHit) {
            stroke = '#00d4ff';
            strokeW = 3;
          } else if (isStrategyMark) {
            stroke = '#00d4ff';
            strokeW = 2;
          } else if (isPredicted) {
            stroke = '#c9a96e';
            strokeW = 2.2;
          }

          return (
            <g
              key={cell.number}
              onClick={() => click(cell.number)}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
              data-number={cell.number}
            >
              {cell.shape === 'rect' && cell.rect ? (
                <rect
                  x={cell.rect.x}
                  y={cell.rect.y}
                  width={cell.rect.w}
                  height={cell.rect.h}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeW}
                />
              ) : (
                <path
                  d={cell.arcD!}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeW}
                />
              )}
              {(isPredicted || isStrategyHit || isStrategyMark) && (
                <>
                  {cell.shape === 'rect' && cell.rect ? (
                    <rect
                      x={cell.rect.x + 1}
                      y={cell.rect.y + 1}
                      width={cell.rect.w - 2}
                      height={cell.rect.h - 2}
                      fill="none"
                      stroke={isStrategyHit || isStrategyMark ? '#00d4ff' : '#c9a96e'}
                      strokeWidth={1.5}
                      className="stadium-pulse"
                    />
                  ) : (
                    <path
                      d={cell.arcD!}
                      fill="none"
                      stroke={isStrategyHit || isStrategyMark ? '#00d4ff' : '#c9a96e'}
                      strokeWidth={1.5}
                      className="stadium-pulse"
                    />
                  )}
                </>
              )}
              <text
                x={cell.labelX}
                y={cell.labelY}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={cell.shape === 'rect' ? 12 : 11}
                fontWeight="bold"
                pointerEvents="none"
              >
                {cell.number}
              </text>
              {isStrategyHit && (
                <g pointerEvents="none">
                  <circle
                    cx={cell.labelX + (cell.shape === 'rect' ? 11 : 10)}
                    cy={cell.labelY - 8}
                    r={6.5}
                    fill="#00d4ff"
                    stroke="#000"
                    strokeWidth={0.5}
                  />
                  <text
                    x={cell.labelX + (cell.shape === 'rect' ? 11 : 10)}
                    y={cell.labelY - 8}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#000"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    ★
                  </text>
                </g>
              )}
              {isPredicted && !isStrategyHit && (
                <g pointerEvents="none">
                  <circle
                    cx={cell.labelX + (cell.shape === 'rect' ? 11 : 10)}
                    cy={cell.labelY - 8}
                    r={6.5}
                    fill="#c9a96e"
                    stroke="#000"
                    strokeWidth={0.5}
                  />
                  <text
                    x={cell.labelX + (cell.shape === 'rect' ? 11 : 10)}
                    y={cell.labelY - 8}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#000"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    {rank}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Section dividers (drawn over the inner area) */}
        {DIVIDERS.map((d, i) => (
          <line
            key={`div-${i}`}
            x1={d.x1}
            y1={d.y1}
            x2={d.x2}
            y2={d.y2}
            stroke="#ffffff"
            strokeWidth={1}
            opacity={0.85}
          />
        ))}

        {/* Section labels */}
        {LABELS.map((l) => (
          <text
            key={l.text}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize="13"
            fontWeight="700"
            letterSpacing="1.5"
            pointerEvents="none"
          >
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
};

export default Racetrack;
