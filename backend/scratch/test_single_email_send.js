require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { sendDailyChurchNotifications } = require('../src/services/dailyNotificationService');

async function testSingleEmail() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sjdb_church';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.');

    console.log('\n--- Testing Single Email Dispatch with Sources ---');
    const result = await sendDailyChurchNotifications({
      isTest: true,
      testEmail: 'arndas777@gmail.com'
    });

    console.log('Test Dispatch Result:', JSON.stringify(result, null, 2));
    console.log('\n Test completed!');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

testSingleEmail();
