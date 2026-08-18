#!/usr/bin/env python3
"""絵カードCM用のBGMをスクリプトで合成する(オリジナル曲・権利上の問題なし)。

30秒CMの構成に合わせて作ってある:
  0.00-1.32  立ち上がり(スイープ)      … 絵カードが降ってくるところ
  1.32       インパクト(シンバル+全体)  … 着地の白フラッシュと同期
  1.32-26.4  本編グルーヴ               … 手順①〜ZIP
  26.4-30.0  締め(コード伸ばし)         … クロージング

出力: remotion/public/audio/bgm.mp3 (-14.5 LUFS 前後に整音)
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / "remotion" / "public" / "audio"

SR = 44100
BPM = 120
BEAT = 60.0 / BPM          # 0.5s
BAR = BEAT * 4             # 2.0s
TOTAL = 30.0
IMPACT = 1.32              # フックの着地
OUTRO = 26.4               # 締めに入る時刻

NOTE = {n: 440.0 * 2 ** ((i - 9) / 12) for i, n in enumerate(
    ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def f(note: str, octv: int) -> float:
    return NOTE[note] * 2 ** (octv - 4)


# 明るいポップ進行(C - G - Am - F)を2小節ずつ
PROG = [
    ("C", ["C", "E", "G"]),
    ("G", ["G", "B", "D"]),
    ("A", ["A", "C", "E"]),
    ("F", ["F", "A", "C"]),
]

rng = np.random.default_rng(11)


def sine(freq, t, detune=0.0):
    return np.sin(2 * np.pi * (freq * (1 + detune)) * t)


def pad(notes, dur, gain=0.14):
    t = np.arange(int(dur * SR)) / SR
    env = np.clip(np.minimum(t / 0.35, 1.0) * np.minimum((dur - t) / 0.45, 1.0), 0, 1)
    out = np.zeros_like(t)
    for n in notes:
        b = f(n, 4)
        out += sine(b, t) + 0.45 * sine(b, t, 0.004) + 0.22 * sine(b * 2, t)
    return out / len(notes) * gain * env


def pluck(freq, dur, gain=0.15):
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-t * 7.0)
    return (sine(freq, t) + 0.35 * sine(freq * 2, t) + 0.12 * sine(freq * 3, t)) * env * gain


def bell(freq, dur, gain=0.12):
    """きらっとした上物(絵カードが降るところで使う)"""
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-t * 4.2)
    return (sine(freq * 2, t) + 0.5 * sine(freq * 3, t) + 0.25 * sine(freq * 4.2, t)) * env * gain


def bass(freq, dur, gain=0.24):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(t / 0.015, 1.0) * np.exp(-t * 1.9)
    return (sine(freq, t) + 0.3 * sine(freq * 2, t)) * env * gain


def kick(dur=0.22, gain=0.5):
    t = np.arange(int(dur * SR)) / SR
    freq = 115 * np.exp(-t * 32) + 45
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 12) * gain


def clap(dur=0.16, gain=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0.0)
    return noise * np.exp(-t * 22) * gain


def hat(dur=0.06, gain=0.055):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0.0)
    return noise * np.exp(-t * 60) * gain


def crash(dur=1.6, gain=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0.0)
    return noise * np.exp(-t * 2.6) * gain


def sweep(dur=1.32, gain=0.16):
    """立ち上がりのノイズスイープ(だんだん明るくなる)"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # 高域を強めていく = 差分の重みを時間で上げる
    hi = np.diff(noise, prepend=0.0)
    w = (t / dur) ** 2
    return (noise * (1 - w) * 0.25 + hi * w) * (t / dur) ** 1.5 * gain


