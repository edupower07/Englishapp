# 小学校外国語アプリポータル (English App Portal)

小学校3〜6年生の外国語活動・外国語科の授業でそのまま使える無料Webアプリ集と、そのポータルサイトです。

- **インストール不要**:ブラウザで開くだけで動きます
- **Chromebook対応**:GIGAスクール端末のChromeブラウザ・タッチ操作を前提に設計
- **プライバシー配慮**:スコア等の記録は端末内のみで保持し、外部送信しません

## 構成

```
index.html          ← ポータルサイト本体(アプリ一覧)
cards.html          ← 絵カードライブラリ(862枚の検索・閲覧・保存)
apps/               ← 各アプリ(単一HTMLファイル、全33本+Small Talk)
  smalltalk.html    ← Small Talk トレーナー(5・6年)
  g3_*.html         ← 3年生向けアプリ(8本)
  g4_*.html         ← 4年生向けアプリ(9本)
  g5_*.html         ← 5年生向けアプリ(8本)
  g6_*.html         ← 6年生向けアプリ(8本)
shared/             ← 共通デザインキット(app-ui.css / app-ui.js / demo.html)
  img/              ← アプリで使う画像(天気アプリのキャラクターなど)
tools/              ← アプリ改修の受け入れ検査(check_app.py)
```

## アプリ改修の受け入れ検査

3年生から順に、各アプリを次の方針で改修しています。**3〜6年生の全33本と Small Talk は改修ずみで、下の検査 13 項目すべてに合格します。**

- **アプリは かってに 読み上げない**(🔊 を押したときだけ発音する)
- 語彙カードに**日本語の訳を併記しない**
- `shared/` の共通キットを使う(声の統一・効果音・絵カード)
- カードを大きくする
- 一人で完結する操作ではなく、**2人組の やりとり**(情報差のある活動)にする

これを機械的に確かめるスクリプトが `tools/check_app.py` です。

```bash
python3 -m http.server 8000 &            # リポジトリのルートで
pip install playwright                   # 初回のみ
python3 tools/check_app.py apps/g6_u1_profile.html    # 引数なしなら g5_*.html 全部
python3 tools/check_app.py apps/g6_*.html             # まとめて検査することもできます
```

検査するのは次の13項目です。

1. `shared/app-ui.css` を読み込んでいる
2. `shared/app-ui.js` を読み込んでいる
3. 独自の声パッチが残っていない
4. 語彙データに `ja:` の併記がない
5. 発話はキット経由(直接 `SpeechSynthesisUtterance` を作っていない)
6. 起動しただけでは発話しない
7. 主要操作でも発話しない(🔊 と `data-say` は除外)
8. 🔊 の操作子がある
9. キットの発話経路が生きている
10. 絵カードに日本語の訳が出ていない
11. `cutout` の合成が祖先で壊れていない
12. 390px幅で横スクロールしない
13. JSエラーが出ていない

「押したときだけ鳴る」操作子には `data-say` 属性を付けてください(🔊 の文字がある要素は自動で除外されます)。この印が無い要素が発話すると不合格になります。かるたの読み上げのように、音が出ること自体がその活動の中心である操作子にも `data-say` を付けます。

### 2人組の やりとりの 作り方

情報差は「1台を2人でのぞきこむ」前提で作っています。お題は既定でかくしておき、**👀 ボタンで4秒だけ見えて、自動でまたかくれる**という形です。出す人だけが見て、あとは口で伝えるしかなくなります(`g6_u1` `g6_u3` `g6_u5` `g6_u7`)。

もう1つの型が**インタビュー**です。相手にしか答えられない質問をして、答えを絵カードで記録します。アプリは答えを持っていないので、たずねないと埋まりません(`g6_u2` `g6_u4` `g6_u6` `g6_u8`)。

アプリ一覧の表示は `index.html` 冒頭の `APPS` 配列で管理しています。アプリを追加したら `status: "live"` と `file` を設定してください。

## 公開方法(GitHub Pages)

1. このリポジトリの **Settings → Pages → Branch** を `main`(root)に設定
2. `https://edupower07.github.io/Englishapp/` がポータルのURLになります

### 絵カード画像について

一部のアプリは [PictureDictionary](https://github.com/edupower07/PictureDictionary) リポジトリの絵カード画像を
`https://edupower07.github.io/PictureDictionary/images/` から参照します。
**PictureDictionary 側でも GitHub Pages を有効にしてください。**
画像が読み込めない環境でも、絵文字にフォールバックして動作します。

## 関連リポジトリ

- [PictureDictionary](https://github.com/edupower07/PictureDictionary) — 絵じてんアプリ(絵カード860枚以上)
- [5thgrades](https://github.com/edupower07/5thgrades) — 全力ツールズ(5年生向け授業・学級経営アプリ集)

## 利用について

- 学校・自治体の教育目的での利用・共有は自由です(申請不要)
- 営利目的での再配布はご遠慮ください
- 不具合報告・リクエストは X [@Edupower07](https://x.com/Edupower07) へ
