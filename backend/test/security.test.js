const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const SystemConfig = require('../src/models/SystemConfig');
const TokenBlocklist = require('../src/models/TokenBlocklist');
const { protect } = require('../src/middleware/auth');
process.env.JWT_SECRET = 'test-only-secret-012345678901234567890';
const user = { _id: '123', role: 'Staff', status: 'Active' };
User.findById = () => ({ select: async () => user });
TokenBlocklist.isTokenBlocked = async () => false;
SystemConfig.findOne = () => ({ lean: async () => ({ security: { deviceApprovalRequired: false } }) });
async function authenticate(payload) {
  const req = { headers: { authorization: `Bearer ${jwt.sign(payload, process.env.JWT_SECRET)}` } };
  let status = 200, passed = false;
  const res = { status(n) { status = n; return this; }, json() { return this; } };
  await protect(req, res, () => { passed = true; });
  return { status, passed };
}
test('access tokens authenticate; refresh, temporary and legacy tokens cannot authorize API calls', async () => {
  assert.deepEqual(await authenticate({ id: '123', tokenType: 'access' }), { status: 200, passed: true });
  for (const payload of [{ id: '123', tokenType: 'refresh' }, { id: '123', isTemp: true }, { id: '123' }]) {
    assert.deepEqual(await authenticate(payload), { status: 401, passed: false });
  }
});
test('required device approval cannot be bypassed by omitting device header', async () => {
  SystemConfig.findOne = () => ({ lean: async () => ({ security: { deviceApprovalRequired: true } }) });
  assert.equal((await authenticate({ id: '123', tokenType: 'access' })).status, 401);
});
test('user serialization removes selected secrets', () => {
  const doc = new User({ name: 'Test', email: 'test@example.com', role: 'Staff', password: 'secret', refreshToken: 'refresh', mfaSecret: 'mfa', mfaBackupCodes: ['backup'] });
  const json = doc.toJSON();
  for (const key of ['password', 'refreshToken', 'mfaSecret', 'mfaBackupCodes']) assert.equal(json[key], undefined);
});
