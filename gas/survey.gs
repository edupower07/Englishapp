/**
 * すきなものアンケート&グラフ(3年 Unit4・5)用 Google Apps Script
 *
 * ■ セットアップ手順
 * 1. Googleスプレッドシートを新規作成し、「拡張機能 → Apps Script」を開く
 * 2. このコードを貼り付けて保存する
 * 3. 「デプロイ → 新しいデプロイ → 種類: ウェブアプリ」を選ぶ
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 「組織内の全員」(※「全員」にはしないこと)
 * 4. 発行されたWebアプリURL(https://script.google.com/macros/s/..../exec)を
 *    アプリの「せんせい用グラフ」画面の入力欄に貼り付ける
 *
 * ■ 記録される内容(1行 = 1回答)
 * 日時 / 出席番号 / カテゴリ / 項目 / すき(TRUE・FALSE)
 * 児童の氏名は扱いません(出席番号のみ)。
 */

const SHEET_NAME = "回答ログ";

function doPost(e) {
  try {
    const row = JSON.parse(e.postData.contents);
    const sheet = getSheet_();
    sheet.appendRow([new Date(), row.student, row.category, row.item, row.liked]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** 集計を確認したいときはWebアプリURLをブラウザで開くと、項目ごとの「すき」の数をJSONで返します */
function doGet() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues().slice(1); // ヘッダーを除く
  const tally = {};
  // 同じ児童×項目は最後の回答を採用
  const latest = {};
  values.forEach(function (v) {
    latest[v[1] + "|" + v[2] + "|" + v[3]] = { category: v[2], item: v[3], liked: v[4] === true || v[4] === "TRUE" };
  });
  Object.keys(latest).forEach(function (k) {
    const r = latest[k];
    if (!r.liked) return;
    const key = r.category + "|" + r.item;
    tally[key] = (tally[key] || 0) + 1;
  });
  return ContentService.createTextOutput(JSON.stringify(tally))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["日時", "出席番号", "カテゴリ", "項目", "すき"]);
  }
  return sheet;
}
