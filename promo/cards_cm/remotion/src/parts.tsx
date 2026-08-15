import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, F, K, V } from "./theme";
import { cl, easeBack, easeOut, lerp, pulse } from "./lib";

/* ------------------------------------------------------------------ *
 * 実画面のスクリーンショットを敷く部品
 *
 * スクショは 1280x720 のビューポートを dsf=2 で撮ってあるので、
 * 幅1920で表示すると CSSピクセル×K(=1.5) が動画ピクセルになる。
 * スクロールもズームもここで毎フレーム計算するので、全編30fpsで滑らか。
 * ------------------------------------------------------------------ */

export const Shot: React.FC<{
  src: string;
  /** CSSピクセルでのスクロール位置 */
  scrollCss?: number;
  /** ズーム倍率 */
  zoom?: number;
  /** ズームの中心(ビューポート内のCSS座標) */
  originCss?: { x: number; y: number };
  blurPx?: number;
  dim?: number;
  /** ズーム座標系の中に置くもの(タップリングなど。CSS座標で配置する) */
  children?: React.ReactNode;
}> = ({ src, scrollCss = 0, zoom = 1, originCss, blurPx = 0, dim = 0, children }) => {
  const ox = (originCss?.x ?? 640) * K;
  const oy = (originCss?.y ?? 360) * K;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#eef2f7" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: V.width,
          height: V.height,
          transform: `scale(${zoom})`,
          transformOrigin: `${ox}px ${oy}px`,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            position: "absolute",
            left: 0,
            top: -scrollCss * K,
            width: V.width,
            display: "block",
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
          }}
        />
        {children}
      </div>
      {dim > 0 && <AbsoluteFill style={{ background: C.deep, opacity: dim }} />}
    </AbsoluteFill>
  );
};

/** タップの輪。CSS座標で置くと、ズームにくっついて動く */
export const TapRing: React.FC<{ xCss: number; yCss: number; t: number; color?: string }> = ({
  xCss,
  yCss,
  t,
  color = C.red,
}) => {
  if (t < 0) return null;
  const rings = [0, 0.42].map((d) => {
    const p = cl((t - d) / 0.75);
    return { r: lerp(26, 130, easeOut(p)), o: (1 - p) * 0.9, k: p };
  });
  const dot = easeBack(cl(t / 0.28)) * 1;
  return (
    <div style={{ position: "absolute", left: xCss * K, top: yCss * K }}>
      {rings.map((r, i) =>
        r.o <= 0 ? null : (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -r.r,
              top: -r.r,
              width: r.r * 2,
              height: r.r * 2,
              borderRadius: "50%",
              border: `${9 - i * 2}px solid ${color}`,
              opacity: r.o,
            }}
          />
        )
      )}
      <div
        style={{
          position: "absolute",
          left: -26 * dot,
          top: -26 * dot,
          width: 52 * dot,
          height: 52 * dot,
          borderRadius: "50%",
          background: color,
          border: "6px solid #fff",
          boxShadow: "0 6px 20px rgba(0,0,0,.35)",
          opacity: cl(1 - (t - 1.5) / 0.4),
        }}
      />
    </div>
  );
};

/** 対象を四角く囲んで目立たせる(リンクやボタン向け) */
export const Highlight: React.FC<{
  xCss: number;
  yCss: number;
  wCss: number;
  hCss: number;
  t: number;
  color?: string;
  padCss?: number;
}> = ({ xCss, yCss, wCss, hCss, t, color = C.red, padCss = 7 }) => {
  const p = easeBack(cl(t / 0.42));
  if (t < 0) return null;
  const blink = 0.72 + 0.28 * Math.sin(t * 7.5);
  return (
    <div
      style={{
        position: "absolute",
        left: (xCss - padCss) * K,
        top: (yCss - padCss) * K,
        width: (wCss + padCss * 2) * K,
        height: (hCss + padCss * 2) * K,
        border: `7px solid ${color}`,
        borderRadius: 18,
        opacity: p * blink,
        transform: `scale(${lerp(1.35, 1, p)})`,
        boxShadow: `0 0 0 6px rgba(255,255,255,.55)`,
      }}
    />
  );
};

/* ------------------------------------------------------------------ *
 * テロップ
 * カラフルな画面の上に置くので、下に濃い帯を敷く(白フチだけでは沈む)
 * ------------------------------------------------------------------ */

