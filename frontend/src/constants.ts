/**
 * Frontend constants for the realistic roulette board.
 * Defines wheel order, sectors, number colors, betting table layout, and theme colors.
 */

/**
 * European roulette wheel number sequence (physical order on the wheel).
 * 37 numbers: 0-36 arranged as they appear clockwise on a European wheel.
 */
export const EUROPEAN_WHEEL_ORDER: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11,
  30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26,
];

/**
 * Traditional wheel sectors defined by consecutive numbers on the physical wheel.
 * - Voisins du Zéro: 17 numbers surrounding zero
 * - Tiers du Cylindre: 12 numbers on the opposite side of the wheel from zero
 * - Orphelins: 8 numbers not covered by Voisins or Tiers (split into two groups on the wheel)
 */
export const SECTORS = {
  voisins: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
  tiers: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
  orphelins: [17, 34, 6, 1, 20, 14, 31, 9],
};

/**
 * Set of red numbers on a European roulette wheel.
 * All other numbers 1-36 not in this set are black. Zero is green.
 */
export const RED_NUMBERS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

/**
 * Betting table grid layout: 3 rows × 12 columns.
 * Row 1 (top): multiples of 3
 * Row 2 (middle): numbers where n % 3 === 2
 * Row 3 (bottom): numbers where n % 3 === 1
 */
export const BETTING_TABLE_ROWS: number[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], // row 1 (top)
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], // row 2 (middle)
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34], // row 3 (bottom)
];

/**
 * Dark theme color palette for the roulette interface.
 */
export const COLORS = {
  tableBackground: '#16213e',
  cellBorder: '#0f3460',
  red: '#c0392b',
  black: '#2c3e50',
  green: '#27ae60',
  gold: '#ffd700',
  accent: '#e94560',
};

/**
 * Returns the color for a given roulette number.
 * @param n - A number from 0 to 36
 * @returns 'green' for 0, 'red' for red numbers, 'black' for black numbers
 */
export function getNumberColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}
