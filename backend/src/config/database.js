const mongoose = require('mongoose');
let connectionPromise;
async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error('MONGODB_URI is not configured');
    connectionPromise = mongoose.connect(uri, {
      maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000, socketTimeoutMS: 30000,
      autoIndex: process.env.NODE_ENV !== 'production',
    }).then(() => mongoose.connection).catch(error => { connectionPromise = undefined; throw error; });
  }
  return connectionPromise;
}
module.exports = connectDB;
