require('dotenv').config();
if (process.env.NODE_ENV === 'production') throw new Error('Demo data scripts are disabled in production');

const mongoose = require('mongoose');

const clearDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/entrynex');
  console.log('MongoDB connected for clearing data...');

  const collections = Object.keys(mongoose.connection.collections);
  for (const collectionName of collections) {
    const collection = mongoose.connection.collections[collectionName];
    try {
      await collection.deleteMany({});
      console.log(`Cleared ${collectionName}`);
    } catch (err) {
      console.error(`Failed to clear ${collectionName}:`, err.message);
    }
  }

  console.log('All collections cleared.');
  await mongoose.disconnect();
  process.exit(0);
};

clearDB().catch((err) => {
  console.error('Error clearing DB:', err);
  process.exit(1);
});