/**
 * 絵カードライブラリ紹介CM(30秒)のテーマ。
 * 色はポータル(index.html / cards.html)の実際のCSS変数に合わせている。
 */
import type { Fonts } from "./theme.schema";

export const C = {
  // ポータルの配色をそのまま持ってくる
  bg: "#f0f4f8",
  ink: "#2d3436",
  sub: "#7f8c9b",
  purple: "#a29bfe",
  purpleDeep: "#6c5ce7",
  teal: "#00cec9",
  yellow: "#fdcb6e",
  red: "#ff7675",

  // 動画用の暗色(テロップの帯・締めの背景)
  deep: "#221f3a",
  deepSoft: "rgba(26,23,48,.86)",
} as const;

/** ポータルと同じ書体で通す(動画がサイトの続きに見える) */
export const F: Fonts = {
  display: { family: '"M PLUS Rounded 1c", sans-serif', weights: [700, 800] },
  latin: { family: '"Fredoka One", cursive', weights: [400] },
};

export const V = {
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 30 * 30,
} as const;

export const s = (sec: number) => Math.round(sec * V.fps);

/**
 * スクリーンショットは 1280x720 のビューポートを dsf=2 で撮ってある。
 * 動画では幅1920に合わせて表示するので、CSSピクセル→動画ピクセルは 1.5 倍。
 */
export const K = V.width / 1280;

/** カット割り(秒)。絵コンテ promo/cards_storyboard.md と対応 */
export const CUTS = {
  hook: [0.0, 3.2],
  portal: [3.2, 6.4],
  step1: [6.4, 10.4],
  step2: [10.4, 14.2],
  step3: [14.2, 18.6],
  step4: [18.6, 23.0],
  zip: [23.0, 26.4],
  close: [26.4, 30.0],
} as const;
