import os
import time
import requests

page_token = 'EAAW7XpyqZAyUBTEjZA3OUJ5srV89ZBBGpjznGewZCcdyV025r8x0WEhYWX3DipKo6TZBZCRG3FgdFY030uIzE934xIZA1KZBdsONQMEYLAbaR8wKWs8q4AIaOERM7lkysLV4FQ0nURI52KAOc0zhvZBny6Flkf23z5zfSbiv8U3fyjk3bnH16pdm5FExUKoSAutZASVwZDZD'
page_id = '1511312668725364'
ig_id = '17841473193109298'

img_path = r'C:\Users\mskar\captodesk\public\marketing\post1_authentic_clean.jpg'
public_url = 'https://captodesk.com/marketing/post1_authentic_clean.jpg'

caption = """Ever had your phone buzz while you’re shoulder-deep under a cast-iron sink or balanced on a 24-foot extension ladder? 

You know how it goes:
Option A: Drop your flashlight, scramble down the rungs, answer out of breath, and pray you don’t drop your phone in the mud.
Option B: Let it go to voicemail.

Here’s the reality with Option B:
9 out of 10 homeowners don’t leave a voicemail. They just tap the very next contractor on Google Maps. 

By the time you wash your hands and call them back 20 minutes later? 
“Oh sorry man, already found someone who answered.”

That’s an easy $800 to $1,500 flushed down the drain.

We built CaptoDesk so you never have to climb down a ladder to save a job:
The second a call goes unanswered, it shoots a quick, clean text straight to the customer:
“Hey, sorry I missed your call — I’m on a job right now. Grab an open time on my schedule here: book.captodesk.com/your-name or text me what’s going on and I’ll get right back to you.”

They pick a slot. Your schedule fills up. Your phone stops ringing during dinner.

Your first 3 customer jobs are completely free. No credit card, no contracts.
Check it out at captodesk.com (or tap the link in bio).

#plumbing #hvac #electrician #contractorlife #fieldservice #smallbusiness #trades #bluecollar #servicebusiness #captodesk"""

# ── 1. PUBLISH TO FACEBOOK PAGE ──
print("Publishing to Facebook Page...")
try:
    with open(img_path, 'rb') as f:
        r_fb = requests.post(f'https://graph.facebook.com/v20.0/{page_id}/photos', data={
            'caption': caption,
            'access_token': page_token,
            'published': True
        }, files={'source': f})
        fb_data = r_fb.json()
        print("Facebook Response:", fb_data)
        if 'id' in fb_data:
            print(f"SUCCESS Facebook Post Published! ID: {fb_data.get('id')}")
        else:
            print(f"FAILED Facebook Post: {fb_data}")
except Exception as e:
    print("Facebook Exception:", e)

# ── 2. PUBLISH TO INSTAGRAM ACCOUNT ──
print("\nChecking public URL for Instagram...")
# Wait until URL is accessible on captodesk.com
for attempt in range(12):
    try:
        r_check = requests.head(public_url, timeout=5)
        if r_check.status_code == 200:
            print(f"Public image URL is live (200 OK): {public_url}")
            break
    except Exception:
        pass
    print(f"Waiting for Vercel deployment... (attempt {attempt+1}/12)")
    time.sleep(5)

print("\nPublishing to Instagram Business Account...")
try:
    # Step 1: Create media container
    r_container = requests.post(f'https://graph.facebook.com/v20.0/{ig_id}/media', data={
        'image_url': public_url,
        'caption': caption,
        'access_token': page_token
    })
    container_data = r_container.json()
    print("Instagram Container Response:", container_data)
    creation_id = container_data.get('id')

    if creation_id:
        print(f"Container created ({creation_id}), waiting 3 seconds for Meta processing...")
        time.sleep(3)

        # Step 2: Publish media
        r_pub = requests.post(f'https://graph.facebook.com/v20.0/{ig_id}/media_publish', data={
            'creation_id': creation_id,
            'access_token': page_token
        })
        pub_data = r_pub.json()
        print("Instagram Publish Response:", pub_data)
        if 'id' in pub_data:
            print(f"SUCCESS Instagram Post Published! ID: {pub_data.get('id')}")
        else:
            print(f"FAILED Instagram Publish: {pub_data}")
    else:
        print(f"FAILED to create Instagram container: {container_data}")
except Exception as e:
    print("Instagram Exception:", e)
