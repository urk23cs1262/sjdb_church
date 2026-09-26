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
  const isServicesTrigger = isServicesKeyword;
  if (isServicesTrigger) return 'SERVICES_MENU';

  // Universal 1-14 Parish Services routing flags
  const isMassTimingsNum    = (menuNum === 1);
  const isConfessionNum     = (menuNum === 2);
  const isVerseNum          = (menuNum === 3);
  const isReadingsNum       = (menuNum === 4);
  const isSaintNum          = (menuNum === 5);
  const isPrayersNum        = (menuNum === 6);
  const isEventsNum         = (menuNum === 7);
  const isAnnouncementsNum  = (menuNum === 8);
  const isLocationNum       = (menuNum === 9);
  const isMinistriesNum     = (menuNum === 10);
  const isPriestsNum        = (menuNum === 11);
  const isHistoryNum        = (menuNum === 12);
  const isContactNum        = (menuNum === 13);
  const isIntentionsCertNum = (menuNum === 14);

  if (isMassTimingsNum) return 'MASS_TIMINGS';
  if (isConfessionNum) return 'CONFESSION';
  if (isVerseNum) return 'BIBLE_VERSE';
  if (isReadingsNum) return 'MASS_READINGS';
  if (isSaintNum) return 'SAINT';
  if (isPrayersNum) return 'PRAYERS';
  if (isEventsNum) return 'EVENTS';
  if (isAnnouncementsNum) return 'ANNOUNCEMENTS';
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

console.log('\n=== UNIVERSAL 1-14 PARISH SERVICES ROUTING ===');
check('Option 1 = Mass Timings', '1', null, 'MASS_TIMINGS');
check('Option 2 = Confession', '2', null, 'CONFESSION');
check('Option 3 = Daily Bible Verse', '3', null, 'BIBLE_VERSE');
check('Option 4 = Daily Mass Readings', '4', null, 'MASS_READINGS');
check('Option 5 = Saint of the Day', '5', null, 'SAINT');
check('Option 6 = Prayers & Rosary', '6', null, 'PRAYERS');
check('Option 7 = Events', '7', null, 'EVENTS');
check('Option 8 = Announcements', '8', null, 'ANNOUNCEMENTS');
check('Option 9 = Location', '9', null, 'LOCATION');
check('Option 10 = Ministries', '10', null, 'MINISTRIES');
check('Option 11 = Priests', '11', null, 'PRIESTS');
check('Option 12 = History', '12', null, 'HISTORY');
check('Option 13 = Contact', '13', null, 'CONTACT');
check('Option 14 = Intentions/Certs', '14', null, 'INTENTIONS_CERTS');

console.log('\n=== CONTEXT INDEPENDENCE (Inside any context or after viewing a service) ===');
check('Option 1 = Mass Timings (after seeing verse)', '1', 'VERSE', 'MASS_TIMINGS');
check('Option 2 = Confession (after seeing mass timings)', '2', 'MASS_TIMINGS', 'CONFESSION');
check('Option 3 = Bible Verse (after seeing confession)', '3', 'CONFESSION', 'BIBLE_VERSE');
check('Option 4 = Daily Readings (after seeing events)', '4', 'EVENTS', 'MASS_READINGS');
check('Option 5 = Saint of Day (after seeing announcements)', '5', 'ANNOUNCEMENTS', 'SAINT');
check('Option 6 = Catholic Prayers (after seeing saint)', '6', 'SAINT', 'PRAYERS');
check('Option 7 = Events (after seeing prayers)', '7', 'PRAYERS', 'EVENTS');
check('Option 8 = Announcements (after seeing events)', '8', 'EVENTS', 'ANNOUNCEMENTS');

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
