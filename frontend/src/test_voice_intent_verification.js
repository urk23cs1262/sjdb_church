import {
  resolveIntent,
  resolveControl,
  matchesRoute,
  isAffirmative,
  isNegative,
  INTENT_MAP,
  CONTROL_MAP,
} from './services/voice_intent_map.js';

console.log('--- COMPREHENSIVE VOICE NAVIGATION INTENT & CONTROL TESTS ---');

const testCases = [
  // Mass timings
  { query: 'mass timings', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },
  { query: 'show mass timings', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },
  { query: 'open mass timings', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },
  { query: 'take me to mass timings', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },
  { query: 'what time is mass', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },
  { query: 'when is holy mass', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },
  { query: 'hey connect mass schedule', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },
  { query: 'திருப்பலி நேரம்', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },
  { query: 'பூசை நேரம்', expectedRoute: '/mass-timings', expectedLabel: 'Mass Timings' },

  // Events
  { query: 'events', expectedRoute: '/events', expectedLabel: 'Events' },
  { query: 'go to church events', expectedRoute: '/events', expectedLabel: 'Events' },
  { query: 'upcoming programs', expectedRoute: '/events', expectedLabel: 'Events' },
  { query: 'feasts and festivals', expectedRoute: '/events', expectedLabel: 'Events' },
  { query: 'நிகழ்வுகள்', expectedRoute: '/events', expectedLabel: 'Events' },
  { query: 'திருவிழா', expectedRoute: '/events', expectedLabel: 'Events' },

  // Daily Readings
  { query: 'daily readings', expectedRoute: '/daily-mass-readings', expectedLabel: 'Daily Readings' },
  { query: 'today gospel', expectedRoute: '/daily-mass-readings', expectedLabel: 'Daily Readings' },
  { query: 'show me daily mass readings', expectedRoute: '/daily-mass-readings', expectedLabel: 'Daily Readings' },
  { query: 'word of god', expectedRoute: '/daily-mass-readings', expectedLabel: 'Daily Readings' },
  { query: 'bible verses', expectedRoute: '/daily-mass-readings', expectedLabel: 'Daily Readings' },
  { query: 'தினசரி திருப்பலி வாசகங்கள்', expectedRoute: '/daily-mass-readings', expectedLabel: 'Daily Readings' },

  // Announcements
  { query: 'announcements', expectedRoute: '/announcements', expectedLabel: 'Announcements' },
  { query: 'church notices', expectedRoute: '/announcements', expectedLabel: 'Announcements' },
  { query: 'open announcements', expectedRoute: '/announcements', expectedLabel: 'Announcements' },
  { query: 'அறிவிப்புகள்', expectedRoute: '/announcements', expectedLabel: 'Announcements' },

  // Prayer requests
  { query: 'prayer requests', expectedRoute: '/prayer-requests', expectedLabel: 'Prayer Requests' },
  { query: 'submit prayer', expectedRoute: '/prayer-requests', expectedLabel: 'Prayer Requests' },
  { query: 'need prayer', expectedRoute: '/prayer-requests', expectedLabel: 'Prayer Requests' },
  { query: 'ஜெப வேண்டுதல்', expectedRoute: '/prayer-requests', expectedLabel: 'Prayer Requests' },

  // About us
  { query: 'about', expectedRoute: '/about', expectedLabel: 'About Us' },
  { query: 'about us', expectedRoute: '/about', expectedLabel: 'About Us' },
  { query: 'church history', expectedRoute: '/about', expectedLabel: 'About Us' },
  { query: 'st john de britto', expectedRoute: '/about', expectedLabel: 'About Us' },
  { query: 'திருச்சபை பற்றி', expectedRoute: '/about', expectedLabel: 'About Us' },
  { query: 'அருளானந்தர்', expectedRoute: '/about', expectedLabel: 'About Us' },

  // Contact
  { query: 'contact', expectedRoute: '/contact', expectedLabel: 'Contact' },
  { query: 'church address and location', expectedRoute: '/contact', expectedLabel: 'Contact' },
  { query: 'phone number', expectedRoute: '/contact', expectedLabel: 'Contact' },
  { query: 'தொடர்பு கொள்ளுங்கள்', expectedRoute: '/contact', expectedLabel: 'Contact' },

  // Donate
  { query: 'donate', expectedRoute: '/donate', expectedLabel: 'Donate' },
  { query: 'online donation', expectedRoute: '/donate', expectedLabel: 'Donate' },
  { query: 'give money to church', expectedRoute: '/donate', expectedLabel: 'Donate' },
  { query: 'make a donation', expectedRoute: '/donate', expectedLabel: 'Donate' },
  { query: 'நன்கொடை', expectedRoute: '/donate', expectedLabel: 'Donate' },

  // Rosary
  { query: 'rosary', expectedRoute: '/rosary', expectedLabel: 'Rosary' },
  { query: 'holy rosary', expectedRoute: '/rosary', expectedLabel: 'Rosary' },
  { query: 'ஜெபமாலை', expectedRoute: '/rosary', expectedLabel: 'Rosary' },

  // Gallery
  { query: 'gallery', expectedRoute: '/gallery', expectedLabel: 'Gallery' },
  { query: 'photos', expectedRoute: '/gallery', expectedLabel: 'Gallery' },
  { query: 'church pictures', expectedRoute: '/gallery', expectedLabel: 'Gallery' },
  { query: 'காட்சியகம்', expectedRoute: '/gallery', expectedLabel: 'Gallery' },

  // Live Stream
  { query: 'live stream', expectedRoute: '/live', expectedLabel: 'Live Stream' },
  { query: 'watch online mass', expectedRoute: '/live', expectedLabel: 'Live Stream' },
  { query: 'நேரடி ஒளிபரப்பு', expectedRoute: '/live', expectedLabel: 'Live Stream' },

  // Calendar
  { query: 'calendar', expectedRoute: '/calendar', expectedLabel: 'Calendar' },
  { query: 'liturgical calendar', expectedRoute: '/calendar', expectedLabel: 'Calendar' },
  { query: 'நாட்காட்டி', expectedRoute: '/calendar', expectedLabel: 'Calendar' },

  // Priests
  { query: 'priests', expectedRoute: '/priests', expectedLabel: 'Priests' },
  { query: 'our fathers', expectedRoute: '/priests', expectedLabel: 'Priests' },
  { query: 'குருக்கள்', expectedRoute: '/priests', expectedLabel: 'Priests' },

  // Parish council
  { query: 'parish council', expectedRoute: '/parish-council', expectedLabel: 'Parish Council' },
  { query: 'council members', expectedRoute: '/parish-council', expectedLabel: 'Parish Council' },
  { query: 'பரிசத்து சபை', expectedRoute: '/parish-council', expectedLabel: 'Parish Council' },

  // Nearby parishes
  { query: 'nearby shrines', expectedRoute: '/nearby-parishes', expectedLabel: 'Nearby Parishes' },
  { query: 'other churches', expectedRoute: '/nearby-parishes', expectedLabel: 'Nearby Parishes' },
  { query: 'அருகிலுள்ள கோவில்கள்', expectedRoute: '/nearby-parishes', expectedLabel: 'Nearby Parishes' },

  // Team
  { query: 'ministry team', expectedRoute: '/team', expectedLabel: 'Team' },
  { query: 'volunteers and staff', expectedRoute: '/team', expectedLabel: 'Team' },
  { query: 'எங்கள் குழு', expectedRoute: '/team', expectedLabel: 'Team' },

  // Anbiyams
  { query: 'anbiyams', expectedRoute: '/anbiyams', expectedLabel: 'Anbiyams' },
  { query: 'அன்பியங்கள்', expectedRoute: '/anbiyams', expectedLabel: 'Anbiyams' },

  // Documents
  { query: 'documents and certificates', expectedRoute: '/documents', expectedLabel: 'Documents' },
  { query: 'baptism certificate', expectedRoute: '/documents', expectedLabel: 'Documents' },
  { query: 'ஆவணங்கள்', expectedRoute: '/documents', expectedLabel: 'Documents' },

  // FAQ
  { query: 'faq', expectedRoute: '/faq', expectedLabel: 'FAQ' },
  { query: 'frequently asked questions', expectedRoute: '/faq', expectedLabel: 'FAQ' },
  { query: 'கேள்வி பதில்', expectedRoute: '/faq', expectedLabel: 'FAQ' },

  // Saint of the Day
  { query: 'saint of the day', expectedRoute: '/saint-of-the-day', expectedLabel: 'Saint of the Day' },
  { query: 'today saint', expectedRoute: '/saint-of-the-day', expectedLabel: 'Saint of the Day' },
  { query: 'இன்றைய புனிதர்', expectedRoute: '/saint-of-the-day', expectedLabel: 'Saint of the Day' },

  // Dashboard & Auth
  { query: 'my profile', expectedRoute: '/dashboard/profile', expectedLabel: 'Profile' },
  { query: 'dashboard', expectedRoute: '/dashboard', expectedLabel: 'Dashboard' },
  { query: 'mass bookings', expectedRoute: '/dashboard/booking', expectedLabel: 'Bookings' },
  { query: 'support tickets', expectedRoute: '/dashboard/tickets', expectedLabel: 'Support Tickets' },
  { query: 'notifications', expectedRoute: '/dashboard/notifications', expectedLabel: 'Notifications' },
  { query: 'account settings', expectedRoute: '/dashboard/settings', expectedLabel: 'Settings' },
  { query: 'login', expectedRoute: '/login', expectedLabel: 'Login' },
  { query: 'sign up', expectedRoute: '/register', expectedLabel: 'Register' },
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const intent = resolveIntent(tc.query);
  if (!intent) {
    console.error(`FAIL: "${tc.query}" resolved to null (expected ${tc.expectedRoute})`);
    failed++;
  } else if (intent.route !== tc.expectedRoute) {
    console.error(`FAIL: "${tc.query}" resolved to ${intent.route} (expected ${tc.expectedRoute})`);
    failed++;
  } else if (intent.labelEn !== tc.expectedLabel) {
    console.error(`FAIL: "${tc.query}" resolved label "${intent.labelEn}" (expected "${tc.expectedLabel}")`);
    failed++;
  } else {
    passed++;
  }
}

