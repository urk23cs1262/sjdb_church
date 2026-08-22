require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { getTodayDailyContent } = require('../src/services/dailyContentService');
const { generateDailyNotificationHtml } = require('../src/templates/dailyNotificationEmail');

async function previewHtml() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church');
  const dailyContent = await getTodayDailyContent();

  const html = generateDailyNotificationHtml({
    userName: 'Nivesh (Parishioner)',
    dailyContent,
    userLanguage: 'ta',
    hasBibleImageAttachment: false,
    hasSaintImageAttachment: false
  });

  const previewPath = path.join(__dirname, 'preview_daily_email.html');
  fs.writeFileSync(previewPath, html, 'utf8');
  console.log(`✅ Preview HTML generated at: ${previewPath}`);
  console.log(`HTML size: ${html.length} bytes`);
  console.log('Includes Mass Readings section:', html.includes('முதல் வாசகம்') && html.includes('நற்செய்தி வாசகம்'));
  console.log('Includes Reflection section:', html.includes('சிலுவையின் மீட்பும் தியாகமும்') && html.includes('மன்றாட்டு:'));
  console.log('Includes Sources:', html.includes('CCBI &amp; USCCB Liturgy') && html.includes('Vatican News'));

  process.exit(0);
}

previewHtml();
