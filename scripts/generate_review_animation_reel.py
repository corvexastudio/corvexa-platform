"""
CaptoDesk 100% Animated 9:16 Vertical Reel:
"Why the Guy with Worse Work Gets More Calls Than You" (Google Reviews / SEO Dominance)
Pure Motion Graphics, Kinetic UI, Vector Stars, and Dynamic Cards.
Zero stock footage — 100% code-driven animation.
"""
import os
import math
import subprocess
import numpy as np
import imageio
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

MARKETING_DIR = r"C:\Users\mskar\captodesk\public\marketing"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

raw_anim_mp4 = os.path.join(MARKETING_DIR, "raw_review_anim_temp.mp4")
final_output_mp4 = os.path.join(MARKETING_DIR, "captodesk_reel_reviews_animated.mp4")

# Audio Inputs
r1 = os.path.join(MARKETING_DIR, "r1.mp3")
r2 = os.path.join(MARKETING_DIR, "r2.mp3")
r3 = os.path.join(MARKETING_DIR, "r3.mp3")
r4 = os.path.join(MARKETING_DIR, "r4.mp3")
bg_music = os.path.join(MARKETING_DIR, "trending_beat_master.mp3")
sfx_sms = os.path.join(MARKETING_DIR, "sfx_sms.wav")
sfx_stars = os.path.join(MARKETING_DIR, "sfx_star_dings.wav")
sfx_success = os.path.join(MARKETING_DIR, "sfx_success.wav")

# Video dimensions & framerate
WIDTH = 720
HEIGHT = 1280
FPS = 24

t_s2 = 7.28
t_s3 = 15.46
t_s4 = 21.19
t_total = 29.76
TOTAL_FRAMES = int(round(t_total * FPS))

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REG = "C:/Windows/Fonts/segoeui.ttf"

font_title = ImageFont.truetype(FONT_BOLD, 38)
font_hook = ImageFont.truetype(FONT_BOLD, 34)
font_body = ImageFont.truetype(FONT_BOLD, 26)
font_sub = ImageFont.truetype(FONT_REG, 23)
font_pill = ImageFont.truetype(FONT_BOLD, 20)
font_mini = ImageFont.truetype(FONT_REG, 18)
font_cta = ImageFont.truetype(FONT_BOLD, 32)
font_stat = ImageFont.truetype(FONT_BOLD, 46)

def draw_star(draw, cx, cy, r_outer, r_inner, fill):
    points = []
    for i in range(10):
        r = r_outer if i % 2 == 0 else r_inner
        angle = i * math.pi / 5 - math.pi / 2
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        points.append((x, y))
    draw.polygon(points, fill=fill)

writer = imageio.get_writer(
    raw_anim_mp4,
    fps=FPS,
    format='mp4',
    codec='libx264',
    ffmpeg_params=['-pix_fmt', 'yuv420p', '-b:v', '2600k']
)

print(f"Rendering {TOTAL_FRAMES} frames of pure animation ({t_total}s @ {FPS}fps)...")

