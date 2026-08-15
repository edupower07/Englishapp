# 絵カードライブラリ紹介CM 生成ツール

`promo/cards_movie.mp4`(X投稿用・30秒)を再生成するための一式です。
絵コンテは `promo/cards_storyboard.md`。

## 作りかた(前回のポータル紹介ムービーとの違い)

前回の `portal_pr_movie.mp4` は Playwright の**画面録画**でした。
今回は**実画面のスクリーンショット + Remotion合成**にしています。

- 15〜30秒のCMは広告の文法(3秒フック・フラッシュ・大きいコピー・カットで語る)が要る
- Playwright の録画は実質25fpsでコマ間隔も不均一なため、スクロールやズームの
  速いカットでカクつく

そこで、スクロール・入力・タップ・ズームは**スクショをRemotion側で毎フレーム
動かして**表現しています。全編きっちり30fpsになり、文言やタイミングの修正も
録り直しなしでできます(スキル `remotion-app-video` のジャンル判定に従った作り)。

## 必要なもの

- Node.js 18+ / Python 3.9+
- `pip install playwright imageio-ffmpeg numpy`
- PictureDictionary のクローン(絵カード実画像で撮るため)

```bash
git clone https://github.com/edupower07/PictureDictionary /workspace/picturedictionary
```

置き場所を変えるときは環境変数 `PD_DIR` で指定してください。

## 手順

```bash
# 1. リポジトリのルートでポータルをローカル配信
cd <リポジトリのルート> && python3 -m http.server 8000 &

# 2. フォントを取得(ポータルのUIを実物と同じ書体で撮るため。初回のみ)
cd promo/cards_cm
python3 <スキル>/scripts/fetch_fonts.py "M PLUS Rounded 1c:wght@500;700;800" "Fredoka One" -o ./fonts
cp -r fonts/m-plus-rounded-1c fonts/fredoka-one remotion/public/fonts/
#    remotion/public/fonts/fonts.css に2ファイル分を連結(url()はサブフォルダ相対に書き換える)

# 3. 実画面のスクショと座標(manifest.json)を撮る
python3 shots.py

# 4. BGM(オリジナル曲)を合成
python3 bgm.py

# 5. レンダー
cd remotion && npm install
npx remotion render Main out/cards_movie.mp4 --concurrency=2
cp out/cards_movie.mp4 ../../cards_movie.mp4
```

## 構成

- `shots.py` — 実画面の撮影。Google Fonts をローカルの woff2 に差し替え、
  絵カード画像を PictureDictionary のクローンから差し込む。要素の座標を
  `remotion/public/manifest.json` に書き出す(動画側はこの座標で動きを作る)
- `bgm.py` — BGM合成(C-G-Am-F、120BPM。0:01.32のインパクトと0:26.4の締めを
  映像のカットに合わせてある)
- `remotion/src/theme.ts` — 色・書体・カット割り(秒)
- `remotion/src/parts.tsx` — スクショを敷く部品、タップリング、テロップ、絵カードの壁
- `remotion/src/Main.tsx` — 8カットの本体

## 直すときの勘所

- **文言だけ直したい** → `Main.tsx` のテロップ文字列を書き換えてレンダーし直すだけ。
  撮影のやり直しは不要
- **尺やカットの配分を変えたい** → `theme.ts` の `CUTS`(秒)を書き換える。
  BGMのインパクト位置(`bgm.py` の `IMPACT` / `OUTRO`)も合わせること
- **ポータルのレイアウトを変えた** → `shots.py` を撮り直す。座標は manifest.json
  経由で動画側に渡るので、Main.tsx の数値直しは基本不要
- スクショは寄り(最大1.6倍)に耐えるよう `DSF = 3` で撮っている。等倍2倍だと
  ボタンに寄ったときにぼやける

## メモ

- 撮影用のフォント・スクショ・BGM・node_modules・out は `.gitignore` 済み
  (すべて上の手順で再生成できます)。リポジトリに入れているのは完成した
  `promo/cards_movie.mp4` とこのツール一式です
- 「右クリック → 画像を保存」のメニューは、OSのネイティブメニューが
  スクリーンショットに写らないため Remotion 側で再現しています
