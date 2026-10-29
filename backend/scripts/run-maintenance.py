import os, urllib.request
from urllib.parse import urlparse
url = os.environ['EAMS_URL'].rstrip('/')
if urlparse(url).scheme != 'https': raise SystemExit('EAMS_URL must use HTTPS')
request = urllib.request.Request(url + '/api/internal/cron', headers={'Authorization': 'Bearer ' + os.environ['CRON_SECRET']})
with urllib.request.urlopen(request, timeout=115) as response:
    print('Maintenance HTTP status:', response.status)
