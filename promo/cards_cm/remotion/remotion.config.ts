import { Config } from "@remotion/cli/config";
import { existsSync, globSync } from "node:fs";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

/**
 * サンドボックス同梱の Chromium（`/opt/pw-browsers/chromium/...`）は
 * 旧ヘッドレスモードが削除済みのビルドで、Remotion からは起動に失敗する
 * （`Old Headless mode has been removed` エラー）。
 *
 * 代わりに Playwright が用意する `headless_shell`（旧ヘッドレス相当）を
 * 指定する。バージョン番号を含むフォルダ名（`chromium_headless_shell-XXXX`）
 * は環境によって変わるので、glob で見つける。
 */
const candidates = existsSync("/opt/pw-browsers")
  ? globSync("/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell")
  : [];

if (candidates[0]) {
  Config.setBrowserExecutable(candidates[0]);
}
