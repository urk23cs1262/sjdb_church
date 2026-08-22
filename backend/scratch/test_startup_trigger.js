require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { checkAndSendOnStartup } = require('../src/services/dailyNotificationService');
const DailyNotificationLog = require('../src/models/DailyNotificationLog');

async function testStartupTrigger() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sjdb_church';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.');

    console.log('\n--- Testing checkAndSendOnStartup() with existing logs for today ---');
    const result1 = await checkAndSendOnStartup();
    console.log('Result 1 (Expected skipped=true if today already sent):', result1);

    if (result1 && result1.skipped) {
      console.log(` Idempotency Verified: Server reboot did NOT duplicate notifications for ${result1.dateKey}.`);
    } else {
      console.log(` Initial send executed: ${result1?.totalSent || 0} sent.`);
      console.log('\n--- Testing immediate second startup trigger (Simulating 2nd Deployment) ---');
      const result2 = await checkAndSendOnStartup();
      console.log('Result 2 (Must be skipped=true):', result2);
      if (result2 && result2.skipped) {
        console.log(` Idempotency Verified on 2nd restart: ${result2.dateKey} safely skipped!`);
      } else {
        throw new Error('Duplicate prevention failed on second restart!');
      }
    }

    console.log('\n STARTUP / DEPLOYMENT IDEMPOTENCY TEST PASSED! ');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

testStartupTrigger();
