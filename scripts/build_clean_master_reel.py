"""
CaptoDesk Master 9:16 Vertical Reel Generator
Features:
- 100% Non-Overlapping Sequential Voiceover (calculated frame-by-frame)
- Synchronized Sound Effects (Phone Ring, SMS Ding, Success Chime)
- Background Trending Rhythm Beat Layer (ducked at 10% volume)
- Smooth Visual Scene Synchronization
"""
import os
import math
import wave
import struct
import asyncio
import subprocess
import numpy as np
import imageio
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
import edge_tts

MARKETING_DIR = r"C:\Users\mskar\captodesk\public\marketing"
os.makedirs(MARKETING_DIR, exist_ok=True)

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

# Output paths
raw_video_mp4 = os.path.join(MARKETING_DIR, "reel_video_temp.mp4")
final_output_mp4 = os.path.join(MARKETING_DIR, "captodesk_reel_with_audio.mp4")
bg_music = os.path.join(MARKETING_DIR, "bg_music_test.mp3")

# ─────────────────────────────────────────────────────────────
# 1. PROCEDURAL SOUND EFFECTS
# ─────────────────────────────────────────────────────────────
def make_tone(filename, freq, duration, sample_rate=44100, volume=0.5, decay=4.0):
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        n_samples = int(sample_rate * duration)
        for i in range(n_samples):
            t = float(i) / sample_rate
            env = math.exp(-decay * t / duration)
            sample = int(32767.0 * volume * env * math.sin(2.0 * math.pi * freq * t))
            wav.writeframesraw(struct.pack('<h', max(-32768, min(32767, sample))))

def make_chime(filename, freqs=[523.25, 659.25, 783.99, 1046.50], duration=0.8, sample_rate=44100, volume=0.35):
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        n_samples = int(sample_rate * duration)
        for i in range(n_samples):
            t = float(i) / sample_rate
            val = 0.0
            for note_i, f in enumerate(freqs):
                note_start = note_i * 0.09
                if t >= note_start:
                    note_t = t - note_start
                    env = math.exp(-4.0 * note_t / (duration - note_start))
                    val += math.sin(2.0 * math.pi * f * note_t) * env
            val = val / len(freqs) * volume * 32767.0
            wav.writeframesraw(struct.pack('<h', max(-32768, min(32767, int(val)))))

def make_phone_ring(filename, duration=1.2, sample_rate=44100):
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        n_samples = int(sample_rate * duration)
        for i in range(n_samples):
            t = float(i) / sample_rate
            pulse = 0.5 * (1.0 + math.sin(2.0 * math.pi * 20.0 * t))
            val = 0.5 * (math.sin(2.0 * math.pi * 440.0 * t) + math.sin(2.0 * math.pi * 480.0 * t)) * pulse * 0.25 * 32767.0
            wav.writeframesraw(struct.pack('<h', max(-32768, min(32767, int(val)))))

sfx_ring = os.path.join(MARKETING_DIR, "sfx_ring.wav")
sfx_sms = os.path.join(MARKETING_DIR, "sfx_sms.wav")
sfx_success = os.path.join(MARKETING_DIR, "sfx_success.wav")

make_phone_ring(sfx_ring, duration=1.2)
make_tone(sfx_sms, freq=1174.66, duration=0.35, decay=5.0, volume=0.5)
make_chime(sfx_success, duration=0.8)

# ─────────────────────────────────────────────────────────────
# 2. VOICE SYNTHESIS & PRECISE TIMELINE CALCULATION
# ─────────────────────────────────────────────────────────────
voice_scenes = [
    ("scene1.mp3", "Never answer this call when you're under a cast iron sink or on a ladder."),
    ("scene2.mp3", "Eighty-two percent of homeowners hang up on voicemail and call the next contractor on Google Maps."),
    ("scene3.mp3", "CaptoDesk auto-texts them your booking link. They lock in an appointment while you keep working."),
    ("scene4.mp3", "Never lose a job to voicemail again. Try your first three jobs free at CaptoDesk dot com.")
]

async def synth_voice():
    for name, text in voice_scenes:
        dest = os.path.join(MARKETING_DIR, name)
        c = edge_tts.Communicate(text, 'en-US-ChristopherNeural', rate='+12%')
        await c.save(dest)

print("Synthesizing neural voiceover...")
asyncio.run(synth_voice())

def get_audio_duration(file_path):
    res = subprocess.run([ffmpeg, '-i', file_path], stderr=subprocess.PIPE, text=True)
    for line in res.stderr.splitlines():
        if 'Duration:' in line:
            part = line.split('Duration:')[1].split(',')[0].strip()
            h, m, s = part.split(':')
            return float(h)*3600 + float(m)*60 + float(s)
    return 4.0

