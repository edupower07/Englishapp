// 共通: フォント差し込み・外部遮断・カーソル/キャプション演出
const fs = require('fs');
const path = require('path');

const SP = path.resolve(__dirname, '..');
const NM = path.join(SP, 'node_modules');
const MP = path.join(NM, '@fontsource/m-plus-rounded-1c');
const FO = path.join(NM, '@fontsource/fredoka-one');

function buildFontCss() {
  // M PLUS Rounded 1c 500/700/800 (japanese + latin) と Fredoka One 400 を
  // 同一オリジンの /__fonts/ 配下を指す @font-face にまとめる
  let css = '';
  const add = (pkgDir, cssFile) => {
    const p = path.join(pkgDir, cssFile);
    if (!fs.existsSync(p)) return;
    css += fs.readFileSync(p, 'utf8').replace(/url\(\.\/files\//g, 'url(http://localhost:8000/__fonts/') + '\n';
  };
  for (const w of [500, 700, 800]) {
    add(MP, `japanese-${w}.css`);
    add(MP, `latin-${w}.css`);
  }
  add(FO, 'latin-400.css');
  add(FO, '400.css');
  return css;
}
const FONT_CSS = buildFontCss();

async function setupRouting(context) {
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      // 同一オリジンのフォント/スライド仮想パスをローカルファイルで応答
      if (u.pathname.startsWith('/__fonts/')) {
        const f = decodeURIComponent(u.pathname.replace('/__fonts/', ''));
        for (const dir of [path.join(MP, 'files'), path.join(FO, 'files')]) {
          const fp = path.join(dir, f);
          if (fs.existsSync(fp)) {
            return route.fulfill({
              status: 200, contentType: 'font/woff2', body: fs.readFileSync(fp),
              headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'font/woff2' }
            });
          }
        }
        return route.fulfill({ status: 404, body: 'nf' });
      }
      if (u.pathname.startsWith('/__slides/')) {
        const f = path.join(SP, 'slides', path.basename(u.pathname));
        if (fs.existsSync(f)) {
          const ct = f.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8';
          return route.fulfill({ status: 200, contentType: ct, body: fs.readFileSync(f) });
        }
        return route.fulfill({ status: 404, body: 'nf' });
      }
      return route.continue();
    }
    if (u.hostname === 'fonts.googleapis.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS });
    }
    // PictureDictionary の絵カード画像はローカルのクローンから応答(クローンがある場合)
    if (u.hostname === 'edupower07.github.io' && u.pathname.includes('/PictureDictionary/images/')) {
      const PD_DIR = process.env.PD_DIR || '/workspace/picturedictionary';
      const f = path.join(PD_DIR, 'images', decodeURIComponent(u.pathname.split('/images/')[1]));
      if (fs.existsSync(f)) {
        return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(f) });
      }
      return route.abort();
    }
    // それ以外の外部は遮断 → アプリは絵文字フォールバック
    return route.abort();
  });
}

