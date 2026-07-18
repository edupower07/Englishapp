# PD機能紹介動画: manifest_pd.json のクリップを正規化(speed指定は倍速化)→結合→BGM→MP4
import json, os, subprocess, sys
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SP, "out")
SEG = os.path.join(OUT, "pd_seg")
os.makedirs(SEG, exist_ok=True)

with open(os.path.join(OUT, "manifest_pd.json")) as fp:
    manifest = sorted(json.load(fp), key=lambda c: c["name"])

def run(args):
    r = subprocess.run([FF, "-y", "-loglevel", "error"] + args, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:])
        sys.exit(1)

total = 0.0
concat_lines = []
for i, c in enumerate(manifest):
    speed = c.get("speed", 1.0)
    out_dur = c["duration"] / speed
    vf = f"setpts=PTS/{speed}," if speed != 1.0 else ""
    vf += "fps=30,scale=1280:720:flags=lanczos,setsar=1"
    if i == 0:
        vf += ",fade=t=in:st=0:d=0.5:color=white"
    if i == len(manifest) - 1:
        vf += f",fade=t=out:st={out_dur - 0.9:.2f}:d=0.9"
    # format 変換は必ず最後(fadeの色指定がRGB経由になり yuv444p に化けるのを防ぐ)
    vf += ",format=yuv420p"
    seg = os.path.join(SEG, c["name"] + ".mp4")
    # -t は出力側オプション: 倍速適用後の尺でカットして末尾の死に時間を落とす
    run(["-ss", f"{c['offset']:.3f}", "-i", c["file"], "-t", f"{out_dur:.3f}",
         "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
         "-pix_fmt", "yuv420p", "-profile:v", "main", "-level", "3.1", seg])
    concat_lines.append(f"file '{seg}'")
    # 実際に書き出されたセグメント尺(フレーム量子化後)を計測して音声配置に使う
    pr = subprocess.run([FF, "-i", seg], capture_output=True, text=True)
    real = out_dur
    for line in pr.stderr.splitlines():
        if "Duration" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            real = int(h) * 3600 + int(m) * 60 + float(s)
            break
    c["_real"] = real
    total += real
    print(f"seg ok: {c['name']}  {c['duration']:.2f}s -> {real:.2f}s (x{speed})")

listfile = os.path.join(OUT, "concat_pd.txt")
with open(listfile, "w") as fp:
    fp.write("\n".join(concat_lines) + "\n")

silent = os.path.join(OUT, "pd_video_noaudio.mp4")
run(["-f", "concat", "-safe", "0", "-i", listfile, "-c", "copy", silent])
print(f"concat ok, total ≈ {total:.1f}s")

subprocess.run([sys.executable, os.path.join(SP, "record/bgm.py"), f"{total:.2f}",
                os.path.join(OUT, "pd_bgm.wav")], check=True)

# --- アプリ内音声トラックの合成 ---------------------------------------------
# 録画時に記録した speak() ログ(単語・速度・時刻)を、espeak-ng で合成して
# 最終タイムライン上の正しい位置に配置する。動画は1.5倍速だがイベント開始位置
# だけ合わせ、声そのものは等速(聞き取りやすさ優先)。
import numpy as np, wave, hashlib, shutil

SR = 44100
espeak = shutil.which("espeak-ng") or shutil.which("espeak")
voice_track = np.zeros(int(total * SR) + SR)

def synth(text, rate):
    wpm = max(80, int(165 * rate))  # アプリの rate(1.0/0.55) を espeak の速度に変換
    key = hashlib.md5(f"{text}|{wpm}".encode()).hexdigest()[:12]
    cache = os.path.join(OUT, "tts")
    os.makedirs(cache, exist_ok=True)
    f = os.path.join(cache, key + ".wav")
    if not os.path.exists(f):
        r = subprocess.run([espeak, "-v", "en-us+f3", "-s", str(wpm), "-a", "170",
                            "-w", f, text], capture_output=True)
        if r.returncode != 0 or not os.path.exists(f):
            return None
    with wave.open(f, "rb") as w:
        sr0 = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
        if w.getnchannels() == 2:
            pcm = pcm.reshape(-1, 2).mean(axis=1)
    # 44100Hz へ線形補間でリサンプリング
    n1 = int(len(pcm) * SR / sr0)
    return np.interp(np.linspace(0, len(pcm) - 1, n1), np.arange(len(pcm)), pcm)

events = []
cum = 0.0
for c in manifest:
    speed = c.get("speed", 1.0)
    real = c.get("_real", c["duration"] / speed)
    for e in c.get("speech", []):
        t = cum + min(e["at"] / speed, real)
        if 0 <= t < total - 0.3:
            events.append({"t": t, "text": e["text"], "rate": e.get("rate", 1.0)})
    cum += real
events.sort(key=lambda e: e["t"])
# 同じ単語が短時間に連続するもの(ビンゴの「タップ→配置」の二重読みなど)は1回に間引く
deduped = []
for e in events:
    if deduped and deduped[-1]["text"] == e["text"] and e["t"] - deduped[-1]["t"] < 0.7:
        continue
    deduped.append(e)
events = deduped

if espeak is None:
    print("WARNING: espeak-ng が見つからないため音声トラックなし")
else:
    for i, e in enumerate(events):
        v = synth(e["text"], e["rate"])
        if v is None:
            continue
        # speechSynthesis.cancel() の挙動を再現: 次の読み上げ開始で前の声を打ち切る
        if i + 1 < len(events):
            limit = int((events[i + 1]["t"] - e["t"]) * SR)
            if limit > int(0.06 * SR) and len(v) > limit:
                fade = min(int(0.05 * SR), limit)
                v = v[:limit].copy()
                v[-fade:] *= np.linspace(1, 0, fade)
        s = int(e["t"] * SR)
        end = min(s + len(v), len(voice_track))
        voice_track[s:end] += v[: end - s]
    print(f"voice events: {len(events)}")

# BGM を読み込み、声が鳴っている間は自動で音量を下げる(ダッキング)
with wave.open(os.path.join(OUT, "pd_bgm.wav"), "rb") as w:
    bgm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    bgm = bgm.reshape(-1, 2)
n = min(len(bgm), len(voice_track))
bgm = bgm[:n]; voice_track = voice_track[:n]

env = np.abs(voice_track)
win = int(0.12 * SR)
kernel = np.ones(win) / win
env = np.convolve(env, kernel, mode="same")
duck = 1.0 - 0.62 * np.clip(env / 0.04, 0, 1)   # 声のあいだ BGM を約 -8dB
duck = np.convolve(duck, kernel, mode="same")    # なめらかに
mix = bgm * (duck * 0.82)[:, None]               # BGM 自体も少し控えめに
mix += (voice_track * 0.95)[:, None]
peak = np.abs(mix).max()
if peak > 0.98:
    mix *= 0.98 / peak
pcm = (mix * 32767).astype(np.int16)
mixed = os.path.join(OUT, "pd_mix.wav")
with wave.open(mixed, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())

final = os.path.join(OUT, "pd_feature_movie.mp4")
run(["-i", silent, "-i", mixed,
     "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
     "-movflags", "+faststart", final])

r = subprocess.run([FF, "-i", final], capture_output=True, text=True)
for line in r.stderr.splitlines():
    if "Duration" in line or "Stream #0:0" in line:
        print(line.strip())
print("final:", final, os.path.getsize(final) // 1024, "KB")
