import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { selectQuest, planMoves, serveGame } from './game.mjs';
import { captureGame, launchBrowser } from './capture.mjs';
import { copy, scenarios } from './scenarios.mjs';
import { encode, renderArtwork, run, verify } from './montage.mjs';

import {seasonalArtwork} from './seasonal.mjs';

const studio = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(await readFile(join(studio, 'source.json'), 'utf8'));
const strings = ['lang', 'scenario', 'duration', 'quest', 'constellation', 'difficulty', 'size', 'speed',
  'copy', 'output', 'music', 'game', 'sha', 'chrome', 'ffmpeg', 'ffprobe','date'];
const { values } = parseArgs({ options: { ...Object.fromEntries(strings.map(name => [name, { type: 'string' }])),
  'no-finger': { type: 'boolean' }, 'keep-capture': { type: 'boolean' }, help: { type: 'boolean' } } });
if (values.help) {
  console.log('npm run video:generate -- --lang fr --scenario gameplay --duration 24 [--game PATH] [--output FILE]');
  console.log('Options: --quest ID|NUMBER, --constellation ID, --difficulty LEVEL, --size N, --speed 0.7–1.25, --copy JSON, --music FILE, --no-finger, --keep-capture, --sha HASH, --chrome PATH, --ffmpeg PATH, --ffprobe PATH');
} else {
  await main();
}

async function main() {
  const lang = values.lang || 'fr', scenario = values.scenario || 'gameplay';
  assert(Object.hasOwn(copy, lang) && Object.hasOwn(scenarios, scenario), 'Unsupported language or scenario');
  const duration = Number(values.duration ?? 24), speed = Number(values.speed ?? 1);
  assert(duration >= 20 && duration <= 25 && Number.isInteger(duration), 'Duration must be 20–25 whole seconds');
  assert(speed >= 0.7 && speed <= 1.25, 'Speed must be between 0.7 and 1.25');
  const scale = duration / 24;
  const timeline = { ...scenarios[scenario] };
  timeline.cardStarts *= scale;
  timeline.finalTap *= scale;
  timeline.start = timeline.finalTap - (scenarios[scenario].finalTap - scenarios[scenario].start) * scale / speed;
  timeline.start = Math.max(3.23, timeline.start);
  const gameRoot = resolve(values.game || process.env.LUMEN_GAME_ROOT || join(studio, '..', '..', 'lumen-video-game-reference'));
  const sha = (await run('git', ['rev-parse', 'HEAD'], { cwd: gameRoot })).trim();
  assert.equal(sha, values.sha || spec.sha, 'The game checkout must match the pinned source SHA');
  assert.equal((await run('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: gameRoot })).trim(), '',
    'Use a clean source checkout');
  const ffmpeg = values.ffmpeg || process.env.FFMPEG || 'ffmpeg', ffprobe = values.ffprobe || process.env.FFPROBE || 'ffprobe';
  const chrome = values.chrome || process.env.CHROME_PATH || await chromePath();
  const output = resolve(values.output || 'output/lumen-gameplay-trailer-' + lang + '.mp4');
  assert(/\.mp4$/i.test(output), 'The output must have an .mp4 extension');
  const finger = values['no-finger'] ? null : join(studio, '..', 'assets', 'hand.png');
  const text = { ...copy[lang], ...(values.copy ? JSON.parse(await readFile(values.copy, 'utf8')) : {}) };
  const seasonal=await seasonalArtwork(gameRoot,values.date,lang);
  if(seasonal?.event){
   text.hook=seasonal.title+' · '+seasonal.previewLabel;
   text.play=seasonal.title+' · '+seasonal.previewLabel;
   text.url='lumen.nopuna.fr/d/'+seasonal.day+'/';
   text.seasonal=seasonal;
  }
  const options = { lang, duration, output, finger, music: values.music ? resolve(values.music) : null };
  await Promise.all([run(ffmpeg, ['-version']), run(ffprobe, ['-version']), finger ? access(finger) : null]);
  const selected = await selectQuest(gameRoot, { ...values, size: Number(values.size) });
  const moves = planMoves(selected, timeline.visibleGuardians);
  const work = await mkdtemp(join(tmpdir(), 'lumen-capture-'));
  const server = await serveGame(gameRoot);
  let browser;
  try {
    browser = await launchBrowser(chrome);
    console.log('Capture ' + lang + ' · ' + selected.quest.id + ' · ' + sha.slice(0, 8));
    const capture = await captureGame(browser, server.origin, selected, moves, timeline, work, options);
    console.log(capture.frames.length + ' actual frames · ' + capture.gestures.length + ' touches · victory at ' + capture.reveal.toFixed(2) + ' s');
    await renderArtwork(browser, gameRoot, work, text);
    await mkdir(dirname(output), { recursive: true });
    await encode(ffmpeg, work, capture, timeline, options);
    const proof = await verify(ffprobe, output, duration, !!options.music);
    const report = { ...proof, gameSha: sha, eventId: seasonal?.event?.id??null, creativeDay: seasonal?.day??null, scenario, language: lang, quest: selected.quest.id,
      constellation: selected.quest.constellationId, boardSize: selected.quest.size, boardDifficulty: selected.quest.difficulty.label,
      startedGuardians: capture.startedGuardians, touchCount: capture.gestures.length, capturedFrames: capture.frames.length,
      victorySeconds: capture.reveal, victoryTitle: capture.victoryText, externalRequestsAllowed: 0 };
    await writeFile(output.replace(/\.mp4$/i, '.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output, ...report }, null, 2));
  } finally {
    await browser?.close();
    await server.close();
    if (values['keep-capture']) console.log('Capture retained in ' + work);
    else await rm(work, { recursive: true, force: true });
  }
}

async function chromePath() {
  const candidates = process.platform === 'win32' ? [
    join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  ] : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] :
    ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
  for (const file of candidates) {
    if (!isAbsolute(file)) continue;
    try { await access(file, constants.X_OK); return file; } catch {}
  }
  throw Error('Chromium missing. Supply --chrome PATH or CHROME_PATH.');
}
