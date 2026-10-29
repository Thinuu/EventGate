const { test } = require('node:test');
const assert = require('node:assert/strict');
const Reader = require('../src/models/Reader');
const readerScan = require('../src/middleware/readerScan');
async function scan(profile, body) {
  Reader.findById = () => ({ lean: async () => profile });
  const req = { body }; let status = 200, passed = false;
  const res = { status(code) { status = code; return this; }, json() { return this; } };
  await readerScan(req, res, () => { passed = true; });
  return { req, status, passed };
}
test('profile binds scan to registered event and gate and produces explicit RFID input', async () => {
  const result = await scan({ _id: 'reader', eventId: 'event', enabled: true, format: 'hex', gateName: 'Gate A' }, { readerId: 'reader', scan: 'aa:00:bb:11' });
  assert.equal(result.passed, true); assert.equal(result.req.body.rfidId, 'AA00BB11');
  assert.equal(result.req.body.eventId, 'event'); assert.equal(result.req.body.gateName, 'Gate A');
});
test('disabled, conflicting-event and mixed QR/RFID scans are rejected', async () => {
  const profile = { _id: 'reader', eventId: 'event', enabled: true, format: 'numeric10' };
  assert.equal((await scan({ ...profile, enabled: false }, { readerId: 'reader', scan: '0001234567' })).status, 403);
  assert.equal((await scan(profile, { readerId: 'reader', eventId: 'other', scan: '0001234567' })).status, 403);
  assert.equal((await scan(profile, { readerId: 'reader', qrToken: 'qr', scan: '0001234567' })).status, 400);
});