durations = [get_audio_duration(os.path.join(MARKETING_DIR, name)) for name, _ in voice_scenes]
print(f"Clip Durations: {durations}")

# Mathematical timeline (sequential with 0.45s pauses between clips)
gap = 0.45
t_v1 = 0.35
t_s2 = t_v1 + durations[0] + gap
t_s3 = t_s2 + durations[1] + gap
t_s4 = t_s3 + durations[2] + gap
t_total = t_s4 + durations[3] + 1.8

print("=== TIMELINE (GUARANTEED ZERO OVERLAP) ===")
print(f"Scene 1: 0.00s -> {t_s2:.2f}s (Voice: {t_v1:.2f}s to {t_v1+durations[0]:.2f}s)")
print(f"Scene 2: {t_s2:.2f}s -> {t_s3:.2f}s (Voice: {t_s2:.2f}s to {t_s2+durations[1]:.2f}s)")
print(f"Scene 3: {t_s3:.2f}s -> {t_s4:.2f}s (Voice: {t_s3:.2f}s to {t_s3+durations[2]:.2f}s)")
print(f"Scene 4: {t_s4:.2f}s -> {t_total:.2f}s (Voice: {t_s4:.2f}s to {t_s4+durations[3]:.2f}s)")
print(f"Total Video Duration: {t_total:.2f}s")

# ─────────────────────────────────────────────────────────────
# 3. VIDEO RENDERING (9:16 VERTICAL, 720x1280 @ 24fps)
# ─────────────────────────────────────────────────────────────
WIDTH = 720
HEIGHT = 1280
FPS = 24
TOTAL_FRAMES = int(math.ceil(t_total * FPS))

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REG = "C:/Windows/Fonts/segoeui.ttf"

font_title = ImageFont.truetype(FONT_BOLD, 40)
font_hook = ImageFont.truetype(FONT_BOLD, 36)
font_body = ImageFont.truetype(FONT_BOLD, 28)
font_sub = ImageFont.truetype(FONT_REG, 24)
font_pill = ImageFont.truetype(FONT_BOLD, 20)
font_cta = ImageFont.truetype(FONT_BOLD, 32)

print(f"Rendering {TOTAL_FRAMES} frames to {raw_video_mp4}...")
writer = imageio.get_writer(
    raw_video_mp4, 
    fps=FPS, 
    format='mp4', 
    codec='libx264',
    ffmpeg_params=['-pix_fmt', 'yuv420p', '-b:v', '2500k']
)