def main():
    n_total = int((TOTAL + 1.0) * SR)
    L = np.zeros(n_total)
    R = np.zeros(n_total)

    def add(buf_l, buf_r, sig, at, pan=0.0):
        i = int(at * SR)
        if i < 0 or i >= len(buf_l):
            return
        j = min(len(buf_l), i + len(sig))
        seg = sig[: j - i]
        buf_l[i:j] += seg * (1 - max(0.0, pan))
        buf_r[i:j] += seg * (1 + min(0.0, pan))

    # ---- 0.0-1.32 立ち上がり ----
    add(L, R, sweep(IMPACT), 0.0)
    add(R, L, sweep(IMPACT), 0.0)
    # 降ってくる絵カードに合わせた鈴の粒
    for i, at in enumerate(np.arange(0.25, IMPACT, 0.11)):
        deg = [0, 2, 4, 7, 9][i % 5]
        add(L, R, bell(f("C", 5) * 2 ** (deg / 12), 0.5, 0.09), at, pan=0.35 if i % 2 else -0.35)

    # ---- 1.32 インパクト ----
    add(L, R, crash(), IMPACT)
    add(R, L, crash(), IMPACT)
    add(L, R, kick(0.3, 0.75), IMPACT)
    add(R, L, kick(0.3, 0.75), IMPACT)
    add(L, R, bass(f("C", 2), 1.0, 0.3), IMPACT)
    add(R, L, bass(f("C", 2), 1.0, 0.3), IMPACT)

    # ---- 本編グルーヴ(小節グリッドは IMPACT を1拍目に合わせる) ----
    b = 0
    while True:
        bar_at = IMPACT + b * BAR
        if bar_at >= OUTRO:
            break
        root, triad = PROG[b % 4]
        # パッド
        p = pad(triad, BAR, 0.13)
        add(L, R, p, bar_at, pan=-0.12)
        add(R, L, p, bar_at, pan=-0.12)
        # ベース(1・2半・4拍)
        for beat, dur in ((0, BEAT * 1.5), (1.5, BEAT), (3, BEAT)):
            add(L, R, bass(f(root, 2), dur + 0.25), bar_at + beat * BEAT)
            add(R, L, bass(f(root, 2), dur + 0.25), bar_at + beat * BEAT)
        # アルペジオ(8分・やや右)
        seq = [triad[0], triad[2], triad[1], triad[2], triad[0], triad[2], triad[1], triad[0]]
        for i, nn in enumerate(seq):
            octv = 5 if i % 4 in (1, 3) else 4
            add(L, R, pluck(f(nn, octv), BEAT * 1.2, 0.13), bar_at + i * BEAT / 2, pan=0.3)
            add(R, L, pluck(f(nn, octv), BEAT * 1.2, 0.13), bar_at + i * BEAT / 2, pan=-0.05)
        # ドラム
        for beat in (0, 2):
            add(L, R, kick(), bar_at + beat * BEAT)
            add(R, L, kick(), bar_at + beat * BEAT)
        for beat in (1, 3):
            add(L, R, clap(), bar_at + beat * BEAT)
            add(R, L, clap(), bar_at + beat * BEAT)
        for i in range(8):
            g = 0.055 if i % 2 == 0 else 0.035
            add(L, R, hat(gain=g), bar_at + i * BEAT / 2, pan=0.25)
            add(R, L, hat(gain=g), bar_at + i * BEAT / 2, pan=-0.25)
        b += 1

    # ---- 締め(26.4-30.0):Cで着地して伸ばす ----
    add(L, R, crash(2.2, 0.26), OUTRO)
    add(R, L, crash(2.2, 0.26), OUTRO)
    add(L, R, kick(0.3, 0.7), OUTRO)
    add(R, L, kick(0.3, 0.7), OUTRO)
    add(L, R, bass(f("C", 2), 3.2, 0.26), OUTRO)
    add(R, L, bass(f("C", 2), 3.2, 0.26), OUTRO)
    fin = pad(["C", "E", "G"], 3.4, 0.2)
    add(L, R, fin, OUTRO)
    add(R, L, fin, OUTRO)
    for i, nn in enumerate(["C", "E", "G", "C"]):
        add(L, R, bell(f(nn, 5 if i < 3 else 6), 1.6, 0.1), OUTRO + i * 0.13, pan=0.2 * (1 if i % 2 else -1))

    # ---- 仕上げ ----
    n = int(TOTAL * SR)
    L, R = L[:n], R[:n]
    # 末尾は音楽的に終わらせる(無音を引き伸ばす事故を避けるため、ここで閉じる)
    tail = np.ones(n)
    fade_n = int(0.55 * SR)
    tail[-fade_n:] = np.linspace(1, 0, fade_n) ** 1.5
    L *= tail
    R *= tail
    peak = max(np.abs(L).max(), np.abs(R).max())
    if peak > 0:
        L, R = L / peak * 0.89, R / peak * 0.89

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    wav = OUT_DIR / "bgm_raw.wav"
    stereo = np.stack([L, R], axis=1)
    with wave.open(str(wav), "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((stereo * 32767).astype("<i2").tobytes())
    print("wrote", wav)

    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    mp3 = OUT_DIR / "bgm.mp3"
    subprocess.run(
        [ff, "-y", "-loglevel", "error", "-i", str(wav),
         # ナレーション無しのCMなので、声の下に敷く前提より上げる
         "-af", "loudnorm=I=-14.5:TP=-1.2:LRA=11",
         "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)],
        check=True)
    wav.unlink()
    print("wrote", mp3, mp3.stat().st_size, "bytes")


if __name__ == "__main__":
    sys.exit(main())
