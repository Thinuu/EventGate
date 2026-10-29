const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    default: '',
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  permissions: {
    canViewDashboard: { type: Boolean, default: false },
    canManageEvents: { type: Boolean, default: false },
    canManageTickets: { type: Boolean, default: false },
    canViewAttendees: { type: Boolean, default: false },
    canEditAttendees: { type: Boolean, default: false },
    canVerifyPhotos: { type: Boolean, default: false },
    canScanEntry: { type: Boolean, default: false },
    canManageZones: { type: Boolean, default: false },
    canInviteAttendees: { type: Boolean, default: false },
    canBulkUpload: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false },
    canViewLogs: { type: Boolean, default: false },
    canManageSponsors: { type: Boolean, default: false },
    canViewTransactions: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false },
  },
  zoneIds: [{ type: String }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

roleSchema.index({ event: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
