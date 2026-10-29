const mongoose = require('mongoose');
module.exports = mongoose.models.JobLease || mongoose.model('JobLease', new mongoose.Schema({ _id: String, owner: String, expiresAt: Date }, { versionKey: false }));
