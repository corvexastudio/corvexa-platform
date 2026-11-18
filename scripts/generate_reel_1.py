"""
CaptoDesk 9:16 Vertical Reel Generator
Generates a 12-second high-retention vertical video (720x1280, 24fps)
formatted for Instagram Reels, Facebook Reels, TikTok & YouTube Shorts.
"""
import os
import math
import numpy as np
import imageio
from PIL import Image, ImageDraw, ImageFont

WIDTH = 720
HEIGHT = 1280
FPS = 24
DURATION = 12  # seconds
TOTAL_FRAMES = FPS * DURATION

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REG = "C:/Windows/Fonts/segoeui.ttf"

font_title = ImageFont.truetype(FONT_BOLD, 42)
font_hook = ImageFont.truetype(FONT_BOLD, 36)
font_body = ImageFont.truetype(FONT_BOLD, 28)
font_sub = ImageFont.truetype(FONT_REG, 24)
font_pill = ImageFont.truetype(FONT_BOLD, 20)
font_cta = ImageFont.truetype(FONT_BOLD, 32)

output_mp4 = r"C:\Users\mskar\captodesk\public\marketing\captodesk_reel_1.mp4"
os.makedirs(os.path.dirname(output_mp4), exist_ok=True)

writer = imageio.get_writer(
    output_mp4, 
    fps=FPS, 
    format='mp4', 
    codec='libx264',
    ffmpeg_params=['-pix_fmt', 'yuv420p', '-b:v', '2500k']
)

print(f"Rendering {TOTAL_FRAMES} frames ({DURATION}s @ {FPS}fps) to {output_mp4}...")

