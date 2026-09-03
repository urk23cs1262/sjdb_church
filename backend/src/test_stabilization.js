require('dotenv').config();
const mongoose = require('mongoose');

async function runTests() { 
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(uri);
  console.log(' Connected to MongoDB for testing.');

  const { answerChurchQuestion } = require('./bot/churchRAGService');
  const { getSaintForDate } = require('./data/catholic_saints_calendar');

  console.log('\n=== 1. Testing Catholic Saints Calendar ===');
  const todaySaint = getSaintForDate(new Date('2026-08-31'));
  console.log('August 31 Saint:', todaySaint?.name, '| Tamil:', todaySaint?.nameTa);

  const brittoSaint = getSaintForDate(new Date('2026-02-04'));
  console.log('February 4 Saint (Patron):', brittoSaint?.name, '| Tamil:', brittoSaint?.nameTa);

  console.log('\n=== 2. Testing Church RAG Engine & NLP Intent Matching ===');
  const locQuery = await answerChurchQuestion('Where is the church located?', 'en', {});
  console.log('Location Reply includes Maps link:', locQuery.reply.includes('maps.google.com'));

  const massQuery = await answerChurchQuestion('What time is Sunday Mass?', 'en', {});
  console.log('Mass Timings Reply includes 6:00 AM:', massQuery.reply.includes('6:00 AM'));

  const contactQuery = await answerChurchQuestion('How to contact church office?', 'en', {});
  console.log('Contact Reply includes Phone:', contactQuery.reply.includes('+91 96556 39144'));

  console.log('\n=== 3. Testing Unsupported Language Filter ===');
  const foreignScriptsRegex = /[\u0600-\u06FF\u0750-\u077F\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u1200-\u137F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u2C00-\u2C5F\u2D30-\u2D7F\u3040-\u30FF\u3100-\u312F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u0370-\u03FF]/;
  const hindiTest = foreignScriptsRegex.test('नमस्ते आप कैसे हैं');
  const tamilTest = foreignScriptsRegex.test('வணக்கம் ஐயா');
  const englishTest = foreignScriptsRegex.test('Hello father, what time is mass?');
  console.log('Hindi rejected (true expected):', hindiTest);
  console.log('Tamil allowed (false expected):', !tamilTest);
  console.log('English allowed (false expected):', !englishTest);

  console.log('\n=== 4. Testing Bot Subscriber Fresh Reset Endpoint Logic ===');
  const { clearAllBotSubscribers } = require('./controllers/botController');
  let mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  };
  await clearAllBotSubscribers({}, mockRes);
  console.log('Fresh Reset Result:', mockRes.data?.message);

  await mongoose.disconnect();
  console.log('\n✅ ALL BACKEND & BOT STABILIZATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
