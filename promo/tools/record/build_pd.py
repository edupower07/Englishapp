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
    run(["-ss", f"{c['offset']:.3f}", "-i", c["file"], "-t", f"{c['duration']:.3f}",
         "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
         "-pix_fmt", "yuv420p", "-profile:v", "main", "-level", "3.1", seg])
    concat_lines.append(f"file '{seg}'")
    total += out_dur
    print(f"seg ok: {c['name']}  {c['duration']:.2f}s -> {out_dur:.2f}s (x{speed})")

listfile = os.path.join(OUT, "concat_pd.txt")
with open(listfile, "w") as fp:
    fp.write("\n".join(concat_lines) + "\n")

silent = os.path.join(OUT, "pd_video_noaudio.mp4")
run(["-f", "concat", "-safe", "0", "-i", listfile, "-c", "copy", silent])
print(f"concat ok, total ≈ {total:.1f}s")

subprocess.run([sys.executable, os.path.join(SP, "record/bgm.py"), f"{total:.2f}",
                os.path.join(OUT, "pd_bgm.wav")], check=True)

final = os.path.join(OUT, "pd_feature_movie.mp4")
run(["-i", silent, "-i", os.path.join(OUT, "pd_bgm.wav"),
     "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
     "-movflags", "+faststart", final])

r = subprocess.run([FF, "-i", final], capture_output=True, text=True)
for line in r.stderr.splitlines():
    if "Duration" in line or "Stream #0:0" in line:
        print(line.strip())
print("final:", final, os.path.getsize(final) // 1024, "KB")
