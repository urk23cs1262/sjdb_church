require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { getTodayDailyContent } = require('../src/services/dailyContentService');

async function testContent() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church');
  const content = await getTodayDailyContent();

  console.log('=== MASS READINGS (TAMIL) ===');
  console.log('Title:', content.massReadings.tamil.title);
  console.log('Readings Count:', content.massReadings.tamil.readings.length);
  content.massReadings.tamil.readings.forEach((r, i) => {
    console.log(`\n[${i}] ${r.type} ${r.reference ? `(${r.reference})` : ''}:`);
    console.log(r.text.slice(0, 150) + '...');
  });

  console.log('\n=== REFLECTION (TAMIL) ===');
  console.log(content.reflection.tamil);

  console.log('\n=== SAINT OF THE DAY ===');
  console.log('Tamil:', content.saint.nameTamil);
  console.log('English:', content.saint.nameEnglish);
  console.log('Image:', content.saint.image);

  process.exit(0);
}

testContent();