export const Telop: React.FC<{
  t: number;
  from: number;
  to: number;
  badge?: string;
  main: string;
  sub?: string;
  accent?: string;
}> = ({ t, from, to, badge, main, sub, accent = C.teal }) => {
  const p = pulse(t, from, to, 0.24, 0.22);
  if (p <= 0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", opacity: p }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 360,
          background: `linear-gradient(to top, ${C.deepSoft} 0%, rgba(26,23,48,.72) 45%, rgba(26,23,48,0) 100%)`,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 26,
          marginBottom: sub ? 96 : 74,
          transform: `translateY(${lerp(46, 0, easeOut(p))}px)`,
        }}
      >
        {badge && (
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: accent,
              color: "#fff",
              fontFamily: F.display.family,
              fontWeight: 800,
              fontSize: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 22px rgba(0,0,0,.35)",
              flex: "none",
            }}
          >
            {badge}
          </div>
        )}
        <div
          style={{
            fontFamily: F.display.family,
            fontWeight: 800,
            fontSize: 74,
            color: "#fff",
            letterSpacing: "0.01em",
            textShadow: "0 4px 18px rgba(0,0,0,.5)",
          }}
        >
          {main}
        </div>
      </div>
      {sub && (
        <div
          style={{
            position: "absolute",
            bottom: 46,
            fontFamily: F.display.family,
            fontWeight: 700,
            fontSize: 38,
            color: "#ffffffcc",
            opacity: pulse(t, from + 0.2, to, 0.3, 0.2),
          }}
        >
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 画面の隅に出す小さいチップ */
export const Chip: React.FC<{
  t: number;
  from: number;
  to: number;
  text: string;
  bg?: string;
  right?: number;
  top?: number;
}> = ({ t, from, to, text, bg = C.purpleDeep, right = 54, top = 54 }) => {
  const p = pulse(t, from, to, 0.3, 0.25);
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        right,
        top,
        background: bg,
        color: "#fff",
        fontFamily: F.display.family,
        fontWeight: 800,
        fontSize: 38,
        padding: "16px 34px",
        borderRadius: 999,
        boxShadow: "0 10px 26px rgba(0,0,0,.28)",
        opacity: p,
        transform: `scale(${lerp(0.82, 1, easeBack(p))})`,
      }}
    >
      {text}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * 絵カードの壁(フックと締めで使う)
 * ------------------------------------------------------------------ */

const COLS = 8;
const ROWS = 5;
const GAP = 14;
const CW = (V.width - GAP * (COLS + 1)) / COLS;
const CH = (V.height - GAP * (ROWS + 1)) / ROWS;

export const CardWall: React.FC<{
  files: string[];
  t: number;
  fall?: boolean;
  /** 締めのように上に文字を載せるときは、ぼかして文字を立たせる */
  blurPx?: number;
}> = ({ files, t, fall = true, blurPx = 0 }) => {
  const items: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const file = files[i % files.length];
      // 落ちてくる順番をばらけさせる(列ごとにずらし、行で少し遅らせる)
      const delay = fall ? 0.06 * ((c * 5 + r * 3) % 11) + r * 0.05 : -1;
      const p = fall ? easeOut(cl((t - delay) / 0.55)) : 1;
      const y = GAP + r * (CH + GAP) + (1 - p) * -900;
      const rot = fall ? (1 - p) * (c % 2 === 0 ? -14 : 12) : 0;
      items.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: GAP + c * (CW + GAP),
            top: y,
            width: CW,
            height: CH,
            background: "#fff",
            borderRadius: 20,
            boxShadow: "0 8px 20px rgba(20,18,50,.22)",
            transform: `rotate(${rot}deg)`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: p > 0 ? 1 : 0,
          }}
        >
          <Img
            src={staticFile(`cards/${file}`)}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      );
    }
  }
  return (
    <AbsoluteFill
      style={{ background: C.purple, filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
    >
      {items}
    </AbsoluteFill>
  );
};

/** 白フラッシュ */
export const Flash: React.FC<{ v: number }> = ({ v }) =>
  v <= 0 ? null : <AbsoluteFill style={{ background: "#fff", opacity: cl(v) }} />;