// Control tests
const controlTests = [
  { query: 'go home', expectedAction: 'home', expectedLabel: 'Going to Home.' },
  { query: 'home page', expectedAction: 'home', expectedLabel: 'Going to Home.' },
  { query: 'go to home', expectedAction: 'home', expectedLabel: 'Going to Home.' },
  { query: 'go back', expectedAction: 'back', expectedLabel: 'Going back.' },
  { query: 'scroll down', expectedAction: 'scroll-down', expectedLabel: 'Scrolling down.' },
  { query: 'scroll up', expectedAction: 'scroll-up', expectedLabel: 'Scrolling up.' },
  { query: 'close assistant', expectedAction: 'close' },
  { query: 'முகப்பு', expectedAction: 'home' },
  { query: 'கீழே உருட்டு', expectedAction: 'scroll-down' },
  { query: 'மேலே உருட்டு', expectedAction: 'scroll-up' },
  { query: 'மூடு', expectedAction: 'close' },
];

for (const ct of controlTests) {
  const ctrl = resolveControl(ct.query);
  if (!ctrl) {
    console.error(`FAIL CTRL: "${ct.query}" resolved to null`);
    failed++;
  } else if (ctrl.action !== ct.expectedAction) {
    console.error(`FAIL CTRL: "${ct.query}" action ${ctrl.action} != ${ct.expectedAction}`);
    failed++;
  } else {
    passed++;
  }
}

