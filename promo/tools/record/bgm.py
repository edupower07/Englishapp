# やさしいBGMを合成する(C - Am - F - G、100BPM、パッド+アルペジオ+ベース)
import numpy as np, wave, sys

SR = 44100
BPM = 100
BEAT = 60.0 / BPM          # 0.6s
BAR = BEAT * 4             # 2.4s
TARGET = float(sys.argv[1]) if len(sys.argv) > 1 else 165.0

NOTE = {n: 440.0 * 2 ** ((i - 9) / 12) for i, n in enumerate(
    ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}
def f(note, octv):  # note freq at octave
    return NOTE[note] * 2 ** (octv - 4)

# 進行: C / Am / F / G(それぞれ1小節)
PROG = [("C", ["C", "E", "G"]), ("A", ["A", "C", "E"]), ("F", ["F", "A", "C"]), ("G", ["G", "B", "D"])]

def sine(freq, t, detune=0.0):
    return np.sin(2 * np.pi * (freq * (1 + detune)) * t)

def pad_chord(notes, dur):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(t / 0.5, 1.0) * np.minimum((dur - t) / 0.6, 1.0)
    env = np.clip(env, 0, 1)
    out = np.zeros_like(t)
    for n in notes:
        base = f(n, 4)
        out += sine(base, t) + 0.5 * sine(base, t, 0.003) + 0.3 * sine(base * 2, t)
    return out / len(notes) * 0.16 * env

def pluck(freq, dur):
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-t * 5.5)
    return (sine(freq, t) + 0.35 * sine(freq * 2, t) + 0.15 * sine(freq * 3, t)) * env * 0.16

def bass(freq, dur):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(t / 0.02, 1.0) * np.exp(-t * 1.4)
    return (sine(freq, t) + 0.25 * sine(freq * 2, t)) * env * 0.22

def hat(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0)  # 高域寄りに
    return noise * np.exp(-t * 55) * 0.05

bars = int(np.ceil(TARGET / BAR)) + 1
L = np.zeros(int(bars * BAR * SR) + SR)
R = np.zeros_like(L)

for b in range(bars):
    root, triad = PROG[b % 4]
    start = int(b * BAR * SR)
    # パッド(センター)
    p = pad_chord(triad, BAR)
    L[start:start + len(p)] += p
    R[start:start + len(p)] += p
    # ベース(1拍目と3拍目)
    for beat in (0, 2):
        s = int((b * BAR + beat * BEAT) * SR)
        v = bass(f(root, 2), BEAT * 2)
        L[s:s + len(v)] += v * 0.9
        R[s:s + len(v)] += v * 0.9
    # アルペジオ(8分、やや右)— 4小節目ごとに休符を入れて息継ぎ
    seq = [triad[0], triad[2], triad[1], triad[2], triad[0], triad[2], triad[1], triad[2]]
    for i, n in enumerate(seq):
        if b % 4 == 3 and i >= 6:
            continue
        s = int((b * BAR + i * BEAT / 2) * SR)
        octv = 5 if i % 4 != 0 else 4
        v = pluck(f(n, octv), BEAT * 0.95)
        L[s:s + len(v)] += v * 0.6
        R[s:s + len(v)] += v * 1.0
    # ハット(2・4拍、やや左)
    for beat in (1, 3):
        s = int((b * BAR + beat * BEAT) * SR)
        v = hat(0.12)
        L[s:s + len(v)] += v * 1.0
        R[s:s + len(v)] += v * 0.55

n = int(TARGET * SR)
L, R = L[:n], R[:n]
# フェードイン/アウト
fi, fo = int(1.2 * SR), int(3.5 * SR)
env = np.ones(n)
env[:fi] = np.linspace(0, 1, fi)
env[-fo:] = np.linspace(1, 0, fo)
L *= env; R *= env
peak = max(np.abs(L).max(), np.abs(R).max())
L, R = L / peak * 0.55, R / peak * 0.55  # 控えめな音量

data = np.stack([L, R], axis=1)
pcm = (data * 32767).astype(np.int16)
with wave.open(sys.argv[2] if len(sys.argv) > 2 else "out/bgm.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("bgm written:", TARGET, "sec")
