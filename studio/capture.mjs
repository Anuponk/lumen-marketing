import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const viewport = { width: 360, height: 640 };
export const scale = 3;
export async function launchBrowser(executablePath) {
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true,
    args: ['--disable-background-networking', '--disable-component-update', '--mute-audio'] });
}

export async function captureGame(browser, origin, selected, moves, timeline, work, options) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: true,
    hasTouch: true, locale: options.lang, serviceWorkers: 'block' });
  const blocked = new Set();
  try {
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && ['GET', 'HEAD'].includes(route.request().method())) return route.continue();
      blocked.add(url.hostname);
      return route.abort();
    });
    await context.addInitScript(({ lang, progress }) => {
      localStorage.setItem('lumen.locale', lang);
      localStorage.setItem('lumenQaProgressV1', JSON.stringify(progress));
      for (const key of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen']) {
        localStorage.setItem(key, '1');
      }
      localStorage.setItem('lumenWelcomeDayV1', new Date().toLocaleDateString('en-CA'));
      localStorage.setItem('lumenInstallLater', String(Date.now()));
      localStorage.setItem('lumenPushChoice','later');
      localStorage.setItem('lumenSound','off');
    }, { lang: options.lang, progress: selected.progress });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.goto(origin + '/?qa=new', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.lumenDiagnostics && document.querySelectorAll('#board .cell').length > 0);
    await page.evaluate(index => {
      if (lumenDiagnostics.snapshot().levelIndex !== index) lumenDiagnostics.setupQuest(index);
    }, selected.quest.legacyIndex);
    for (const selector of ['#learningSkip','#learningCoachDismiss','#badgeUnlockOk','#autoCrossUnlockOk','#questGo','#attemptMask']) {
      const button = page.locator(selector);
      if (await button.isVisible()) await button.tap({ timeout: 3000 });
    }
    const shotState = () => page.evaluate(() => {
      const { n, levelIndex, puz, state, celebrated } = lumenDiagnostics.snapshot();
      return { n, levelIndex, reg: puz.reg, state, celebrated, lang: document.documentElement.lang };
    });
    const initial = await shotState();
    assert.equal(initial.lang, options.lang);
    assert.deepEqual(initial.reg, selected.quest.reg);
    assert(!initial.celebrated && initial.state.every(row => row.every(v => v === 0)), 'Start with a real empty grid');

    const gestures = [];
    let started, captureOn = false;
    const locatorPoint = async (locator) => {
      const box = await locator.boundingBox();
      if (!box) throw Error('Touch target lost its layout');
      const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
      await locator.evaluate((element, { x, y }) => {
        if (!element.contains(document.elementFromPoint(x, y))) throw Error('An overlay intercepts the tap');
      }, { x, y });
      return { x, y };
    };
    const cellPoint = ({ row, column }) => locatorPoint(page.locator('#board .cell').nth(row * initial.n + column));
    async function playMove(move, point = null) {
      const { row, column, value } = move;
      const { x, y } = point ?? await cellPoint(move);
      let before = (await shotState()).state[row][column];
      while (before !== value) {
        const at = captureOn ? (performance.now() - started) / 1000 : null;
        await page.touchscreen.tap(x, y);
        const actual = (await shotState()).state[row][column];
        assert.equal(actual, (before + 1) % 3, 'A true touch must advance the game cell state');
        if (captureOn) gestures.push({ at, x, y, row, column, state: actual, reason: move.reason });
        before = actual;
        if (before !== value) await delay(move.interval ?? 155);
      }
    }
    for (const move of moves.preparation) await playMove(move);
    const board = await page.locator('#board').boundingBox();
    const lesson = moves.visual && { ...moves.visual,
      cells: await page.locator('#board .cell').evaluateAll(cells => cells.map(cell => {
        const { x, y, width, height } = cell.getBoundingClientRect();
        return { x, y, width, height };
      })) };
    const qaBanner = await page.locator('.qa-banner').boundingBox();
    const victoryCropTop = Math.ceil((qaBanner?.y ?? 0) + (qaBanner?.height ?? 0)) + 1;
    const beforeCapture = await shotState();
    assert.equal(beforeCapture.state.flat().filter(v => v === 2).length, selected.quest.size - timeline.visibleGuardians);
    await mkdir(join(work, 'frames'));
    const firstFrame = 'frames/000000.jpg';
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: true, deviceScaleFactor: scale,
      screenWidth: viewport.width, screenHeight: viewport.height });
    const { visualViewport } = await session.send('Page.getLayoutMetrics');
    const clip = { x: visualViewport.pageX, y: visualViewport.pageY, ...viewport,
      scale: visualViewport.scale * (lesson ? 2 / scale : 1) };
    const screenshot = () => session.send('Page.captureScreenshot', {
      format: 'jpeg', quality: lesson ? 92 : 94, optimizeForSpeed: Boolean(lesson), captureBeyondViewport: false, clip,
    });
    const initialImage = await screenshot();
    await writeFile(join(work, firstFrame), Buffer.from(initialImage.data, 'base64'));
    const frames = [{ time: 0, file: firstFrame }];
    const record = async () => {
      while (captureOn && (performance.now() - started) / 1000 < timeline.cardStarts) {
        const timestamp = performance.now();
        const { data } = await screenshot();
        const time = (timestamp - started) / 1000;
        if (time > 0.001) {
          const file = 'frames/' + String(frames.length).padStart(6, '0') + '.jpg';
          await writeFile(join(work, file), Buffer.from(data, 'base64'));
          frames.push({ time, file });
        }
        await delay(Math.max(0, 1000 / 30 - (performance.now() - timestamp)));
      }
    };
    started = performance.now();
    captureOn = true;
    const recording = record().then(() => null, error => error);
    const sleepUntil = t => delay(Math.max(0, t * 1000 - (performance.now() - started)));
    for (const [i, move] of moves.visible.entries()) {
      const t = move.at ?? (timeline.start + (timeline.finalTap - timeline.start) * i / (moves.visible.length - 1));
      await sleepUntil(t);
      await playMove(move);
    }
    await page.waitForFunction(() => lumenDiagnostics.snapshot().celebrated, null, { timeout: 4000 });
    const ended = (performance.now() - started) / 1000;
    await page.waitForFunction(() => !document.getElementById('skyReveal').hidden, null, { timeout: 4500 });
    const reveal = (performance.now() - started) / 1000;
    const final = await shotState();
    assert.deepEqual(final.state.map(row => row.indexOf(2)), selected.solution);
    assert(final.state.every(row => row.filter(v => v === 2).length === 1));
    await sleepUntil(timeline.cardStarts);
    captureOn = false;
    const recordingError = await recording;
    if (recordingError) throw recordingError;
    const minFramesPerSecond = lesson ? 5.5 : 7;
    const maxGap = Math.max(...frames.slice(1).map((frame, index) => frame.time - frames[index].time));
    assert(frames.length >= timeline.cardStarts * minFramesPerSecond && (!lesson || maxGap < 1.1),
      'The recording must preserve the timing of the real animation (' + frames.length +
      ' frames, longest gap ' + maxGap.toFixed(2) + 's)');
    assert(reveal < timeline.cardStarts - 0.8, 'The real victory must be visible before the end card');
    assert.deepEqual(runtimeErrors, [], 'The game must render without script errors');
    const results = { language: options.lang, quest: selected.quest.id, size: selected.quest.size,
      board, lesson, victoryCropTop, startedGuardians: beforeCapture.state.flat().filter(v => v === 2).length,
      gestures, frames, ended, reveal, blockedHosts: [...blocked],
      victoryText: await page.locator('#skyRevealTitle').textContent() };
    await writeFile(join(work, 'capture.json'), JSON.stringify(results, null, 2));
    return results;
  } finally {
    await context.close();
  }
}
