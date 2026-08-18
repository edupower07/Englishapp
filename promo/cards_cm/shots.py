#!/usr/bin/env python3
"""絵カードライブラリCM用のスクリーンショットを実画面から撮る。

- ポータル(index.html)と絵カードライブラリ(cards.html)をローカル配信して撮影する
- Google Fonts は Chromium から直接取れないので、fetch_fonts.py で取得済みの
  woff2 をルート差し替えで流し込む(これをしないとポータルのUIが代替フォントで焼かれる)
- 絵カード画像は PictureDictionary のローカルクローンから差し込む
  (GitHub Pages はサンドボックスから到達できないため)
- 併せて manifest.json に要素の座標を書き出す。Remotion 側はこの座標を使って
  スクロール・入力・タップの動きを毎フレーム合成する

使い方:
    (リポジトリのルートで) python3 -m http.server 8000 &
    python3 shots.py
"""
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
FONTS = HERE / "fonts"
OUT = HERE / "remotion" / "public" / "shots"
CARDS_OUT = HERE / "remotion" / "public" / "cards"
PD_DIR = Path(os.environ.get("PD_DIR", "/workspace/picturedictionary"))
BASE = "http://localhost:8000"

VW, VH = 1280, 720
# 動画側でボタンやリンクに寄る(最大1.6倍)ので、等倍の2倍だと解像度が足りない。
# 3倍で撮って寄りに耐えるようにする。
DSF = 3
# 検索の前後で画面のフレーミングが変わらないよう、同じスクロール位置で撮る
LIB_SCROLL = 104

# CMで見せる検索(曜日カードが一式ヒットする)とタップするカード
SEARCH_TERM = "day"
TAP_CARD = "Monday"

# フックと締めで降らせる絵カード(実物から見栄えのするものを選定)
HOOK_CARDS = [
    "apple.jpg", "cat.jpg", "dog.jpg", "sunny.jpg", "rainbow.jpg", "pizza.jpg",
    "soccer.jpg", "cake.jpg", "elephant.jpg", "strawberry.jpg", "banana.jpg",
    "umbrella.jpg", "penguin.jpg", "rabbit.jpg", "panda.jpg", "ice cream.jpg",
    "hamburger.jpg", "sushi.jpg", "lion.jpg", "dolphin.jpg", "grapes.jpg",
    "watermelon.jpg", "snowy.jpg", "star.jpg", "flower.jpg", "bus stop.jpg",
    "doctor.jpg", "teacher.jpg", "guitar.jpg", "notebook.jpg",
]


def build_font_css() -> str:
    """取得済み fonts.css を、同一オリジンの /__fonts/ を指す形にまとめる。"""
    css = ""
    for d in sorted(FONTS.iterdir()):
        f = d / "fonts.css"
        if f.exists():
            css += re.sub(r"url\(([^)]+\.woff2)\)", rf"url({BASE}/__fonts/{d.name}/\1)",
                          f.read_text(encoding="utf-8")) + "\n"
    return css


FONT_CSS = build_font_css()


def setup_routes(context):
    def handler(route):
        url = route.request.url
        # 同一オリジンの仮想パス: フォント実体
        if url.startswith(f"{BASE}/__fonts/"):
            rel = url[len(f"{BASE}/__fonts/"):]
            fp = FONTS / rel
            if fp.exists():
                return route.fulfill(status=200, body=fp.read_bytes(),
                                     headers={"Content-Type": "font/woff2",
                                              "Access-Control-Allow-Origin": "*"})
            return route.fulfill(status=404, body="nf")
        if url.startswith(BASE):
            return route.continue_()
        # Google Fonts はローカルの @font-face に差し替え
        if "fonts.googleapis.com" in url:
            return route.fulfill(status=200, content_type="text/css", body=FONT_CSS)
        if "fonts.gstatic.com" in url:
            return route.abort()
        # 絵カード画像はローカルクローンから
        if "edupower07.github.io" in url and "/PictureDictionary/images/" in url:
            from urllib.parse import unquote
            name = unquote(url.split("/images/", 1)[1].split("?")[0])
            fp = PD_DIR / "images" / name
            if fp.exists():
                return route.fulfill(status=200, body=fp.read_bytes(),
                                     content_type="image/jpeg")
            return route.abort()
        return route.abort()

    context.route("**/*", handler)


def settle(page, ms=900):
    """フォント・画像の読み込みを待ってから撮る(pitfalls 4番: 測ってすぐ撮る)。"""
    page.evaluate("""() => {
        document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; });
    }""")
    page.wait_for_timeout(ms)
    page.evaluate("() => document.fonts.ready")
    page.wait_for_function("""() => {
        const im = [...document.querySelectorAll('img')];
        return im.every(i => !i.src || i.complete);
    }""", timeout=60000)
    page.wait_for_timeout(350)


