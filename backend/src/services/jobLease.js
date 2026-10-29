const crypto = require('node:crypto');
const JobLease = require('../models/JobLease');
async function withJobLease(name, task, durationMs = 240000) {
  const owner = crypto.randomUUID();
  let lease;
  try { lease = await JobLease.findOneAndUpdate({ _id: name, expiresAt: { $lte: new Date() } }, { $set: { owner, expiresAt: new Date(Date.now() + durationMs) } }, { upsert: true, new: true }); }
  catch (error) { if (error.code === 11000) return { skipped: true }; throw error; }
  if (!lease) return { skipped: true };
  try { return await task(); }
  finally { await JobLease.updateOne({ _id: name, owner }, { $set: { expiresAt: new Date(0) } }); }
}
module.exports = { withJobLease };
