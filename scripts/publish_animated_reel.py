import os
import time
import requests
import json

# ── TOKENS & IDENTIFIERS ──
# Permanent System User token (works for IG & Page)
system_token = 'EAAW7XpyqZAyUBTEjZA3OUJ5srV89ZBBGpjznGewZCcdyV025r8x0WEhYWX3DipKo6TZBZCRG3FgdFY030uIzE934xIZA1KZBdsONQMEYLAbaR8wKWs8q4AIaOERM7lkysLV4FQ0nURI52KAOc0zhvZBny6Flkf23z5zfSbiv8U3fyjk3bnH16pdm5FExUKoSAutZASVwZDZD'
page_id = '1511312668725364'
ig_id = '17841473193109298'

# Page Access Token for Page publishing
page_token = 'EAAW7XpyqZAyUBTBlfOUSAMqFEHfnxIkZCZANstLxSWbYDnvwh4x1O0ZB8W4sYT0Uvo33tLQS96oPNAi4VsBirXcrJz3hYbH48apZAsH8XeHRrV2OX3BtlUU2hTr0anyz28YRx7vQTHzMu6R5wJHk8CStoNtaGLzNjMFefunJaJyMbhmqPuc9s1P3fQsYK5WT59ZCl9kOqJ'

video_url = 'https://captodesk.com/marketing/captodesk_reel_reviews_animated.mp4'

caption = """Ever wonder why the guy with sloppy solder joints and leaking fittings gets 4x more calls than you? 

Here’s the brutal truth:
Google doesn’t inspect your pipe work. 
Google ranks two numbers: how many reviews you have, and how fresh they are. 

87% of homeowners hire one of the top 3 contractors on Google Maps. If you only have 9 reviews from two years ago, you’re invisible—no matter how clean your work is.

We built CaptoDesk to fix this automatically:
Every time an invoice is marked paid, CaptoDesk pings the customer with a 1-tap Google review link 15 minutes later—before you even pull out of the driveway.

Your reviews climb. Your Google ranking jumps. You take the #1 spot from the guys doing worse work.

Try your first 3 customer jobs 100% free at captodesk.com (link in bio).

#plumbing #hvac #electrician #contractorlife #bluecollar #fieldservice #smallbusinessowner #tradies #homeimprovement #americancontractor #servicebusiness #captodesk"""

print("=== STARTING CAPTODESK ANIMATED REEL MULTI-CAST ===")
print(f"Video Asset: {video_url}")

# ── 1. PUBLISH TO INSTAGRAM REELS ──
print("\n[1/2] Initiating Instagram Reel Publication...")
try:
    # Create IG Reel container
    container_payload = {
        'media_type': 'REELS',
        'video_url': video_url,
        'caption': caption,
        'share_to_feed': 'true',
        'access_token': system_token
    }
    r_ig_init = requests.post(f'https://graph.facebook.com/v20.0/{ig_id}/media', data=container_payload)
    ig_init_data = r_ig_init.json()
    print("Instagram Container Response:", ig_init_data)
    
    container_id = ig_init_data.get('id')
    if container_id:
        print(f"Container created ({container_id}). Waiting for Meta video processing...")
        # Poll container status until FINISHED
        for attempt in range(20):
            time.sleep(5)
            r_status = requests.get(f'https://graph.facebook.com/v20.0/{container_id}?fields=status_code,status&access_token={system_token}')
            status_data = r_status.json()
            code = status_data.get('status_code')
            print(f"  Attempt {attempt+1}/20 - Transcoding status: {code}")
            
            if code == 'FINISHED':
                print("  Transcoding complete! Publishing Reel to feed...")
                r_pub = requests.post(f'https://graph.facebook.com/v20.0/{ig_id}/media_publish', data={
                    'creation_id': container_id,
                    'access_token': system_token
                })
                pub_data = r_pub.json()
                print("  INSTAGRAM PUBLISH SUCCESS:", pub_data)
                break
            elif code == 'ERROR':
                print("  INSTAGRAM TRANSCODING ERROR:", status_data)
                break
    else:
        print("  INSTAGRAM CONTAINER CREATION FAILED:", ig_init_data)
except Exception as e:
    print("  Instagram Exception:", e)

# ── 2. PUBLISH TO FACEBOOK PAGE WITH US TARGETING ──
print("\n[2/2] Initiating Facebook Page Reel Publication...")
try:
    # Use Page Access Token
    fb_payload = {
        'file_url': video_url,
        'description': caption,
        'title': 'Why the Guy with Worse Work Gets More Calls Than You',
        'targeting': json.dumps({
            'geo_locations': {
                'countries': ['US']
            }
        }),
        'access_token': page_token
    }
    r_fb = requests.post(f'https://graph.facebook.com/v20.0/{page_id}/videos', data=fb_payload)
    fb_data = r_fb.json()
    print("Facebook Video Response:", fb_data)
    if 'id' in fb_data:
        print(f"  FACEBOOK VIDEO PUBLISH SUCCESS! Video ID: {fb_data.get('id')}")
    else:
        print(f"  FACEBOOK VIDEO PUBLISH FAILED: {fb_data}")
except Exception as e:
    print("  Facebook Exception:", e)

print("\n=== MULTI-CAST DISPATCH COMPLETE ===")
