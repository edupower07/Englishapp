// Picture Dictionary 機能紹介動画: 全セグメント録画
// デモクリップは manifest の speed:1.5 で後段の build_pd.py が1.5倍速化する
const { chromium } = require('playwright');
const { setupRouting, attachOverlay, moveClick, moveClickHandle, caption, chip } = require('./common');
const fs = require('fs');
const path = require('path');

const SP = path.resolve(__dirname, '..');
const RAW = path.join(SP, 'out/pd_raw');
const PD = 'http://localhost:8001/index.html';
fs.mkdirSync(RAW, { recursive: true });

const ORANGE = '#d35400', TEAL = '#00cec9', PURPLE = '#6c5ce7', PINK = '#e84393';
const manifest = [];
let browser;

async function clip(name, speed, fn) {
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
    await fn(page, mark, context);
    const tEnd = Date.now();
    const video = page.video();
    await context.close();
    const vp = await video.path();
    const out = path.join(RAW, name + '.webm');
    fs.renameSync(vp, out);
    manifest.push({ name, file: out, offset: (tMark - tPage) / 1000, duration: (tEnd - tMark) / 1000, speed });
    console.log('clip ok:', name, 'dur', ((tEnd - tMark) / 1000).toFixed(2), 'speed', speed);
  } catch (e) {
    await context.close().catch(() => {});
    console.log('CLIP FAIL:', name, e.message.split('\n')[0]);
    throw e;
  }
}

