// PR動画: 全セグメント録画スクリプト
const { chromium } = require('playwright');
const { setupRouting, attachOverlay, moveClick, caption, chip } = require('./common');
const fs = require('fs');
const path = require('path');

const SP = path.resolve(__dirname, '..');
const RAW = path.join(SP, 'out/raw');
const BASE = 'http://localhost:8000/';
fs.mkdirSync(RAW, { recursive: true });

const G = { g3: '#ffa502', g4: '#2ed573', g5: '#ff4757', g6: '#2e86de' };
const manifest = [];

async function smoothScroll(page, to, ms) {
  await page.evaluate(([to, ms]) => new Promise(res => {
    const from = window.scrollY, d = to - from, t0 = performance.now();
    const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    (function step(now) {
      const p = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, from + d * ease(p));
      p < 1 ? requestAnimationFrame(step) : res();
    })(t0);
  }), [to, ms]);
}

async function prep(page) {
  await page.addStyleTag({ content: '::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}html{scrollbar-width:none}' }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await attachOverlay(page);
}

let browser;
async function clip(name, fn) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
  });
  await setupRouting(context);
  const page = await context.newPage();
  const tPage = Date.now();
  let tMark = tPage;
  const mark = () => { tMark = Date.now(); };
  try {
    await fn(page, mark);
    const tEnd = Date.now();
    const video = page.video();
    await context.close();
    const vp = await video.path();
    const out = path.join(RAW, name + '.webm');
    fs.renameSync(vp, out);
    manifest.push({ name, file: out, offset: (tMark - tPage) / 1000, duration: (tEnd - tMark) / 1000 });
    console.log('clip ok:', name, 'offset', ((tMark - tPage) / 1000).toFixed(2), 'dur', ((tEnd - tMark) / 1000).toFixed(2));
  } catch (e) {
    await context.close().catch(() => {});
    console.log('CLIP FAIL:', name, e.message.split('\n')[0]);
    throw e;
  }
}

// ---- スライド(CSSアニメはロード時に始まるので mark はロード直後) ----
async function slide(name, url, sec) {
  await clip(name, async (page, mark) => {
    await page.goto(BASE + url, { waitUntil: 'load' });
    mark();
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(sec * 1000);
  });
}

// ---- アプリデモの共通前処理 ----
async function openApp(page, mark, rel, gradeKey, gradeLabel, capText) {
  await page.goto(BASE + rel, { waitUntil: 'load' });
  await page.waitForTimeout(700); // 画像フォールバック・フォント安定待ち
  await prep(page);
  await chip(page, gradeLabel, G[gradeKey]);
  await caption(page, capText, G[gradeKey]);
  mark();
  await page.waitForTimeout(600);
}

