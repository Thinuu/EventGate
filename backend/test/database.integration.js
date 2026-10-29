const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Order = require('../src/models/Order');
const Event = require('../src/models/Event');
const { settlePayment } = require('../src/services/paymentSettlement');
test('concurrent payment callbacks credit revenue exactly once; cancelled orders cannot settle', { timeout: 120000 }, async () => {
  const mongo = process.env.TEST_MONGO_URI ? null : await MongoMemoryReplSet.create({ binary: { version: '7.0.14' }, replSet: { count: 1 }, instanceOpts: [{ args: ['--nounixsocket'] }] });
  try {
    await mongoose.connect(process.env.TEST_MONGO_URI || mongo.getUri());
    const eventId = new mongoose.Types.ObjectId();
    await Event.collection.insertOne({ _id: eventId, name: 'Test', revenue: 0 });
    const original = await Order.create({ eventId, buyerName: 'Test', buyerEmail: 'test@example.com', totalAmount: 100, tickets: [{ categoryName: 'General', quantity: 1, price: 100 }] });
    const copies = await Promise.all([Order.findById(original._id), Order.findById(original._id)]);
    for (const order of copies) Object.assign(order, { paymentStatus: 'paid', status: 'CONFIRMED', gatewayUsed: 'stripe', paidAt: new Date() });
    const results = await Promise.all(copies.map(order => settlePayment(order, eventId)));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await Event.findById(eventId)).revenue, 100);
    assert.equal((await Order.findById(original._id)).paymentStatus, 'paid');
    assert.equal(await require('../src/models/PaymentTask').countDocuments({ orderId: original._id }), 1);
    const cancelled = await Order.create({ eventId, buyerName: 'Test', buyerEmail: 'test@example.com', totalAmount: 100, status: 'CANCELLED', tickets: [] });
    cancelled.paymentStatus = 'paid';
    assert.equal(await settlePayment(cancelled, eventId), false);
    assert.equal((await Event.findById(eventId)).revenue, 100);
  } finally { await mongoose.disconnect(); if (mongo) await mongo.stop(); }
});

test('RFID transactions, archive cleanup, shared limits, and reservation expiry stay consistent under concurrency', { timeout: 120000 }, async () => {
  const mongo = process.env.TEST_MONGO_URI ? null : await MongoMemoryReplSet.create({ binary: { version: '7.0.14' }, replSet: { count: 1 }, instanceOpts: [{ args: ['--nounixsocket'] }] });
  const Attendee = require('../src/models/Attendee');
  const Ticket = require('../src/models/Ticket');
  const RfidTag = require('../src/models/RfidTag');
  const RfidAssignment = require('../src/models/RfidAssignment');
  const { assignRfidToAttendee, unassignRfidFromAttendee } = require('../src/services/rfidService');
  const { resolveAttendee } = require('../src/services/credentialService');
  try {
    await mongoose.connect(process.env.TEST_MONGO_URI || mongo.getUri());
    await Promise.all([Attendee.init(), RfidTag.init(), RfidAssignment.init()]);
    const event = await Event.create({ name: 'RFID Test', slug: `test-${Date.now()}`, venue: { name: 'Test Venue' }, startDate: new Date(Date.now() - 10000), endDate: new Date(Date.now() + 3600000), settings: { rfidEnabled: true }, categories: [{ id: 'general', name: 'General', price: 100, capacity: 10, sold: 2 }] });
    const operatorId = new mongoose.Types.ObjectId();
    const attendee = await Attendee.create({ fullName: 'Test A', event: event._id });
    await Attendee.create({ fullName: 'Test B', event: event._id });
    await RfidTag.create([{ rfidTag: 'AA00BB11' }, { rfidTag: 'AA00BB22' }]);
    const attempts = await Promise.allSettled(['AA00BB11', 'AA00BB22'].map(rfidTag => assignRfidToAttendee({ rfidTag, attendeeId: attendee._id, operatorId })));
    assert.equal(attempts.filter(value => value.status === 'fulfilled').length, 1);
    assert.equal(await RfidAssignment.countDocuments({ attendee: attendee._id, status: 'ACTIVE' }), 1);
    assert.equal(await RfidTag.countDocuments({ status: 'ASSIGNED' }), 1);
    const current = await Attendee.findById(attendee._id);
    assert.equal(String((await resolveAttendee({ rfidId: current.rfidTag, eventId: event._id }))._id), String(attendee._id));
    await unassignRfidFromAttendee({ rfidTag: current.rfidTag, operatorId });
    assert.equal(await RfidAssignment.countDocuments({ status: 'ACTIVE' }), 0);
    assert.equal((await Attendee.findById(attendee._id)).rfidTag, undefined);
    await assignRfidToAttendee({ rfidTag: 'AA00BB11', attendeeId: attendee._id, operatorId });
    await Event.updateOne({ _id: event._id }, { $set: { status: 'completed', endDate: new Date(Date.now() - 90000000) } });
    await require('../src/jobs/rfidArchiveRelease').runArchiveAndRelease();
    assert.equal((await Attendee.findById(attendee._id)).rfidTag, undefined);
    assert.equal((await RfidTag.findOne({ rfidTag: 'AA00BB11' })).status, 'AVAILABLE');
    assert.equal(await resolveAttendee({ rfidId: 'AA00BB11', eventId: event._id }), null);
    const Store = require('../src/middleware/mongoRateStore');
    const first = new Store('integration-limit'), second = new Store('integration-limit');
    first.init({ windowMs: 60000 }); second.init({ windowMs: 60000 });
    const counts = await Promise.all([first.increment('same-user'), second.increment('same-user')]);
    assert.deepEqual(counts.map(value => value.totalHits).sort(), [1, 2]);
    const order = await Order.create({ eventId: event._id, buyerName: 'Expiry', buyerEmail: 'expiry@example.com', totalAmount: 200, status: 'RESERVED', paymentMethod: 'cash_at_entrance', tickets: [{ categoryName: 'General', quantity: 2, price: 100 }] });
    await Ticket.create({ event: event._id, order: order._id, categoryName: 'General', slotIndex: 1, status: 'RESERVED' });
    const { expireOrder } = require('../src/jobs/reservationMaintenance');
    const expiries = await Promise.all([expireOrder(order._id, { status: 'RESERVED' }), expireOrder(order._id, { status: 'RESERVED' })]);
    assert.equal(expiries.filter(Boolean).length, 1);
    assert.equal((await Event.findById(event._id)).categories[0].sold, 0);
    assert.equal((await Ticket.findOne({ order: order._id })).status, 'CANCELLED');
  } finally { await mongoose.disconnect(); if (mongo) await mongo.stop(); }
});
