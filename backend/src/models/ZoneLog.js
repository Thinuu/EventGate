const mongoose = require('mongoose');

const zoneLogSchema = new mongoose.Schema({
  attendeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendee',
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  zoneName: {
    type: String,
    required: true,
    trim: true,
  },
  action: {
    type: String,
    enum: ['ENTRY', 'EXIT'],
    required: true,
  },
  accessGranted: {
    type: Boolean,
    default: true,
  },
  denialReason: {
    type: String,
    enum: [
      'NOT_ALLOWED',
      'INVALID_TICKET',
      'DUPLICATE_SCAN',
      'TICKET_NOT_CONFIRMED',
      'TICKET_DISABLED',
      'EVENT_ENDED',
    ],
  },
  scanMethod: {
    type: String,
    enum: ['QR', 'RFID'],
    default: 'QR',
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  attendeeSnapshot: {
    fullName: { type: String },
    categoryName: { type: String },
    allowedZones: [{ type: String }],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

zoneLogSchema.index({ eventId: 1, zoneName: 1, timestamp: -1 });
zoneLogSchema.index({ attendeeId: 1, zoneName: 1, timestamp: -1 });

zoneLogSchema.post('save', async function(doc) {
  try {
    const SystemLog = mongoose.model('SystemLog');
    const User = mongoose.model('User');
    const operator = doc.scannedBy ? await User.findById(doc.scannedBy).lean() : null;

    await SystemLog.create({
      userId: doc.scannedBy || undefined,
      userEmail: operator?.email || 'system@entrynex.lk',
      userRole: operator?.role || 'Staff',
      action: 'ticket_scan',
      eventId: doc.eventId,
      details: {
        message: `${doc.attendeeSnapshot?.fullName || 'Attendee'} scanned at zone ${doc.zoneName}. Result: ${doc.accessGranted ? 'Granted' : `Denied (${doc.denialReason || 'Not allowed'})`}`,
        action: doc.action === 'ENTRY' ? 'zone_entry' : 'zone_exit',
        method: String(doc.scanMethod || 'QR').toLowerCase(),
        zoneName: doc.zoneName,
        accessGranted: doc.accessGranted,
        denialReason: doc.denialReason
      }
    });
  } catch (err) {
    console.error('Failed to log zone activity to SystemLog:', err);
  }
});

module.exports = mongoose.model('ZoneLog', zoneLogSchema);
