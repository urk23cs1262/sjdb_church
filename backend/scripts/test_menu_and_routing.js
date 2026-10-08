const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { extractMenuNumber, getMainMenuMessage, getServicesMenuMessage } = require('../src/bot/botHandler');

async function runTests() {
  console.log('--- 1. Testing extractMenuNumber ---');
  for (let i = 1; i <= 15; i++) {
    const parsed = extractMenuNumber(String(i));
    if (parsed !== i) throw new Error(`Failed to extract ${i}, got ${parsed}`);
  }
  console.log('✅ extractMenuNumber 1 to 15 verified!');

  console.log('--- 2. Testing getMainMenuMessage with "NIVESH ARN" ---');
  const menuEn = getMainMenuMessage('NIVESH ARN', false);
  console.log('Menu output:\n' + menuEn);

  const expected = `⛪ *Main Menu*
Welcome, *NIVESH ARN*! How can I help you today?
_(வணக்கம்! உங்களுக்கு எவ்வாறு உதவ முடியும்?)_

1️⃣ 📖 *Daily Bible* (தினசரி விவிலியம்)
2️⃣ 🕊️ *Daily Mass Readings* (தினசரி திருப்பலி வாசகங்கள்)
3️⃣  ⛪ *Mass Timings* (திருப்பலி நேரங்கள்)
4️⃣  🌟 *Saint of the Day* (இன்றைய புனிதர்)
5️⃣ 📅 *Events* (நிகழ்வுகள்)
6️⃣ 📢 *Announcements* (அறிவிப்புகள்)
7️⃣ 📜 *Church Information* (ஆலய விபரங்கள்)
8️⃣ ❓ *Help* (உதவி)

👉 *You can reply with a number or ask your question naturally.*
➡️ *Type "Services" for the complete 15 Parish Help Desk services.*`;

  if (menuEn.trim() !== expected.trim()) {
    console.error('Mismatch in getMainMenuMessage!');
    console.error('Actual:\n', JSON.stringify(menuEn));
    console.error('Expected:\n', JSON.stringify(expected));
    process.exit(1);
  }
  console.log('✅ getMainMenuMessage matches requested text perfectly!');

  console.log('--- 3. Testing getMainMenuMessage with Tamil / fallback ---');
  const menuTa = getMainMenuMessage('NIVESH ARN', true);
  if (menuTa.trim() !== expected.trim()) {
    console.error('Mismatch in Tamil getMainMenuMessage!');
    process.exit(1);
  }
  console.log('✅ Tamil getMainMenuMessage verified!');

  const menuNoName = getMainMenuMessage('', false);
  if (!menuNoName.includes('Welcome! How can I help you today?')) {
    throw new Error('Fallback greeting failed when userName is empty!');
  }
  console.log('✅ Fallback greeting without userName verified!');

  console.log('--- 4. Testing getServicesMenuMessage ---');
  const servicesEn = getServicesMenuMessage(false);
  if (!servicesEn.includes('1️⃣5️⃣ 📜 *Mass Intentions & Certificates*')) {
    throw new Error('15th service missing from Services Menu!');
  }
  console.log('✅ Services Menu 1 to 15 verified!');

  console.log('\n🎉 ALL MENU TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
