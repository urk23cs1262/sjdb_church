require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const DailyMassReading = require('../src/models/DailyMassReading');
const { getReadingForDate, fetchAndStoreTamilReading } = require('../src/services/dailyMassReadingService');

async function checkReadingDoc() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church');
  let doc = await getReadingForDate('2026-08-21');
  if (!doc) {
    console.log('No doc found for 2026-08-21, fetching...');
    doc = await fetchAndStoreTamilReading('2026-08-21');
  }

  console.log('DailyMassReading Document for 2026-08-21:');
  console.log('Title:', doc.title || doc.pageTitle || doc.liturgicalDay);
  console.log('Celebration:', doc.celebration);
  console.log('Sections count:', doc.sections?.length);
  if (doc.sections) {
    doc.sections.forEach((s, i) => {
      console.log(` Section [${i}] heading:`, s.heading);
      console.log(` Section [${i}] paragraphs count:`, s.paragraphs?.length);
      console.log(` Section [${i}] sample text:`, s.paragraphs?.[0]?.slice(0, 100));
    });
  }
  console.log('Reflection:', {
    title: doc.reflection?.title,
    heading: doc.reflection?.heading,
    content: doc.reflection?.content?.slice(0, 120),
    paragraphsCount: doc.reflection?.paragraphs?.length,
    prayer: doc.reflection?.prayer
  });

  process.exit(0);
}

checkReadingDoc();
