const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { handleIncomingMessage, extractMenuNumber, getMainMenuMessage, getServicesMenuMessage } = require('../src/bot/botHandler');
const BotSession = require('../src/models/BotSession');
const User = require('../src/models/User');

async function runTests() {
  console.log('--- 1. Testing extractMenuNumber ---');
  for (let i = 1; i <= 14; i++) {
    const parsed = extractMenuNumber(String(i));
    if (parsed !== i) throw new Error(`Failed to extract ${i}, got ${parsed}`);
  }
  console.log('✅ extractMenuNumber 1 to 14 verified!');

  console.log('--- 2. Testing getMainMenuMessage with "NIVESH ARN" ---');
  const menuEn = getMainMenuMessage('NIVESH ARN', false);
  console.log('Menu output:\n' + menuEn);

  const expected = `⛪ *Main Menu*
Welcome, *NIVESH ARN*! How can I help you today?

1️⃣ 📖 *Daily Bible*
2️⃣ ⛪ *Mass Timings*
3️⃣ 🕊️ *Services & Help Desk*
4️⃣ 📅 *Events*
5️⃣ 📢 *Announcements*
6️⃣ 📜 *Church Information*
7️⃣ 🌟 *Saint of the Day*
8️⃣ ❓ *Help*

👉 *You can reply with a number or ask your question naturally.*
➡️ *Type "Services" for the complete 14 Parish Help Desk services.*`;

  if (menuEn.trim() !== expected.trim()) {
    console.error('Mismatch in getMainMenuMessage!');
    console.error('Actual:', JSON.stringify(menuEn));
    console.error('Expected:', JSON.stringify(expected));
    process.exit(1);
  }
  console.log('✅ getMainMenuMessage matches requested text perfectly!');

  console.log('--- 3. Testing getServicesMenuMessage ---');
  const servicesEn = getServicesMenuMessage(false);
  console.log('Services menu preview:\n' + servicesEn.slice(0, 200) + '...');
  if (!servicesEn.includes('1️⃣4️⃣ 📜 *Mass Intentions & Certificates*')) {
    throw new Error('14th service missing from Services Menu!');
  }
  console.log('✅ Services Menu 1 to 14 verified!');

  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
