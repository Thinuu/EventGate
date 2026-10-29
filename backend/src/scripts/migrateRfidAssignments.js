/**
 * RFID Architecture Migration Script
 * ====================================
 * Migrates existing RfidTag assignment data into the new RfidAssignment collection.
 *
 * SAFE TO RUN MULTIPLE TIMES — uses findOneAndUpdate with upsert: false to avoid
 * creating duplicate assignment records.
 *
 * Run with:
 *   node src/scripts/migrateRfidAssignments.js
 *
 * What it does:
 *  1. Finds all RfidTag records that have an attendee AND status === 'ASSIGNED'.
 *  2. For each, creates a corresponding RfidAssignment record (status: ACTIVE)
 *     IF one does not already exist.
 *  3. Reports what was created vs skipped.
 *  4. Does NOT delete or modify any existing records.
 *  5. Does NOT remove the deprecated fields from RfidTag (backward compat).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Load models
const RfidTag = require('../models/RfidTag');
const RfidAssignment = require('../models/RfidAssignment');

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('[migrate] ERROR: MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  console.log('[migrate] Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[migrate] Connected.');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Find all ASSIGNED tags that still have legacy attendee/event data
  const assignedTags = await RfidTag.find({
    status: 'ASSIGNED',
    attendee: { $exists: true, $ne: null },
  }).lean();

  console.log(`[migrate] Found ${assignedTags.length} ASSIGNED RfidTag records to process.`);

  for (const tag of assignedTags) {
    try {
      // Check if an ACTIVE assignment already exists for this tag
      const existing = await RfidAssignment.findOne({
        rfidTagId: tag._id,
        status: 'ACTIVE',
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create the RfidAssignment from the legacy data
      await RfidAssignment.create({
        rfidTagId: tag._id,
        rfidIdentifierSnapshot: tag.rfidTag,
        event: tag.event,
        attendee: tag.attendee,
        ticket: tag.ticket || undefined,
        categoryId: tag.categoryId || undefined,
        status: 'ACTIVE',
        assignedAt: tag.assignedAt || tag.createdAt || new Date(),
        assignedBy: tag.assignedBy || undefined,
        notes: 'Migrated from legacy RfidTag assignment data.',
      });

      created++;
      console.log(`[migrate]  Created assignment: tag ${tag.rfidTag} → attendee ${tag.attendee}`);
    } catch (err) {
      errors++;
      console.error(`[migrate]  ERROR for tag ${tag.rfidTag}:`, err.message);
    }
  }

  console.log('\n[migrate] ─────────────────────────────────────────');
  console.log(`[migrate] Migration complete.`);
  console.log(`[migrate]   Created : ${created}`);
  console.log(`[migrate]   Skipped : ${skipped} (already had RfidAssignment)`);
  console.log(`[migrate]   Errors  : ${errors}`);
  console.log('[migrate] ─────────────────────────────────────────\n');
  console.log('[migrate] NOTE: Deprecated fields (event, attendee, ticket) remain on');
  console.log('[migrate] RfidTag records for backward compatibility. They will be');
  console.log('[migrate] removed in a future migration once the codebase is fully');
  console.log('[migrate] switched to reading from RfidAssignment.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});
