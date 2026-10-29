const mongoose = require('mongoose');
const SystemConfig = require('../../src/models/SystemConfig');
const Event = require('../../src/models/Event');
require('dotenv').config();

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/entrynex';

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Ensure global system config exists
  let config = await SystemConfig.findOne({ key: 'global' });
  if (!config) {
    config = new SystemConfig({ key: 'global' });
    await config.save();
    console.log('Created new SystemConfig global');
  }

  if (config.email?.enabled === undefined) {
    config.email = config.email || {};
    config.email.enabled = true;
    await config.save();
    console.log('Set SystemConfig.email.enabled = true');
  } else {
    console.log('SystemConfig.email.enabled already set:', config.email.enabled);
  }

  // Ensure events have settings.communicationChannels defaults
  const events = await Event.find();
  console.log(`Found ${events.length} events`);
  for (const ev of events) {
    ev.settings = ev.settings || {};
    ev.settings.communicationChannels = ev.settings.communicationChannels || {};
    if (ev.settings.communicationChannels.email === undefined) ev.settings.communicationChannels.email = true;
    if (ev.settings.communicationChannels.sms === undefined) ev.settings.communicationChannels.sms = false;
    if (ev.settings.requiresPhotoVerification === undefined) ev.settings.requiresPhotoVerification = true;
    await ev.save();
    console.log(`Updated event ${ev._id} defaults`);
  }

  console.log('Migration complete');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});