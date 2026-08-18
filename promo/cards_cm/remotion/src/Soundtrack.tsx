import React from "react";
import { Audio, Sequence, staticFile, interpolate } from "remotion";

/**
 * BGM＋ナレーションの音まわり。
 *
 * 設計：
 * - BGM はナレーションより十分下げた「床」として鳴らす（scripts/build_audio.py
 *   で -20 LUFS 程度に正規化しておく想定。ナレーションは -16 LUFS）。
 * - ナレーションが鳴っている区間だけ、BGM を自動でダッキング（一時的に
 *   音量を絞る）する。声と音楽の実効差が 10〜15LU くらいになると聞き取りやすい。
 * - ナレーションが1本もなくても（＝ narration=[] でも）BGMだけで成立する
 *   ように作ってあるので、音声を後から足す・抜くの両方に対応できる。
 */

export type NarrationClip = {
  /** 読み始める時刻（秒） */
  atSec: number;
  /** 実測の尺（秒） */
  durSec: number;
  /** public/ からの相対パス */
  src: string;
};

export type SoundtrackProps = {
  bgmSrc: string;
  narration?: NarrationClip[];
  fps?: number;
  /** BGMの頭のフェードイン（秒） */
  fadeInSec?: number;
  /** ナレーション中にBGMをどこまで下げるか（0〜1） */
  duckTo?: number;
  /** ダッキングの上げ下げにかける時間（秒） */
  duckRampSec?: number;
};

export const Soundtrack: React.FC<SoundtrackProps> = ({
  bgmSrc,
  narration = [],
  fps = 30,
  fadeInSec = 0.7,
  duckTo = 0.35,
  duckRampSec = 0.4,
}) => {
  const s = (sec: number) => Math.round(sec * fps);
  const duckRamp = s(duckRampSec);

  const duckAt = (frame: number): number => {
    let level = 1;
    for (const n of narration) {
      const start = s(n.atSec);
      const end = start + s(n.durSec);
      level = Math.min(
        level,
        interpolate(
          frame,
          [start - duckRamp, start, end, end + duckRamp],
          [1, duckTo, duckTo, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      );
    }
    return level;
  };

  return (
    <>
      <Audio
        src={staticFile(bgmSrc)}
        volume={(frame) =>
          interpolate(frame, [0, s(fadeInSec)], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) * duckAt(frame)
        }
      />
      {narration.map((n, i) => (
        <Sequence key={i} from={s(n.atSec)} durationInFrames={s(n.durSec) + 2}>
          <Audio src={staticFile(n.src)} />
        </Sequence>
      ))}
    </>
  );
};
