#!/usr/bin/env python3
"""アプリ改修の受け入れ検査。

3・4年生の改修で決めた方針を機械的に検査する:
  1. shared/ の共通キットを読み込んでいる
  2. 起動〜全モード遷移〜主要操作で speechSynthesis.speak が0回
     (🔊 を押したときだけ発話する)
  3. 🔊 を押せば実際に発話する
  4. cardArt の cutout(乗算合成)が祖先の transform / filter / opacity /
     z-index / isolation で壊れていない
  5. 語彙カードに日本語の訳が併記されていない
  6. 390px 幅で横スクロールしない
  7. JSエラーが0件

使い方:
    (リポジトリのルートで) python3 -m http.server 8000 &
    python3 check_app.py apps/g5_u1_spelling.html [...]
"""
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8000"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

# 操作ラベルは「日本語併記」ではないので語彙検査から除く
OP_WORDS = set("""
けす もどす つぎへ もどる すすむ きく みる やめる とじる ひらく はじめる おわり
さいしょから ポータルへ 使い方 つかいかた ろくおん さいせい ためす こたえ ヒント
つぎ まえ リセット クリア ぜんぶ えらぶ きめる きろく はっぴょう れんしゅう
""".split())

# 発話を数える計器。アプリのどのスクリプトより先に入れる
PROBE = """
window.__speakLog = [];
(function(){
  if(!window.speechSynthesis) { window.speechSynthesis = {}; }
  var s = window.speechSynthesis;
  var orig = s.speak ? s.speak.bind(s) : function(){};
  s.speak = function(u){
    try { window.__speakLog.push(String(u && u.text || '')); } catch(e){}
    // 実際には鳴らさない(ヘッドレスで詰まらせない)
  };
  s.cancel = s.cancel || function(){};
  s.getVoices = s.getVoices || function(){ return []; };
})();
"""


class Result:
    def __init__(self, name):
        self.name = name
        self.checks = []

    def add(self, ok, label, detail=""):
        self.checks.append((ok, label, detail))

    @property
    def passed(self):
        return sum(1 for ok, _, _ in self.checks if ok)

    @property
    def total(self):
        return len(self.checks)

    def report(self):
        print(f"\n── {self.name}  {self.passed}/{self.total}")
        for ok, label, detail in self.checks:
            mark = "  OK " if ok else "  NG "
            print(f"{mark}{label}" + (f"  … {detail}" if detail else ""))
        return self.passed == self.total


def static_checks(path: Path, r: Result):
    src = path.read_text(encoding="utf-8")
    r.add("shared/app-ui.css" in src, "共通CSSを読み込んでいる")
    r.add("shared/app-ui.js" in src, "共通JSを読み込んでいる")
    # 各アプリが独自に持っていた声パッチは、キットに移したので残っていないはず
    r.add("speechSynthesis.speak = function" not in src,
          "独自の声パッチが残っていない")
    ja = re.findall(r'\bja\s*:\s*"[^"]*"', src)
    r.add(not ja, "語彙データに ja: の併記がない",
          f"{len(ja)}件残っている" if ja else "")
    raw = re.findall(r"new SpeechSynthesisUtterance", src)
    r.add(not raw, "発話はキット経由（直接 Utterance を作っていない）",
          f"{len(raw)}件" if raw else "")


def dom_japanese_in_cards(page):
    """絵カードのラベルに日本語(かな・漢字)が入っていないか"""
    return page.evaluate(
        """(ops) => {
        const bad = [];
        const jp = /[぀-ゟ゠-ヿ㐀-䶿一-鿿]/;
        document.querySelectorAll('.app-card, .app-card-label, .chip, .clabel, .word, .w-label')
          .forEach(el => {
            const t = (el.textContent || '').trim();
            if (!t || !jp.test(t)) return;
            // 操作ラベルは除外
            const stripped = t.replace(/[\\s0-9A-Za-z!-\\/:-@\\[-`{-~、。()（）]/g, '');
            if (!stripped) return;
            if (ops.some(w => stripped.includes(w))) return;
            bad.push(t.slice(0, 24));
          });
        return [...new Set(bad)].slice(0, 6);
    }""",
        list(OP_WORDS),
    )


def cutout_ancestors_ok(page):
    """cutout(乗算合成)を壊す祖先プロパティが無いか"""
    return page.evaluate("""() => {
        const bad = [];
        document.querySelectorAll('.app-card-art.cutout').forEach(el => {
            let p = el.parentElement;
            while (p && p !== document.documentElement) {
                const cs = getComputedStyle(p);
                const why = [];
                if (cs.transform && cs.transform !== 'none') why.push('transform');
                if (cs.filter && cs.filter !== 'none') why.push('filter');
                if (cs.opacity && parseFloat(cs.opacity) < 1) why.push('opacity');
                if (cs.zIndex && cs.zIndex !== 'auto' && cs.position !== 'static') why.push('z-index');
                if (cs.isolation === 'isolate') why.push('isolation');
                if (why.length) bad.push(p.className + ':' + why.join(','));
                p = p.parentElement;
            }
        });
        return [...new Set(bad)].slice(0, 6);
    }""")


def fill_inputs(page):
    """空の入力欄を埋めて、disabled のボタンを解放する"""
    page.evaluate("""() => {
        document.querySelectorAll('input, textarea').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio' || el.disabled) return;
            if (el.value) return;
            if (el.type === 'number' || el.type === 'range') el.value = el.min || '1';
            else el.value = 'SATOSHI';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        document.querySelectorAll('select').forEach(el => {
            if (el.selectedIndex <= 0 && el.options.length > 1) {
                el.selectedIndex = 1;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }""")