async function prep(page) {
  await page.addStyleTag({ content: '::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}html{scrollbar-width:none}' }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await attachOverlay(page);
  // speak() をフックして最後に読み上げた単語を記録(正解タップ用)
  await page.evaluate(() => {
    if (window.speak && !window.__speakHooked) {
      const orig = window.speak;
      window.__speakHooked = true;
      window.__spoken = null;
      window.speak = (w, ...rest) => { window.__spoken = w; try { return orig(w, ...rest); } catch (e) {} };
    }
  });
}

// 疑似カーソルを動かして JSクリック(Playwrightのアクション待ちを完全回避。モーダル内・再描画される要素に)
async function jsTap(page, fn, arg, opts = {}) {
  const handle = await page.evaluateHandle(fn, arg);
  const el = handle.asElement();
  if (!el) return false;
  const box = await el.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate(([x, y]) => window.__pv && window.__pv.move(x, y), [x, y]);
  await page.waitForTimeout(opts.moveWait ?? 350);
  await page.evaluate(([x, y]) => window.__pv && window.__pv.ripple(x, y), [x, y]);
  await page.evaluate((el) => { el.click(); }, el);
  if (opts.dbl) { await page.waitForTimeout(110); await page.evaluate((el) => { el.click(); }, el); }
  await page.waitForTimeout(opts.afterWait ?? 250);
  return true;
}

// 直前に読み上げられた単語の正解カードを、辞書で word→img 解決してクリック
async function clickCorrect(page, cardSelector, opts = {}) {
  const handle = await page.evaluateHandle((sel) => {
    const word = window.__spoken;
    if (!word) return null;
    let img = null;
    for (const cat of Object.values(window.dictionary || {})) {
      for (const it of cat.items) {
        const p = window.parseItem(it);
        if (p.word === word) { img = p.img; break; }
      }
      if (img) break;
    }
    const cards = [...document.querySelectorAll(sel)];
    return cards.find(c => {
      const el = c.querySelector('img');
      return el && img && decodeURIComponent(el.getAttribute('src')) === decodeURIComponent(img);
    }) || cards[0];
  }, cardSelector);
  const el = handle.asElement();
  if (el) await moveClickHandle(page, el, opts);
}

async function openPD(page, mark, capText, capColor, chipText) {
  await page.goto(PD, { waitUntil: 'load' });
  await page.waitForTimeout(900); // 画像・フォント安定待ち
  await prep(page);
  if (chipText) await chip(page, chipText, '#2d3436');
  await caption(page, capText, capColor);
  mark();
  await page.waitForTimeout(700);
}

// 3年生ホームまで進める(録画対象外の下準備ではなく、見せ場に含めたい時は mark 前後で調整)
async function toGrade3(page) {
  await moveClick(page, '.grade-btn.g3', { moveWait: 500, afterWait: 700 });
}

(async () => {
  browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });

  // ---- 01 オープニング(等速) ----
  await clip('pd01_op', 1.0, async (page, mark) => {
    await page.goto('http://localhost:8001/__slides/pd_op.html', { waitUntil: 'load' });
    mark();
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(5000);
  });

  // ---- 02 トップ画面 → 学年をえらぶ ----
  await clip('pd02_top', 1.5, async (page, mark) => {
    await openPD(page, mark, '📖 学年をえらんでスタート ― 絵カード860枚以上・音声つき', ORANGE, 'Picture Dictionary');
    await page.waitForTimeout(1600);
    await moveClick(page, '.grade-btn.g3', { moveWait: 900, afterWait: 900 });
    await caption(page, '「学ぶ・練習・ゲーム」の3モード × 単元べつカテゴリー', TEAL);
    await page.waitForTimeout(2600);
    // カテゴリ一覧を少し見せる
    await page.evaluate(() => window.scrollTo({ top: 320, behavior: 'smooth' }));
    await page.waitForTimeout(1800);
  });

  // ---- 03 学ぶ(Study) ----
  await clip('pd03_study', 1.5, async (page, mark) => {
    await openPD(page, mark, '📚 学ぶ ― カードをタップすると 発音が聞ける', TEAL, '学ぶ Study');
    await toGrade3(page);
    // 動物・体カテゴリ(8番目)
    await moveClick(page, '#category-list .cat-card >> nth=7', { moveWait: 700, afterWait: 800 });
    await moveClick(page, '#card-area .word-card >> nth=1', { moveWait: 700, afterWait: 700 });   // cat タップ=音声
    await caption(page, '🐢 ゆっくり音声 / ♥ 単語バンクに登録', TEAL);
    const slow = page.locator('#card-area .word-card >> nth=1').locator('.slow-btn-mini');
    await moveClickHandle(page, await slow.elementHandle(), { moveWait: 600, afterWait: 600 });
    const heart = page.locator('#card-area .word-card >> nth=1').locator('.heart-btn');
    await moveClickHandle(page, await heart.elementHandle(), { moveWait: 550, afterWait: 550 });
    // 🎤 発音練習(ろくおん → じぶんの声)※モーダル内はJSクリックで確実に
    await caption(page, '🎤 発音練習 ― ろくおんして じぶんの声をチェック', PINK);
    const mic = page.locator('#card-area .word-card >> nth=0').locator('.rec-btn-mini');
    await moveClickHandle(page, await mic.elementHandle(), { moveWait: 600, afterWait: 800 });
    await jsTap(page, () => document.getElementById('btn-record'), null, { moveWait: 500, afterWait: 1600 }); // ろくおん
    await jsTap(page, () => document.getElementById('btn-record'), null, { moveWait: 250, afterWait: 700 });  // とめる
    await jsTap(page, () => document.getElementById('btn-play-my'), null, { moveWait: 400, afterWait: 1100 });
    await jsTap(page, () => document.querySelector('.close-modal-btn'), null, { moveWait: 350, afterWait: 500 });
    await page.waitForTimeout(500);
  });

  // ---- 04 練習(Practice / Quiz) ----
  await clip('pd04_practice', 1.5, async (page, mark) => {
    await openPD(page, mark, '✏️ 練習 ― 音声を聞いて えらぶクイズ(全10問)', '#0984e3', '練習 Practice');
    await toGrade3(page);
    await moveClick(page, '#t-practice', { moveWait: 600, afterWait: 600 });
    await moveClick(page, '#category-list .cat-card >> nth=1', { moveWait: 600, afterWait: 700 }); // 気持ち
    await caption(page, 'レベルは Easy(4たく) / Hard(6たく)', '#0984e3');
    await moveClick(page, '#quiz-level-select .big-option-btn >> nth=1', { moveWait: 800, afterWait: 1100 }); // Hard
    // 2問正解する(読み上げ→正解タップ)
    for (let i = 0; i < 2; i++) {
      await page.waitForTimeout(900);
      await clickCorrect(page, '#card-area .quiz-card', { moveWait: 800, afterWait: 900 });
      await page.waitForTimeout(900);
    }
    await caption(page, '⭕むけて10問 ― さいごに スコア発表!', '#0984e3');
    await page.waitForTimeout(1200);
  });

  // ---- 05 ゲーム① かるた ----
  await clip('pd05_karuta', 1.5, async (page, mark) => {
    await openPD(page, mark, '🎮 ゲーム① Speed Karuta ― 聞こえた単語をすばやくタップ!', PURPLE, 'ゲーム|かるた');
    await toGrade3(page);
    await moveClick(page, '#t-game', { moveWait: 500, afterWait: 500 });
    await moveClick(page, '#category-list .cat-card >> nth=4', { moveWait: 500, afterWait: 600 }); // 食べ物・スポーツ
    await moveClick(page, '#game-type-select .big-option-btn >> nth=0', { moveWait: 550, afterWait: 1500 }); // Karuta
    for (let i = 0; i < 2; i++) {
      await page.waitForTimeout(1100);
      await clickCorrect(page, '#card-area .game-card', { moveWait: 700, afterWait: 500 });
    }
    await caption(page, 'タイムを競って ランキング(Top5)に記録', PURPLE);
    await page.waitForTimeout(1400);
  });

  // ---- 06 ゲーム② 神経衰弱 ----
  await clip('pd06_memory', 1.5, async (page, mark) => {
    await openPD(page, mark, '🎮 ゲーム② Memory ― 2〜4人であそべる 神経衰弱', PURPLE, 'ゲーム|神経衰弱');
    await toGrade3(page);
    await moveClick(page, '#t-game', { moveWait: 450, afterWait: 450 });
    await moveClick(page, '#category-list .cat-card >> nth=7', { moveWait: 500, afterWait: 550 });
    await moveClick(page, '#game-type-select .big-option-btn >> nth=1', { moveWait: 500, afterWait: 550 }); // Memory
    await moveClick(page, '.player-btn >> nth=0', { moveWait: 550, afterWait: 900 }); // 2人
    await moveClick(page, '.memory-card >> nth=2', { moveWait: 600, afterWait: 500 });
    await moveClick(page, '.memory-card >> nth=9', { moveWait: 550, afterWait: 900 });
    await moveClick(page, '.memory-card >> nth=5', { moveWait: 600, afterWait: 500 });
    await moveClick(page, '.memory-card >> nth=12', { moveWait: 550, afterWait: 900 });
    await page.waitForTimeout(700);
  });

  // ---- 07 ゲーム③ スペル ----
  await clip('pd07_spelling', 1.5, async (page, mark) => {
    await openPD(page, mark, '🎮 ゲーム③ Spelling ― 文字をならべて つづりをマスター', PURPLE, 'ゲーム|スペル');
    await toGrade3(page);
    await moveClick(page, '#t-game', { moveWait: 450, afterWait: 450 });
    await moveClick(page, '#category-list .cat-card >> nth=7', { moveWait: 500, afterWait: 550 }); // 動物
    await moveClick(page, '#game-type-select .big-option-btn >> nth=2', { moveWait: 500, afterWait: 1000 }); // Spelling
    // 💡ヒントで絵を見せてから、文字プールが見えるようにスクロールし、正しい文字を順にタップ
    await jsTap(page, () => document.querySelector('.btn-hint-reveal'), null, { moveWait: 500, afterWait: 500 });
    await page.evaluate(() => window.scrollTo({ top: 170, behavior: 'smooth' }));
    await page.waitForTimeout(600);
    const word = await page.evaluate(() => (window.__spoken || '').replace(/\s+/g, '').toLowerCase());
    for (const ch of word.slice(0, 8)) {
      await jsTap(page, (ch) => [...document.querySelectorAll('#spell-pool .spell-char:not(.used)')].find(b => b.innerText.trim().toLowerCase() === ch), ch, { moveWait: 380, afterWait: 240 });
    }
    await caption(page, '💡ヒント / 🐢ゆっくり音声 つきで 安心', PURPLE);
    await page.waitForTimeout(1700);
  });

  // ---- 08 ゲーム④ ビンゴ ----
  await clip('pd08_bingo', 1.5, async (page, mark) => {
    await openPD(page, mark, '🎮 ゲーム④ BINGO ― 自分だけのビンゴカードを作ってあそぶ', PURPLE, 'ゲーム|ビンゴ');
    await toGrade3(page);
    await moveClick(page, '#t-game', { moveWait: 450, afterWait: 450 });
    await moveClick(page, '#category-list .cat-card >> nth=3', { moveWait: 500, afterWait: 550 }); // 色
    await moveClick(page, '#game-type-select .big-option-btn >> nth=3', { moveWait: 500, afterWait: 550 }); // BINGO
    await moveClick(page, '#bingo-size-select .nav-btn >> nth=0', { moveWait: 500, afterWait: 700 }); // 3x3
    // 「まだ使われていない」カードをタップ→マスをタップ で9マス埋める(配置済みカードは used クラスでプールに残る)
    for (let i = 0; i < 9; i++) {
      await jsTap(page, () => document.querySelector('#bingo-pool .pool-card:not(.used)'), null, { moveWait: 230, afterWait: 90 });
      await jsTap(page, (i) => document.querySelectorAll('#bingo-grid .bingo-cell')[i], i, { moveWait: 210, afterWait: 90 });
    }
    await page.waitForTimeout(500);
    await jsTap(page, () => document.getElementById('btn-bingo-start'), null, { moveWait: 550, afterWait: 1000 });
    await caption(page, '先生の読み上げに合わせて ダブルタップで ○!', PURPLE);
    for (const idx of [0, 1, 2]) {
      await jsTap(page, (i) => document.querySelectorAll('#bingo-grid .bingo-cell')[i], idx, { moveWait: 480, afterWait: 450, dbl: true });
    }
    await page.waitForTimeout(2000); // BINGO演出
  });

  // ---- 09 単語バンク ----
  await clip('pd09_bank', 1.5, async (page, mark, context) => {
    await context.addInitScript(() => {
      localStorage.setItem('myWordBank', JSON.stringify(['cat', 'dog', 'elephant', 'pizza', 'happy', 'rainbow', 'soccer', 'Monday']));
    });
    await openPD(page, mark, '📒 My Word Bank ― ♥でためた 自分だけの単語帳', ORANGE, '単語バンク');
    await moveClick(page, '.bank-entry-btn', { moveWait: 700, afterWait: 800 });
    await moveClick(page, '.bank-action-btn.check', { moveWait: 650, afterWait: 1000 }); // かくにん
    await caption(page, 'かくにん・せいり・フラッシュカード特訓(20問)', ORANGE);
    await page.waitForTimeout(1200);
    await moveClick(page, '#back-btn', { moveWait: 550, afterWait: 600 });
    await moveClick(page, '.bank-action-btn.flash', { moveWait: 600, afterWait: 900 }); // 特訓
    await moveClick(page, '.btn-got-it', { moveWait: 700, afterWait: 700 });   // ⭕覚えた
    await moveClick(page, '.btn-not-yet', { moveWait: 600, afterWait: 700 });  // 🔺もう少し
    await moveClick(page, '.btn-got-it', { moveWait: 600, afterWait: 700 });
    await caption(page, '「もう少し」の単語だけ もう一度挑戦できる', ORANGE);
    await page.waitForTimeout(1000);
  });

  // ---- 10 My Speech ----
  await clip('pd10_speech', 1.5, async (page, mark) => {
    await openPD(page, mark, '🎤 My Speech ― 英語の文をつくって 発表の練習', PURPLE, 'My Speech');
    await moveClick(page, '.speech-entry-btn', { moveWait: 700, afterWait: 800 });
    await moveClick(page, '.speech-menu-actions .btn-add-sentence', { moveWait: 650, afterWait: 800 }); // ぶんをつくる
    await caption(page, '① 文のかたち → ② ことば をえらぶだけ', PURPLE);
    await moveClick(page, '#speech-tpl-grid > * >> nth=1', { moveWait: 700, afterWait: 800 }); // I like ___.
    // 3年生 → Food & Sports → 自然な文になる単語を選ぶ(カテゴリチップは英語表記)
    await jsTap(page, () => [...document.querySelectorAll('#speech-picker-grades > *')].find(c => c.textContent.includes('3')) || document.querySelector('#speech-picker-grades > *'), null, { moveWait: 550, afterWait: 650 });
    await jsTap(page, () => [...document.querySelectorAll('#speech-picker-cats > *')].find(c => /food/i.test(c.textContent)) || document.querySelector('#speech-picker-cats > *'), null, { moveWait: 550, afterWait: 650 });
    await jsTap(page, () => [...document.querySelectorAll('#speech-word-grid > *')].find(c => c.textContent.trim().toLowerCase().includes('pizza')) || document.querySelector('#speech-word-grid > *'), null, { moveWait: 650, afterWait: 750 });
    await moveClick(page, '#btn-speech-save', { moveWait: 650, afterWait: 600 }); // きめる
    await page.waitForTimeout(2100); // 「ついかしたよ!」の演出が消えるまで
    await caption(page, '▲▼で じゅんばんをならべて、はっぴょうモードへ', PURPLE);
    await page.waitForTimeout(900);
    await moveClick(page, '#btn-present', { moveWait: 800, afterWait: 1400 }); // はっぴょうする
    await jsTap(page, () => document.querySelector('.present-speak'), null, { moveWait: 600, afterWait: 1000 });
    await page.waitForTimeout(1500);
  });

  // ---- 11 絵カードライブラリ(ポータル側) ----
  await clip('pd11_cards', 1.5, async (page, mark) => {
    await page.goto('http://localhost:8000/cards.html', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await prep(page);
    await chip(page, '絵カードライブラリ', '#6c5ce7');
    await caption(page, '🎴 絵カード859枚は 検索して保存・ZIP一括DLも(ポータルから)', '#a29bfe');
    mark();
    await page.waitForTimeout(1400);
    await moveClick(page, '#q', { moveWait: 650, afterWait: 300 });
    await page.keyboard.type('cat', { delay: 260 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo({ top: 240, behavior: 'smooth' }));
    await caption(page, 'ワークシートやスライドづくりに そのまま使えます', '#a29bfe');
    await page.waitForTimeout(2200);
  });

  // ---- 12 クロージング(等速) ----
  await clip('pd12_close', 1.0, async (page, mark) => {
    await page.goto('http://localhost:8001/__slides/pd_close.html', { waitUntil: 'load' });
    mark();
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(8500);
  });

  fs.writeFileSync(path.join(SP, 'out/manifest_pd.json'), JSON.stringify(manifest, null, 2));
  const total = manifest.reduce((s, c) => s + c.duration / c.speed, 0);
  console.log('TOTAL clips:', manifest.length, 'estimated final video:', total.toFixed(1) + 's');
  await browser.close();
})();
