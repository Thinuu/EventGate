const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const demoUsers = [
  {
    name: 'System Administrator',
    email: 'admin@stadium.entrynex.com',
    password: 'Admin@Matrix.Reset',
    role: 'MainAdmin',
    phone: '+94 77 111 2222',
    status: 'Active',
    isVerified: true,
    permissions: { all: true }
  },
  {
    name: 'Event Director',
    email: 'organiser@stadium.entrynex.com',
    password: 'Organiser@Matrix.Reset',
    role: 'MainOrganiser',
    phone: '+94 77 222 3333',
    status: 'Active',
    isVerified: true,
    permissions: { canManageEvents: true }
  },
  {
    name: 'Sector Lead',
    email: 'suborg@stadium.entrynex.com',
    password: 'SubOrg@Matrix.Reset',
    role: 'SubOrganiser',
    phone: '+94 77 333 4444',
    status: 'Active',
    isVerified: true,
    permissions: { canScanTickets: true, canViewLogs: true },
    assignedZones: [],
  },
  {
    name: 'Gate Controller',
    email: 'staff@stadium.entrynex.com',
    password: 'Staff@Matrix.Reset',
    role: 'Staff',
    phone: '+94 77 444 5555',
    status: 'Active',
    isVerified: true,
    permissions: { canScanTickets: true }
  },
  {
    name: 'Field Volunteer',
    email: 'volunteer@stadium.entrynex.com',
    password: 'Volunteer@Matrix.Reset',
    role: 'Volunteer',
    phone: '+94 77 555 6666',
    status: 'Active',
    isVerified: true,
    permissions: { canScanTickets: true }
  },
  {
    name: 'Financial Auditor',
    email: 'auditor@stadium.entrynex.com',
    password: 'Auditor@Matrix.Reset',
    role: 'Auditor',
    phone: '+94 77 666 7777',
    status: 'Active',
    isVerified: true,
    permissions: { canViewReports: true }
  },
  {
    name: 'VVIP Attendee',
    email: 'attendee@stadium.entrynex.com',
    password: 'Attendee@Matrix.Reset',
    role: 'Attendee',
    phone: '+94 77 777 8888',
    status: 'Active',
    isVerified: true,
    permissions: {}
  }
];

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB Elite Gateway...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connection Established.');

    console.log('Flushing existing demo ecosystem...');
    // Clear all @stadium.entrynex.com users to start fresh or by explicit email
    await User.deleteMany({ email: { $regex: '@stadium.entrynex.com$' } });
    await User.deleteMany({ email: { $regex: '@entrynex.com$' } }); // Clear old ones too

    console.log('Initializing Premium Identities...');
    for (const user of demoUsers) {
      await User.create(user);
      console.log(`[AUTHORIZED] ${user.role}: ${user.email}`);
    }

    console.log('--- SYSTEM RE-SEED COMPLETE ---');
    process.exit(0);
  } catch (error) {
    console.error('--- SEEDING CRITICAL FAILURE ---');
    console.error(error.message);
    process.exit(1);
  }
};

seedDatabase();
