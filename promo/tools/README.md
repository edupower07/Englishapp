# 紹介ムービー生成ツール

`promo/portal_pr_movie.mp4`(ポータル紹介)と `promo/pd_feature_movie.mp4`
(Picture Dictionary 機能紹介)を再生成するためのスクリプト一式です。
Playwright(Chromium)でポータルと各アプリを実際に操作しながら録画し、
ffmpeg で1本のMP4に結合します。BGMも numpy で合成します。

## 必要なもの

- Node.js 18+ / Python 3.9+
- `pip install imageio-ffmpeg numpy`(ffmpeg 本体は imageio-ffmpeg が同梱)

## 手順

```bash
# 1. リポジトリのルートでポータルをローカル配信
python3 -m http.server 8000 &

# 2. このディレクトリで依存をインストール(Chromium も入ります)
cd promo/tools
npm install

# 3. 全セグメントを録画(out/raw/*.webm と out/manifest.json ができます)
node record/segments.js

# 4. 結合・BGM合成・MP4書き出し(out/portal_pr_movie.mp4)
python3 record/build.py
cp out/portal_pr_movie.mp4 ../portal_pr_movie.mp4
```

### Picture Dictionary 機能紹介ムービーの場合

PictureDictionary リポジトリのクローンが別途必要です(絵カード実画像で録画するため)。

```bash
git clone https://github.com/edupower07/PictureDictionary /workspace/picturedictionary
(cd /workspace/picturedictionary && python3 -m http.server 8001 &)  # PD本体を配信
# ポータル側の 8000 も起動したうえで
node record/pd_segments.js      # 録画(デモ部分はあとで1.5倍速化)
python3 record/build_pd.py      # 結合・倍速化・BGM(out/pd_feature_movie.mp4)
cp out/pd_feature_movie.mp4 ../pd_feature_movie.mp4
```

クローン先を変える場合は環境変数 `PD_DIR` で場所を指定してください
(cards.html の絵カード画像をローカルから差し込むのに使います)。

## 構成

- `record/common.js` — 録画共通処理。Google Fonts をローカルの @fontsource で差し替え、
  外部リクエストを遮断(アプリは絵文字フォールバックで動作)、疑似カーソル・字幕・学年チップを注入
- `record/segments.js` — 全24クリップの絵コンテ実装(スライド+アプリ実演)
- `record/bgm.py` — BGM合成(C-Am-F-G、100BPM のオリジナル曲)
- `record/build.py` — セグメント正規化 → 結合 → BGMミックス → MP4
- `slides/` — オープニング・つくり手の思い・学年見出し・PD機能一覧・クロージングのスライドHTML

## メモ

- 録画はオフライン前提です。絵カード画像(外部の PictureDictionary リポジトリ)への
  リクエストは意図的に遮断し、各アプリの絵文字フォールバックで表示しています。
- 字幕文言やアプリの選定を変えるときは `record/segments.js` と `slides/` を編集してください。