// Ambiguity checks
const ambiguousCases = ['show me that', 'open this page', 'go there'];
for (const ac of ambiguousCases) {
  const intent = resolveIntent(ac);
  if (!intent || !intent.needsClarification) {
    console.error(`FAIL AMBIGUOUS: "${ac}" was not flagged as ambiguous`);
    failed++;
  } else {
    passed++;
  }
}

// Affirmative & Negative checks
if (isAffirmative('yes') && isAffirmative('sure') && isAffirmative('ஆம்') && isAffirmative('சரி')) {
  passed += 4;
} else {
  console.error('FAIL Affirmative checks');
  failed++;
}

if (isNegative('no') && isNegative('cancel') && isNegative('இல்லை') && isNegative('வேண்டாம்')) {
  passed += 4;
} else {
  console.error('FAIL Negative checks');
  failed++;
}

// Route matching checks
if (
  matchesRoute('/mass-timings', '/mass-timings') &&
  matchesRoute('/events', '/events') &&
  matchesRoute('/events?date=2026-09-10', '/events') &&
  matchesRoute('/dashboard/booking', '/dashboard/booking') &&
  !matchesRoute('/events-old', '/events')
) {
  passed += 5;
} else {
  console.error('FAIL matchesRoute checks');
  failed++;
}

console.log(`\nFINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
if (failed > 0) process.exit(1);