for f in range(TOTAL_FRAMES):
    t = f / FPS
    img = Image.new("RGB", (WIDTH, HEIGHT), (11, 15, 25))
    draw = ImageDraw.Draw(img)

    # Ambient Background Gradient Accent
    accent_y = int(HEIGHT * 0.4 + 40 * math.sin(t * 2))
    draw.ellipse([WIDTH//2 - 250, accent_y - 250, WIDTH//2 + 250, accent_y + 250], fill=(16, 28, 55))

    # Top Brand Header
    draw.text((WIDTH//2, 80), "CaptoDesk", font=font_sub, fill=(156, 163, 175), anchor="mm")
    draw.line([(WIDTH//2 - 100, 110), (WIDTH//2 + 100, 110)], fill=(31, 41, 55), width=2)

    # ── SCENE 1: THE HOOK (0s - 3.2s) ──
    if t < 3.2:
        # Yellow Hook Pill
        pill_text = "NEVER ANSWER THIS CALL 🚫"
        draw.rounded_rectangle([WIDTH//2 - 280, 180, WIDTH//2 + 280, 245], radius=14, fill=(251, 191, 36))
        draw.text((WIDTH//2, 212), pill_text, font=font_hook, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 290), "When you're under a sink or on a ladder...", font=font_sub, fill=(209, 213, 219), anchor="mm")

        # Ringing Phone Card
        pulse = 10 * math.sin(t * 12)
        card_top = 420
        draw.rounded_rectangle([60, card_top, WIDTH - 60, card_top + 420], radius=24, fill=(17, 24, 39), outline=(55, 65, 81), width=2)
        
        draw.text((WIDTH//2, card_top + 60), "Incoming Call", font=font_sub, fill=(156, 163, 175), anchor="mm")
        draw.text((WIDTH//2, card_top + 120), "Homeowner (Water Leak)", font=font_title, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, card_top + 170), "+1 (555) 234-8901", font=font_sub, fill=(107, 114, 128), anchor="mm")

        # Pulsing Call Ring Buttons
        btn_r = int(45 + pulse * 0.3)
        draw.ellipse([WIDTH//2 - 160 - btn_r, card_top + 300 - btn_r, WIDTH//2 - 160 + btn_r, card_top + 300 + btn_r], fill=(239, 68, 68))
        draw.text((WIDTH//2 - 160, card_top + 300), "Decline", font=font_pill, fill=(255, 255, 255), anchor="mm")

        draw.ellipse([WIDTH//2 + 160 - btn_r, card_top + 300 - btn_r, WIDTH//2 + 160 + btn_r, card_top + 300 + btn_r], fill=(16, 185, 129))
        draw.text((WIDTH//2 + 160, card_top + 300), "Answer", font=font_pill, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 940), "Should you climb down and drop your tools?", font=font_body, fill=(156, 163, 175), anchor="mm")

    # ── SCENE 2: THE VOICEMAIL TRAP (3.2s - 6.5s) ──
    elif t < 6.5:
        draw.rounded_rectangle([WIDTH//2 - 240, 180, WIDTH//2 + 240, 245], radius=14, fill=(239, 68, 68))
        draw.text((WIDTH//2, 212), "CALL SENT TO VOICEMAIL ❌", font=font_hook, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 320), "Here's what happens in 2026:", font=font_title, fill=(255, 255, 255), anchor="mm")

        # Big Stat Callout Card
        draw.rounded_rectangle([60, 400, WIDTH - 60, 680], radius=24, fill=(24, 24, 27), outline=(239, 68, 68), width=2)
        draw.text((WIDTH//2, 460), "82% OF HOMEOWNERS", font=font_title, fill=(248, 113, 113), anchor="mm")
        draw.text((WIDTH//2, 530), "hang up on voicemail and call", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 580), "the NEXT guy on Google Maps.", font=font_title, fill=(255, 255, 255), anchor="mm")

        # Lost Money Badge
        draw.rounded_rectangle([WIDTH//2 - 200, 750, WIDTH//2 + 200, 830], radius=20, fill=(69, 10, 10))
        draw.text((WIDTH//2, 790), "Lost Job: $800 - $1,500 💸", font=font_title, fill=(248, 113, 113), anchor="mm")

        draw.text((WIDTH//2, 940), "By the time you call back, they hired someone else.", font=font_sub, fill=(156, 163, 175), anchor="mm")

    # ── SCENE 3: THE CAPTODESK RESCUE (6.5s - 9.5s) ──
    elif t < 9.5:
        draw.rounded_rectangle([WIDTH//2 - 250, 180, WIDTH//2 + 250, 245], radius=14, fill=(16, 185, 129))
        draw.text((WIDTH//2, 212), "10-SECOND AUTO TEXT-BACK ⚡", font=font_hook, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 280), "While your hands stay on the tools:", font=font_sub, fill=(209, 213, 219), anchor="mm")

        # SMS Thread Simulation Card
        card_top = 340
        draw.rounded_rectangle([50, card_top, WIDTH - 50, card_top + 480], radius=24, fill=(17, 24, 39), outline=(55, 65, 81), width=1)
        
        # Outbound Text Bubble (Blue)
        draw.rounded_rectangle([120, card_top + 40, WIDTH - 80, card_top + 200], radius=18, fill=(37, 99, 235))
        draw.text((145, card_top + 60), "Hey! Sorry I missed your call, on a job.", font=font_sub, fill=(255, 255, 255))
        draw.text((145, card_top + 95), "Grab an open slot on my schedule here:", font=font_sub, fill=(255, 255, 255))
        draw.text((145, card_top + 130), "book.captodesk.com/mike", font=font_body, fill=(191, 219, 254))
        draw.text((WIDTH - 100, card_top + 175), "10:14 AM • Auto-sent", font=font_pill, fill=(191, 219, 254), anchor="ra")

        # Inbound Customer Reply Bubble (Grey)
        draw.rounded_rectangle([80, card_top + 240, WIDTH - 140, card_top + 360], radius=18, fill=(55, 65, 81))
        draw.text((105, card_top + 265), "Thanks Mike! Just booked", font=font_sub, fill=(255, 255, 255))
        draw.text((105, card_top + 300), "for Thursday 9am for diagnostic.", font=font_sub, fill=(255, 255, 255))

        # Green Confirmation Badge
        draw.rounded_rectangle([WIDTH//2 - 220, card_top + 400, WIDTH//2 + 220, card_top + 455], radius=14, fill=(6, 78, 59))
        draw.text((WIDTH//2, card_top + 428), "✓ Confirmed Appointment • $0 Phone Tag", font=font_pill, fill=(52, 211, 153), anchor="mm")

        draw.text((WIDTH//2, 920), "Homeowner locked in before calling anyone else.", font=font_sub, fill=(156, 163, 175), anchor="mm")

    # ── SCENE 4: CALL TO ACTION (9.5s - 12.0s) ──
    else:
        draw.rounded_rectangle([WIDTH//2 - 200, 200, WIDTH//2 + 200, 260], radius=14, fill=(59, 130, 246))
        draw.text((WIDTH//2, 230), "CaptoDesk.com", font=font_hook, fill=(255, 255, 255), anchor="mm")

        draw.text((WIDTH//2, 350), "Never Lose a Job to", font=font_title, fill=(255, 255, 255), anchor="mm")
        draw.text((WIDTH//2, 410), "Voicemail Again.", font=font_title, fill=(251, 191, 36), anchor="mm")

        # Feature Stack
        draw.text((WIDTH//2, 520), "⚡ 15-Sec Automated SMS Text-Back", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 575), "📅 24/7 Google & IG Booking Calendar", font=font_body, fill=(229, 231, 235), anchor="mm")
        draw.text((WIDTH//2, 630), "💳 Driveway Apple Pay & Auto Reviews", font=font_body, fill=(229, 231, 235), anchor="mm")

        # Big Yellow CTA Box
        pulse_cta = int(5 * math.sin(t * 8))
        draw.rounded_rectangle([60, 740, WIDTH - 60, 840 + pulse_cta], radius=24, fill=(251, 191, 36))
        draw.text((WIDTH//2, 790 + pulse_cta//2), "TRY FIRST 3 JOBS 100% FREE", font=font_cta, fill=(0, 0, 0), anchor="mm")

        draw.text((WIDTH//2, 910), "No Credit Card Required • $0 Platform Fees", font=font_sub, fill=(156, 163, 175), anchor="mm")
        draw.text((WIDTH//2, 960), "Tap Link in Bio to Claim Your Pass", font=font_body, fill=(96, 165, 250), anchor="mm")

    # Bottom Progress Bar
    prog_w = int(WIDTH * (f / TOTAL_FRAMES))
    draw.rectangle([0, HEIGHT - 10, prog_w, HEIGHT], fill=(59, 130, 246))

    frame_np = np.array(img)
    writer.append_data(frame_np)

writer.close()
print(f"DONE! Reel exported to {output_mp4} ({os.path.getsize(output_mp4) / 1024:.1f} KB)")
