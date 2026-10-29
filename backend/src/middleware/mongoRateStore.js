const crypto = require('node:crypto');
const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, totalHits: Number, expiresAt: Date }, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Bucket = mongoose.models.RateBucket || mongoose.model('RateBucket', schema);
class MongoRateStore {
  constructor(namespace) { this.namespace = namespace; this.prefix = `${namespace}:`; this.localKeys = false; }
  init(options) { this.windowMs = options.windowMs; }
  id(key) { return `${this.namespace}:${crypto.createHash('sha256').update(String(key)).digest('hex')}`; }
  async increment(key) {
    const now = new Date();
    const active = { $gt: ['$expiresAt', now] };
    const bucket = await Bucket.findOneAndUpdate({ _id: this.id(key) }, [{ $set: {
      totalHits: { $cond: [active, { $add: ['$totalHits', 1] }, 1] },
      expiresAt: { $cond: [active, '$expiresAt', new Date(now.getTime() + this.windowMs)] },
    } }], { upsert: true, new: true }).lean();
    return { totalHits: bucket.totalHits, resetTime: bucket.expiresAt };
  }
  async decrement(key) { await Bucket.updateOne({ _id: this.id(key), totalHits: { $gt: 0 } }, { $inc: { totalHits: -1 } }); }
  async resetKey(key) { await Bucket.deleteOne({ _id: this.id(key) }); }
}
module.exports = MongoRateStore;
