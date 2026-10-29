const mongoose = require('mongoose');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Company = require('../src/models/Company');
require('dotenv').config();

const syncData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Create a Default/Legacy Company if none exists
    let legacyCompany = await Company.findOne({ name: 'Legacy Organization' });
    if (!legacyCompany) {
      legacyCompany = await Company.create({
        name: 'Legacy Organization',
        registeredBusinessName: 'Legacy Organization',
        organizationType: 'NGO',
        status: 'Active',
        primaryContactPerson: 'System Administrator',
        officialEmail: 'admin@legacy.org',
        officialPhone: '0000000000',
        isProfitable: false,
        registeredAddress: 'System Default Address',
        contactNumber: '0000000000',
        designation: 'Admin',
        invoiceEmail: 'admin@legacy.org',
        paymentContact: 'System Admin',
        bankDetails: 'N/A'
      });
      console.log('Created Legacy Company');
    }

    // 2. Sync Organisers without a company
    const organisersToSync = await User.find({ 
      role: { $in: ['MainOrganiser', 'SubOrganiser'] },
      company: { $exists: false }
    });
    
    if (organisersToSync.length > 0) {
      await User.updateMany(
        { _id: { $in: organisersToSync.map(u => u._id) } },
        { $set: { company: legacyCompany._id } }
      );
      console.log(`Synced ${organisersToSync.length} organisers to Legacy Company`);
    }

    // 3. Sync Events without a company
    const eventsToSync = await Event.find({
      company: { $exists: false }
    });

    if (eventsToSync.length > 0) {
      await Event.updateMany(
        { _id: { $in: eventsToSync.map(e => e._id) } },
        { $set: { company: legacyCompany._id } }
      );
      console.log(`Synced ${eventsToSync.length} events to Legacy Company`);
    }

    // 4. Handle singular mainOrganiser to plural mainOrganisers
    const rawEvents = await Event.find({}).lean();
    for (const event of rawEvents) {
      let updates = {};
      let needsUpdate = false;

      if (event.mainOrganiser && (!event.mainOrganisers || event.mainOrganisers.length === 0)) {
        updates.mainOrganisers = [event.mainOrganiser];
        needsUpdate = true;
      }

      if (needsUpdate) {
        await Event.updateOne({ _id: event._id }, { $set: updates });
      }
    }

    console.log('Sync completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
};

syncData();
