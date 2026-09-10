const mongoose = require('mongoose');

async function restoreAndFreshStart() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  console.log(`Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);

  try {
    const db = mongoose.connection.db;

    // 1. Unblock / restore all UserModeration records
    const modResult = await db.collection('usermoderations').updateMany({}, {
      $set: {
        status: 'active',
        violationCount: 0,
        blockedReason: null,
        blockedAt: null,
        unblockedAt: new Date(),
        violations: []
      }
    });
    console.log(`[Restoration] UserModeration records unblocked & restored: ${modResult.modifiedCount} (matched: ${modResult.matchedCount})`);

    // 2. Reactivate any deactivated users in User collection
    const userResult = await db.collection('users').updateMany(
      { isActive: false },
      { $set: { isActive: true, deactivatedReason: null } }
    );
    console.log(`[Restoration] Deactivated users reactivated: ${userResult.modifiedCount}`);

    // 3. Delete all BotSession records so everyone starts completely freshly
    const sessionResult = await db.collection('botsessions').deleteMany({});
    console.log(`[Fresh Start] All BotSession records deleted: ${sessionResult.deletedCount}`);

    // 4. Delete all ProcessedMessage records
    const pmResult = await db.collection('processedmessages').deleteMany({});
    console.log(`[Fresh Start] ProcessedMessage records cleared: ${pmResult.deletedCount}`);

    // 5. Verification
    const mods = await db.collection('usermoderations').find({}).toArray();
    console.log('\n--- Current UserModeration Status ---');
    mods.forEach(m => {
      console.log(`Phone: ${m.phoneNumber} | Status: ${m.status} | Violations: ${m.violationCount} | BlockedReason: ${m.blockedReason}`);
    });

    const activeSessionsCount = await db.collection('botsessions').countDocuments();
    console.log(`Active BotSessions: ${activeSessionsCount}`);

    console.log('\n✅ Database is 100% restored and ready for fresh WhatsApp bot onboarding!');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  restoreAndFreshStart()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error during restore:', err);
      process.exit(1);
    });
}

module.exports = { restoreAndFreshStart };
