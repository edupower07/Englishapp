import React from "react";
import { staticFile, continueRender, delayRender } from "remotion";
import type { Fonts as FontsConfig } from "./theme.schema";

/**
 * ローカルに取得済みの @font-face を読み込んで、実際に使う書体・ウェイトを
 * 明示的に待ってから続行する。
 *
 * Google Fonts の woff2 は unicode-range で細かく分割配信されるため、
 * ただ <link> するだけでは「読み込み中に最初のフレームがレンダーされて
 * 代替フォントのまま焼き付く」ことがある。`document.fonts.load()` に
 * 実際に使う文字列を渡して確実に解決してから `continueRender()` する。
 *
 * フォント本体は public/fonts/<family-slug>/ に配置し、fonts.css を
 * 1本にまとめて読み込む想定（assets/fonts/ 同梱フォントと同じレイアウト）。
 */

let injected = false;

type UseFontsOptions = {
  /** public/ からの相対パス。既定は "fonts/fonts.css" */
  cssPath?: string;
  /** 待つ書体一覧。theme.ts の Fonts 型をそのまま渡せる */
  fonts: FontsConfig;
  /** 読み込み確認に使うサンプル文字列（そのフォントで実際に使う文字を含めること） */
  sampleText?: string;
};

export const useFonts = ({
  cssPath = "fonts/fonts.css",
  fonts,
  sampleText = "Sample 0123",
}: UseFontsOptions) => {
  const [handle] = React.useState(() => delayRender("フォント読み込み"));

  React.useEffect(() => {
    if (injected) {
      continueRender(handle);
      return;
    }
    injected = true;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = staticFile(cssPath);
    document.head.appendChild(link);

    link.onload = () => {
      const checks = Object.values(fonts).flatMap((f) =>
        f.weights.map((w) => document.fonts.load(`${w} 100px ${f.family}`, sampleText))
      );
      Promise.all(checks)
        .then(() => document.fonts.ready)
        .then(() => continueRender(handle))
        .catch(() => continueRender(handle));
    };
    link.onerror = () => continueRender(handle);
  }, [handle, cssPath, fonts, sampleText]);
};

export const Fonts: React.FC<UseFontsOptions & { children: React.ReactNode }> = ({
  children,
  ...opts
}) => {
  useFonts(opts);
  return <>{children}</>;
};
