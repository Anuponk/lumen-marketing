import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scale, viewport } from './capture.mjs';
import { lesson, rulesText } from './rules.mjs';
import { writeAmbient } from './ambient.mjs';

const width = 1080, height = 1920, frameRate = 30;
const escape = value => String(value).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;',
  '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);

export async function run(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { ...options, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(out) : reject(Error(program + ' exited ' + code + ': ' + err.slice(-4000))));
  });
}

const styles = `
  *{box-sizing:border-box}
  html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#eefaff}
  .night{position:absolute;inset:0;background:
    radial-gradient(ellipse at 76% 17%,#123851 0%,transparent 44%),
    radial-gradient(ellipse at 42% 60%,#14223e 0%,transparent 59%),
    linear-gradient(169deg,#050e1c,#08182a 60%,#030812)}
  .stars{position:absolute;inset:0;pointer-events:none}
  .stars i{position:absolute;border-radius:50%;background:#bbebf8;box-shadow:0 0 15px #58c2fc85}
  .brand{color:#86d6ee;font-size:28px;font-weight:700;letter-spacing:13px;text-align:center;white-space:nowrap}
  .flare{height:2px;background:linear-gradient(90deg,transparent,#5895ac,transparent);margin:32px auto;width:60%}
  .hook{position:absolute;top:183px;left:72px;width:866px;text-align:center}
  .hook strong{display:block;font-size:78px;font-weight:650;line-height:1.08;letter-spacing:-2.7px;margin:34px 0 0;text-wrap:balance}
  .signature{position:absolute;top:217px;left:72px;width:866px;text-align:center;opacity:.8}
  .end{position:absolute;left:96px;top:384px;width:856px;text-align:center}
  .mark{width:231px;height:231px;display:block;margin:auto;filter:drop-shadow(0 0 33px #51c9ff45)}
  .name{font-size:107px;font-weight:700;letter-spacing:24px;padding-left:24px;line-height:1;margin:37px 0 19px}
  .constellations{font-size:44px;font-weight:450;letter-spacing:-.9px;margin:24px 0;color:#d2ebfb}
  .free{font-size:52px;font-weight:650;letter-spacing:-1.4px;margin:33px 0 91px;color:#ffdc86}
  .cta{display:inline-block;border-radius:80px;padding:24px 66px;background:#ffdf8d;color:#13223b;font-size:43px;font-weight:700;box-shadow:0 0 56px #f8d36b31}
  .url{font-size:34px;margin:36px 0 0;color:#b3d6e9;letter-spacing:2px}
  .rule-heading{position:absolute;top:152px;left:83px;width:864px;text-align:center}
  .rule-heading strong{display:block;font-size:66px;font-weight:710;line-height:1.05;letter-spacing:-2px;margin-top:23px}
  .rule-list{position:absolute;top:1257px;left:128px;width:774px;list-style:none;margin:0;padding:23px 26px;
    border:1px solid #396274;border-radius:26px;background:#0a192bec;display:grid;gap:8px}
  .rule-list li{display:flex;align-items:center;gap:15px;padding:8px 12px;border-radius:12px;
    color:#e1f3fc;font-size:38px;font-weight:580;letter-spacing:-.45px;line-height:1.18}
  .rule-list li.active{background:#254354;color:#ffdc90}
  .rule-list i{width:11px;height:11px;border-radius:9px;background:#83c7de;flex:none}
  .rule-list li.active i{background:#ffdc90}
  .lesson-end{top:286px}
  .lesson-end .mark{width:166px;height:166px}
  .lesson-end .name{font-size:86px}
  .lesson-end .free{margin-bottom:52px}

  .outline{position:absolute;border:3px solid #ffd982;border-radius:18px;background:#ffd98215}
  .outline.anchor{border-color:#92f3ff;box-shadow:inset 0 0 17px #67dcef8f;background:transparent}
`;

function boardLayout(capture) {
  const { board, lesson } = capture;
  const targetWidth = lesson ? 792 : 910;
  const gameX = lesson ? 117 : 57, gameY = lesson ? 403 : 502;
  const left = lesson ? Math.floor(board.x - 11) : 0;
  const sourceWidth = lesson ? Math.ceil(board.width + 22) : viewport.width;
  const factor = targetWidth / sourceWidth;
  return {
    targetWidth, gameX, gameY, left, sourceWidth, factor, offsetX: gameX - left * factor,
    top: Math.max(0, Math.floor(board.y - (lesson ? 8 : 60))),
    bottom: Math.min(viewport.height, Math.ceil(board.y + board.height + (lesson ? 8 : 6))),
  };
}

