"""Line-based RFID bridge. Install pyserial only when using --port.
Tokens come from environment, never command-line arguments. No automatic retries
of access-changing scans: uncertain delivery requires operator review.
"""
import argparse, json, os, sys, urllib.request, urllib.error
from urllib.parse import urlparse
p = argparse.ArgumentParser()
p.add_argument('--port', help='Serial port, e.g. COM3 or /dev/ttyUSB0; omit to read stdin')
p.add_argument('--baud', type=int, default=9600)
p.add_argument('--action', choices=['check_in', 'check_out'], required=True)
p.add_argument('--zone', help='Optional zone name')
a = p.parse_args()
base = os.environ.get('EAMS_URL', '').rstrip('/')
if urlparse(base).scheme != 'https' and urlparse(base).hostname not in ('localhost', '127.0.0.1'):
    p.error('Use HTTPS or a localhost server')
for key in ['EAMS_TOKEN', 'EAMS_READER_ID', 'EAMS_EVENT_ID']:
    if not os.environ.get(key): p.error(key + ' is required')
source = sys.stdin.buffer
if a.port:
    import serial
    source = serial.Serial(a.port, a.baud, timeout=1)
print('Reader ready. Stop with Ctrl+C. Re-authenticate when your token expires.', file=sys.stderr)
try:
    while True:
        line = source.readline(257)
        if not line:
            if a.port: continue
            break
        if len(line) > 256:
            print('Rejected oversized scan; restart and inspect reader framing', file=sys.stderr)
            break
        try:
            scan = line.decode('ascii').strip('\r\n')
            payload = {'readerId': os.environ['EAMS_READER_ID'], 'eventId': os.environ['EAMS_EVENT_ID'], 'scan': scan, 'action': a.action, 'gateId': os.environ['EAMS_READER_ID']}
            if a.zone: payload['zone'] = a.zone
            headers = {'Authorization': 'Bearer ' + os.environ['EAMS_TOKEN'], 'Content-Type': 'application/json'}
            if os.environ.get('EAMS_DEVICE_ID'): headers['x-device-id'] = os.environ['EAMS_DEVICE_ID']
            request = urllib.request.Request(base + '/api/' + ('zone' if a.zone else 'entry') + '/scan', data=json.dumps(payload).encode(), headers=headers)
            with urllib.request.urlopen(request, timeout=15) as response:
                result = json.load(response)
                print(json.dumps({'status': response.status, 'success': result.get('success'), 'message': result.get('message')}), flush=True)
        except urllib.error.HTTPError as e:
            print(json.dumps({'status': e.code, 'message': 'Scan rejected; review operator dashboard'}), flush=True)
            if e.code in (401, 403): break
        except Exception:
            print('Delivery uncertain or invalid input. Check dashboard before rescanning.', file=sys.stderr)
except KeyboardInterrupt:
    pass
finally:
    if a.port: source.close()
