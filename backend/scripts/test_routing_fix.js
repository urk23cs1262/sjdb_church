/**
 * Routing test for the dual-context menu logic.
 * Run: node backend/scripts/test_routing_fix.js
 * 
 * Verifies:
 * - MAIN MENU (lastBotReplyType !== 'SERVICES_MENU'):
 *     1 = Daily Bible
 *     2 = Mass Timings
 *     3 = Services & Help Desk
 *     4 = Events
 *     5 = Announcements
 *     6 = Church Information
 *     7 = Saint of the Day
 *     8 = Help
 *     9-14 = Direct to extended services
 * - SERVICES MENU (lastBotReplyType === 'SERVICES_MENU'):
 *     1 = Mass Timings
 *     2 = Confession Timings
 *     3 = Daily Bible Verse
 *     4 = Daily Mass Readings
 *     5 = Saint of the Day
 *     6 = Catholic Prayers & Rosary
 *     7 = Church Events
 *     8 = Parish Announcements
 *     9-14 = Extended services
 * - Menu & Greetings:
 *     "menu", "Menu", "hi", "Hi", "hello", "வணக்கம்" -> MAIN_MENU
 * - Services trigger:
 *     "services", "Services", "help desk" -> SERVICES_MENU
 */
const { extractMenuNumber } = require('../src/bot/botHandler');

function simulateRouting(rawText, lastBotReplyType) {
  const normalizedText = rawText.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const menuNum = extractMenuNumber(rawText);
  const isInServicesMenu = lastBotReplyType === 'SERVICES_MENU';

  const isMassTimingsNum    = isInServicesMenu ? (menuNum === 1) : (menuNum === 2);
  const isConfessionNum     = isInServicesMenu && (menuNum === 2);
  const isVerseNum          = isInServicesMenu ? (menuNum === 3) : (menuNum === 1);
  const isReadingsNum       = isInServicesMenu && (menuNum === 4);
  const isSaintNum          = isInServicesMenu ? (menuNum === 5) : (menuNum === 7);
  const isPrayersNum        = isInServicesMenu && (menuNum === 6);
  const isEventsNum         = isInServicesMenu ? (menuNum === 7) : (menuNum === 4);
  const isAnnouncementsNum  = isInServicesMenu ? (menuNum === 8) : (menuNum === 5);
  const isChurchInfoNum     = !isInServicesMenu && (menuNum === 6);
  const isHelpNum           = !isInServicesMenu && (menuNum === 8);
  const isLocationNum       = (menuNum === 9);
  const isMinistriesNum     = (menuNum === 10);
  const isPriestsNum        = (menuNum === 11);
  const isHistoryNum        = (menuNum === 12);
  const isContactNum        = (menuNum === 13);
  const isIntentionsCertNum = (menuNum === 14);

  const isServicesKeyword = /^(services|service|help desk|சேவைகள்|பங்கு சேவைகள்|உதவி மையம்)$/i.test(normalizedText);
  const isServicesTrigger = isServicesKeyword || (!isInServicesMenu && menuNum === 3);
  if (isServicesTrigger) return 'SERVICES_MENU';

  const isMenuTrigger = /^(menu|bot menu|main menu|show menu|help menu|0|home|start|quick commands|மெனு|முதன்மை மெனு)$/i.test(normalizedText);
  const isGreeting = /^(hi|hello|hey|hai|hlo|வணக்கம்|vanakkam|good morning|good evening|good afternoon|praise the lord|praised be jesus|இயேசுவுக்கே புகழ்|கிறிஸ்துவுக்கே புகழ்|பிரைஸ் தி லார்ட்|ave maria|halleluiah|அல்லேலூயா)$/i.test(normalizedText);
  if (isMenuTrigger || isGreeting) return 'MAIN_MENU';

  if (isVerseNum) return 'BIBLE_VERSE';
  if (isMassTimingsNum) return 'MASS_TIMINGS';
  if (isConfessionNum) return 'CONFESSION';
  if (isReadingsNum) return 'MASS_READINGS';
  if (isSaintNum) return 'SAINT';
  if (isPrayersNum) return 'PRAYERS';
  if (isEventsNum) return 'EVENTS';
  if (isAnnouncementsNum) return 'ANNOUNCEMENTS';
  if (isChurchInfoNum) return 'CHURCH_INFO';
  if (isHelpNum) return 'HELP';
  if (isLocationNum) return 'LOCATION';
  if (isMinistriesNum) return 'MINISTRIES';
  if (isPriestsNum) return 'PRIESTS';
  if (isHistoryNum) return 'HISTORY';
  if (isContactNum) return 'CONTACT';
  if (isIntentionsCertNum) return 'INTENTIONS_CERTS';

  return 'UNKNOWN/RAG';
}

