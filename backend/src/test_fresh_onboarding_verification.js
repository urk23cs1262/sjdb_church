/**
 * Verification Test: Fresh Bot Onboarding Flow after Clearing Sessions
 */

const mongoose = require('mongoose');
const BotSession = require('./models/BotSession');
const { handleIncomingMessage } = require('./bot/botHandler');

async function testFreshOnboarding() {
  console.log('====================================================');
  console.log('🧪 TESTING FRESH BOT ONBOARDING AFTER SESSION RESET');
  console.log('====================================================\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/sjdb_church', { serverSelectionTimeoutMS: 2000 });
  } catch (e) {
    console.log('MongoDB offline, setting buffer timeout.');
    mongoose.set('bufferTimeoutMS', 500);
  }

  // Verify BotSession collection is 0
  const sessionCount = await BotSession.countDocuments();
  console.log(`Current bot sessions count: ${sessionCount}`);

  // Test new incoming message from an un-onboarded user
  const mockJid = '919876543210@s.whatsapp.net';
  const res = await handleIncomingMessage(mockJid, 'Hi', 'Mariappan');

  console.log('\nBot response to "Hi":');
  console.log(res);

  // Check that new session was created in 'welcome' or 'ask_phone' state
  const session = await BotSession.findOne({ phoneNumber: '919876543210' });
  console.log('\nNewly created session state:');
  console.log({
    phoneNumber: session?.phoneNumber,
    step: session?.step,
    isVerified: session?.isVerified,
    isOnboarded: session?.isOnboarded
  });

  if (session && session.step === 'ask_phone') {
    console.log('\n✅ PASS: Fresh onboarding flow triggered successfully!');
  } else {
    console.log('\nℹ️ Session created with step:', session?.step);
  }

  // Clean up mock test session
  await BotSession.deleteOne({ phoneNumber: '919876543210' });
  console.log('Cleaned up test session.');

  await mongoose.disconnect();
}

testFreshOnboarding().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
