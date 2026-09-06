const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const User = require('../models/User');

async function restoreAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const result = await User.updateMany(
    { role: { $in: ['admin', 'priest'] } },
    {
      $set: {
        isActive: true,
        memberStatus: 'Active',
        account_verified: true,
        isVerified: true,
        otpVerified: true,
        isSuspended: false,
        failedLoginAttempts: 0,
        isLockedUntil: null
      }
    }
  );

  console.log(`Admin/Priest accounts restored to active: ${result.modifiedCount}`);
  
  const admins = await User.find({ role: { $in: ['admin', 'priest'] } }).select('email name role isActive memberStatus');
  console.log('Active Admin/Priest accounts:', admins);

  await mongoose.disconnect();
}

restoreAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
