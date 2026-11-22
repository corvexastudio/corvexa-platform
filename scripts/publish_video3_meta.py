import os
import time
import requests
import json

# ── TOKENS & IDENTIFIERS ──
system_token = 'EAAW7XpyqZAyUBTEjZA3OUJ5srV89ZBBGpjznGewZCcdyV025r8x0WEhYWX3DipKo6TZBZCRG3FgdFY030uIzE934xIZA1KZBdsONQMEYLAbaR8wKWs8q4AIaOERM7lkysLV4FQ0nURI52KAOc0zhvZBny6Flkf23z5zfSbiv8U3fyjk3bnH16pdm5FExUKoSAutZASVwZDZD'
page_id = '1511312668725364'
ig_id = '17841473193109298'

page_token = 'EAAW7XpyqZAyUBTBlfOUSAMqFEHfnxIkZCZANstLxSWbYDnvwh4x1O0ZB8W4sYT0Uvo33tLQS96oPNAi4VsBirXcrJz3hYbH48apZAsH8XeHRrV2OX3BtlUU2hTr0anyz28YRx7vQTHzMu6R5wJHk8CStoNtaGLzNjMFefunJaJyMbhmqPuc9s1P3fQsYK5WT59ZCl9kOqJ'

video_url = 'https://captodesk.com/marketing/captodesk_reel_driveway_payments.mp4'

caption = """Ever finish a 4-hour job on Friday, hand the customer an invoice, and hear:
"Let me look for my checkbook inside... actually, can I just mail it to you?" 🤦‍♂️

Three weeks later, you are still chasing paper checks while supply bills are due.

In mobile service businesses, slow cash flow kills more businesses than bad workmanship ever will.

We built CaptoDesk Driveway Pay so you never leave a job unpaid:
1. Tap the job on your phone
2. Send a 1-tap SMS checkout link in 1 second
3. Customer taps Apple Pay, Google Pay, or Card right in their driveway
4. Paid in 10 seconds. Receipts sent automatically. Direct bank deposit the next morning.

Zero card readers to break or charge. Zero paper invoices.

Claim your Exclusive Contractor Starter Pass: Your first 3 jobs are 100% free with $0 platform fees at captodesk.com (link in bio).

#contractor #mobiledetailing #fieldservice #pressurewashing #plumbing #hvac #electrician #bluecollar #smallbusinessowner #invoicing #applepay #captodesk"""

print("=== STARTING CAPTODESK VIDEO 3 MULTI-CAST ===")
print(f"Video Asset: {video_url}")

# ── 1. PUBLISH TO INSTAGRAM REELS ──
print("\n[1/2] Initiating Instagram Reel Publication...")
try:
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
        for attempt in range(25):
            time.sleep(5)
            r_status = requests.get(f'https://graph.facebook.com/v20.0/{container_id}?fields=status_code,status&access_token={system_token}')
            status_data = r_status.json()
            code = status_data.get('status_code')
            print(f"  Attempt {attempt+1}/25 - Transcoding status: {code}")
            
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
    fb_payload = {
        'file_url': video_url,
        'description': caption,
        'title': 'Stop Chasing Paper Checks for 3 Weeks',
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
