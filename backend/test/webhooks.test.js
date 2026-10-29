const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const stripe = require('stripe')('sk_test_placeholder');
const configure = require('../src/middleware/bodyParsers');
test('real Stripe signature survives body parser chain; PayHere form and ordinary JSON also parse', async () => {
  const app = express(); configure(app);
  app.post('/api/payment/stripe-webhook', (req, res) => {
    try { const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], 'whsec_test'); res.json({ id: event.id }); }
    catch { res.sendStatus(400); }
  });
  app.post('/api/payment/notify', (req, res) => res.json(req.body));
  app.post('/ordinary', (req, res) => res.json(req.body));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const payload = '{ "id": "evt_test", "type": "checkout.session.completed" }';
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });
    const result = await fetch(base + '/api/payment/stripe-webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload });
    assert.equal(result.status, 200); assert.equal((await result.json()).id, 'evt_test');
    const tampered = await fetch(base + '/api/payment/stripe-webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload + ' ' }); assert.equal(tampered.status, 400);
    const form = await fetch(base + '/api/payment/notify', { method: 'POST', body: new URLSearchParams({ status_code: '2', custom_1: 'order' }) }); assert.deepEqual(await form.json(), { status_code: '2', custom_1: 'order' });
    const json = await fetch(base + '/ordinary', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ok":true}' }); assert.deepEqual(await json.json(), { ok: true });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
