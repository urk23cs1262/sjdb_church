const mongoose = require('mongoose');
const { autoAssignMemberIds } = require('../services/memberIdService');

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI or MONGO_URI must be configured.');
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 1
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    autoAssignMemberIds().catch(err =>
      console.error('[DB] Member ID initialization failed:', err.message)
    );

    const User = require('../models/User');
    User.updateMany(
      { sccGroup: { $exists: true } },
      { $rename: { sccGroup: 'anbiyam' } }
    ).then(result => {
      if (result.modifiedCount > 0) {
        console.log(`[DB] Renamed ${result.modifiedCount} legacy sccGroup fields to anbiyam`);
      }
    }).catch(err => console.error('[DB] Legacy field migration failed:', err.message));

    return conn.connection;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