function rulesPanel(focus) {
  return '<ul class="rule-list">' + rulesText.map(([key, text]) =>
    '<li' + (key === focus ? ' class="active"' : '') + '><i></i>' + escape(text) + '</li>').join('') + '</ul>';
}

function lessonArtwork(beat, capture) {
  const { example, neighbor, regions, cells } = capture.lesson;
  const { offsetX, gameY, top, factor } = boardLayout(capture);
  const boxes = new Map();
  const box = (row, column, kind) => boxes.set(cells[row * capture.size + column], kind);
  if (beat.focus === 'row' || beat.focus === 'column' || beat.focus === 'territory') {
    for (const [row, values] of regions.entries()) {
      for (const [column, region] of values.entries()) {
        const hit = beat.focus === 'row' ? row === example.row : beat.focus === 'column' ? column === example.column :
          region === regions[example.row][example.column];
        if (hit) box(row, column, row === example.row && column === example.column ? 'anchor' : 'hint');
      }
    }
  }
  if (beat.focus === 'guardian') box(example.row, example.column, 'anchor');
  if (beat.focus === 'diagonal') {
    box(neighbor.guardian.row, neighbor.guardian.column, 'anchor');
    box(neighbor.row, neighbor.column, 'hint');
  }
  const outlines = [...boxes].map(([r, kind]) => '<div class="outline ' + kind + '" style="left:' +
    (offsetX + r.x * factor) + 'px;top:' + (gameY + (r.y - top) * factor) + 'px;width:' + (r.width * factor) +
    'px;height:' + (r.height * factor) + 'px"></div>').join('');
  return '<div class="rule-heading"><div class="brand">LUMEN</div><strong>Comment jouer à Lumen ?</strong></div>' +
    rulesPanel(beat.focus) + outlines;
}

export async function renderArtwork(browser, gameRoot, work, text, capture, timeline) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
    serviceWorkers: 'block' });
  try {
    await context.route('http*://**/*', route => route.abort());
    const page = await context.newPage();
    const icon = 'data:image/svg+xml;base64,' + (await readFile(join(gameRoot, 'icon.svg'))).toString('base64');
    const stars = Array.from({ length: 74 }, (_, i) => {
      const x = (i * 137 + i * i * 11 + 55) % width, y = (i * 211 + i * i * 31 + 34) % height;
      const diameter = i % 9 === 0 ? 4 : 2;
      return '<i style="left:' + x + 'px;top:' + y + 'px;width:' + diameter + 'px;height:' + diameter +
        'px;opacity:' + ((i % 7 + 2) / 16) + '"></i>';
    }).join('');
    const night = '<div class="night"></div><div class="stars">' + stars + '</div>';
    const designs = {
      background: night,
      hook: '<div class="hook"><div class="brand">LUMEN</div><strong>' + escape(text.hook) + '</strong></div>',
      signature: '<div class="signature"><div class="brand">LUMEN</div><div class="flare"></div></div>',
      card: night + '<div class="end' + (capture?.lesson ? ' lesson-end' : '') + '"><img class="mark" src="' + icon + '"><div class="name">LUMEN</div><div class="flare"></div>' +
        '<div class="constellations">' + escape(text.constellations) + '</div><div class="free">' + escape(text.free) +
        '</div><div class="cta">' + escape(text.play) + '</div><div class="url">' + escape(text.url || 'lumen.nopuna.fr') +
        '</div></div>',
    };
    if (capture?.lesson) {
      designs['rule-static'] = rulesPanel();
      for (const [index, beat] of lesson.entries()) designs['rule-' + index] = lessonArtwork(beat, capture);
      const stills = lesson.map((beat, index) => "file 'rule-" + index + ".png'\noption framerate 1000\nduration " +
        ((lesson[index + 1]?.at ?? (timeline.cardStarts / timeline.ratio)) * timeline.ratio -
          beat.at * timeline.ratio).toFixed(5));
      stills.push("file 'rule-" + (lesson.length - 1) + ".png'\noption framerate 1000");
      await writeFile(join(work, 'rules.ffconcat'), 'ffconcat version 1.0\n' + stills.join('\n') + '\n');
    }
    for (const [name, content] of Object.entries(designs)) {
      await page.setContent('<!doctype html><meta charset="utf-8"><style>' + styles + '</style>' + content);
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.screenshot({ path: join(work, name + '.png'), omitBackground: true });
    }
  } finally {
    await context.close();
  }
}

