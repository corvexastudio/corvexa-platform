import os
import subprocess
import imageio_ffmpeg

MARKETING_DIR = r"C:\Users\mskar\captodesk\public\marketing"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

def make_sfx():
    # 1. Whoosh transition (filtered noise sweep)
    whoosh_path = os.path.join(MARKETING_DIR, "v3_whoosh.wav")
    subprocess.run([
        ffmpeg, "-y", "-f", "lavfi",
        "-i", "anoisesrc=d=0.45:c=pink:r=44100,lowpass=f=1200,volume=1.8,afade=t=in:ss=0:d=0.15,afade=t=out:st=0.25:d=0.2",
        whoosh_path
    ], check=True, stderr=subprocess.DEVNULL)
    print("Created Whoosh SFX")

    # 2. iPhone SMS Ping (chime at 1046Hz & 1318Hz)
    ping_path = os.path.join(MARKETING_DIR, "v3_sms_ping.wav")
    subprocess.run([
        ffmpeg, "-y", "-f", "lavfi",
        "-i", "aevalsrc=0.4*sin(2*PI*1046.5*t)*exp(-10*t)+0.5*sin(2*PI*1318.5*t)*exp(-8*t):s=44100:d=0.5,volume=1.5",
        ping_path
    ], check=True, stderr=subprocess.DEVNULL)
    print("Created SMS Ping SFX")

    # 3. Apple Pay Double-Tone Chime
    apple_pay_path = os.path.join(MARKETING_DIR, "v3_apple_pay.wav")
    subprocess.run([
        ffmpeg, "-y", "-f", "lavfi",
        "-i", "aevalsrc=0.5*sin(2*PI*1174.66*t)*exp(-10*t)+0.6*sin(2*PI*1567.98*t)*exp(-8*t):s=44100:d=0.6,volume=1.6",
        apple_pay_path
    ], check=True, stderr=subprocess.DEVNULL)
    print("Created Apple Pay SFX")

    # 4. Cash Register / Success Cha-Ching
    cash_path = os.path.join(MARKETING_DIR, "v3_cash.wav")
    subprocess.run([
        ffmpeg, "-y", "-f", "lavfi",
        "-i", "aevalsrc=0.4*sin(2*PI*1760*t)*exp(-7*t)+0.4*sin(2*PI*2637*t)*exp(-9*t)+0.3*sin(2*PI*3520*t)*exp(-11*t):s=44100:d=0.7,volume=1.8",
        cash_path
    ], check=True, stderr=subprocess.DEVNULL)
    print("Created Cash Register SFX")

if __name__ == "__main__":
    make_sfx()
