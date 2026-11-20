import asyncio
import edge_tts
import os
import subprocess
import imageio_ffmpeg

MARKETING_DIR = r"C:\Users\mskar\captodesk\public\marketing"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

VOICE = "en-US-ChristopherNeural"

scenes = [
    {
        "id": "v3_s1",
        "text": "The worst feeling in the trades? Finishing a clean twelve hundred dollar job on Friday, and spending the next three weeks chasing an unpaid paper check."
    },
    {
        "id": "v3_s2",
        "text": "Stop playing the awkward driveway dance or carrying broken card swipers. With CaptoDesk, you send an instant one-tap checkout straight to their phone."
    },
    {
        "id": "v3_s3",
        "text": "The customer taps Apple Pay or card. Boom! Twelve hundred dollars hits your bank account in ten seconds, before you even put your truck in reverse."
    },
    {
        "id": "v3_s4",
        "text": "No paper invoices. No card swiper dongles. And your first three customer jobs are one hundred percent free with zero platform fees. Start today at CaptoDesk dot com."
    }
]

async def generate():
    os.makedirs(MARKETING_DIR, exist_ok=True)
    durations = []
    
    for sc in scenes:
        mp3_path = os.path.join(MARKETING_DIR, f"{sc['id']}.mp3")
        comm = edge_tts.Communicate(sc['text'], VOICE, rate="+6%")
        await comm.save(mp3_path)
        
        # Probe duration using ffprobe/ffmpeg
        cmd = [
            ffmpeg, "-i", mp3_path
        ]
        proc = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        # Parse Duration: 00:00:06.45
        import re
        m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", proc.stderr)
        dur = 0.0
        if m:
            dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
        durations.append((sc['id'], dur, mp3_path))
        print(f"Generated {sc['id']}: {dur:.2f}s")
    
    total_speech = sum(d[1] for d in durations)
    print(f"\nTotal speech duration: {total_speech:.2f}s")
    
    # Save metadata JSON for the video renderer
    import json
    meta = {
        "voice": VOICE,
        "scenes": [
            {"id": d[0], "duration": d[1], "file": d[2]}
            for d in durations
        ],
        "total_duration": total_speech + 1.2 # padding
    }
    with open(os.path.join(MARKETING_DIR, "v3_audio_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

if __name__ == "__main__":
    asyncio.run(generate())