function handTimeline(gestures, x, y, factor, top) {
  const target = gesture => [Math.round(x + gesture.x * factor - 37), Math.round(y + (gesture.y - top) * factor - 15)];
  const points = [];
  const add = (t, base, dx, dy) => points.push([t, base[0] + dx, base[1] + dy]);
  const first = gestures[0], last = gestures.at(-1);
  add(first.at - 0.54, target(first), 220, 250);
  for (const [i, gesture] of gestures.entries()) {
    const base = target(gesture);
    const next = gestures[i + 1];
    add(gesture.at, base, 0, 0);
    if (!next) break;
    const duration = next.at - gesture.at;
    if (duration > 0.35) {
      add(gesture.at + Math.min(0.2, duration / 3), base, 24, 28);
      add(next.at - 0.20, target(next), 20, 21);
    } else {
      add(gesture.at + duration * 0.5, base, 7, 10);
    }
  }
  add(last.at + 0.49, target(last), 260, 280);
  const dimension = index => {
    let expr = String(points.at(-1)[index]);
    for (let k = points.length - 2; k >= 0; k--) {
      const a = points[k], b = points[k + 1], dt = Math.max(0.001, b[0] - a[0]);
      const p = 'clip((t-' + a[0].toFixed(4) + ')/' + dt.toFixed(4) + ',0,1)';
      const ease = '(' + p + '*' + p + '*(3-2*' + p + '))';
      expr = 'if(lt(t,' + b[0].toFixed(4) + '),' + a[index] + '+(' + (b[index] - a[index]) + ')*' + ease + ',' + expr + ')';
    }
    return expr;
  };
  return { x: dimension(1), y: dimension(2), from: points[0][0], to: points.at(-1)[0] };
}