for f in range(TOTAL_FRAMES):
    t = f / FPS
    img = Image.new("RGB", (WIDTH, HEIGHT), (11, 15, 25))
    draw = ImageDraw.Draw(img)

    # Ambient Background Subtle Glow
    accent_y = int(HEIGHT * 0.45 + 30 * math.sin(t * 1.5))
    draw.ellipse([WIDTH//2 - 260, accent_y - 260, WIDTH//2 + 260, accent_y + 260], fill=(16, 28, 55))

    # Top Brand Header
    draw.text((WIDTH//2, 75), "CaptoDesk", font=font_sub, fill=(156, 163, 175), anchor="mm")
    draw.line([(WIDTH//2 - 90, 105), (WIDTH//2 + 90, 105)], fill=(31, 41, 55), width=2)

    # ── SCENE 1 (Hook & Ringing Phone) ──
    if t < t_s2:
        draw.rounded_rectangle([WIDTH//2 - 280, 175, WIDTH//2 + 280, 240], radius=14, fill=(251, 191, 36))
        draw.text((WIDTH//2, 207), "NEVER ANSWER THIS CALL 🚫", font=font_hook, fill=(0, 0, 0), anchor="mm")
        draw.text((WIDTH//2, 285), "Under a sink or 20ft on a ladder...", font=font_sub, fill=(209, 213, 219), anchor="mm")

        pulse = 12 * math.sin(t * 10)
        card_top = 400
        draw.rounded_rectangle([60, card_top, WIDTH - 60, card_top + 430], radius=24, fill=(17, 24, 39), outline=(55, 65, 81), width=2)
        
        draw.text((WIDTH//2, card_top + 60), "Incoming Customer Call", font=font_sub, fill=(156, 163, 175), anchor="mm")
        draw.text((WIDTH//2, card_top + 120), "Homeowner (Water Leak)", font=font_title, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, card_top + 170), "+1 (555) 234-8901", font=font_sub, fill=(107, 114, 128), anchor="mm")

        btn_r = int(45 + pulse * 0.3)
        draw.ellipse([WIDTH//2 - 160 - btn_r, card_top + 310 - btn_r, WIDTH//2 - 160 + btn_r, card_top + 310 + btn_r], fill=(239, 68, 68))
        draw.text((WIDTH//2 - 160, card_top + 310), "Decline", font=font_pill, fill=(255, 255, 255), anchor="mm")

        draw.ellipse([WIDTH//2 + 160 - btn_r, card_top + 310 - btn_r, WIDTH//2 + 160 + btn_r, card_top + 310 + btn_r], fill=(16, 185, 129))
        draw.text((WIDTH//2 + 160, card_top + 310), "Answer", font=font_pill, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 940), "Should you drop your tools and rush down?", font=font_body, fill=(156, 163, 175), anchor="mm")

    # ── SCENE 2 (The Voicemail Trap) ──
    elif t < t_s3:
        draw.rounded_rectangle([WIDTH//2 - 250, 175, WIDTH//2 + 250, 240], radius=14, fill=(239, 68, 68))
        draw.text((WIDTH//2, 207), "CALL SENT TO VOICEMAIL ❌", font=font_hook, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, 310), "Here's what happens in 2026:", font=font_title, fill=(255, 255, 255), anchor="mm")

        draw.rounded_rectangle([60, 390, WIDTH - 60, 680], radius=24, fill=(24, 24, 27), outline=(239, 68, 68), width=2)
        draw.text((WIDTH//2, 450), "82% OF HOMEOWNERS", font=font_title, fill=(248, 113, 113), anchor="mm")
        draw.text((WIDTH//2, 520), "hang up on voicemail and call", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 570), "the NEXT guy on Google Maps.", font=font_title, fill=(255, 255, 255), anchor="mm")

        draw.rounded_rectangle([WIDTH//2 - 210, 740, WIDTH//2 + 210, 825], radius=20, fill=(69, 10, 10))
        draw.text((WIDTH//2, 782), "Lost Job: $800 - $1,500 💸", font=font_title, fill=(248, 113, 113), anchor="mm")

        draw.text((WIDTH//2, 930), "By the time you call back, someone else got the job.", font=font_sub, fill=(156, 163, 175), anchor="mm")

    # ── SCENE 3 (CaptoDesk 10s Rescue) ──
    elif t < t_s4:
        draw.rounded_rectangle([WIDTH//2 - 260, 175, WIDTH//2 + 260, 240], radius=14, fill=(16, 185, 129))
        draw.text((WIDTH//2, 207), "10-SECOND AUTO TEXT-BACK ⚡", font=font_hook, fill=(0, 0, 0), anchor="mm")
        draw.text((WIDTH//2, 280), "While your hands stay on the tools:", font=font_sub, fill=(209, 213, 219), anchor="mm")

        card_top = 340
        draw.rounded_rectangle([50, card_top, WIDTH - 50, card_top + 480], radius=24, fill=(17, 24, 39), outline=(55, 65, 81), width=1)
        
        # Outbound Text
        draw.rounded_rectangle([110, card_top + 35, WIDTH - 70, card_top + 195], radius=18, fill=(37, 99, 235))
        draw.text((135, card_top + 55), "Hey! Sorry I missed your call, on a job.", font=font_sub, fill=(255, 255, 255))
        draw.text((135, card_top + 90), "Grab an open slot on my schedule here:", font=font_sub, fill=(255, 255, 255))
        draw.text((135, card_top + 125), "book.captodesk.com/mike", font=font_body, fill=(191, 219, 254))
        draw.text((WIDTH - 90, card_top + 170), "Auto-sent in 8s • CaptoDesk", font=font_pill, fill=(191, 219, 254), anchor="ra")

        # Inbound Reply
        draw.rounded_rectangle([70, card_top + 235, WIDTH - 130, card_top + 355], radius=18, fill=(55, 65, 81))
        draw.text((95, card_top + 260), "Thanks Mike! Just booked for", font=font_sub, fill=(255, 255, 255))
        draw.text((95, card_top + 295), "Thursday 9am for diagnostic.", font=font_sub, fill=(255, 255, 255))

        # Confirmed Badge
        draw.rounded_rectangle([WIDTH//2 - 230, card_top + 395, WIDTH//2 + 230, card_top + 450], radius=14, fill=(6, 78, 59))
        draw.text((WIDTH//2, card_top + 422), "✓ Confirmed Appointment • $0 Phone Tag", font=font_pill, fill=(52, 211, 153), anchor="mm")

        draw.text((WIDTH//2, 920), "Homeowner locked in before calling anyone else.", font=font_sub, fill=(156, 163, 175), anchor="mm")

    # ── SCENE 4 (Call to Action) ──
    else:
        draw.rounded_rectangle([WIDTH//2 - 200, 185, WIDTH//2 + 200, 245], radius=14, fill=(59, 130, 246))
        draw.text((WIDTH//2, 215), "CaptoDesk.com", font=font_hook, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 330), "Never Lose a Job to", font=font_title, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, 390), "Voicemail Again.", font=font_title, fill=(251, 191, 36), anchor="mm")

        draw.text((WIDTH//2, 490), "⚡ 15-Sec Automated SMS Text-Back", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 545), "📅 24/7 Google & IG Booking Calendar", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 600), "💳 Driveway Apple Pay & Auto Reviews", font=font_body, fill=(229, 231, 235), anchor="mm")

        pulse_cta = int(6 * math.sin(t * 8))
        draw.rounded_rectangle([60, 710, WIDTH - 60, 810 + pulse_cta], radius=24, fill=(251, 191, 36))
        draw.text((WIDTH//2, 760 + pulse_cta//2), "TRY FIRST 3 JOBS 100% FREE", font=font_cta, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 880), "No Credit Card Required • $0 Platform Fees", font=font_sub, fill=(156, 163, 175), anchor="mm")
        draw.text((WIDTH//2, 930), "Tap Link in Bio to Claim Starter Pass", font=font_body, fill=(96, 165, 250), anchor="mm")

    prog_w = int(WIDTH * (f / TOTAL_FRAMES))
    draw.rectangle([0, HEIGHT - 10, prog_w, HEIGHT], fill=(59, 130, 246))

    frame_np = np.array(img)
    writer.append_data(frame_np)

writer.close()
print("Raw video complete!")

# ─────────────────────────────────────────────────────────────
# 4. COMPOSITE AUDIO WITH ZERO OVERLAP & TRENDING BEAT
# ─────────────────────────────────────────────────────────────
s1 = os.path.join(MARKETING_DIR, "scene1.mp3")
s2 = os.path.join(MARKETING_DIR, "scene2.mp3")
s3 = os.path.join(MARKETING_DIR, "scene3.mp3")
s4 = os.path.join(MARKETING_DIR, "scene4.mp3")

ms_v1 = int(t_v1 * 1000)
ms_v2 = int(t_s2 * 1000)
ms_v3 = int(t_s3 * 1000)
ms_v4 = int(t_s4 * 1000)
ms_sms = int((t_s3 + 0.1) * 1000)
ms_success = int((t_s4 + 1.8) * 1000)

filter_complex = (
    f"[1:a]adelay={ms_v1}|{ms_v1},volume=1.0[v1];"
    f"[2:a]adelay={ms_v2}|{ms_v2},volume=1.0[v2];"
    f"[3:a]adelay={ms_v3}|{ms_v3},volume=1.0[v3];"
    f"[4:a]adelay={ms_v4}|{ms_v4},volume=1.0[v4];"
    f"[5:a]adelay=100|100,volume=0.22[ring];"
    f"[6:a]adelay={ms_sms}|{ms_sms},volume=0.45[sms];"
    f"[7:a]adelay={ms_success}|{ms_success},volume=0.4[success];"
    f"[8:a]atrim=0:{t_total:.2f},afade=t=in:ss=0:d=1,afade=t=out:st={t_total-1.8:.2f}:d=1.8,volume=0.10[beat];"
    "[v1][v2][v3][v4][ring][sms][success][beat]amix=inputs=8:duration=longest:dropout_transition=0[aout]"
)

cmd = [
    ffmpeg, "-y",
    "-i", raw_video_mp4,
    "-i", s1,
    "-i", s2,
    "-i", s3,
    "-i", s4,
    "-i", sfx_ring,
    "-i", sfx_sms,
    "-i", sfx_success,
    "-i", bg_music,
    "-filter_complex", filter_complex,
    "-map", "0:v",
    "-map", "[aout]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-t", f"{t_total:.2f}",
    final_output_mp4
]

print("Executing FFmpeg audio compositing...")
p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
if p.returncode == 0:
    print(f"SUCCESS! Master Reel with Trending Beat & Clean Voiceover: {final_output_mp4}")
    print(f"Size: {os.path.getsize(final_output_mp4)/1024:.1f} KB")
else:
    print("FFmpeg error:", p.stderr)
