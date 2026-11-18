import os
import time
import requests

page_token = 'EAAW7XpyqZAyUBTAMZCjlpxshDWsomeYLrn7ZCZC4PI4pCCgzDc4FB4eJPE9K4IzZAPP7hoeXJyDy0LFkhhFNrAz0paiWIwwwyAGeQfxDBTSXWfqqaulCzj0wionzOZB51cLSyMOsfJoQysiJuNONWz4LQ2KJWPQUDZCkzmcqBYZC2KWSf33yNcZAJGc8heJLFqCE1dCibJZAHmpr76kqfV3ZAZBIZCSNEInjNZAkVrio2Vit9eXmdgZATrmW82cKmxb'
page_id = '1511312668725364'
ig_id = '17841473193109298'

video_path = r'C:\Users\mskar\captodesk\public\marketing\captodesk_reel_1.mp4'
public_url = 'https://captodesk.com/marketing/captodesk_reel_1.mp4'

caption = """If you're under a cast-iron sink or 20 feet up on an extension ladder, DO NOT answer your phone.

Here’s why:
82% of homeowners don't leave voicemails anymore. If they hit your voicemail greeting, they hang up and dial the next contractor on Google Maps. 

By the time you wipe the grease off your hands and call back 15 minutes later?
"Thanks man, but someone already picked up and they're coming at 2."

That’s an $800 to $1,500 ticket gone in 15 seconds.

Instead of dropping your tools or scrambling down a ladder:
CaptoDesk spots the missed call and instantly texts them back within 10 seconds:
"Hey! Sorry I missed you, shoulder-deep on a job right now. Grab an open slot directly on my schedule here: book.captodesk.com or shoot me a quick text with what you need."

They book their own slot. Your day stays full. You don't play phone tag at 7 PM during dinner.

Your first 3 jobs are completely free to try.
Link is in bio — or head to captodesk.com.

#trades #contractor #contractorlife #plumber #electrician #hvac #hvaclife #bluecollar #servicebusiness #fieldservice #smallbusinessowner #captodesk"""

# ── 1. PUBLISH AS FACEBOOK REEL / VIDEO ──
print("--- [1/2] Publishing Video/Reel to Facebook Page ---")
try:
    with open(video_path, 'rb') as f:
        r_fb = requests.post(
            f'https://graph.facebook.com/v20.0/{page_id}/videos',
            data={
                'description': caption,
                'title': 'Never Answer This Call - Stop Losing Jobs to Voicemail',
                'access_token': page_token
            },
            files={'source': f}
        )
        fb_res = r_fb.json()
        print("Facebook Video Response:", fb_res)
        fb_video_id = fb_res.get('id')
        if fb_video_id:
            print(f"SUCCESS: Facebook Video/Reel uploaded! ID: {fb_video_id}")
        else:
            print(f"Facebook Video returned: {fb_res}")
except Exception as e:
    print("Facebook Video Exception:", e)

# ── 2. PUBLISH AS INSTAGRAM REEL ──
print("\n--- [2/2] Publishing Reel to Instagram Business Account ---")
# Check if Vercel has deployed the video
print("Verifying public URL accessibility on captodesk.com...")
deployed = False
for attempt in range(15):
    try:
        r = requests.head(public_url, timeout=5)
        if r.status_code == 200:
            print(f"Video URL is live (200 OK): {public_url}")
            deployed = True
            break
        else:
            print(f"Status code {r.status_code}, waiting...")
    except Exception as e:
        print(f"Request attempt error: {e}")
    time.sleep(4)

if not deployed:
    print("WARNING: Public URL not returning 200 yet, attempting anyway...")

try:
    # Step A: Create IG Reels Media Container
    print("Creating Instagram Reel container...")
    r_cont = requests.post(
        f'https://graph.facebook.com/v20.0/{ig_id}/media',
        data={
            'media_type': 'REELS',
            'video_url': public_url,
            'caption': caption,
            'share_to_feed': 'true',
            'access_token': page_token
        }
    )
    cont_res = r_cont.json()
    print("IG Container Response:", cont_res)
    creation_id = cont_res.get('id')

    if not creation_id:
        print(f"Failed to create IG reel container: {cont_res}")
    else:
        print(f"Container created successfully: {creation_id}")
        
        # Step B: Poll until container status is FINISHED
        print("Polling Meta video transcoding and ingest status...")
        for poll_i in range(30):
            r_status = requests.get(
                f'https://graph.facebook.com/v20.0/{creation_id}',
                params={
                    'fields': 'status_code,status',
                    'access_token': page_token
                }
            )
            s_data = r_status.json()
            status_code = s_data.get('status_code')
            print(f"Poll {poll_i+1}: status_code = {status_code} ({s_data.get('status')})")
            
            if status_code == 'FINISHED':
                break
            elif status_code == 'ERROR':
                print(f"Meta video processing failed: {s_data}")
                break
            time.sleep(5)

        # Step C: Publish the Reel
        print("Publishing Instagram Reel...")
        r_pub = requests.post(
            f'https://graph.facebook.com/v20.0/{ig_id}/media_publish',
            data={
                'creation_id': creation_id,
                'access_token': page_token
            }
        )
        pub_res = r_pub.json()
        print("IG Publish Response:", pub_res)
        ig_media_id = pub_res.get('id')

        if ig_media_id:
            print(f"\nSUCCESS! Instagram Reel Published! Media ID: {ig_media_id}")
            # Fetch permalink
            r_info = requests.get(
                f'https://graph.facebook.com/v20.0/{ig_media_id}',
                params={
                    'fields': 'permalink,id,media_type',
                    'access_token': page_token
                }
            )
            info = r_info.json()
            print("Reel Live Details:", info)
            permalink = info.get('permalink')
            print(f"\n==========================================")
            print(f"LIVE INSTAGRAM REEL PERMALINK: {permalink}")
            print(f"==========================================")
        else:
            print(f"Failed to publish IG Reel: {pub_res}")

except Exception as e:
    print("Instagram Reel Exception:", e)
