const mongoose = require('mongoose');

/**
 * RfidAccessLog
 * Immutable audit trail for every RFID scan attempt.
 *
 * Design rules:
 *  - Records are NEVER modified after creation.
 *  - rfidIdentifierSnapshot stores the external ID at scan time so records
 *    remain meaningful even if the inventory record is later changed.
 *  - Both GRANTED and DENIED results are stored.
 */
const rfidAccessLogSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    attendee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendee',
    },
    rfidTagId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RfidTag',
    },
    // External identifier snapshot — always stored, even for unknown/unregistered scans
    rfidIdentifierSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RfidAssignment',
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
    },

    // Physical location of the scan
    gateId: { type: String },
    gateName: { type: String },
    zoneId: { type: String },
    zoneName: { type: String },
    reader: { type: String }, // device/reader identifier if provided

    // Scan metadata
    scanMethod: {
      type: String,
      enum: ['RFID', 'QR', 'MANUAL'],
      default: 'RFID',
    },

    // Result
    result: {
      type: String,
      enum: ['GRANTED', 'DENIED'],
      required: true,
    },
    denialReason: {
      type: String,
      enum: [
        'RFID_NOT_FOUND',
        'RFID_NOT_ASSIGNED',
        'RFID_ASSIGNED_TO_OTHER_EVENT',
        'RFID_DISABLED',
        'TICKET_INVALID',
        'TICKET_CANCELLED',
        'TICKET_NOT_CONFIRMED',
        'EVENT_ENDED',
        'EVENT_NOT_STARTED',
        'ZONE_ACCESS_DENIED',
        'ATTENDEE_NOT_ACTIVE',
        'ATTENDEE_DISABLED',
        'ALREADY_CHECKED_IN',
        'ALREADY_CHECKED_OUT',
        'NOT_CHECKED_IN',
        'RFID_FEATURE_DISABLED',
        'GATE_ACCESS_DENIED',
        'UNKNOWN',
      ],
    },

    // Attendee snapshot at time of scan (for offline resilience + archival readability)
    attendeeSnapshot: {
      fullName: { type: String },
      categoryId: { type: String },
      categoryName: { type: String },
    },

    // Who/what performed the scan
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deviceId: { type: String },

    // Immutable timestamp — do NOT use timestamps:true (would add updatedAt)
    timestamp: { type: Date, default: Date.now, immutable: true },
  },
  {
    timestamps: false, // Immutable records — no updatedAt
  }
);

// Query indexes — optimised for dashboard/audit queries
rfidAccessLogSchema.index({ event: 1, timestamp: -1 });
rfidAccessLogSchema.index({ attendee: 1, event: 1, timestamp: -1 });
rfidAccessLogSchema.index({ rfidTagId: 1, timestamp: -1 });
rfidAccessLogSchema.index({ event: 1, result: 1, timestamp: -1 });
rfidAccessLogSchema.index({ event: 1, gateId: 1, timestamp: -1 });
rfidAccessLogSchema.index({ event: 1, zoneId: 1, timestamp: -1 });

module.exports = mongoose.model('RfidAccessLog', rfidAccessLogSchema);
