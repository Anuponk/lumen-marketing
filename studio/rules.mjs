import assert from 'node:assert/strict';

export const lesson = [
  { at: 0, title: 'Comment jouer à Lumen ?', detail: 'Place six Gardiens, représentés par des boucliers, sur cette grille 6 × 6.', focus: 'guardian' },
  { at: 4, title: 'Repère les territoires', detail: 'Un territoire est un groupe de cases de même couleur.', focus: 'territory' },
  { at: 8.5, title: 'Un Gardien par ligne', detail: 'Une ligne se lit de gauche à droite.', focus: 'row' },
  { at: 12.5, title: 'Un Gardien par colonne', detail: 'Une colonne se lit de haut en bas.', focus: 'column' },
  { at: 16.5, title: 'Un Gardien par territoire', detail: 'Un Gardien suffit pour tout le territoire surligné.', focus: 'territory' },
  { at: 20.5, title: 'Ils ne se touchent jamais', detail: 'Même en diagonale. Un appui marque cette case comme impossible.', focus: 'diagonal' },
  { at: 25.5, title: 'Annule le dernier geste', detail: 'Touche « Annuler » pour retirer la marque.', focus: 'undo' },
  { at: 29.5, title: 'Deux appuis pour placer', detail: 'Sur une case vide, le 1er appui affiche un cercle. Le 2e place le Gardien.', focus: 'placement' },
  { at: 34, title: 'Termine la grille', detail: 'Écarte les cases interdites. Le dernier placement correct déclenche la victoire.' },
];

export function planRules(selected, moves, timeline) {
  const { quest, solution } = selected;
  assert(quest.size === 6 && quest.difficulty.label === 'Facile', 'The rules lesson requires an easy 6 × 6 quest');
  const opening = moves.preparation.filter(move => move.value === 2);
  const placement = moves.visible.find(move => move.value === 2);
  const marked = new Set(moves.preparation.map(move => move.row + ':' + move.column));
  const region = ({ row, column }) => quest.reg[row][column];
  const candidates = opening.flatMap(guardian => [-1, 1].flatMap(dy => [-1, 1].map(dx => ({
    guardian, row: guardian.row + dy, column: guardian.column + dx,
  })))).filter(({ row, column }) => row >= 0 && row < 6 && column >= 0 && column < 6 &&
    column !== solution[row] && !marked.has(row + ':' + column));
  const neighbor = candidates.find(cell => opening.every(other =>
    other.row !== cell.row && other.column !== cell.column && region(other) !== region(cell))) ?? candidates[0];
  assert(neighbor, 'The lesson needs an unmarked diagonal neighbor of a Guardian');
  const followup = moves.visible.filter(move => move.row !== placement.row);
  const time = (seconds) => seconds * timeline.ratio;
  return {
    preparation: moves.preparation,
    visible: [
      { row: neighbor.row, column: neighbor.column, value: 1, at: time(23), reason: 'lesson-diagonal' },
      { action: 'undo', row: neighbor.row, column: neighbor.column, at: time(27.5), value: 0, reason: 'lesson-undo' },
      { ...placement, at: time(31.5), interval: 330, reason: 'lesson-place' },
      ...followup.map((move, index) => ({
        ...move, at: time(34.6 + (4.1 - (followup.length - 1 - index) * 0.82) / timeline.speed),
      })),
    ],
    visual: { example: opening[0], neighbor, placement, regions: quest.reg },
  };
}
