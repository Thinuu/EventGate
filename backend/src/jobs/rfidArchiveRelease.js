const mongoose = require('mongoose');
const Event = require('../models/Event');
const RfidTag = require('../models/RfidTag');
const RfidAssignment = require('../models/RfidAssignment');
const Attendee = require('../models/Attendee');
async function runArchiveAndRelease() {
  const threshold = new Date(Date.now() - 86400000);
  const events = await Event.find({ status: { $in: ['completed', 'published', 'ongoing'] }, endDate: { $lt: threshold } }).limit(1).select('_id').lean();
  let releasedAssignments = 0;
  for (const event of events) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const assignments = await RfidAssignment.find({ event: event._id, status: 'ACTIVE' }).limit(100).session(session);
        for (const assignment of assignments) {
          await RfidAssignment.updateOne({ _id: assignment._id, status: 'ACTIVE' }, { $set: { status: 'RELEASED', releasedAt: new Date(), releaseReason: 'Automatic event archive release' } }, { session });
          await RfidTag.updateOne({ _id: assignment.rfidTagId, attendee: assignment.attendee, status: 'ASSIGNED' }, { $set: { status: 'AVAILABLE' }, $unset: { event: 1, attendee: 1, ticket: 1, categoryId: 1, assignedAt: 1 } }, { session });
          await Attendee.updateOne({ _id: assignment.attendee, event: event._id, rfidTag: assignment.rfidIdentifierSnapshot }, { $unset: { rfidTag: 1, wristbandId: 1 } }, { session });
        }
        const remaining = await RfidAssignment.countDocuments({ event: event._id, status: 'ACTIVE' }).session(session);
        if (!remaining) await Event.updateOne({ _id: event._id }, { $set: { status: 'archived' } }, { session });
      });
      releasedAssignments += 1;
    } finally { await session.endSession(); }
  }
  return { processedEvents: events.length, releasedEvents: releasedAssignments };
}
module.exports = { runArchiveAndRelease };