export async function encode(ffmpeg, work, capture, timeline, options) {
  const frames = capture.frames.filter(f => f.time < timeline.cardStarts);
  const line = (f, i) => "file '" + f.file + "'\noption framerate 1000\nduration " +
    Math.max(0.001, (frames[i + 1]?.time ?? timeline.cardStarts) - f.time).toFixed(5);
  await writeFile(join(work, 'video.ffconcat'), 'ffconcat version 1.0\n' +
    frames.map(line).join('\n') + "\nfile '" + frames.at(-1).file + "'\noption framerate 1000\n");

  // The board keeps a margin on the right and above the platform UI.
  const { targetWidth, gameX, gameY, top, bottom, left, sourceWidth, offsetX, factor } = boardLayout(capture);
  const victoryTop = (capture.victoryCropTop ?? 64) * scale;
  const victoryHeight = 1830 - victoryTop;
  const victoryWidth = capture.lesson ? 720 : 912;
  const victoryX = capture.lesson ? 153 : 53, victoryY = capture.lesson ? 139 : 255;
  // Keep the board during the game's completion glow, then frame the celestial reveal.
  const boardCut = Math.floor((capture.reveal - 0.12) * frameRate) / frameRate;
  const cut = Math.ceil((capture.reveal + 0.08) * frameRate) / frameRate;
  const input = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'video.ffconcat'];
  for (const name of ['background', 'hook', 'signature', 'card']) input.push('-loop', '1', '-framerate', '30', '-i', name + '.png');
  const filters = [
    '[0:v]fps=30,scale=1080:1920:flags=lanczos,setsar=1,split=2[before][after]',
    '[before]trim=end=' + boardCut + ',tpad=stop_duration=' + (cut - boardCut + 0.1) +
      ':stop_mode=clone,crop=' + (sourceWidth * scale) + ':' + ((bottom - top) * scale) + ':' +
      (left * scale) + ':' + (top * scale) +
      ',scale=' + targetWidth + ':-2[play]',
    '[after]crop=1080:' + victoryHeight + ':0:' + victoryTop + ',scale=' + victoryWidth + ':-2[win]',
    '[1:v][play]overlay=' + gameX + ':' + gameY + ":enable='lt(t," + cut + ")'[screen]",

  ];
  let inputIndex = 5;
  if (capture.lesson) {
    input.push('-f', 'concat', '-safe', '0', '-i', 'rules.ffconcat');
    filters.push("[" + inputIndex++ + ":v]fps=30[rules]");
  } else {
    filters.push("[screen][2:v]overlay=0:0:enable='lt(t,3.0)'[intro]");
    filters.push("[intro][3:v]overlay=0:0:enable='gte(t,3.0)*lt(t," + cut + ")'[signature]");
  }
  let game = capture.lesson ? '[screen]' : '[signature]';
  if (options.finger) {
    input.push('-loop', '1', '-framerate', '30', '-i', options.finger);
    const hand = handTimeline(capture.gestures, offsetX, gameY, factor, top);
    const between = (from, to) => 'between(t,' + from.toFixed(4) + ',' + to.toFixed(4) + ')';
    const active = capture.lesson ? capture.gestures.map(({ at }) => between(at - 0.38, at + 0.43)).join('+') :
      between(hand.from, hand.to);
    filters.push('[' + inputIndex++ + ':v]scale=290:-2,format=rgba[hand]');
    filters.push(game + "[hand]overlay=x='" + hand.x + "':y='" + hand.y +
      "':enable='" + active + "'[pointed]");
    game = '[pointed]';
  }
  if (capture.lesson) {
    filters.push(game + "[rules]overlay=0:0:enable='lt(t," + cut + ")'[lesson]");
    game = '[lesson]';
  }
  filters.push(game + "[win]overlay=" + victoryX + ":" + victoryY + ":enable='gte(t," + cut + ")'[celebration]");
  filters.push("[celebration][4:v]overlay=0:0:enable='gte(t," + timeline.cardStarts + ")'[carded]");
  let final = '[carded]';
  if (capture.lesson) {
    input.push('-loop', '1', '-framerate', '30', '-i', 'rule-static.png');
    filters.push(final + '[' + inputIndex++ + ":v]overlay=0:0:enable='gte(t," + cut + ")'[withRules]");
    final = '[withRules]';
  }
  filters.push(final + 'scale=out_range=tv,format=yuv420p[out]');
  const music = options.music || (options.ambient ? join(work, 'ambient.wav') : null);
  if (options.ambient && !options.music) await writeAmbient(music, options.duration);
  const sources = [];
  if (music) {
    input.push('-stream_loop', '-1', '-i', music);
    filters.push('[' + inputIndex++ + ':a]volume=' + (options.voice ? '0.32' : (options.ambient ? '0.66' : '0.34')) +
      ',afade=t=in:st=0:d=0.4,afade=t=out:st=' + (options.duration - 1.5) + ':d=1.5[bed]');
    sources.push('[bed]');
  }
  if (options.voice) {
    input.push('-i', options.voice);
    filters.push('[' + inputIndex + ':a]atempo=' + (1 / timeline.ratio).toFixed(5) +
      ',highpass=f=85,aformat=channel_layouts=stereo,volume=0.86[voice]');
    sources.push('[voice]');
  }
  if (sources.length === 2) filters.push(sources.join('') + 'amix=inputs=2:normalize=0,alimiter=limit=0.92[sound]');
  await writeFile(join(work, 'montage.ffmpeg'), filters.join(';\n'));
  const sound = sources.length === 2 ? '[sound]' : sources[0];
  await run(ffmpeg, [...input, '-filter_complex_threads', '2', '-/filter_complex', 'montage.ffmpeg',
    '-map', '[out]', ...(sound ? ['-map', sound, '-c:a', 'aac', '-b:a', '160k'] : ['-an']),
    '-c:v', 'libx264', '-threads', '5', '-preset', 'veryfast', '-crf', '18', '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-r', String(frameRate), '-t', String(options.duration), '-movflags', '+faststart', options.output], { cwd: work });
}

export async function verify(ffprobe, file, duration, audioExpected) {
  const probe = JSON.parse(await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
  const video = probe.streams.find(stream => stream.codec_type === 'video');
  const audio = probe.streams.find(stream => stream.codec_type === 'audio');
  assert.equal(video.width, width);
  assert.equal(video.height, height);
  assert.equal(video.codec_name, 'h264');
  assert.equal(video.pix_fmt, 'yuv420p');
  assert.equal(video.avg_frame_rate, '30/1');
  assert(Math.abs(Number(probe.format.duration) - duration) <= 0.10, 'Encoded duration must match the request');
  assert.equal(audio?.codec_name, audioExpected ? 'aac' : undefined);
  return { duration: Number(probe.format.duration), width, height, fps: frameRate,
    video: video.codec_name, audio: audio?.codec_name ?? null, bytes: Number(probe.format.size) };
}
