const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
test('HTTP routing, readiness, login, reader management, and protected cron work together', { timeout: 120000 }, async () => {
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.14' }, replSet: { count: 1 }, instanceOpts: [{ args: ['--nounixsocket'] }] });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = 'integration-only-secret-at-least-thirty-two-characters';
  process.env.CRON_SECRET = 'integration-cron-secret';
  process.env.NODE_ENV = 'test';
  const server = require('../src/server');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, body, token) {
    return fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  try {
    assert.equal((await request('/api/health/live')).status, 200);
    assert.equal((await request('/api/health/ready')).status, 200);
    const User = require('../src/models/User');
    const Event = require('../src/models/Event');
    const event = await Event.create({ name: 'HTTP Test', slug: 'http-test', venue: { name: 'Venue' }, startDate: new Date(), endDate: new Date(Date.now() + 3600000), settings: { rfidEnabled: true } });
    await User.create({ name: 'HTTP Admin', email: 'admin-test@example.com', password: 'Integration-Only-Password-123!', role: 'MainAdmin', status: 'Active', isVerified: true });
    const login = await request('/api/auth/login', { email: 'admin-test@example.com', password: 'Integration-Only-Password-123!' });
    assert.equal(login.status, 200); const data = await login.json(); assert.ok(data.accessToken);
    assert.equal(data.data.user.password, undefined);
    assert.equal((await request('/api/readers?eventId=' + event._id)).status, 401);
    const result = await request('/api/readers', { eventId: String(event._id), name: 'Test Reader', transport: 'keyboard', format: 'hex' }, data.accessToken);
    assert.equal(result.status, 201); const reader = (await result.json()).data;
    const preview = await request('/api/readers/preview', { eventId: String(event._id), readerId: reader._id, scan: 'aa:00:bb:11' }, data.accessToken);
    assert.equal(preview.status, 200); assert.equal((await preview.json()).data.credential, 'AA00BB11');
    assert.equal((await request('/api/internal/cron')).status, 401);
    assert.equal((await request('/api/ai/event-summary', { eventId: String(event._id) }, data.accessToken)).status, 503);
  } finally {
    await new Promise(resolve => server.io.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
});
