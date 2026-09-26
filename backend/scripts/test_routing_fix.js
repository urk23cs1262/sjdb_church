/**
 * Routing test for the corrected menu logic.
 * Run: node scripts/test_routing_fix.js
 * 
 * Design principle:
 * - Main Menu options 1-8 ALWAYS win over Services Menu options
 * - Services Menu options 9-14 only apply when in Services context
 * - "services" keyword always opens Services Menu
 * - "7" always = Saint of the Day (never Events)
/**
 * Routing test for the corrected menu logic.
 * Run: node scripts/test_routing_fix.js
 * 
 * Design principle:
 * - When in Services Menu: numbers 1-14 map to the 14 Parish Help Desk services
 * - When in Main Menu / General context: numbers 1-8 map to Main Menu, 9-14 map to Services
 * - "services" keyword always opens Services Menu
 * - "menu" keyword always opens Main Menu
 */
const { extractMenuNumber } = require('../src/bot/botHandler');

function simulateRouting(rawText, lastBotReplyType) {
  const normalizedText = rawText.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const menuNum = extractMenuNumber(rawText);
  const isInServicesMenu = lastBotReplyType === 'SERVICES_MENU';

  // Services keyword trigger
  const isServicesKeyword = /^(services|service|help desk)$/i.test(normalizedText);
  const isServicesTrigger = isServicesKeyword || (!isInServicesMenu && menuNum === 3);
  if (isServicesTrigger) return 'SERVICES_MENU';

  // Numeric routing flags matching botHandler.js
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

  if (isVerseNum) return 'BIBLE_VERSE';
  if (isReadingsNum) return 'MASS_READINGS';
  if (isSaintNum) return 'SAINT';
  if (isPrayersNum) return 'PRAYERS';
  if (isMassTimingsNum) return 'MASS_TIMINGS';
  if (isConfessionNum) return 'CONFESSION';
  if (isEventsNum) return 'EVENTS';
  if (isAnnouncementsNum) return 'ANNOUNCEMENTS';
  if (isChurchInfoNum) return 'CHURCH_INFO';
  if (isLocationNum) return 'LOCATION';
  if (isMinistriesNum) return 'MINISTRIES';
  if (isPriestsNum) return 'PRIESTS';
  if (isHistoryNum) return 'HISTORY';
  if (isContactNum) return 'CONTACT';
  if (isIntentionsCertNum) return 'INTENTIONS_CERTS';
  if (isHelpNum) return 'HELP';

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

console.log('\n=== MAIN MENU routing (no Services context) ===');
check('Option 1 = Daily Bible', '1', null, 'BIBLE_VERSE');
check('Option 2 = Mass Timings', '2', null, 'MASS_TIMINGS');
check('Option 3 = Services Menu', '3', null, 'SERVICES_MENU');
check('Option 4 = Events', '4', null, 'EVENTS');
check('Option 5 = Announcements', '5', null, 'ANNOUNCEMENTS');
check('Option 6 = Church Info', '6', null, 'CHURCH_INFO');
check('Option 7 = Saint of the Day', '7', null, 'SAINT');
check('Option 8 = Help', '8', null, 'HELP');
check('Option 9 = Location', '9', null, 'LOCATION');
check('Option 10 = Ministries', '10', null, 'MINISTRIES');
check('Option 11 = Priests', '11', null, 'PRIESTS');
check('Option 12 = History', '12', null, 'HISTORY');
check('Option 13 = Contact', '13', null, 'CONTACT');
check('Option 14 = Intentions/Certs', '14', null, 'INTENTIONS_CERTS');

console.log('\n=== SERVICES MENU context (1 to 14) ===');
check('Services Option 1 = Mass Timings', '1', 'SERVICES_MENU', 'MASS_TIMINGS');
check('Services Option 2 = Confession', '2', 'SERVICES_MENU', 'CONFESSION');
check('Services Option 3 = Daily Bible Verse', '3', 'SERVICES_MENU', 'BIBLE_VERSE');
check('Services Option 4 = Daily Mass Readings', '4', 'SERVICES_MENU', 'MASS_READINGS');
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

console.log('\n=== SERVICES keyword always triggers Services menu ===');
check('Keyword "services"', 'services', null, 'SERVICES_MENU');
check('Keyword "services" inside Services context', 'services', 'SERVICES_MENU', 'SERVICES_MENU');
check('Keyword "Services" (capitalized)', 'Services', null, 'SERVICES_MENU');

console.log('\n=== extractMenuNumber check ===');
console.log('  extractMenuNumber("7")   =', extractMenuNumber('7'));
console.log('  extractMenuNumber("1")   =', extractMenuNumber('1'));
console.log('  extractMenuNumber("3")   =', extractMenuNumber('3'));
console.log('  extractMenuNumber("7️⃣")  =', extractMenuNumber('7️⃣'));
console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
