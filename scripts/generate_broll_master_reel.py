"""
CaptoDesk Master 9:16 Vertical Reel with Real B-Roll Footage
Combines:
- Real B-Roll Video 1: Plumber working on pipes/tools under sink
- Real B-Roll Video 2: Workers on commercial jobsite
- Real B-Roll Video 3: Close-up hands texting on smartphone
- Real B-Roll Scene 4: Contractor service truck with cinematic Ken Burns push-in
- 100% Non-Overlapping Sequential Voiceover Narration
- Rhythmic Trending Background Beat (-18 dB ducked)
- Synchronized Sound Effects (Phone Ring, SMS Ping, Success Chime)
"""
import os
import math
import subprocess
import numpy as np
import imageio
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

MARKETING_DIR = r"C:\Users\mskar\captodesk\public\marketing"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

# Video Inputs
broll_plumber_path = os.path.join(MARKETING_DIR, "broll_plumber.mp4")
broll_workers_path = os.path.join(MARKETING_DIR, "broll_workers.mp4")
broll_phone_path = os.path.join(MARKETING_DIR, "broll_phone.mp4")
img_truck_path = os.path.join(MARKETING_DIR, "post3_driveway_clean.jpg")

# Audio Inputs
s1 = os.path.join(MARKETING_DIR, "scene1.mp3")
s2 = os.path.join(MARKETING_DIR, "scene2.mp3")
s3 = os.path.join(MARKETING_DIR, "scene3.mp3")
s4 = os.path.join(MARKETING_DIR, "scene4.mp3")
bg_music = os.path.join(MARKETING_DIR, "trending_beat_master.mp3")
sfx_ring = os.path.join(MARKETING_DIR, "sfx_ring.wav")
sfx_sms = os.path.join(MARKETING_DIR, "sfx_sms.wav")
sfx_success = os.path.join(MARKETING_DIR, "sfx_success.wav")

# Output files
raw_broll_mp4 = os.path.join(MARKETING_DIR, "raw_broll_temp.mp4")
final_output_mp4 = os.path.join(MARKETING_DIR, "captodesk_reel_with_broll.mp4")

# Timeline (calculated sequential timestamps)
t_s2 = 5.17
t_s3 = 11.14
t_s4 = 17.45
t_total = 25.88

FPS = 24
WIDTH = 720
HEIGHT = 1280
TOTAL_FRAMES = int(round(t_total * FPS))

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REG = "C:/Windows/Fonts/segoeui.ttf"

font_title = ImageFont.truetype(FONT_BOLD, 40)
font_hook = ImageFont.truetype(FONT_BOLD, 36)
font_body = ImageFont.truetype(FONT_BOLD, 28)
font_sub = ImageFont.truetype(FONT_REG, 24)
font_pill = ImageFont.truetype(FONT_BOLD, 20)
font_cta = ImageFont.truetype(FONT_BOLD, 32)

# Open B-Roll Video Readers
r_plumber = imageio.get_reader(broll_plumber_path)
r_workers = imageio.get_reader(broll_workers_path)
r_phone = imageio.get_reader(broll_phone_path)

# Prepare Scene 4 Truck Image
img_truck_base = Image.open(img_truck_path).convert("RGB")

writer = imageio.get_writer(
    raw_broll_mp4,
    fps=FPS,
    format='mp4',
    codec='libx264',
    ffmpeg_params=['-pix_fmt', 'yuv420p', '-b:v', '2800k']
)

print(f"Rendering {TOTAL_FRAMES} B-Roll frames ({t_total}s @ {FPS}fps)...")

