"""
CaptoDesk 9:16 Vertical Reel Generator with Neural Voiceover & SFX
Generates a 21-second high-retention vertical video (720x1280, 24fps)
with synchronized American contractor voice narration and sound effects.
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

WIDTH = 720
HEIGHT = 1280
FPS = 24
DURATION = 21  # 21 seconds total
TOTAL_FRAMES = FPS * DURATION

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REG = "C:/Windows/Fonts/segoeui.ttf"

font_title = ImageFont.truetype(FONT_BOLD, 40)
font_hook = ImageFont.truetype(FONT_BOLD, 36)
font_body = ImageFont.truetype(FONT_BOLD, 28)
font_sub = ImageFont.truetype(FONT_REG, 24)
font_pill = ImageFont.truetype(FONT_BOLD, 20)
font_cta = ImageFont.truetype(FONT_BOLD, 32)

MARKETING_DIR = r"C:\Users\mskar\captodesk\public\marketing"
os.makedirs(MARKETING_DIR, exist_ok=True)

raw_video_mp4 = os.path.join(MARKETING_DIR, "reel_video_temp.mp4")
final_output_mp4 = os.path.join(MARKETING_DIR, "captodesk_reel_with_audio.mp4")

# ─────────────────────────────────────────────────────────────
# 1. PROCEDURAL SOUND EFFECTS GENERATOR
# ─────────────────────────────────────────────────────────────
def make_tone(filename, freq, duration, sample_rate=44100, volume=0.4, decay=2.0):
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

def make_chime(filename, freqs=[523.25, 659.25, 783.99, 1046.50], duration=0.6, sample_rate=44100, volume=0.35):
    """Pleasant ascending major arpeggio chime"""
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        n_samples = int(sample_rate * duration)
        for i in range(n_samples):
            t = float(i) / sample_rate
            # Each note triggers staggered
            sample_val = 0.0
            for note_i, f in enumerate(freqs):
                note_start = note_i * 0.08
                if t >= note_start:
                    note_t = t - note_start
                    env = math.exp(-4.0 * note_t / (duration - note_start))
                    sample_val += math.sin(2.0 * math.pi * f * note_t) * env
            sample_val = sample_val / len(freqs) * volume * 32767.0
            wav.writeframesraw(struct.pack('<h', max(-32768, min(32767, int(sample_val)))))

def make_phone_ring(filename, duration=1.2, sample_rate=44100):
    """Pulsing dual-tone telephone ringer"""
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        n_samples = int(sample_rate * duration)
        for i in range(n_samples):
            t = float(i) / sample_rate
            # Pulse 20Hz modulation
            pulse = 0.5 * (1.0 + math.sin(2.0 * math.pi * 20.0 * t))
            val = 0.5 * (math.sin(2.0 * math.pi * 440.0 * t) + math.sin(2.0 * math.pi * 480.0 * t)) * pulse * 0.3 * 32767.0
            wav.writeframesraw(struct.pack('<h', max(-32768, min(32767, int(val)))))

sfx_ring = os.path.join(MARKETING_DIR, "sfx_ring.wav")
sfx_sms = os.path.join(MARKETING_DIR, "sfx_sms.wav")
sfx_success = os.path.join(MARKETING_DIR, "sfx_success.wav")

make_phone_ring(sfx_ring, duration=1.2)
make_tone(sfx_sms, freq=1174.66, duration=0.35, decay=5.0, volume=0.5)  # D6 high notification ping
make_chime(sfx_success, duration=0.8)

# ─────────────────────────────────────────────────────────────
# 2. NEURAL CONTRACTOR VOICEOVER GENERATION
# ─────────────────────────────────────────────────────────────
voice_scenes = [
    ("v1.mp3", "Never answer this call when you're under a cast iron sink or on a ladder."),
    ("v2.mp3", "Eighty-two percent of homeowners hang up on voicemail and call the next contractor on Google Maps. That's a thousand-dollar job gone."),
    ("v3.mp3", "With CaptoDesk, your phone automatically shoots them a booking link in ten seconds. They lock in an appointment while you keep working."),
    ("v4.mp3", "Stop losing jobs to voicemail. Try your first three jobs completely free at CaptoDesk dot com.")
]

async def generate_voiceover_files():
    for filename, text in voice_scenes:
        dest = os.path.join(MARKETING_DIR, filename)
        # en-US-ChristopherNeural: energetic, authentic American male voice
        c = edge_tts.Communicate(text, 'en-US-ChristopherNeural', rate='+10%')
        await c.save(dest)
        print(f"Generated voice track: {dest}")

print("Synthesizing neural voiceover tracks...")
asyncio.run(generate_voiceover_files())

# ─────────────────────────────────────────────────────────────
# 3. RENDER 9:16 VERTICAL VIDEO (21s @ 24fps)
# ─────────────────────────────────────────────────────────────
print(f"Rendering {TOTAL_FRAMES} frames ({DURATION}s @ {FPS}fps) to {raw_video_mp4}...")
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

    # ── SCENE 1: THE HOOK (0s - 4.5s) ──
    if t < 4.5:
        pill_text = "NEVER ANSWER THIS CALL 🚫"
        draw.rounded_rectangle([WIDTH//2 - 280, 175, WIDTH//2 + 280, 240], radius=14, fill=(251, 191, 36))
        draw.text((WIDTH//2, 207), pill_text, font=font_hook, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 285), "Under a sink or 20ft on a ladder...", font=font_sub, fill=(209, 213, 219), anchor="mm")

        # Ringing Phone Card
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

    # ── SCENE 2: THE VOICEMAIL TRAP (4.5s - 9.5s) ──
    elif t < 9.5:
        draw.rounded_rectangle([WIDTH//2 - 250, 175, WIDTH//2 + 250, 240], radius=14, fill=(239, 68, 68))
        draw.text((WIDTH//2, 207), "CALL SENT TO VOICEMAIL ❌", font=font_hook, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 310), "Here's what happens in 2026:", font=font_title, fill=(255, 255, 255), anchor="mm")

        # Stat Card
        draw.rounded_rectangle([60, 390, WIDTH - 60, 680], radius=24, fill=(24, 24, 27), outline=(239, 68, 68), width=2)
        draw.text((WIDTH//2, 450), "82% OF HOMEOWNERS", font=font_title, fill=(248, 113, 113), anchor="mm")
        draw.text((WIDTH//2, 520), "hang up on voicemail and call", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 570), "the NEXT guy on Google Maps.", font=font_title, fill=(255, 255, 255), anchor="mm")

        # Lost Job Badge
        draw.rounded_rectangle([WIDTH//2 - 210, 740, WIDTH//2 + 210, 825], radius=20, fill=(69, 10, 10))
        draw.text((WIDTH//2, 782), "Lost Job: $800 - $1,500 💸", font=font_title, fill=(248, 113, 113), anchor="mm")

        draw.text((WIDTH//2, 930), "By the time you call back, someone else got the job.", font=font_sub, fill=(156, 163, 175), anchor="mm")

    # ── SCENE 3: THE CAPTODESK RESCUE (9.5s - 15.5s) ──
    elif t < 15.5:
        draw.rounded_rectangle([WIDTH//2 - 260, 175, WIDTH//2 + 260, 240], radius=14, fill=(16, 185, 129))
        draw.text((WIDTH//2, 207), "10-SECOND AUTO TEXT-BACK ⚡", font=font_hook, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 280), "While your hands stay on the tools:", font=font_sub, fill=(209, 213, 219), anchor="mm")

        # SMS Simulation
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

    # ── SCENE 4: CALL TO ACTION (15.5s - 21.0s) ──
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

    # Bottom Progress Bar
    prog_w = int(WIDTH * (f / TOTAL_FRAMES))
    draw.rectangle([0, HEIGHT - 10, prog_w, HEIGHT], fill=(59, 130, 246))

    frame_np = np.array(img)
    writer.append_data(frame_np)

writer.close()
print("Raw video rendering complete!")

# ─────────────────────────────────────────────────────────────
# 4. COMPOSITE AUDIO TRACKS & MUX INTO MP4 WITH FFMPEG
# ─────────────────────────────────────────────────────────────
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

v1 = os.path.join(MARKETING_DIR, "v1.mp3")
v2 = os.path.join(MARKETING_DIR, "v2.mp3")
v3 = os.path.join(MARKETING_DIR, "v3.mp3")
v4 = os.path.join(MARKETING_DIR, "v4.mp3")

# Timestamps in milliseconds:
# Scene 1: voice starts @ 0.3s (300ms) | phone ring @ 0.1s (100ms)
# Scene 2: voice starts @ 4.6s (4600ms)
# Scene 3: voice starts @ 9.6s (9600ms) | SMS chime @ 9.7s (9700ms)
# Scene 4: voice starts @ 15.6s (15600ms) | success chime @ 18.0s (18000ms)

filter_complex = (
    "[1:a]adelay=300|300,volume=1.0[a_v1];"
    "[2:a]adelay=4600|4600,volume=1.0[a_v2];"
    "[3:a]adelay=9600|9600,volume=1.0[a_v3];"
    "[4:a]adelay=15600|15600,volume=1.0[a_v4];"
    "[5:a]adelay=100|100,volume=0.35[a_ring];"
    "[6:a]adelay=9700|9700,volume=0.5[a_sms];"
    "[7:a]adelay=17500|17500,volume=0.45[a_chime];"
    "[a_v1][a_v2][a_v3][a_v4][a_ring][a_sms][a_chime]amix=inputs=7:duration=longest:dropout_transition=0[a_out]"
)

cmd = [
    ffmpeg, "-y",
    "-i", raw_video_mp4,
    "-i", v1,
    "-i", v2,
    "-i", v3,
    "-i", v4,
    "-i", sfx_ring,
    "-i", sfx_sms,
    "-i", sfx_success,
    "-filter_complex", filter_complex,
    "-map", "0:v",
    "-map", "[a_out]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-t", "21",
    final_output_mp4
]

print("Executing FFmpeg audio muxing...")
p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
if p.returncode == 0:
    print(f"SUCCESS! Master Reel with Voiceover & SFX exported to {final_output_mp4}")
    print(f"Size: {os.path.getsize(final_output_mp4)/1024:.1f} KB")
else:
    print("FFmpeg error:", p.stderr)
