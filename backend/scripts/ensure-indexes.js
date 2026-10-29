require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  await require('../src/config/database')();
  for (const file of fs.readdirSync(path.join(__dirname, '../src/models'))) if (file.endsWith('.js')) require(path.join(__dirname, '../src/models', file));
  require('../src/middleware/mongoRateStore');
  for (const [name, model] of Object.entries(mongoose.models)) {
    await model.createIndexes(); // Add only; never drop existing indexes automatically.
    console.log('Indexes verified:', name);
  }
  await mongoose.connection.collection('socket_events').createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
  await mongoose.disconnect();
}
main().catch(async error => { console.error('Index setup failed:', error.message); await mongoose.disconnect(); process.exitCode = 1; });
