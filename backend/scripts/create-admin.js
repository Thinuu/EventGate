require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
async function main() {
  const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 14) throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of 14+ characters in your secure environment');
  await require('../src/config/database')();
  if (await User.exists({ email: email.toLowerCase() })) throw new Error('Account already exists; refusing to overwrite');
  await User.create({ name: process.env.ADMIN_NAME || 'System Administrator', email, password, role: 'MainAdmin', status: 'Active', isVerified: true });
  console.log('Administrator created. Enable MFA after signing in.');
  await mongoose.disconnect();
}
main().catch(async error => { console.error('Admin setup failed:', error.message); await mongoose.disconnect(); process.exitCode = 1; });