def rect(page, selector):
    el = page.wait_for_selector(selector, state="visible", timeout=30000)
    box = el.bounding_box()
    sy = page.evaluate("() => window.scrollY")
    sx = page.evaluate("() => window.scrollX")
    # bounding_box はビューポート基準なので、ページ絶対座標に直す
    return {"x": box["x"] + sx, "y": box["y"] + sy,
            "w": box["width"], "h": box["height"]}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    CARDS_OUT.mkdir(parents=True, exist_ok=True)
    man = {"vw": VW, "vh": VH, "dsf": DSF}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
        ctx = browser.new_context(viewport={"width": VW, "height": VH},
                                  device_scale_factor=DSF)
        setup_routes(ctx)
        page = ctx.new_page()

        # ---- 1. ポータル(index.html) 全景 ----
        page.goto(f"{BASE}/index.html", wait_until="networkidle")
        page.wait_for_function(
            "() => document.querySelectorAll('#sections .app-card, #sections a').length > 0",
            timeout=30000)
        settle(page)
        man["portal_h"] = page.evaluate("() => document.documentElement.scrollHeight")
        man["portal_material"] = rect(page, ".material-sec")
        man["portal_btn"] = rect(page, '.material-sec a[href="cards.html"]')
        page.screenshot(path=str(OUT / "portal_full.png"), full_page=True)
        print("portal_full.png", man["portal_h"], man["portal_btn"])

        # ---- 2. 絵カードライブラリ(cards.html) ----
        page.goto(f"{BASE}/cards.html", wait_until="networkidle")
        page.wait_for_selector(".card", state="visible", timeout=30000)
        # 「もっと見る」を押してカードの壁を厚くする(CMで見せる“ずらり”のため)
        for _ in range(2):
            page.click("#btn-more")
            page.wait_for_timeout(400)
        settle(page, 1500)
        man["lib_h"] = page.evaluate("() => document.documentElement.scrollHeight")
        man["lib_search"] = rect(page, "#q")
        man["lib_zip"] = rect(page, '.intro a[href*="main.zip"]')
        man["lib_intro"] = rect(page, ".intro")
        man["lib_count"] = page.inner_text("#count")
        page.screenshot(path=str(OUT / "library_full.png"), full_page=True)
        print("library_full.png", man["lib_h"], man["lib_count"])

        # ---- 2b. 検索する直前の状態(ビューポート撮り) ----
        # 全ページ撮りでは sticky ヘッダーがページ先頭に写るため、検索後のカットと
        # 画面上端がズレる。同じスクロール位置のビューポート撮りをそろえて用意する。
        page.evaluate(f"() => window.scrollTo(0, {LIB_SCROLL})")
        page.wait_for_timeout(400)
        settle(page, 600)
        man["lib_scroll_pre"] = page.evaluate("() => Math.round(window.scrollY)")
        page.screenshot(path=str(OUT / "library_pre.png"))
        print("library_pre.png at scrollY", man["lib_scroll_pre"])

        # ---- 3. 検索して絞り込んだ状態 ----
        # 「day」= 曜日カードが一式出るので、ワークシートづくりの実感が伝わる
        page.fill("#q", SEARCH_TERM)
        page.wait_for_timeout(600)
        page.evaluate(f"() => window.scrollTo(0, {LIB_SCROLL})")
        page.wait_for_timeout(300)
        settle(page, 900)
        man["lib_scroll_search"] = page.evaluate("() => Math.round(window.scrollY)")
        man["lib_first_card"] = rect(page, ".gallery .card:first-child")
        # タップして見せるカード(Monday)の座標
        el = page.locator(".gallery .card", has=page.locator(
            f'.name:text-is("{TAP_CARD}")')).first
        el.wait_for(state="visible", timeout=30000)
        b = el.bounding_box()
        man["lib_tap_card"] = {"x": b["x"], "y": b["y"], "w": b["width"], "h": b["height"]}
        man["lib_count_search"] = page.inner_text("#count")
        man["search_term"] = SEARCH_TERM
        man["tap_card"] = TAP_CARD
        page.screenshot(path=str(OUT / "library_search.png"))
        print("library_search.png", man["lib_count_search"], man["lib_tap_card"])

        # ---- 4. カードをタップして開いた大きな画像 ----
        page.goto(f"https://edupower07.github.io/PictureDictionary/images/{TAP_CARD}.jpg",
                  wait_until="load")
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / "card_big.png"))
        print("card_big.png")

        browser.close()

    # ---- 5. フック用の絵カードを Remotion の public へコピー ----
    copied = []
    for f in HOOK_CARDS:
        src = PD_DIR / "images" / f
        if src.exists():
            dst = CARDS_OUT / f.replace(" ", "_")
            dst.write_bytes(src.read_bytes())
            copied.append(dst.name)
        else:
            print("  (skip, not found)", f)
    man["hook_cards"] = copied
    print("hook cards:", len(copied))

    (HERE / "remotion" / "public" / "manifest.json").write_text(
        json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(man, ensure_ascii=False, indent=2)[:800])


if __name__ == "__main__":
    sys.exit(main())
