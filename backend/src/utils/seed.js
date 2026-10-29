require('dotenv').config();
if (process.env.NODE_ENV === 'production') throw new Error('Demo data scripts are disabled in production');

const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Sponsor = require('../models/Sponsor');
const Attendee = require('../models/Attendee');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/entrynex');
  console.log('MongoDB connected for seeding...');
};

const seed = async () => {
  await connectDB();
  await User.deleteMany({});
  await Event.deleteMany({});
  await Sponsor.deleteMany({});
  await Attendee.deleteMany({});
  console.log('Cleared existing data.');

  const admin = await User.create({
    name: 'System Admin', email: process.env.SEED_ADMIN_EMAIL || 'admin@stadium.entrynex.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@Matrix.Reset', role: 'main_admin', isActive: true,
    phone: '+94711111111', isVerified: true
  });

  const organiser = await User.create({
    name: 'Roshan Perera', email: 'organiser@stadium.entrynex.com', password: 'Organiser@Matrix.Reset',
    role: 'main_organiser', isActive: true, createdBy: admin._id,
    phone: '+94722222222', isVerified: true
  });

  const subOrg = await User.create({
    name: 'Nimali Silva', email: 'suborg@stadium.entrynex.com', password: 'SubOrg@Matrix.Reset',
    role: 'sub_organiser', isActive: true, createdBy: organiser._id,
    phone: '+94733333333', isVerified: true,
    permissions: { canAddAttendees: true, canBulkUpload: true, canVerifyPhotos: true, canInviteAttendees: true, canViewReports: true, canManageStaff: false },
  });

  const staff = await User.create({
    name: 'Kamal Bandara', email: 'staff@stadium.entrynex.com', password: 'Staff@Matrix.Reset',
    role: 'staff', isActive: true, assignedGates: ['Gate A', 'Gate B'], createdBy: organiser._id,
    phone: '+94744444444', isVerified: true
  });

  const event = await Event.create({
    name: 'The Big Match 2025', slug: 'the-big-match-2025', description: 'The most anticipated cricket match of the year at R. Premadasa Stadium.',
    eventType: 'cricket',
    venue: { name: 'R. Premadasa International Cricket Stadium', address: 'Khettarama Road', city: 'Colombo', country: 'Sri Lanka' },
    startDate: new Date('2027-07-15T08:00:00Z'), endDate: new Date('2027-07-17T20:00:00Z'),
    gatesOpenTime: new Date('2027-07-15T06:00:00Z'), 
    status: 'published', 
    publishedAt: new Date(),
    branding: {
      themeColor: '#078f92',
      logoImage: '',
      bannerImage: '',
    },
    matchDetails: { teamA: 'Royal College', teamB: "S. Thomas' College", matchType: 'Two-Day', series: 'Battle of the Maroons 2025' },
    categories: [
      { id: 'vvip', name: 'VVIP', description: 'Exclusive hospitality suite', price: 25000, capacity: 100, sold: 0, color: '#7C3AED', allowedZones: ['vvip-suite','vip-lounge','premium-stand','general-stand','media-center'], benefits: ['VVIP Suite','Gourmet dining','Priority parking','All areas access'] },
      { id: 'vip', name: 'VIP', description: 'Premium pavilion seating', price: 12000, capacity: 500, sold: 0, color: '#078f92', allowedZones: ['vip-lounge','premium-stand','general-stand'], benefits: ['VIP Pavilion','Lounge access','Complimentary refreshments'] },
      { id: 'general', name: 'General Admission', description: 'Standard seating', price: 3500, capacity: 5000, sold: 0, color: '#16A34A', allowedZones: ['general-stand'], benefits: ['General stand access','Match programme'] },
      { id: 'school', name: 'School / Student', description: 'Student block', price: 1500, capacity: 3000, sold: 0, color: '#D97706', allowedZones: ['school-block'], benefits: ['School block seating','Student ID required'] },
      { id: 'media', name: 'Media / Press', description: 'Press accreditation', price: 0, capacity: 200, sold: 0, color: '#DC2626', allowedZones: ['media-center','press-box','general-stand'], benefits: ['Press box','Media centre','Interview zone'] },
    ],
    zones: [
      { id: 'vvip-suite', name: 'VVIP Hospitality Suite', capacity: 100, color: '#7C3AED' },
      { id: 'vip-lounge', name: 'VIP Lounge', capacity: 600, color: '#078f92' },
      { id: 'premium-stand', name: 'Premium Stand', capacity: 1000, color: '#0891B2' },
      { id: 'general-stand', name: 'General Stand', capacity: 5000, color: '#16A34A' },
      { id: 'school-block', name: 'School Block', capacity: 3000, color: '#D97706' },
      { id: 'media-center', name: 'Media Centre', capacity: 200, color: '#DC2626' },
      { id: 'press-box', name: 'Press Box', capacity: 50, color: '#9333EA' },
    ],
    sponsorPackages: [
      {
        id: 'sponsor-platinum-001',
        name: 'Platinum Sponsor',
        level: 'Platinum',
        description: 'Top-tier sponsor package with premium access passes.',
        capacity: 8,
        price: 750000,
        benefits: ['Main stage branding', 'VIP lounge access', 'Media mentions', 'Premium passes'],
        contactNumber: '+94777777777',
        isVisible: true,
      },
      {
        id: 'sponsor-gold-001',
        name: 'Gold Sponsor',
        level: 'Gold',
        description: 'Mid-tier sponsor package with event branding and team passes.',
        capacity: 5,
        price: 420000,
        benefits: ['Ground branding', 'Event mentions', 'Gold passes'],
        contactNumber: '+94788888888',
        isVisible: true,
      },
    ],
    mainOrganiser: organiser._id, subOrganisers: [subOrg._id], staff: [staff._id],
    settings: { 
      currency: 'LKR',
      requirePhotoVerification: true, 
      allowSelfConfirmation: true, 
      confirmationDeadlineHours: 72, 
      maxTicketsPerOrder: 10, 
      rfidEnabled: true,
      paymentMethods: {
        card: true,
        bank_transfer: true,
        cash: true,
      }
    },
    createdBy: admin._id,
  });

  const auditor = await User.create({
    name: 'Dilshan Silva', email: 'auditor@stadium.entrynex.com', password: 'Auditor@Matrix.Reset',
    role: 'auditor', isActive: true, createdBy: organiser._id,
    phone: '+94755555555', isVerified: true
  });

  const attendeeUser = await User.create({
    name: 'Sofia Flex', email: 'attendee@stadium.entrynex.com', password: 'Attendee@Matrix.Reset',
    role: 'attendee', isActive: true,
    phone: '+94766666666', isVerified: true
  });

  const sponsorUser = await User.create({
    name: 'Nuwan Holdings Sponsor',
    email: 'sponsor@stadium.entrynex.com',
    password: 'Sponsor@Matrix.Reset',
    role: 'Sponsor',
    isActive: true,
    createdBy: organiser._id,
    phone: '+94777777777',
    isVerified: true,
    assignedEvents: [event._id],
  });

  const seededSponsor = await Sponsor.create({
    eventId: event._id,
    packageId: 'sponsor-platinum-001',
    companyName: 'Nuwan Holdings (Pvt) Ltd',
    contactPerson: 'Nuwan Perera',
    email: sponsorUser.email,
    phone: sponsorUser.phone,
    userId: sponsorUser._id,
    status: 'Active',
    notes: 'Seeded sponsor account for QA lab access.',
  });

  await Attendee.create({
    event: event._id,
    sponsorPackageId: 'sponsor-platinum-001',
    sponsorId: seededSponsor._id,
    fullName: 'Nuwan Perera',
    email: sponsorUser.email,
    phone: sponsorUser.phone,
    categoryId: 'sponsor-platinum-001-pass',
    categoryName: 'Platinum Sponsor Pass',
    isPass: true,
    confirmationStatus: 'invited',
    isConfirmed: false,
    addedVia: 'sponsor',
    addedBy: sponsorUser._id,
    allowedZones: ['vvip-suite', 'vip-lounge', 'premium-stand'],
  });

  await User.updateMany({ _id: { $in: [organiser._id, subOrg._id, staff._id, auditor._id, sponsorUser._id] } }, { $addToSet: { assignedEvents: event._id } });

  console.log('\n=== SEED COMPLETE ===');
  console.log(`  Main Admin:     ${process.env.SEED_ADMIN_EMAIL || 'admin@stadium.entrynex.com'} / ${process.env.SEED_ADMIN_PASSWORD || 'Admin@Matrix.Reset'}`);
  console.log('  Main Organiser: organiser@stadium.entrynex.com / Organiser@Matrix.Reset');
  console.log('  Sub Organiser:  suborg@stadium.entrynex.com    / SubOrg@Matrix.Reset');
  console.log('  Staff:          staff@stadium.entrynex.com     / Staff@Matrix.Reset');
  console.log('  Auditor:        auditor@stadium.entrynex.com   / Auditor@Matrix.Reset');
  console.log('  Sponsor:        sponsor@stadium.entrynex.com   / Sponsor@Matrix.Reset');
  console.log('  Attendee:       attendee@stadium.entrynex.com  / Attendee@Matrix.Reset');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