for f in range(TOTAL_FRAMES):
    t = f / FPS

    # ─────────────────────────────────────────────────────────
    # A. FETCH BACKGROUND B-ROLL FRAME
    # ─────────────────────────────────────────────────────────
    if t < t_s2:
        # Scene 1: Real Plumber B-Roll
        frame_idx = min(f, r_plumber.count_frames() - 1)
        raw_f = r_plumber.get_data(frame_idx)
        bg_frame = Image.fromarray(raw_f)
    elif t < t_s3:
        # Scene 2: Real Construction Site Workers B-Roll
        rel_f = int((t - t_s2) * FPS)
        frame_idx = min(rel_f, r_workers.count_frames() - 1)
        raw_f = r_workers.get_data(frame_idx)
        bg_frame = Image.fromarray(raw_f)
    elif t < t_s4:
        # Scene 3: Real Phone Texting B-Roll
        rel_f = int((t - t_s3) * FPS)
        frame_idx = min(rel_f, r_phone.count_frames() - 1)
        raw_f = r_phone.get_data(frame_idx)
        bg_frame = Image.fromarray(raw_f)
    else:
        # Scene 4: Cinematic Ken Burns Push-in on Service Truck
        rel_t = (t - t_s4) / (t_total - t_s4)
        zoom = 1.0 + 0.08 * rel_t
        w_crop = int(img_truck_base.width / zoom)
        h_crop = int(img_truck_base.height / zoom)
        x_crop = (img_truck_base.width - w_crop) // 2
        y_crop = (img_truck_base.height - h_crop) // 2
        cropped = img_truck_base.crop((x_crop, y_crop, x_crop + w_crop, y_crop + h_crop))
        bg_frame = cropped.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)

    # ─────────────────────────────────────────────────────────
    # B. APPLY CINEMATIC DARK TINT (FOR 100% TEXT LEGIBILITY)
    # ─────────────────────────────────────────────────────────
    # Darken B-roll to 35-40% brightness so white/yellow text and cards pop
    bg_frame = ImageEnhance.Brightness(bg_frame).enhance(0.42)

    # Add dark vignette overlay
    tint_layer = Image.new("RGBA", (WIDTH, HEIGHT), (10, 14, 24, 110))
    bg_frame = Image.alpha_composite(bg_frame.convert("RGBA"), tint_layer).convert("RGB")

    draw = ImageDraw.Draw(bg_frame)

    # Top Brand Header
    draw.text((WIDTH//2, 75), "CaptoDesk", font=font_sub, fill=(209, 213, 219), anchor="mm")
    draw.line([(WIDTH//2 - 90, 105), (WIDTH//2 + 90, 105)], fill=(75, 85, 99), width=2)

    # ─────────────────────────────────────────────────────────
    # C. KINETIC UI OVERLAYS PER SCENE
    # ─────────────────────────────────────────────────────────
    # ── SCENE 1: THE HOOK (0.00s - 5.17s) ──
    if t < t_s2:
        draw.rounded_rectangle([WIDTH//2 - 280, 175, WIDTH//2 + 280, 240], radius=14, fill=(251, 191, 36))
        draw.text((WIDTH//2, 207), "NEVER ANSWER THIS CALL 🚫", font=font_hook, fill=(0, 0, 0), anchor="mm")
        draw.text((WIDTH//2, 285), "Under a sink or 20ft on a ladder...", font=font_sub, fill=(243, 244, 246), anchor="mm")

        pulse = 12 * math.sin(t * 10)
        card_top = 400
        draw.rounded_rectangle([60, card_top, WIDTH - 60, card_top + 430], radius=24, fill=(17, 24, 39), outline=(75, 85, 99), width=2)
        
        draw.text((WIDTH//2, card_top + 60), "Incoming Customer Call", font=font_sub, fill=(156, 163, 175), anchor="mm")
        draw.text((WIDTH//2, card_top + 120), "Homeowner (Water Leak)", font=font_title, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, card_top + 170), "+1 (555) 234-8901", font=font_sub, fill=(156, 163, 175), anchor="mm")

        btn_r = int(45 + pulse * 0.3)
        draw.ellipse([WIDTH//2 - 160 - btn_r, card_top + 310 - btn_r, WIDTH//2 - 160 + btn_r, card_top + 310 + btn_r], fill=(239, 68, 68))
        draw.text((WIDTH//2 - 160, card_top + 310), "Decline", font=font_pill, fill=(255, 255, 255), anchor="mm")

        draw.ellipse([WIDTH//2 + 160 - btn_r, card_top + 310 - btn_r, WIDTH//2 + 160 + btn_r, card_top + 310 + btn_r], fill=(16, 185, 129))
        draw.text((WIDTH//2 + 160, card_top + 310), "Answer", font=font_pill, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 940), "Should you drop your tools and rush down?", font=font_body, fill=(229, 231, 235), anchor="mm")

    # ── SCENE 2: THE VOICEMAIL TRAP (5.17s - 11.14s) ──
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

        draw.text((WIDTH//2, 930), "By the time you call back, someone else got the job.", font=font_sub, fill=(229, 231, 235), anchor="mm")

    # ── SCENE 3: CAPTODESK RESCUE (11.14s - 17.45s) ──
    elif t < t_s4:
        draw.rounded_rectangle([WIDTH//2 - 260, 175, WIDTH//2 + 260, 240], radius=14, fill=(16, 185, 129))
        draw.text((WIDTH//2, 207), "10-SECOND AUTO TEXT-BACK ⚡", font=font_hook, fill=(0, 0, 0), anchor="mm")
        draw.text((WIDTH//2, 280), "While your hands stay on the tools:", font=font_sub, fill=(243, 244, 246), anchor="mm")

        card_top = 340
        draw.rounded_rectangle([50, card_top, WIDTH - 50, card_top + 480], radius=24, fill=(17, 24, 39), outline=(75, 85, 99), width=1)
        
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

        draw.text((WIDTH//2, 920), "Homeowner locked in before calling anyone else.", font=font_sub, fill=(229, 231, 235), anchor="mm")

    # ── SCENE 4: CALL TO ACTION (17.45s - 25.88s) ──
    else:
        draw.rounded_rectangle([WIDTH//2 - 200, 185, WIDTH//2 + 200, 245], radius=14, fill=(59, 130, 246))
        draw.text((WIDTH//2, 215), "CaptoDesk.com", font=font_hook, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 330), "Never Lose a Job to", font=font_title, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, 390), "Voicemail Again.", font=font_title, fill=(251, 191, 36), anchor="mm")

        draw.text((WIDTH//2, 490), "⚡ 15-Sec Automated SMS Text-Back", font=font_body, fill=(243, 244, 246), anchor="mm")
        draw.text((WIDTH//2, 545), "📅 24/7 Google & IG Booking Calendar", font=font_body, fill=(243, 244, 246), anchor="mm")
        draw.text((WIDTH//2, 600), "💳 Driveway Apple Pay & Auto Reviews", font=font_body, fill=(243, 244, 246), anchor="mm")

        pulse_cta = int(6 * math.sin(t * 8))
        draw.rounded_rectangle([60, 710, WIDTH - 60, 810 + pulse_cta], radius=24, fill=(251, 191, 36))
        draw.text((WIDTH//2, 760 + pulse_cta//2), "TRY FIRST 3 JOBS 100% FREE", font=font_cta, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 880), "No Credit Card Required • $0 Platform Fees", font=font_sub, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 930), "Tap Link in Bio to Claim Starter Pass", font=font_body, fill=(147, 197, 253), anchor="mm")

    # Bottom Progress Bar
    prog_w = int(WIDTH * (f / TOTAL_FRAMES))
    draw.rectangle([0, HEIGHT - 10, prog_w, HEIGHT], fill=(59, 130, 246))

    frame_np = np.array(bg_frame)
    writer.append_data(frame_np)

writer.close()
r_plumber.close()
r_workers.close()
r_phone.close()
print("Raw B-Roll Video rendering complete!")

# ─────────────────────────────────────────────────────────────
# D. COMPOSE AUDIO: CLEAN SEQUENTIAL VOICEOVER + BEAT + SFX
# ─────────────────────────────────────────────────────────────
ms_v1 = int(0.35 * 1000)
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
    f"[5:a]adelay=100|100,volume=0.25[ring];"
    f"[6:a]adelay={ms_sms}|{ms_sms},volume=0.45[sms];"
    f"[7:a]adelay={ms_success}|{ms_success},volume=0.4[success];"
    f"[8:a]atrim=0:{t_total:.2f},afade=t=in:ss=0:d=1,afade=t=out:st={t_total-1.8:.2f}:d=1.8,volume=0.10[beat];"
    "[v1][v2][v3][v4][ring][sms][success][beat]amix=inputs=8:duration=longest:dropout_transition=0,"
    "volume=2.4[aout]"
)

cmd = [
    ffmpeg, "-y",
    "-i", raw_broll_mp4,
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

print("Executing FFmpeg audio & B-Roll muxing...")
p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
if p.returncode == 0:
    print(f"SUCCESS! Master B-Roll Reel exported to {final_output_mp4}")
    print(f"Size: {os.path.getsize(final_output_mp4)/1024:.1f} KB")
else:
    print("FFmpeg error:", p.stderr)
