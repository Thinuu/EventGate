const mongoose = require('mongoose');

/**
 * RfidAssignment
 * Represents a temporary, event-specific assignment of a physical RFID tag to an attendee.
 *
 * Design rules:
 *  - One physical tag can have many assignments across different events (time-series).
 *  - Only ONE assignment for a given tag may be ACTIVE at a time.
 *  - Only ONE assignment for a given attendee+event may be ACTIVE at a time.
 *  - Historical records are NEVER deleted — release sets status=RELEASED.
 */
const rfidAssignmentSchema = new mongoose.Schema(
  {
    // Physical tag reference
    rfidTagId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RfidTag',
      required: true,
    },
    // Snapshot of the external identifier at assignment time.
    // Ensures historical readability even if the inventory record changes later.
    rfidIdentifierSnapshot: {
      type: String,
      required: true,
      trim: true,
    },

    // Event context (required — every assignment must belong to an event)
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    attendee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendee',
      required: true,
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
    },
    categoryId: { type: String },

    // Assignment lifecycle
    status: {
      type: String,
      enum: ['ACTIVE', 'RELEASED', 'CANCELLED'],
      default: 'ACTIVE',
    },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Release lifecycle
    releasedAt: { type: Date },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    releaseReason: { type: String },

    notes: { type: String },
  },
  { timestamps: true }
);

// Only one ACTIVE assignment per physical tag at a time.
// Partial index — only applies when status is ACTIVE.
rfidAssignmentSchema.index(
  { rfidTagId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
    name: 'unique_active_assignment_per_tag',
  }
);

// Only one ACTIVE assignment per attendee per event at a time.
rfidAssignmentSchema.index(
  { event: 1, attendee: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
    name: 'unique_active_assignment_per_attendee_event',
  }
);

// Query indexes
rfidAssignmentSchema.index({ rfidTagId: 1, event: 1 });
rfidAssignmentSchema.index({ event: 1, status: 1 });
rfidAssignmentSchema.index({ attendee: 1, status: 1 });
rfidAssignmentSchema.index({ assignedAt: -1 });

module.exports = mongoose.model('RfidAssignment', rfidAssignmentSchema);
