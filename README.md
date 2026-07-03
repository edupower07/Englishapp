# 小学校外国語アプリポータル (English App Portal)

小学校3〜6年生の外国語活動・外国語科の授業でそのまま使える無料Webアプリ集と、そのポータルサイトです。

- **インストール不要**:すべて単一HTMLファイル。ブラウザで開くだけで動きます
- **Chromebook対応**:GIGAスクール端末のChromeブラウザ・タッチ操作を前提に設計
- **プライバシー配慮**:スコア等の記録は端末内のみで保持し、外部送信しません(GAS連携を明記したアプリを除く)

## 構成

```
index.html          ← ポータルサイト本体(アプリ一覧)
apps/               ← 各アプリ(単一HTMLファイル)
  smalltalk.html    ← Small Talk トレーナー(5・6年)
  g3_*.html         ← 3年生向けアプリ
  g4_*.html         ← 4年生向けアプリ
  g5_*.html         ← 5年生向けアプリ
  g6_*.html         ← 6年生向けアプリ
gas/                ← GAS連携が必要なアプリ用の Apps Script コード
```

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
