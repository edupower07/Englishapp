/**
 * プロジェクトごとに書く theme.ts が満たすべき形。
 *
 * このスキルの各コンポーネント（Backdrop / Fonts / Footage / Soundtrack）は
 * ここで定義した型に沿った値を受け取れば動く。実際の色・書体・レイアウト数値は
 * プロジェクトごとに全く違ってよい —— このCMでの実装は `theme.ts` を参照。
 */

export type VideoConfig = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
};

/** 秒→フレーム変換はどのプロジェクトでも同じ形になるので、型として明示しておく */
export type SecToFrames = (sec: number) => number;

export type FontSpec = {
  /** CSS の font-family 値。フォールバック込みでよい（例: '"Shippori Mincho B1", serif'） */
  family: string;
  /** そのフォントで実際に使うウェイト。Fonts.tsx の読み込み待ちに使う */
  weights: number[];
};

export type Fonts = Record<string, FontSpec>;

/**
 * 「机の上に置いた書類」方式のレイアウト値（このスキルの推奨パターン。
 * pitfalls.md 参照）。アプリ画面をそのまま全画面に敷くのではなく、
 * 一枚のパネルとして配置し、余白を別の情報表示に使う。
 */
export type PanelLayout = {
  left: number;
  top: number;
  width: number;
};

export type BoardLayout = {
  left: number;
  right: number;
  top: number;
};