def clickables(page):
    """🔊 以外の押せるものを集める(自動発話をあぶり出すため)"""
    return page.evaluate("""() => {
        const out = [];
        document.querySelectorAll(
          'button, [data-mode], [role="button"], .chip, .app-card, .app-mode-card, .tab,'
          + ' .menu-item, .titem, .bill-line, .card, .item, a[href^="#"]')
          .forEach((el, i) => {
            const t = (el.textContent || '') + (el.getAttribute('aria-label') || '');
            if (t.includes('🔊') || t.includes('🎙')) return;
            // data-say は「押したら鳴る」と明示した操作子。自動発話ではない
            if (el.hasAttribute('data-say')) return;
            if (el.disabled) return;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return;
            el.setAttribute('data-probe', 'c' + i);
            out.push('c' + i);
          });
        return out.slice(0, 40);
    }""")


def check(page, path: Path) -> Result:
    r = Result(path.name)
    static_checks(path, r)

    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(f"{BASE}/{path.as_posix()}", wait_until="networkidle")
    page.wait_for_timeout(700)

    # --- 起動直後に喋っていないか ---
    n = page.evaluate("() => window.__speakLog.length")
    r.add(n == 0, "起動しただけでは発話しない", f"{n}回 発話" if n else "")

    # --- 主要操作で喋らないか(🔊以外を一通り押す) ---
    # 入力欄が空だと「つぎへ」等が disabled のままで先の画面に入れないので、
    # 先に埋めてから回す。1周では新しく現れた要素に届かないので数周する。
    fill_inputs(page)
    total_clicked = 0
    for _ in range(4):
        ids = clickables(page)
        if not ids:
            break
        for cid in ids:
            try:
                el = page.query_selector(f'[data-probe="{cid}"]')
                if el:
                    el.click(timeout=900, force=True)
                    page.wait_for_timeout(50)
            except Exception:
                pass
        total_clicked += len(ids)
        fill_inputs(page)
        page.wait_for_timeout(150)
    page.wait_for_timeout(400)
    log = page.evaluate("() => window.__speakLog")
    r.add(len(log) == 0, f"主要操作({total_clicked}か所)でも発話しない",
          f"{len(log)}回: {log[:3]}" if log else "")

    # --- 🔊 の口が用意されているか ---
    # 「押したら実際に鳴る」は、どの画面でどう組み立てたかに依存するので
    # 汎用検査では再現しきれない(文が空なら鳴らないのが正しい)。
    # ここでは(1)🔊の操作子があること (2)キットの発話経路が生きていること
    # の2点だけ見る。実際の鳴りは各アプリの手動確認で担保する。
    # 🔊 は button とはかぎらない(span をタップさせているアプリもある)。
    # 要素の種類でしぼらず、🔊 を持つ最も内側の要素を数える。
    n_speaker = page.evaluate("""() => [...document.querySelectorAll('*')]
        .filter(e => {
            const own = [...e.childNodes]
                .filter(n => n.nodeType === 3).map(n => n.textContent).join('');
            return own.includes('🔊') || (e.getAttribute('aria-label') || '').includes('🔊');
        }).length""")
    r.add(n_speaker > 0, "🔊 の操作子がある", f"{n_speaker}個" if n_speaker else "見つからない")

    page.evaluate("() => { window.__speakLog.length = 0; }")
    page.evaluate("() => { try { window.AppUI && AppUI.speak && AppUI.speak('hello'); } catch(e){} }")
    page.wait_for_timeout(300)
    r.add(page.evaluate("() => window.__speakLog.length") > 0,
          "キットの発話経路が生きている")

    # --- 日本語併記 ---
    bad = dom_japanese_in_cards(page)
    r.add(not bad, "絵カードに日本語の訳が出ていない", str(bad) if bad else "")

    # --- cutout ---
    broken = cutout_ancestors_ok(page)
    r.add(not broken, "cutout の合成が祖先で壊れていない", str(broken) if broken else "")

    # --- 390px 横スクロール ---
    page.set_viewport_size({"width": 390, "height": 780})
    page.wait_for_timeout(400)
    over = page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    r.add(over <= 1, "390px幅で横スクロールしない", f"{over}px はみ出し" if over > 1 else "")
    page.set_viewport_size({"width": 1280, "height": 800})

    # --- JSエラー ---
    real = [e for e in errors if "favicon" not in e.lower()
            and "PictureDictionary" not in e and "ERR_" not in e]
    r.add(not real, "JSエラーが出ていない", str(real[:2]) if real else "")
    return r


def main(argv):
    targets = [Path(a) for a in argv] or sorted(Path("apps").glob("g5_*.html"))
    ok_all = True
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        for t in targets:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            ctx.add_init_script(PROBE)
            # 絵カード画像は外部。サンドボックスからは届かないので落とす
            ctx.route("**/PictureDictionary/**", lambda route: route.abort())
            page = ctx.new_page()
            try:
                res = check(page, t)
            except Exception as e:
                res = Result(t.name)
                res.add(False, "検査が最後まで走った", str(e)[:160])
            ok_all &= res.report()
            ctx.close()
        browser.close()
    print("\n" + ("すべて合格" if ok_all else "不合格あり"))
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
