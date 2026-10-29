require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/entrynex');
  console.log('MongoDB connected...');
};

const createExpiredEvent = async () => {
  await connectDB();
  
  // Clean up any previous test expired events
  await Event.deleteMany({ slug: 'expired-test-match' });
  
  const now = new Date();
  const startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const endDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
  
  const event = await Event.create({
    name: 'Expired Test Match',
    slug: 'expired-test-match',
    description: 'This match is in the past for testing overdue filters.',
    eventType: 'cricket',
    venue: { name: 'Past Stadium', address: 'Old Road', city: 'Colombo', country: 'Sri Lanka' },
    startDate,
    endDate,
    status: 'published',
    publishedAt: new Date(),
    categories: [
      { id: 'vip', name: 'VIP', description: 'Premium seating', price: 5000, capacity: 100, sold: 0 }
    ],
    settings: {
      currency: 'LKR',
      requirePhotoVerification: false,
      allowSelfConfirmation: true,
      paymentMethods: { card: true, bank_transfer: true, cash: true }
    }
  });

  console.log('Expired test event created:', event._id, event.name);
  console.log('EndDate:', event.endDate);
  mongoose.connection.close();
};

createExpiredEvent().catch(console.error);