(async () => {
  browser = await chromium.launch();

  // 01-03 オープニング/思い
  await slide('01_op', '__slides/op.html', 6.5);
  await slide('02_msg1', '__slides/msg1.html', 7.0);
  await slide('03_msg2', '__slides/msg2.html', 7.5);

  // 04 ポータル全体ツアー (17s)
  await clip('04_portal', async (page, mark) => {
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await prep(page);
    await caption(page, '3〜6年生・全33アプリ|無料・インストール不要・Chromebook対応', '#00cec9');
    mark();
    await page.waitForTimeout(2400);                    // ヒーロー
    await smoothScroll(page, 620, 2600);                // featured + PDクイック
    await page.waitForTimeout(900);
    await smoothScroll(page, 1300, 2600);               // 3年生グリッドへ
    await page.waitForTimeout(900);
    await caption(page, '学年をえらぶと、その学年のアプリだけ表示', '#2e86de');
    await smoothScroll(page, 0, 1200);
    await moveClick(page, '.gnav-btn.g4', { moveWait: 700, afterWait: 900 });
    await moveClick(page, '.gnav-btn.g6', { moveWait: 600, afterWait: 900 });
    await moveClick(page, '.gnav-btn.all', { moveWait: 600, afterWait: 800 });
    await page.waitForTimeout(500);
  });

  // ============ 3年生 ============
  await slide('05_g3', '__slides/grade.html?g=g3', 2.6);

  await clip('06_g3_greetings', async (page, mark) => {
    await openApp(page, mark, 'apps/g3_u1_greetings.html', 'g3', '3年生|世界のあいさつ',
      '🌏 せかいのあいさつ図鑑 ― 国旗をタップして 世界のあいさつを聞こう');
    await moveClick(page, '[data-mode="zukan"]', { moveWait: 550, afterWait: 500 });
    await moveClick(page, '.flag-card >> nth=1', { moveWait: 600, afterWait: 700 });
    await moveClick(page, '#btn-d-speak', { moveWait: 600, afterWait: 500 });
    await page.waitForTimeout(1400);
  });

  await clip('07_g3_alphabet', async (page, mark) => {
    await openApp(page, mark, 'apps/g3_u6_alphabet.html', 'g3', '3年生|アルファベット',
      '🅰️ アルファベット大文字かるた ― 音を聞いて すばやくタップ!');
    await moveClick(page, '[data-mode="search"]', { moveWait: 550, afterWait: 700 });
    // お題の単語の頭文字を読んで正解カードをタップ
    let letter = 'A';
    try {
      const w = await page.locator('#search-word').innerText();
      const m = w.trim().match(/^([A-Za-z])/);
      if (m) letter = m[1].toUpperCase();
    } catch (e) {}
    await moveClick(page, `#board2 .karuta[data-l="${letter}"]`, { moveWait: 750, afterWait: 600 });
    await page.waitForTimeout(1500);
  });

  await clip('08_g3_survey', async (page, mark) => {
    await openApp(page, mark, 'apps/g3_u45_survey.html', 'g3', '3年生|すきなもの',
      '📊 すきなものアンケート ― I like 〜. でこたえて クラスのグラフに');
    await moveClick(page, '.num-btn[data-n="12"]', { moveWait: 550, afterWait: 600 });
    await moveClick(page, '.cat-card.c-food', { moveWait: 600, afterWait: 700 });
    await moveClick(page, '#btn-like', { moveWait: 650, afterWait: 600 });
    await page.waitForTimeout(1100);
  });

  // ============ 4年生 ============
  await slide('09_g4', '__slides/grade.html?g=g4', 2.6);

  await clip('10_g4_clock', async (page, mark) => {
    await openApp(page, mark, 'apps/g4_u4_clock.html', 'g4', '4年生|時こく',
      '🕐 なんじなにをする?時計アプリ ― What time is it?');
    await moveClick(page, '[data-mode="free"]', { moveWait: 550, afterWait: 800 });
    await moveClick(page, '#btn-pm', { moveWait: 650, afterWait: 700 });
    await moveClick(page, '#btn-speak', { moveWait: 600, afterWait: 500 });
    await page.waitForTimeout(1000);
  });

  await clip('11_g4_weather', async (page, mark) => {
    await openApp(page, mark, 'apps/g4_u2_weather.html', 'g4', '4年生|天気と服そう',
      '☀️ 天気&服装コーディネート ― How’s the weather?');
    await moveClick(page, '.w-card >> nth=0', { moveWait: 600, afterWait: 800 });
    await moveClick(page, '#item-grid > * >> nth=0', { moveWait: 550, afterWait: 450 });
    await moveClick(page, '#item-grid > * >> nth=3', { moveWait: 550, afterWait: 450 });
    await page.waitForTimeout(1100);
  });

  await clip('12_g4_pizza', async (page, mark) => {
    await openApp(page, mark, 'apps/g4_u7_juicepizza.html', 'g4', '4年生|たべもの',
      '🍕 オリジナルピザ作り ― What do you want?');
    await moveClick(page, '[data-mode="pizza"]', { moveWait: 500, afterWait: 500 });
    await moveClick(page, '.ing-card >> nth=0', { moveWait: 500, afterWait: 350 });
    await moveClick(page, '.ing-card >> nth=2', { moveWait: 450, afterWait: 350 });
    await moveClick(page, '#btn-finish', { moveWait: 500, afterWait: 400 });
    await page.waitForTimeout(1700); // やき上がりアニメ
  });

  // ============ 5年生 ============
  await slide('13_g5', '__slides/grade.html?g=g5', 2.6);

  await clip('14_g5_restaurant', async (page, mark) => {
    await openApp(page, mark, 'apps/g5_u6_restaurant.html', 'g5', '5年生|レストラン',
      '🍔 バーチャルレストラン注文 ― What would you like?');
    await moveClick(page, '[data-mode="order"]', { moveWait: 500, afterWait: 500 });
    await moveClick(page, '.menu-item >> nth=0', { moveWait: 550, afterWait: 400 });
    await moveClick(page, '.menu-item >> nth=5', { moveWait: 550, afterWait: 500 });
    await moveClick(page, '#btn-checkout', { moveWait: 600, afterWait: 500 });
    await page.waitForTimeout(1000);
  });

  await clip('15_g5_map', async (page, mark) => {
    await openApp(page, mark, 'apps/g5_u5_map.html', 'g5', '5年生|道案内',
      '🗺️ 道案内マップアプリ ― Go straight! Turn right!');
    await moveClick(page, '[data-mode="challenge"]', { moveWait: 500, afterWait: 500 });
    await moveClick(page, '[data-b="straight"]', { moveWait: 500, afterWait: 300 });
    await moveClick(page, '[data-b="straight"]', { moveWait: 350, afterWait: 300 });
    await moveClick(page, '[data-b="right"]', { moveWait: 400, afterWait: 300 });
    await moveClick(page, '#btn-run', { moveWait: 500, afterWait: 200 });
    await smoothScroll(page, 340, 900); // 歩くキャラクターを追う
    await page.waitForTimeout(1400);
  });

  await clip('16_smalltalk', async (page, mark) => {
    await openApp(page, mark, 'apps/smalltalk.html', 'g5', '5・6年生|帯活動',
      '💬 Small Talk トレーナー ― 話題ガチャ+モデル対話+トークタイマー');
    await moveClick(page, '#gacha', { moveWait: 650, afterWait: 900 });
    await smoothScroll(page, 260, 1200);
    await page.waitForTimeout(1600);
  });

  // ============ 6年生 ============
  await slide('17_g6', '__slides/grade.html?g=g6', 2.6);

  await clip('18_g6_foodchain', async (page, mark) => {
    await openApp(page, mark, 'apps/g6_u5_foodchain.html', 'g6', '6年生|食物連鎖',
      '🦈 食物連鎖クイズビルダー ― Sharks eat fish.');
    await moveClick(page, '[data-mode="build"]', { moveWait: 500, afterWait: 500 });
    await moveClick(page, '.creature.ok:not(.dim) >> nth=0', { moveWait: 550, afterWait: 400 });
    await moveClick(page, '.creature.ok:not(.dim) >> nth=0', { moveWait: 500, afterWait: 400 });
    await moveClick(page, '#btn-say', { moveWait: 550, afterWait: 400 });
    await page.waitForTimeout(1200);
  });

  await clip('19_g6_summer', async (page, mark) => {
    await openApp(page, mark, 'apps/g6_u4_summer.html', 'g6', '6年生|夏の思い出',
      '🏖️ サマーバケーション思い出マップ ― I went to the beach.');
    await moveClick(page, '#chips-place .chip >> nth=0', { moveWait: 500, afterWait: 300 });
    await moveClick(page, '#chips-act .chip >> nth=0', { moveWait: 450, afterWait: 300 });
    await moveClick(page, '#chips-food .chip >> nth=0', { moveWait: 450, afterWait: 300 });
    await moveClick(page, '#chips-feel .chip >> nth=0', { moveWait: 450, afterWait: 300 });
    await moveClick(page, '#btn-diary', { moveWait: 500, afterWait: 400 });
    await page.waitForTimeout(1300); // 英語の日記が完成
  });

  await clip('20_g6_memory', async (page, mark) => {
    await openApp(page, mark, 'apps/g6_u7_memory.html', 'g6', '6年生|思い出',
      '📔 ベストメモリーアルバム ― My best memory is 〜.');
    await moveClick(page, '.pick >> nth=1', { moveWait: 550, afterWait: 700 });
    await moveClick(page, '.chip >> nth=0', { moveWait: 550, afterWait: 500 });
    await moveClick(page, '.chip >> nth=2', { moveWait: 500, afterWait: 500 });
    await page.waitForTimeout(1100);
  });

  // ============ Picture Dictionary ============
  await clip('21_pd_intro', async (page, mark) => {
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await prep(page);
    await chip(page, 'Picture Dictionary', '#d35400');
    await caption(page, '📖 看板アプリ「Picture Dictionary 絵じてん」', '#fdcb6e');
    mark();
    await smoothScroll(page, 260, 1400);
    await moveClick(page, '.featured-card', { moveWait: 800, afterWait: 0, noClick: true });
    await page.waitForTimeout(1600);
    await caption(page, '学年をえらんで「学ぶ・練習・ゲーム」へ。単語バンクも', '#fdcb6e');
    await smoothScroll(page, 480, 1200);
    await moveClick(page, '.pdq-card.g3', { moveWait: 700, afterWait: 0, noClick: true });
    await moveClick(page, '.pdq-card.g5', { moveWait: 700, afterWait: 0, noClick: true });
    await moveClick(page, '.pdq-card.bank', { moveWait: 700, afterWait: 0, noClick: true });
    await page.waitForTimeout(900);
  });

  await slide('22_pdfeat', '__slides/pdfeat.html', 13);

  await clip('23_pd_cards', async (page, mark) => {
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await prep(page);
    await page.evaluate(() => document.querySelector('.material-sec').scrollIntoView({ block: 'center' }));
    await chip(page, 'Picture Dictionary', '#d35400');
    await caption(page, '🎴 絵カード859枚を けんさく・保存・ZIP一括ダウンロード', '#a29bfe');
    mark();
    await page.waitForTimeout(1200);
    await moveClick(page, '.material-sec a', { moveWait: 900, afterWait: 0, noClick: true });
    await page.waitForTimeout(1000);
    await caption(page, 'ワークシートやスライドづくりにも つかえます', '#a29bfe');
    await page.waitForTimeout(2400);
  });

  // 24 クロージング
  await slide('24_closing', '__slides/closing.html', 10.5);

  fs.writeFileSync(path.join(SP, 'out/manifest.json'), JSON.stringify(manifest, null, 2));
  const total = manifest.reduce((s, c) => s + c.duration, 0);
  console.log('TOTAL clips:', manifest.length, 'estimated video:', total.toFixed(1) + 's');
  await browser.close();
})();
