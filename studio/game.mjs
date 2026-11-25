import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };

export async function serveGame(root) {
  root = await realpath(root);
  const allowed = /^(?:index\.html|icon(?:-maskable)?\.svg|manifest\.webmanifest|sw\.js|(?:src|content)\/[^.].*)$/;
  const server = createServer(async (req, res) => {
    try {
      const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html';
      if (!allowed.test(requested) || requested.split('/').some(part => part.startsWith('.'))) {
        res.writeHead(404).end();
        return;
      }
      const file = await realpath(join(root, requested));
      if (relative(root, file).startsWith('..') || !(await stat(file)).isFile()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { origin: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

export async function selectQuest(root, { quest: target, constellation, difficulty, size }) {
  const load = file => import(pathToFileURL(join(root, file)).href);
  const { canonicalQuestList } = await load('src/campaign/canonical-quests.js');
  const { createGameEngine } = await load('src/game/engine.js');
  const { currentCatalogueOrigin } = await load('src/campaign/catalogue-origin.js');
  const quests = canonicalQuestList();
  const simplify = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const tiers = { easy: 'facile', medium: 'intermediaire', hard: 'difficile', expert: 'expert' };
  const level = tiers[simplify(difficulty)] || simplify(difficulty);
  const matches = q => (!constellation || simplify(q.constellationId) === simplify(constellation)) &&
    (!level || simplify(q.difficulty?.label) === level) && (!size || q.size === size);
  const candidate = target ? quests.find(q => q.id === target || q.ordinal === Number(target)) :
    (constellation || level || size ? quests.find(q => q.legacyIndex !== null && q.ordinal > 2 && matches(q)) :
      quests.find(q => q.id === 'base-q006'));
  assert(candidate && candidate.ordinal > 2 && candidate.legacyIndex !== null && matches(candidate),
    'Choose an existing catalogue quest with a legacy grid, outside the two mandatory tutorial quests.');
  const progress = {
    solved: Object.fromEntries(quests.filter(q => q.ordinal < candidate.ordinal && q.legacyIndex !== null)
      .map(q => [q.legacyIndex, 1])),
    canonicalQuestState: Object.fromEntries(quests.filter(q => q.ordinal < candidate.ordinal && q.legacyIndex === null)
      .map(q => [q.id, { solved: true, stars: 1, badges: {} }])),
    badges: {},
    catalogueOrigin: currentCatalogueOrigin,
  };
  const board = { n: candidate.size, puz: candidate,
    state: Array.from({ length: candidate.size }, () => Array(candidate.size).fill(0)) };
  const engine = createGameEngine(() => board, () => false);
  const solutions = engine.solutions();
  assert.equal(solutions.length, 1, 'Selected grid must have exactly one solution');
  const solution = solutions[0];
  assert.deepEqual(solution, candidate.sol, 'The solver and audited catalogue must agree');
  const placements = [];
  for (let actions = 0; placements.length < board.n && actions < board.n * board.n; actions++) {
    const step = engine.proofEngine();
    if (step.kind === 'none') break;
    const [row, column] = step.cell;
    const value = step.kind === 'place' ? 2 : 1;
    assert.equal(column === solution[row], value === 2, 'The proof must agree with the solution');
    if (board.state[row][column] === value) break;
    board.state[row][column] = value;
    if (value === 2) placements.push({ row, column, reason: step.detail?.rule || 'proof' });
  }
  for (const [row, column] of solution.entries()) {
    if (!placements.some(p => p.row === row)) placements.push({ row, column, reason: 'unique solution' });
  }
  return { quest: candidate, progress, placements, solution };
}

export function planMoves({ quest, placements, solution }, shown) {
  const opening = placements.slice(0, -shown);
  const visible = [];
  const marked = new Set();
  const candidates = (p) => [...solution.keys()].filter(c => c !== solution[p.row])
    .sort((a, b) => Math.abs(a - p.column) - Math.abs(b - p.column));
  for (const p of placements.slice(-shown)) {
    const nearby = candidates(p).filter(c => !marked.has(p.row + ':' + c));
    for (const column of nearby.slice(0, 2)) {
      marked.add(p.row + ':' + column);
      visible.push({ row: p.row, column, value: 1, reason: 'excluded by audited solution' });
    }
    visible.push({ ...p, value: 2 });
  }
  const preparation = opening.flatMap(p => [
    ...candidates(p).slice(0, 2).map(column => ({ row: p.row, column, value: 1 })),
    { ...p, value: 2 },
  ]);
  assert(visible.every(({ row, column }) => row < quest.size && column < quest.size));
  return { preparation, visible };
}
