import re
from urllib.request import Request, urlopen
import json

with open(r'C:\Users\mskar\captodesk\.env.local', 'r') as f:
    text = f.read()

url_match = re.search(r'NEXT_PUBLIC_SUPABASE_URL=["\']?([^"\'\s]+)', text)
key_match = re.search(r'SUPABASE_SERVICE_ROLE_KEY=["\']?([^"\'\s]+)', text)

url = url_match.group(1)
key = key_match.group(1)

req = Request(f"{url}/rest/v1/organizations?select=id,name,business_hours,booking_mode,default_duration_minutes,buffer_minutes&limit=1", headers={
    "apikey": key,
    "Authorization": f"Bearer {key}"
})

try:
    with urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        if data:
            print("Sample org config:", json.dumps(data[0], indent=2))
except Exception as e:
    print("Error:", e)

req3 = Request(f"{url}/rest/v1/appointments?select=*&limit=1", headers={
    "apikey": key,
    "Authorization": f"Bearer {key}"
})

try:
    with urlopen(req3) as resp:
        data3 = json.loads(resp.read().decode())
        if data3:
            print("Appointments columns:", sorted(list(data3[0].keys())))
        else:
            print("No data in appointments")
except Exception as e:
    print("Error appointments:", e)