let pass = 0, fail = 0;

function check(label, input, context, expected) {
  const got = simulateRouting(input, context);
  const ok = got === expected;
  if (ok) {
    console.log(`  PASS  ${label}: "${input}" (ctx=${context||'none'}) => ${got}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: "${input}" (ctx=${context||'none'}) => GOT: ${got}, EXPECTED: ${expected}`);
    fail++;
  }
}

console.log('\n=== 1. MAIN MENU & GREETING COMMANDS ===');
check('User sends Menu', 'Menu', null, 'MAIN_MENU');
check('User sends menu lowercase', 'menu', 'MENU', 'MAIN_MENU');
check('User sends Hi', 'Hi', 'MENU', 'MAIN_MENU');
check('User sends hi', 'hi', null, 'MAIN_MENU');
check('User sends hello', 'hello', null, 'MAIN_MENU');
check('User sends வணக்கம்', 'வணக்கம்', null, 'MAIN_MENU');

console.log('\n=== 2. MAIN MENU NUMERIC SELECTIONS (1 to 8) ===');
check('Option 1 = Daily Bible', '1', 'MENU', 'BIBLE_VERSE');
check('Option 2 = Mass Timings', '2', 'MENU', 'MASS_TIMINGS');
check('Option 3 = Services & Help Desk', '3', 'MENU', 'SERVICES_MENU');
check('Option 4 = Events', '4', 'MENU', 'EVENTS');
check('Option 5 = Announcements', '5', 'MENU', 'ANNOUNCEMENTS');
check('Option 6 = Church Information', '6', 'MENU', 'CHURCH_INFO');
check('Option 7 = Saint of the Day', '7', 'MENU', 'SAINT');
check('Option 8 = Help', '8', 'MENU', 'HELP');
check('Option 9 = Location', '9', 'MENU', 'LOCATION');
check('Option 10 = Ministries', '10', 'MENU', 'MINISTRIES');
check('Option 11 = Priests', '11', 'MENU', 'PRIESTS');
check('Option 12 = History', '12', 'MENU', 'HISTORY');
check('Option 13 = Contact', '13', 'MENU', 'CONTACT');
check('Option 14 = Intentions/Certs', '14', 'MENU', 'INTENTIONS_CERTS');

console.log('\n=== 3. SERVICES MENU KEYWORD & NUMERIC SELECTIONS (1 to 14) ===');
check('Services keyword', 'Services', 'MENU', 'SERVICES_MENU');
check('Services lowercase', 'services', null, 'SERVICES_MENU');
check('Services Option 1 = Mass Timings', '1', 'SERVICES_MENU', 'MASS_TIMINGS');
check('Services Option 2 = Confession', '2', 'SERVICES_MENU', 'CONFESSION');
check('Services Option 3 = Bible Verse', '3', 'SERVICES_MENU', 'BIBLE_VERSE');
check('Services Option 4 = Daily Readings', '4', 'SERVICES_MENU', 'MASS_READINGS');
check('Services Option 5 = Saint of the Day', '5', 'SERVICES_MENU', 'SAINT');
check('Services Option 6 = Prayers & Rosary', '6', 'SERVICES_MENU', 'PRAYERS');
check('Services Option 7 = Church Events', '7', 'SERVICES_MENU', 'EVENTS');
check('Services Option 8 = Announcements', '8', 'SERVICES_MENU', 'ANNOUNCEMENTS');
check('Services Option 9 = Location', '9', 'SERVICES_MENU', 'LOCATION');
check('Services Option 10 = Ministries', '10', 'SERVICES_MENU', 'MINISTRIES');
check('Services Option 11 = Priests', '11', 'SERVICES_MENU', 'PRIESTS');
check('Services Option 12 = History', '12', 'SERVICES_MENU', 'HISTORY');
check('Services Option 13 = Contact', '13', 'SERVICES_MENU', 'CONTACT');
check('Services Option 14 = Intentions/Certs', '14', 'SERVICES_MENU', 'INTENTIONS_CERTS');

console.log(`\nResults: ${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
