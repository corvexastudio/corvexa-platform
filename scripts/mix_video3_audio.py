import os
import subprocess
import json
import imageio_ffmpeg

MARKETING_DIR = r"C:\Users\mskar\captodesk\public\marketing"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

with open(os.path.join(MARKETING_DIR, "v3_audio_meta.json"), "r") as f:
    meta = json.load(f)

scenes = meta["scenes"]
d1 = scenes[0]["duration"] # 9.38
d2 = scenes[1]["duration"] # 9.79
d3 = scenes[2]["duration"] # 10.27
d4 = scenes[3]["duration"] # 13.39

# Start timestamps for each scene
t_s1 = 0.0
t_s2 = t_s1 + d1 # ~9.38
t_s3 = t_s2 + d2 # ~19.17
t_s4 = t_s3 + d3 # ~29.44
total_len = t_s4 + d4 + 0.8 # ~43.6s

print(f"Scene timings: S1={t_s1:.2f}s, S2={t_s2:.2f}s, S3={t_s3:.2f}s, S4={t_s4:.2f}s | Total={total_len:.2f}s")

# Audio files
s1_file = os.path.join(MARKETING_DIR, "v3_s1.mp3")
s2_file = os.path.join(MARKETING_DIR, "v3_s2.mp3")
s3_file = os.path.join(MARKETING_DIR, "v3_s3.mp3")
s4_file = os.path.join(MARKETING_DIR, "v3_s4.mp3")

bg_music = os.path.join(MARKETING_DIR, "trending_beat_master.mp3")
whoosh = os.path.join(MARKETING_DIR, "v3_whoosh.wav")
sms_ping = os.path.join(MARKETING_DIR, "v3_sms_ping.wav")
apple_pay = os.path.join(MARKETING_DIR, "v3_apple_pay.wav")
cash = os.path.join(MARKETING_DIR, "v3_cash.wav")

output_master = os.path.join(MARKETING_DIR, "v3_master_audio.mp3")

# Construct FFmpeg complex filter
# Inputs:
# 0: bg_music
# 1: s1
# 2: s2
# 3: s3
# 4: s4
# 5: whoosh
# 6: sms_ping
# 7: apple_pay
# 8: cash

# Delay offsets in milliseconds:
ms_s1 = int(round(t_s1 * 1000))
ms_s2 = int(round(t_s2 * 1000))
ms_s3 = int(round(t_s3 * 1000))
ms_s4 = int(round(t_s4 * 1000))

ms_w1 = 0
ms_w2 = int(round((t_s2 - 0.2) * 1000))
ms_w3 = int(round((t_s3 - 0.2) * 1000))
ms_w4 = int(round((t_s4 - 0.2) * 1000))

ms_sms = int(round((t_s2 + 4.5) * 1000))
ms_apple = int(round((t_s3 + 2.5) * 1000))
ms_cash = int(round((t_s3 + 5.2) * 1000))

filter_complex = f"""
[0:a]volume=0.15,atrim=0:{total_len},afade=t=out:st={total_len-2}:d=2[bg];
[1:a]adelay={ms_s1}|{ms_s1},volume=1.05[a1];
[2:a]adelay={ms_s2}|{ms_s2},volume=1.05[a2];
[3:a]adelay={ms_s3}|{ms_s3},volume=1.05[a3];
[4:a]adelay={ms_s4}|{ms_s4},volume=1.05[a4];
[5:a]asplit=4[w1][w2][w3][w4];
[w1]adelay={ms_w1}|{ms_w1},volume=0.9[sfx_w1];
[w2]adelay={ms_w2}|{ms_w2},volume=0.9[sfx_w2];
[w3]adelay={ms_w3}|{ms_w3},volume=0.9[sfx_w3];
[w4]adelay={ms_w4}|{ms_w4},volume=0.9[sfx_w4];
[6:a]adelay={ms_sms}|{ms_sms},volume=1.2[sfx_sms];
[7:a]adelay={ms_apple}|{ms_apple},volume=1.3[sfx_apple];
[8:a]adelay={ms_cash}|{ms_cash},volume=1.4[sfx_cash];
[bg][a1][a2][a3][a4][sfx_w1][sfx_w2][sfx_w3][sfx_w4][sfx_sms][sfx_apple][sfx_cash]amix=inputs=12:duration=first:dropout_transition=2[outa]
"""

cmd = [
    ffmpeg, "-y",
    "-i", bg_music,
    "-i", s1_file,
    "-i", s2_file,
    "-i", s3_file,
    "-i", s4_file,
    "-i", whoosh,
    "-i", sms_ping,
    "-i", apple_pay,
    "-i", cash,
    "-filter_complex", filter_complex.strip(),
    "-map", "[outa]",
    "-t", str(total_len),
    "-q:a", "2",
    output_master
]

print("Mixing master audio track...")
subprocess.run(cmd, check=True)
print(f"Master soundtrack mixed successfully: {output_master}")
