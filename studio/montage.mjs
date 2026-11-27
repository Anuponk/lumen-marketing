import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scale, viewport } from './capture.mjs';

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
`;

export async function renderArtwork(browser, gameRoot, work, text) {
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
      card: night + '<div class="end"><img class="mark" src="' + icon + '"><div class="name">LUMEN</div><div class="flare"></div>' +
        '<div class="constellations">' + escape(text.constellations) + '</div><div class="free">' + escape(text.free) +
        '</div><div class="cta">' + escape(text.play) + '</div><div class="url">' + escape(text.url || 'lumen.nopuna.fr') +
        '</div></div>',
    };
    for (const [name, content] of Object.entries(designs)) {
      const skin=text.seasonal?.event?.skin;
      const seasonalStyle=skin?'.brand,.cta{color:'+skin.accent+'}.night{box-shadow:inset 0 0 0 4px '+skin.accent+'}':'';
      await page.setContent('<!doctype html><meta charset="utf-8"><style>' + styles + seasonalStyle + '</style>' + content);
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
  const targetWidth = 910, gameX = 57, gameY = 502;
  const top = Math.max(0, Math.floor(capture.board.y - 60));
  const bottom = Math.min(viewport.height, Math.ceil(capture.board.y + capture.board.height + 6));
  const factor = targetWidth / viewport.width;
  const victoryTop = (capture.victoryCropTop ?? 64) * scale;
  const victoryHeight = 1830 - victoryTop;
  // Keep the board during the game's completion glow, then frame the celestial reveal.
  const boardCut = Math.floor((capture.reveal - 0.12) * frameRate) / frameRate;
  const cut = Math.ceil((capture.reveal + 0.08) * frameRate) / frameRate;
  const input = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'video.ffconcat'];
  for (const name of ['background', 'hook', 'signature', 'card']) input.push('-loop', '1', '-framerate', '30', '-i', name + '.png');
  const filters = [
    '[0:v]fps=30,setsar=1,split=2[before][after]',
    '[before]trim=end=' + boardCut + ',tpad=stop_duration=' + (cut - boardCut + 0.1) +
      ':stop_mode=clone,crop=1080:' + ((bottom - top) * scale) + ':0:' + (top * scale) +
      ',scale=' + targetWidth + ':-2[play]',
    '[after]crop=1080:' + victoryHeight + ':0:' + victoryTop + ',scale=912:-2[win]',
    '[1:v][play]overlay=' + gameX + ':' + gameY + ":enable='lt(t," + cut + ")'[screen]",
    "[screen][2:v]overlay=0:0:enable='lt(t,3.0)'[intro]",
    "[intro][3:v]overlay=0:0:enable='gte(t,3.0)*lt(t," + cut + ")'[signature]",
  ];
  let game = '[signature]';
  if (options.finger) {
    input.push('-loop', '1', '-framerate', '30', '-i', options.finger);
    const hand = handTimeline(capture.gestures, gameX, gameY, factor, top);
    filters.push('[5:v]scale=290:-2,format=rgba[hand]');
    filters.push("[signature][hand]overlay=x='" + hand.x + "':y='" + hand.y +
      "':enable='between(t," + hand.from.toFixed(4) + ',' + hand.to.toFixed(4) + ")'[pointed]");
    game = '[pointed]';
  }
  filters.push(game + "[win]overlay=53:255:enable='gte(t," + cut + ")'[celebration]");
  filters.push("[celebration][4:v]overlay=0:0:enable='gte(t," + timeline.cardStarts + ")',scale=out_range=tv,format=yuv420p[out]");
  await writeFile(join(work, 'montage.ffmpeg'), filters.join(';\n'));
  const audio = options.music ? ['-stream_loop', '-1', '-i', options.music] : [];
  await run(ffmpeg, [...input, ...audio, '-filter_complex_threads', '2', '-/filter_complex', 'montage.ffmpeg',
    '-map', '[out]', ...(options.music ? ['-map', (options.finger ? '6' : '5') + ':a:0', '-c:a', 'aac', '-b:a', '160k',
      '-af', 'volume=0.34,afade=t=in:st=0:d=0.4,afade=t=out:st=' + (options.duration - 1.5) + ':d=1.5'] : ['-an']),
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