for f in range(TOTAL_FRAMES):
    t = f / FPS
    img = Image.new("RGB", (WIDTH, HEIGHT), (11, 15, 25))
    draw = ImageDraw.Draw(img)

    # Ambient Background Pulsing Light Accent
    accent_y = int(HEIGHT * 0.42 + 35 * math.sin(t * 1.6))
    draw.ellipse([WIDTH//2 - 270, accent_y - 270, WIDTH//2 + 270, accent_y + 270], fill=(16, 28, 55))
    draw.ellipse([WIDTH//2 - 180, accent_y - 180, WIDTH//2 + 180, accent_y + 180], fill=(20, 36, 70))

    # Top Brand Header
    draw.text((WIDTH//2, 75), "CaptoDesk", font=font_sub, fill=(156, 163, 175), anchor="mm")
    draw.line([(WIDTH//2 - 90, 105), (WIDTH//2 + 90, 105)], fill=(31, 41, 55), width=2)

    # ─────────────────────────────────────────────────────────
    # SCENE 1: THE UNFAIR GOOGLE CONTRAST (0.00s - 7.28s)
    # ─────────────────────────────────────────────────────────
    if t < t_s2:
        draw.rounded_rectangle([WIDTH//2 - 280, 175, WIDTH//2 + 280, 240], radius=14, fill=(251, 191, 36))
        draw.text((WIDTH//2, 207), "THE UNFAIR GOOGLE TRUTH ⚠️", font=font_hook, fill=(0, 0, 0), anchor="mm")
        draw.text((WIDTH//2, 285), "Why the other guy gets all the calls...", font=font_sub, fill=(209, 213, 219), anchor="mm")

        # Fake Google Maps Search Bar
        draw.rounded_rectangle([60, 340, WIDTH - 60, 400], radius=16, fill=(31, 41, 55), outline=(75, 85, 99), width=1)
        draw.text((90, 370), "🔍  Emergency Plumber Near Me", font=font_sub, fill=(229, 231, 235), anchor="lm")
        draw.text((WIDTH - 90, 370), "MAPS", font=font_pill, fill=(96, 165, 250), anchor="rm")

        # Competitor Card (Green Glowing #1)
        pulse_green = int(4 * math.sin(t * 8))
        draw.rounded_rectangle([50, 430, WIDTH - 50, 620], radius=20, fill=(17, 24, 39), outline=(16, 185, 129), width=2)
        
        # Rank Pill
        draw.rounded_rectangle([75, 455, 260, 495], radius=10, fill=(6, 78, 59))
        draw.text((167, 475), "#1 ON GOOGLE", font=font_pill, fill=(52, 211, 153), anchor="mm")

        draw.text((WIDTH - 75, 475), "8+ Calls / Day", font=font_pill, fill=(52, 211, 153), anchor="rm")
        draw.text((75, 525), "Apex Plumbing & Drains", font=font_title, fill=(255, 255, 255), anchor="lm")

        # 5 Gold Stars
        for i in range(5):
            draw_star(draw, 90 + i * 28, 570, 10, 4, (251, 191, 36))
        draw.text((245, 570), "4.9 (184 reviews)", font=font_body, fill=(251, 191, 36), anchor="lm")

        # You (Red Card Buried on Page 2)
        draw.rounded_rectangle([50, 650, WIDTH - 50, 840], radius=20, fill=(24, 24, 27), outline=(239, 68, 68), width=2)
        
        draw.rounded_rectangle([75, 675, 300, 715], radius=10, fill=(69, 10, 10))
        draw.text((187, 695), "#14 BURIED ON PAGE 2", font=font_pill, fill=(248, 113, 113), anchor="mm")

        draw.text((WIDTH - 75, 695), "1 Call / Week", font=font_pill, fill=(248, 113, 113), anchor="rm")
        draw.text((75, 745), "Mike's Master Plumbing", font=font_title, fill=(156, 163, 175), anchor="lm")

        for i in range(5):
            draw_star(draw, 90 + i * 28, 790, 10, 4, (251, 191, 36))
        draw.text((245, 790), "5.0 (14 reviews)", font=font_body, fill=(156, 163, 175), anchor="lm")

        draw.text((WIDTH//2, 920), "Better craftsmanship. Zero calls.", font=font_body, fill=(248, 113, 113), anchor="mm")
        draw.text((WIDTH//2, 960), "Homeowners never scroll past the top 3.", font=font_sub, fill=(156, 163, 175), anchor="mm")

    # ─────────────────────────────────────────────────────────
    # SCENE 2: THE 2-NUMBER RULE & 87% STAT (7.28s - 15.46s)
    # ─────────────────────────────────────────────────────────
    elif t < t_s3:
        draw.rounded_rectangle([WIDTH//2 - 250, 175, WIDTH//2 + 250, 240], radius=14, fill=(239, 68, 68))
        draw.text((WIDTH//2, 207), "THE 2-NUMBER RULE 📊", font=font_hook, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 290), "Homeowners only look at two numbers:", font=font_title, fill=(255, 255, 255), anchor="mm")

        # Two Metric Display Cards
        draw.rounded_rectangle([50, 360, WIDTH//2 - 15, 490], radius=18, fill=(17, 24, 39), outline=(59, 130, 246), width=2)
        draw.text((WIDTH//4 + 10, 400), "⭐ RATING", font=font_pill, fill=(96, 165, 250), anchor="mm")
        draw.text((WIDTH//4 + 10, 450), "4.8+", font=font_stat, fill=(255, 255, 255), anchor="mm")

        draw.rounded_rectangle([WIDTH//2 + 15, 360, WIDTH - 50, 490], radius=18, fill=(17, 24, 39), outline=(16, 185, 129), width=2)
        draw.text((3*WIDTH//4 - 10, 400), "💬 COUNT", font=font_pill, fill=(52, 211, 153), anchor="mm")
        draw.text((3*WIDTH//4 - 10, 450), "100+", font=font_stat, fill=(255, 255, 255), anchor="mm")

        # Big Shocking Stat Callout
        draw.rounded_rectangle([50, 530, WIDTH - 50, 770], radius=24, fill=(24, 24, 27), outline=(251, 191, 36), width=2)
        draw.text((WIDTH//2, 590), "87% OF HOMEOWNERS", font=font_stat, fill=(251, 191, 36), anchor="mm")
        draw.text((WIDTH//2, 650), "hire one of the TOP 3 contractors", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 695), "with the highest review count.", font=font_title, fill=(255, 255, 255), anchor="mm")

        # Cost Tag
        draw.rounded_rectangle([WIDTH//2 - 200, 810, WIDTH//2 + 200, 875], radius=16, fill=(69, 10, 10))
        draw.text((WIDTH//2, 842), "Lost Revenue: $15,000+/mo 💸", font=font_title, fill=(248, 113, 113), anchor="mm")

        draw.text((WIDTH//2, 935), "They don't know pipe solder. They look at reviews.", font=font_sub, fill=(156, 163, 175), anchor="mm")

    # ─────────────────────────────────────────────────────────
    # SCENE 3: CAPTODESK 15-MIN AUTO REVIEW (15.46s - 21.19s)
    # ─────────────────────────────────────────────────────────
    elif t < t_s4:
        draw.rounded_rectangle([WIDTH//2 - 270, 175, WIDTH//2 + 270, 240], radius=14, fill=(16, 185, 129))
        draw.text((WIDTH//2, 207), "15-MIN AUTO REVIEW INVITE ⚡", font=font_hook, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 280), "While your customer is still smiling:", font=font_sub, fill=(209, 213, 219), anchor="mm")

        card_top = 340
        draw.rounded_rectangle([50, card_top, WIDTH - 50, card_top + 480], radius=24, fill=(17, 24, 39), outline=(55, 65, 81), width=1)
        
        # Outbound Review Invite SMS
        draw.rounded_rectangle([100, card_top + 35, WIDTH - 70, card_top + 185], radius=18, fill=(37, 99, 235))
        draw.text((125, card_top + 55), "Hey Sarah! Mike here from CaptoDesk Plumbing.", font=font_sub, fill=(255, 255, 255))
        draw.text((125, card_top + 88), "Thanks for having us out! Mind leaving us", font=font_sub, fill=(255, 255, 255))
        draw.text((125, card_top + 120), "a quick 5-star Google review here:", font=font_sub, fill=(255, 255, 255))
        draw.text((125, card_top + 150), "g.page/mike-plumbing/review", font=font_body, fill=(191, 219, 254))

        # 5 Gold Animated Stars Lighting Up
        stars_t = t - 15.46
        lit_count = min(5, max(1, int(stars_t * 3.5)))
        
        draw.rounded_rectangle([70, card_top + 215, WIDTH - 70, card_top + 330], radius=18, fill=(31, 41, 55), outline=(251, 191, 36), width=2)
        draw.text((WIDTH//2, card_top + 245), "CUSTOMER LEFT A 5-STAR REVIEW!", font=font_pill, fill=(251, 191, 36), anchor="mm")

        for i in range(5):
            fill_color = (251, 191, 36) if i < lit_count else (75, 85, 99)
            draw_star(draw, WIDTH//2 - 90 + i * 45, card_top + 290, 16, 7, fill_color)

        # Inbound Review Notification
        draw.rounded_rectangle([70, card_top + 360, WIDTH - 70, card_top + 440], radius=16, fill=(6, 78, 59))
        draw.text((WIDTH//2, card_top + 388), "✓ New Google Review Added to Maps!", font=font_body, fill=(52, 211, 153), anchor="mm")
        draw.text((WIDTH//2, card_top + 418), '"Mike fixed the leak in 30 mins, super clean!"', font=font_mini, fill=(167, 243, 208), anchor="mm")

        draw.text((WIDTH//2, 920), "40 reviews in 60 days. You hit #1 in your zip code.", font=font_sub, fill=(156, 163, 175), anchor="mm")

    # ─────────────────────────────────────────────────────────
    # SCENE 4: RANKING PAYOFF & CALL TO ACTION (21.19s - 29.76s)
    # ─────────────────────────────────────────────────────────
    else:
        draw.rounded_rectangle([WIDTH//2 - 200, 185, WIDTH//2 + 200, 245], radius=14, fill=(59, 130, 246))
        draw.text((WIDTH//2, 215), "CaptoDesk.com", font=font_hook, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 320), "Hit #1 on Google Maps.", font=font_title, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, 380), "On 100% Autopilot.", font=font_title, fill=(251, 191, 36), anchor="mm")

        # Features Stack
        draw.text((WIDTH//2, 480), "⭐ 15-Min Automated Review SMS", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 535), "⚡ 10-Second Missed Call Text-Back", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 590), "💳 Driveway Apple Pay & 24/7 Booking", font=font_body, fill=(229, 231, 235), anchor="mm")

        # Milestone Badge
        draw.rounded_rectangle([WIDTH//2 - 220, 640, WIDTH//2 + 220, 695], radius=14, fill=(6, 78, 59))
        draw.text((WIDTH//2, 668), "🏆 +40 Five-Star Reviews in 60 Days", font=font_pill, fill=(52, 211, 153), anchor="mm")

        pulse_cta = int(6 * math.sin(t * 8))
        draw.rounded_rectangle([60, 730, WIDTH - 60, 830 + pulse_cta], radius=24, fill=(251, 191, 36))
        draw.text((WIDTH//2, 780 + pulse_cta//2), "TRY FIRST 3 JOBS 100% FREE", font=font_cta, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 895), "No Credit Card Required • $0 Platform Fees", font=font_sub, fill=(156, 163, 175), anchor="mm")
        draw.text((WIDTH//2, 945), "Tap Link in Bio to Claim Starter Pass", font=font_body, fill=(96, 165, 250), anchor="mm")

    # Bottom Progress Bar
    prog_w = int(WIDTH * (f / TOTAL_FRAMES))
    draw.rectangle([0, HEIGHT - 10, prog_w, HEIGHT], fill=(59, 130, 246))

    frame_np = np.array(img)
    writer.append_data(frame_np)

writer.close()
print("Raw animation video complete!")

# ─────────────────────────────────────────────────────────────
# COMPOSE MULTI-TRACK AUDIO (VOICEOVER + BEAT + STAR DINGS)
# ─────────────────────────────────────────────────────────────
ms_v1 = int(0.35 * 1000)
ms_v2 = int(t_s2 * 1000)
ms_v3 = int(t_s3 * 1000)
ms_v4 = int(t_s4 * 1000)
ms_sms = int((t_s3 + 0.1) * 1000)
ms_stars = int((t_s3 + 2.0) * 1000)
ms_success = int((t_s4 + 1.8) * 1000)

filter_complex = (
    f"[1:a]adelay={ms_v1}|{ms_v1},volume=1.0[v1];"
    f"[2:a]adelay={ms_v2}|{ms_v2},volume=1.0[v2];"
    f"[3:a]adelay={ms_v3}|{ms_v3},volume=1.0[v3];"
    f"[4:a]adelay={ms_v4}|{ms_v4},volume=1.0[v4];"
    f"[5:a]adelay={ms_sms}|{ms_sms},volume=0.45[sms];"
    f"[6:a]adelay={ms_stars}|{ms_stars},volume=0.5[stars];"
    f"[7:a]adelay={ms_success}|{ms_success},volume=0.4[success];"
    f"[8:a]atrim=0:{t_total:.2f},afade=t=in:ss=0:d=1,afade=t=out:st={t_total-1.8:.2f}:d=1.8,volume=0.10[beat];"
    "[v1][v2][v3][v4][sms][stars][success][beat]amix=inputs=8:duration=longest:dropout_transition=0,"
    "volume=2.4[aout]"
)

cmd = [
    ffmpeg, "-y",
    "-i", raw_anim_mp4,
    "-i", r1,
    "-i", r2,
    "-i", r3,
    "-i", r4,
    "-i", sfx_sms,
    "-i", sfx_stars,
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

print("Executing FFmpeg animation & audio compositing...")
p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
if p.returncode == 0:
    print(f"SUCCESS! Master Animated Reel exported to {final_output_mp4}")
    print(f"Size: {os.path.getsize(final_output_mp4)/1024:.1f} KB")
else:
    print("FFmpeg error:", p.stderr)
