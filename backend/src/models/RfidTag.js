const mongoose = require('mongoose');

/**
 * RfidTag — Physical RFID inventory item.
 *
 * This model represents the physical tag only.
 * Assignment history lives in RfidAssignment.
 * Access history lives in RfidAccessLog.
 *
 * The external identifier (rfidTag field) has a unique index because
 * two physical tags from the same vendor must not share the same identifier.
 * Reuse across events is achieved through the RfidAssignment lifecycle —
 * NOT by relaxing this constraint.
 *
 * NOTE: The 'event', 'attendee', 'ticket', 'assignedBy', 'assignedAt' fields
 * below are DEPRECATED and kept only for backward compatibility while a
 * migration script creates the corresponding RfidAssignment records.
 * New code must NOT write to these fields. They will be removed in a future
 * schema version once all existing records have been migrated.
 */
const rfidTagSchema = new mongoose.Schema(
  {
    // ─── External Identifier ──────────────────────────────────────────────────
    // The identifier provided by the RFID reader.
    // Format is vendor-dependent; the current default is 10 decimal digits.
    // Normalization/validation is performed in rfidService.js.
    rfidTag: {
      type: String,
      required: true,
      trim: true,
    },

    // ─── Inventory Status ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'DISABLED'],
      default: 'AVAILABLE',
    },

    // ─── Hardware / Vendor Information ───────────────────────────────────────
    // Vendor and technology are stored so the system can handle conflicts
    // when the same external identifier appears from different vendors.
    vendor: { type: String, trim: true, default: 'unknown' },
    technology: {
      type: String,
      enum: ['NFC', 'UHF', 'HF', 'LF', 'BLE', 'unknown'],
      default: 'unknown',
    },
    tagType: { type: String, trim: true }, // e.g. 'wristband', 'card', 'sticker'

    // ─── Registration Metadata ────────────────────────────────────────────────
    registeredAt: { type: Date, default: Date.now },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ─── Disable Metadata ─────────────────────────────────────────────────────
    disabledAt: { type: Date },
    disabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disableReason: { type: String },

    notes: { type: String },

    // ─── DEPRECATED FIELDS ────────────────────────────────────────────────────
    // These fields were used before RfidAssignment was introduced.
    // They are kept for backward compatibility and will be removed after migration.
    /** @deprecated Use RfidAssignment instead */
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    /** @deprecated Use RfidAssignment instead */
    categoryId: { type: String },
    /** @deprecated Use RfidAssignment instead */
    attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' },
    /** @deprecated Use RfidAssignment instead */
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    /** @deprecated Use RfidAssignment instead */
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** @deprecated Use RfidAssignment instead */
    assignedAt: { type: Date },
    /** @deprecated Use RfidAssignment instead */
    sequence: { type: Number },
  },
  { timestamps: true }
);

// Unique constraint on external identifier.
// This prevents duplicate physical tag records for the same identifier+vendor.
// Do NOT remove this index — reuse across events is handled by RfidAssignment.
rfidTagSchema.index({ rfidTag: 1 }, { unique: true });

// Status-based queries (inventory management)
rfidTagSchema.index({ status: 1 });
rfidTagSchema.index({ vendor: 1, technology: 1 });

// Keep legacy compound index for backward compat with existing queries
rfidTagSchema.index({ status: 1, event: 1, categoryId: 1 });

module.exports = mongoose.model('RfidTag', rfidTagSchema);