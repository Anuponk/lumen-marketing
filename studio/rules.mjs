import assert from 'node:assert/strict';

export const rulesText = [
  ['row', '1 Gardien par ligne'],
  ['column', '1 Gardien par colonne'],
  ['territory', '1 Gardien par territoire'],
  ['diagonal', 'Jamais côte à côte, même en diagonale'],
];

export const lesson = [
  { at: 0, focus: 'guardian' },
  { at: 4, focus: 'row' },
  { at: 8, focus: 'column' },
  { at: 12, focus: 'territory' },
  { at: 16, focus: 'diagonal' },
  { at: 21 },
];

export function planRules(selected, moves, timeline) {
  const { quest, solution } = selected;
  assert(quest.size === 6 && quest.difficulty.label === 'Facile', 'The rules lesson requires an easy 6 × 6 quest');
  const opening = moves.preparation.filter(move => move.value === 2);
  const marked = new Set(moves.preparation.map(move => move.row + ':' + move.column));
  const region = ({ row, column }) => quest.reg[row][column];
  const candidates = opening.flatMap(guardian => [-1, 1].flatMap(dy => [-1, 1].map(dx => ({
    guardian, row: guardian.row + dy, column: guardian.column + dx,
  })))).filter(({ row, column }) => row >= 0 && row < 6 && column >= 0 && column < 6 &&
    column !== solution[row] && !marked.has(row + ':' + column));
  const neighbor = candidates.find(cell => opening.every(other =>
    other.row !== cell.row && other.column !== cell.column && region(other) !== region(cell))) ?? candidates[0];
  assert(neighbor, 'The lesson needs an unmarked diagonal neighbor of a Guardian');
  const finish = moves.visible.filter(move => move.row !== neighbor.row || move.column !== neighbor.column);
  return {
    preparation: moves.preparation,
    visible: [
      { row: neighbor.row, column: neighbor.column, value: 1, at: 18 * timeline.ratio, reason: 'lesson-diagonal' },
      ...finish.map((move, index) => ({
        ...move, at: (28.5 - (finish.length - 1 - index) * 0.84 / timeline.speed) * timeline.ratio,
      })),
    ],
    visual: { example: opening[0], neighbor, regions: quest.reg },
  };
}