// ページ内演出: 疑似カーソルとキャプションバー
const OVERLAY_JS = `
(() => {
  if (window.__pv) return;
  const cur = document.createElement('div');
  cur.id = '__pv_cursor';
  cur.style.cssText = 'position:fixed;z-index:999999;width:26px;height:26px;border-radius:50%;' +
    'background:rgba(255,118,117,.85);border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);' +
    'pointer-events:none;left:-60px;top:-60px;transform:translate(-50%,-50%);transition:left .55s cubic-bezier(.22,.61,.36,1),top .55s cubic-bezier(.22,.61,.36,1);';
  document.body.appendChild(cur);
  const cap = document.createElement('div');
  cap.id = '__pv_caption';
  cap.style.cssText = 'position:fixed;z-index:999998;left:50%;bottom:26px;transform:translateX(-50%) translateY(140%);' +
    "max-width:92%;background:rgba(255,255,255,.97);border:4px solid #00cec9;border-radius:50px;" +
    "padding:10px 28px;font-family:'M PLUS Rounded 1c',sans-serif;font-weight:800;font-size:22px;color:#2d3436;" +
    'box-shadow:0 8px 24px rgba(0,0,0,.22);white-space:nowrap;transition:transform .45s cubic-bezier(.22,.61,.36,1);text-align:center;';
  document.body.appendChild(cap);
  const chip = document.createElement('div');
  chip.id = '__pv_chip';
  chip.style.cssText = 'position:fixed;z-index:999998;left:16px;top:72px;display:none;transform:translateY(-420%);' +
    "background:#2d3436;color:#fff;border-radius:50px;padding:7px 20px;font-family:'M PLUS Rounded 1c',sans-serif;" +
    'font-weight:800;font-size:17px;box-shadow:0 6px 18px rgba(0,0,0,.3);transition:transform .4s ease;';
  document.body.appendChild(chip);
  window.__pv = {
    move(x, y) { cur.style.left = x + 'px'; cur.style.top = y + 'px'; },
    ripple(x, y) {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:999997;left:' + x + 'px;top:' + y + 'px;width:14px;height:14px;' +
        'border-radius:50%;border:4px solid #ff7675;transform:translate(-50%,-50%);pointer-events:none;opacity:1;';
      document.body.appendChild(r);
      r.animate([
        { width: '14px', height: '14px', opacity: 1 },
        { width: '90px', height: '90px', opacity: 0 }
      ], { duration: 520, easing: 'ease-out' }).onfinish = () => r.remove();
    },
    caption(text, color) {
      if (!text) { cap.style.transform = 'translateX(-50%) translateY(140%)'; return; }
      cap.textContent = text;
      if (color) cap.style.borderColor = color;
      cap.style.transform = 'translateX(-50%) translateY(0)';
    },
    chip(text, bg) {
      if (!text) { chip.style.display = 'none'; chip.style.transform = 'translateY(-420%)'; return; }
      chip.textContent = text;
      if (bg) chip.style.background = bg;
      chip.style.display = '';
      requestAnimationFrame(() => { chip.style.transform = 'translateY(0)'; });
    },
    hideCursor() { cur.style.display = 'none'; },
    showCursor() { cur.style.display = ''; }
  };
})();`;

async function attachOverlay(page) {
  await page.evaluate(OVERLAY_JS);
}

async function moveClick(page, selector, opts = {}) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2 + (opts.dx || 0);
  const y = box.y + box.height / 2 + (opts.dy || 0);
  await page.evaluate(([x, y]) => window.__pv && window.__pv.move(x, y), [x, y]);
  await page.waitForTimeout(opts.moveWait ?? 650);
  if (!opts.noClick) {
    await page.evaluate(([x, y]) => window.__pv && window.__pv.ripple(x, y), [x, y]);
    await el.click({ force: true, timeout: 1500 }).catch(async () => { await page.mouse.click(x, y); });
  }
  await page.waitForTimeout(opts.afterWait ?? 450);
  return true;
}

// ElementHandle / Locator を疑似カーソルつきでクリック
async function moveClickHandle(page, handle, opts = {}) {
  const box = await handle.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2 + (opts.dx || 0);
  const y = box.y + box.height / 2 + (opts.dy || 0);
  await page.evaluate(([x, y]) => window.__pv && window.__pv.move(x, y), [x, y]);
  await page.waitForTimeout(opts.moveWait ?? 650);
  if (!opts.noClick) {
    await page.evaluate(([x, y]) => window.__pv && window.__pv.ripple(x, y), [x, y]);
    if (opts.dblclick) { await handle.dblclick({ force: true, timeout: 1500 }).catch(async () => { await page.mouse.dblclick(x, y); }); }
    else { await handle.click({ force: true, timeout: 1500 }).catch(async () => { await page.mouse.click(x, y); }); }
  }
  await page.waitForTimeout(opts.afterWait ?? 450);
  return true;
}

async function caption(page, text, color) {
  await page.evaluate(([t, c]) => window.__pv && window.__pv.caption(t, c), [text, color || null]);
}
async function chip(page, text, bg) {
  await page.evaluate(([t, b]) => window.__pv && window.__pv.chip(t, b), [text, bg || null]);
}

module.exports = { setupRouting, attachOverlay, moveClick, moveClickHandle, caption, chip, OVERLAY_JS };
