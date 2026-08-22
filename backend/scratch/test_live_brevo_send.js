require('dotenv').config(); // reads backend/.env
const mongoose = require('mongoose');
const { sendDailyChurchNotifications } = require('../src/services/dailyNotificationService');

async function testLiveEmail() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.\n');

    console.log('SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      from: process.env.SMTP_FROM
    });

    console.log('\n🚀 Dispatching Full Liturgical Email (with Mass Readings & Reflection)...');
    const result = await sendDailyChurchNotifications({
      isTest: true,
      testEmail: 'arndas777@gmail.com',
      testLang: 'ta',
      testName: 'Nivesh'
    });

    console.log('Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testLiveEmail();
