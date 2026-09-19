/**
 * voice_intent_map.js — Universal Natural Language Intent, Action & Route Resolver
 *
 * Covers:
 * - Every single navigable page in the St. John De Britto Church website
 * - Dashboard action cards ("Book a Mass", "Request Document", "Raise a Ticket", "Prayer Request")
 * - User sections ("My Mass Bookings", "My Documents", "My Donations", "Notifications", "Settings", "Profile")
 * - Public pages & "More Info" sub-pages (Events, Announcements, Bible Verse, Mass Readings, Saint of the Day, Devotional Songs, etc.)
 * - Safe Button & Form Actions (Submit, Get File / Download, New Request, New Booking)
 * - Ambiguity handling & clarification ("Open documents" -> Request vs My Documents)
 * - Page-specific controls (back, forward, refresh, scroll up/down/top/bottom, close modal)
 * - English & Tamil normalized speech mapping
 */

export const INTENT_IDS = {
  // ── Public Pages ──
  HOME: 'HOME',
  ABOUT_CHURCH: 'ABOUT_CHURCH',
  CONTACT: 'CONTACT',
  EVENTS: 'EVENTS',
  DEVOTIONAL_SONGS: 'DEVOTIONAL_SONGS',
  BIBLE_VERSE: 'BIBLE_VERSE',
  SAINT_OF_THE_DAY: 'SAINT_OF_THE_DAY',
  DAILY_READINGS: 'DAILY_READINGS',
  MASS_TIMINGS: 'MASS_TIMINGS',
  ANNOUNCEMENTS: 'ANNOUNCEMENTS',
  GALLERY: 'GALLERY',
  DONATE: 'DONATE',
  PRAYER_REQUESTS: 'PRAYER_REQUESTS',
  ROSARY: 'ROSARY',
  LIVE_STREAM: 'LIVE_STREAM',
  CALENDAR: 'CALENDAR',
  PRIESTS: 'PRIESTS',
  PARISH_COUNCIL: 'PARISH_COUNCIL',
  NEARBY_PARISHES: 'NEARBY_PARISHES',
  TEAM: 'TEAM',
  ANBIYAMS: 'ANBIYAMS',
  PUBLIC_DOCUMENTS: 'PUBLIC_DOCUMENTS',
  FAQ: 'FAQ',
  LOGIN: 'LOGIN',
  REGISTER: 'REGISTER',

  // ── Dashboard & User Pages ──
  DASHBOARD: 'DASHBOARD',
  BOOK_MASS: 'BOOK_MASS',
  MASS_BOOKINGS: 'MASS_BOOKINGS',
  REQUEST_DOCUMENT: 'REQUEST_DOCUMENT',
  MY_DOCUMENTS: 'MY_DOCUMENTS',
  RAISE_TICKET: 'RAISE_TICKET',
  MY_TICKETS: 'MY_TICKETS',
  MY_DONATIONS: 'MY_DONATIONS',
  PROFILE: 'PROFILE',
  SETTINGS: 'SETTINGS',
  NOTIFICATIONS: 'NOTIFICATIONS',
};

// ─── Spoken Language Detection (Sections 31, 35, 39) ──────────────────────────
/**
 * Detects whether spoken text is Tamil, Tanglish (mixed), or English
 * @param {string} text
 * @returns {'ta' | 'en'}
 */
export function detectSpokenLanguage(text) {
  if (!text) return 'en';

  // 1. Check for Tamil script (Unicode range \u0B80 - \u0BFF)
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return 'ta';
  }

  // 2. Check for common Tamil transliteration & Tanglish particles
  const TANGLISH_REGEX = /\b(pannu|pannunga|pannren|kaatu|kaattu|thira|thera|po|ponga|vaa|vanga|sey|seya|seiya|seiyavum|vendum|vendugol|ennoda|ennudaiya|unnoda|unnudaiya|pakkam|pakkathai|kku|ku|la|irukku|iruku|sollu|padu|padi|podu|thiruppali|aavanam|aavanangal|jebam|jeba|nikalvu|nigazhvugal|kadavul|kovil|aalayam|nandri|vanakkam|enakku|ungallukku|naan|neenga|bukking)\b/i;

  if (TANGLISH_REGEX.test(text)) {
    return 'ta';
  }

  return 'en';
}

/**
 * Converts uppercase/acronym names into natural Title Case words
 * so SpeechSynthesis engines read/pronounce the name phonetically
 * instead of spelling it out letter-by-letter.
 * e.g., "NIVESH ARN" -> "Nivesh Arn"
 * @param {string} raw
 * @returns {string}
 */
export function toPronounceableName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length === 1) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Sanitizes text prior to passing to SpeechSynthesisUtterance.
 * Replaces all-caps words (2+ letters) with Title Case so TTS
 * never spells out capitalized names or nouns as initialisms.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeForSpeechSynthesis(text) {
  if (!text) return '';
  return text.replace(/\b[A-Z]{2,}\b/g, (match) => {
    if (['FAQ', 'PDF', 'AM', 'PM', 'SMS', 'OTP'].includes(match)) {
      return match;
    }
    return match.charAt(0) + match.slice(1).toLowerCase();
  });
}

// ─── Master Route & Intent Map ────────────────────────────────────────────────

export const INTENT_MAP = [
  // 1. Dashboard Section: My Mass Bookings / View All Bookings (placed before Book a Mass for specific view phrases)
  {
    id: INTENT_IDS.MASS_BOOKINGS,
    route: '/dashboard/bookings',
    requiresAuth: true,
    labelEn: 'My Mass Bookings',
    labelTa: 'என் திருப்பலி முன்பதிவுகள்',
    confirmEn: 'Opening your Mass Bookings.',
    confirmTa: 'உங்கள் திருப்பலி முன்பதிவுகள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*my.*mass.*bookings?|show.*my.*mass.*bookings?|my.*mass.*bookings?|show.*all.*bookings?|view.*all.*bookings?|open.*my.*bookings?|show.*my.*bookings?|my.*bookings?|all.*bookings?)\b/i,
      /\b(ennoda\s*bookings\s*kaatu|my\s*bookings\s*kaatu|my\s*bookings\s*show\s*pannu)\b/i,
      /(என்னுடைய.*திருப்பலி.*முன்பதிவுகளை.*காட்டு|என்னுடைய.*புக்கிங்களை.*காட்டு|என்னுடைய.*முன்பதிவுகளை.*காட்டு|என்.*முன்பதிவுகள்|அனைத்து.*முன்பதிவுகள்|முன்பதிவுகளை.*காட்டு)/i,
      /(என்னோட\s*bookings\s*காட்டு|என்\s*bookings\s*காட்டு)/i,
    ],
  },

  // 2. Dashboard Action: Book a Mass (New Booking Form)
  {
    id: INTENT_IDS.BOOK_MASS,
    route: '/dashboard/booking',
    requiresAuth: true,
    labelEn: 'Book a Mass',
    labelTa: 'திருப்பலி முன்பதிவு',
    confirmEn: 'Opening Book a Mass.',
    confirmTa: 'திருப்பலி முன்பதிவு பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(book.*a.*mass|book.*mass|i.*want.*to.*book.*a.*mass|can.*i.*book.*a.*mass|take.*me.*to.*mass.*booking|open.*mass.*booking|show.*me.*the.*mass.*booking.*page|mass.*booking.*page|mass.*booking|new.*mass.*booking|new.*booking|make.*a.*booking)\b/i,
      /\b(mass\s*booking\s*(page\s*)?(open\s*pannu|pannu|open|seiya\s*vendum)|mass\s*booking\s*page\s*ku\s*po)\b/i,
      /(திருப்பலி.*முன்பதிவு.*பக்கத்தை.*திற|திருப்பலி.*புக்.*செய்ய.*வேண்டும்|திருப்பலி.*முன்பதிவு.*செய்|முன்பதிவு.*செய்|திருப்பலி.*பதிவு|திருப்பலி.*முன்பதிவு(?!.*காட்டு))/i,
      /(mass\s*booking\s*(page\s*)?open\s*பண்ணு|mass\s*booking\s*open\s*பண்ணு|mass\s*booking\s*பண்ணு)/i,
    ],
  },

  // 3. Dashboard Action: Request Document (Document Request Form)
  {
    id: INTENT_IDS.REQUEST_DOCUMENT,
    route: '/dashboard/documents',
    requiresAuth: true,
    isFormToggle: true,
    labelEn: 'Request Document',
    labelTa: 'ஆவணக் கோரிக்கை',
    confirmEn: 'Opening Request Document.',
    confirmTa: 'ஆவணக் கோரிக்கை பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(request.*a.*document|request.*document|i.*need.*a.*document|open.*document.*request|take.*me.*to.*request.*document|new.*document.*request|ask.*for.*a.*document|apply.*for.*document)\b/i,
      /\b(document\s*request\s*(open\s*pannu|pannu|page\s*ku\s*po))\b/i,
      /(ஆவணம்.*கோரிக்கை.*பக்கத்தை.*திற|ஆவணம்.*கேட்க.*வேண்டும்|ஆவணம்.*கோரும்.*பக்கத்தை.*திற|ஆவணம்.*கோரிக்கை|ஆவணம்.*கோரு|புதிய.*ஆவணக்.*கோரிக்கை|ஆவண.*விண்ணப்பம்)/i,
      /(document\s*request\s*open\s*பண்ணு|document\s*request\s*பண்ணு)/i,
    ],
  },

  // 4. Dashboard Section: My Documents / Show My Documents
  {
    id: INTENT_IDS.MY_DOCUMENTS,
    route: '/dashboard/documents',
    requiresAuth: true,
    labelEn: 'My Documents',
    labelTa: 'என் ஆவணங்கள்',
    confirmEn: 'Opening your Documents.',
    confirmTa: 'உங்கள் ஆவணங்கள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*my.*documents?|show.*my.*documents?|my.*documents?|show.*documents?|view.*my.*documents?)\b/i,
      /\b(ennoda\s*documents\s*kaatu|my\s*documents\s*kaatu|documents\s*(show\s*pannu|kaatu))\b/i,
      /(என்னுடைய.*ஆவணங்களை.*காட்டு|என்.*ஆவணங்கள்|என்.*சான்றிதழ்கள்)/i,
      /(என்னோட\s*documents\s*காட்டு|என்\s*documents\s*காட்டு)/i,
    ],
  },

  // 5. Dashboard Action: Raise a Ticket / Open Support
  {
    id: INTENT_IDS.RAISE_TICKET,
    route: '/dashboard/tickets',
    requiresAuth: true,
    isFormToggle: true,
    labelEn: 'Raise a Ticket',
    labelTa: 'உதவி கோரிக்கை',
    confirmEn: 'Opening Raise a Ticket.',
    confirmTa: 'உதவி கோரிக்கை பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(raise.*a.*ticket|raise.*ticket|i.*want.*to.*raise.*a.*ticket|create.*a?.*ticket|open.*ticket|new.*ticket|i.*need.*help|open.*support|help.*desk|customer.*support)\b/i,
      /\b(ticket\s*(open\s*pannu|raise\s*pannu|podu))\b/i,
      /(டிக்கெட்.*பதிவு.*செய்|ஒரு.*டிக்கெட்.*உருவாக்க.*வேண்டும்|டிக்கெட்.*பக்கத்தை.*திற|உதவி.*கோரிக்கை|புதிய.*டிக்கெட்|டிக்கெட்.*பதிவு|டிக்கெட்)/i,
      /(ticket\s*open\s*பண்ணு|ticket\s*போடு)/i,
    ],
  },

  // 6. Dashboard Section: Support Tickets
  {
    id: INTENT_IDS.MY_TICKETS,
    route: '/dashboard/tickets',
    requiresAuth: true,
    labelEn: 'Support Tickets',
    labelTa: 'உதவி கோரிக்கைகள்',
    confirmEn: 'Opening Support Tickets.',
    confirmTa: 'உதவி கோரிக்கைகள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*my.*tickets?|show.*my.*tickets?|my.*tickets?|support.*tickets?|all.*tickets?)\b/i,
      /(என்.*டிக்கெட்டுகள்|என்.*உதவி.*கோரிக்கைகள்)/i,
    ],
  },

  // 7. Prayer Request (Dashboard Action + Public Page)
  {
    id: INTENT_IDS.PRAYER_REQUESTS,
    route: '/prayer-requests',
    labelEn: 'Prayer Request',
    labelTa: 'ஜெப வேண்டுதல்',
    confirmEn: 'Opening Prayer Requests.',
    confirmTa: 'ஜெப வேண்டுதல் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(prayer.*requests?|i.*want.*to.*submit.*a.*prayer.*request|i.*want.*to.*request.*a.*prayer|submit.*a.*prayer.*request|submit.*a.*prayer|submit.*prayer|ask.*prayer|need.*prayer|prayers?|prayer.*intention)\b/i,
      /\b(prayer\s*request\s*(open\s*pannu|open\s*pannunga|pannu|page\s*ku\s*po))\b/i,
      /(ஜெப.*வேண்டுகோள்.*பக்கத்தை.*திற|ஜெப.*வேண்டுகோள்.*கொடுக்க.*வேண்டும்|ஜெபம்.*கேட்க.*வேண்டும்|ஜெப.*வேண்டுகோள்|ஜெப.*வேண்டுதல்|பிரார்த்தனை.*விண்ணப்பம்|ஜெபிக்க.*கேளு)/i,
      /(prayer\s*request\s*open\s*பண்ணு|prayer\s*request\s*open\s*பண்ணுங்க)/i,
    ],
  },

  // 8. Dashboard Section: My Donations
  {
    id: INTENT_IDS.MY_DONATIONS,
    route: '/dashboard/donations',
    requiresAuth: true,
    labelEn: 'My Donations',
    labelTa: 'என் நன்கொடைகள்',
    confirmEn: 'Opening your Donations.',
    confirmTa: 'உங்கள் நன்கொடைகள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*my.*donations?|show.*my.*donations?|my.*donations?|donation.*history|view.*all.*donations?)\b/i,
      /(என்.*நன்கொடைகள்|நன்கொடை.*வரலாறு)/i,
    ],
  },

  // 9. Dashboard Header: Notifications
  {
    id: INTENT_IDS.NOTIFICATIONS,
    route: '/dashboard/notifications',
    requiresAuth: true,
    labelEn: 'Notifications',
    labelTa: 'அறிவிப்புகள்',
    confirmEn: 'Opening Notifications.',
    confirmTa: 'அறிவிப்புகள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*notifications?|show.*notifications?|notifications?|my.*alerts?|inbox|unread.*notifications?)\b/i,
      /\b(notifications\s*(open\s*pannu|kaatu|thira))\b/i,
      /(அறிவிப்புகளை.*திற|என்.*அறிவிப்புகள்|உள்.*அறிவிப்புகள்)/i,
      /(notifications\s*open\s*பண்ணு|notifications\s*காட்டு)/i,
    ],
  },

  // 10. Dashboard Header: Settings
  {
    id: INTENT_IDS.SETTINGS,
    route: '/dashboard/settings',
    requiresAuth: true,
    labelEn: 'Settings',
    labelTa: 'அமைப்புகள்',
    confirmEn: 'Opening Settings.',
    confirmTa: 'அமைப்புகள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*settings?|settings?|preferences?|account.*settings?)\b/i,
      /\b(settings\s*(open\s*pannu|thira))\b/i,
      /(அமைப்புகளை.*திற|அமைப்புகள்|விருப்பங்கள்)/i,
      /(settings\s*open\s*பண்ணு)/i,
    ],
  },

  // 11. Dashboard Header: Profile / Complete Profile
  {
    id: INTENT_IDS.PROFILE,
    route: '/dashboard/profile',
    requiresAuth: true,
    labelEn: 'Profile',
    labelTa: 'சுயவிவரம்',
    confirmEn: 'Opening your Profile.',
    confirmTa: 'உங்கள் சுயவிவர பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*my.*profile|open.*profile|my.*profile|profiles?|open.*my.*account|my.*account|edit.*profile|complete.*profile|profile.*complete)\b/i,
      /\b(profile\s*(open\s*pannu|kaatu)|my\s*profile\s*open\s*pannu|ennoda\s*profile\s*kaatu)\b/i,
      /(எனது.*சுயவிவரத்தை.*திற|சுயவிவரத்தை.*திற|சுயவிவரம்|என்.*சுயவிவரம்|என்.*கணக்கு)/i,
      /(profile\s*open\s*பண்ணு|my\s*profile\s*open\s*பண்ணு|என்னோட\s*profile\s*காட்டு)/i,
    ],
  },

  // 12. Dashboard Main Page
  {
    id: INTENT_IDS.DASHBOARD,
    route: '/dashboard',
    requiresAuth: true,
    labelEn: 'Dashboard',
    labelTa: 'கட்டுப்பாட்டு அறை',
    confirmEn: 'Opening your Dashboard.',
    confirmTa: 'கட்டுப்பாட்டு அறை பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*dashboard|take.*me.*to.*dashboard|dashboards?|user.*dashboard|member.*portal|portal)\b/i,
      /(கட்டுப்பாட்டு அறை|என் பக்கம்)/i,
    ],
  },

  // 13. Public Home
  {
    id: INTENT_IDS.HOME,
    route: '/',
    labelEn: 'Home',
    labelTa: 'முகப்பு',
    confirmEn: 'Opening the Home page.',
    confirmTa: 'முகப்பு பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(go.*home|open.*home|take.*me.*to.*home|take.*me.*home|home.*page|main.*page|home)\b/i,
      /(முகப்பு|ஹோம்|வீட்டு பக்கம்)/i,
    ],
  },

  // 14. Saint of the Day
  {
    id: INTENT_IDS.SAINT_OF_THE_DAY,
    route: '/saint-of-the-day',
    readTarget: 'saint-of-the-day',
    labelEn: 'Saint of the Day',
    labelTa: 'இன்றைய புனிதர்',
    confirmEn: 'Opening the Saint of the Day page.',
    confirmTa: 'இன்றைய புனிதர் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*saint.*of.*the.*day|show.*saint.*of.*the.*day|read.*saint.*of.*the.*day|saint.*of.*the.*day|saint.*today|today'?s?.*saint|saint.*day|day.*saint|patron.*saint|show.*me.*today'?s?.*saint)\b/i,
      /\b(saint\s*of\s*the\s*day\s*(open\s*pannu|kaatu|padi))\b/i,
      /(இன்றைய.*புனிதரை.*பற்றி.*படி|இன்றைய.*புனிதர்.*பக்கத்தை.*திற|இன்றைய.*புனிதரை.*காட்டு|இன்றைய.*புனிதர்|புனிதர்)/i,
      /(saint\s*of\s*the\s*day\s*open\s*பண்ணு)/i,
    ],
  },

  // 15. Daily Bible Verse
  {
    id: INTENT_IDS.BIBLE_VERSE,
    route: '/bible-verse',
    readTarget: 'verse',
    labelEn: "Today's Bible Verse",
    labelTa: 'இன்றைய விவிலிய வசனம்',
    confirmEn: 'Opening today’s Bible verse.',
    confirmTa: 'இன்றைய விவிலிய வசனத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*daily.*bible.*verse|show.*bible.*verse|open.*bible.*verse|show.*today'?s?.*bible.*verse|today'?s?.*bible.*verse|daily.*bible.*verse|read.*bible.*verse|bible.*verse|verses?|word\s*of\s*the\s*day)\b/i,
      /\b(bible\s*verse\s*(open\s*pannu|padi))\b/i,
      /(இன்றைய.*பைபிள்.*வசனத்தை.*படி|இன்றைய.*விவிலிய.*வசனத்தை.*திற|விவிலிய.*வசனம்|இன்றைய.*வசனம்|வேத.*வசனம்|தினசரி.*வசனம்)/i,
      /(bible\s*verse\s*open\s*பண்ணு)/i,
    ],
  },

  // 16. Daily Mass Readings
  {
    id: INTENT_IDS.DAILY_READINGS,
    route: '/daily-mass-readings',
    readTarget: 'readings',
    labelEn: 'Daily Mass Readings',
    labelTa: 'தினசரி திருப்பலி வாசகங்கள்',
    confirmEn: 'Opening the Daily Mass Readings page.',
    confirmTa: 'தினசரி திருப்பலி வாசகங்கள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*daily.*mass.*readings?|show.*daily.*mass.*readings?|read.*daily.*mass.*readings?|daily.*mass.*readings?|mass.*readings?|daily.*readings?|readings?|gospel|scripture|word.*of.*god|first\s*reading|second\s*reading|today.*gospel)\b/i,
      /\b(mass\s*readings\s*(open\s*pannu|padi))\b/i,
      /(இன்றைய.*திருப்பலி.*வாசகங்களை.*படி|தினசரி.*திருப்பலி.*வாசகங்கள்|வாசகங்கள்|நற்செய்தி|வேதாகம.*வாசகம்|சுவிசேஷம்)/i,
      /(mass\s*readings\s*open\s*பண்ணு)/i,
    ],
  },

  // 17. Devotional Songs
  {
    id: INTENT_IDS.DEVOTIONAL_SONGS,
    route: '/rosary',
    labelEn: 'Devotional Songs',
    labelTa: 'பக்திப் பாடல்கள்',
    confirmEn: 'Opening the Devotional Songs section.',
    confirmTa: 'பக்திப் பாடல்கள் பகுதியை திறக்கிறேன்.',
    patterns: [
      /\b(open.*devotional.*songs?|play.*devotional.*songs?|devotional.*songs?|church.*songs?|christian.*songs?|songs?)\b/i,
      /(பக்திப் பாடல்கள்|பாடல்கள்|பாடல்)/i,
    ],
  },

  // 18. Church Events
  {
    id: INTENT_IDS.EVENTS,
    route: '/events',
    readTarget: 'events',
    labelEn: 'Events',
    labelTa: 'ஆலய நிகழ்வுகள்',
    confirmEn: 'Opening Events.',
    confirmTa: 'நிகழ்வுகள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*events?|show.*events?|read.*events?|events?|upcoming.*events?|programmes?|programs?|feasts?|festivals?|celebrations?)\b/i,
      /\b(events\s*(page\s*)?(open\s*pannu|ku\s*po|kaatu))\b/i,
      /(நிகழ்வுகளை.*திற|நிகழ்வுகள்|நிகழ்வு|நிகழ்ச்சி|விழா|திருவிழா|பண்டிகை)/i,
      /(events\s*(page-?க்கு\s*போ|page\s*open\s*பண்ணு|open\s*பண்ணு))/i,
    ],
  },

  // 19. Announcements
  {
    id: INTENT_IDS.ANNOUNCEMENTS,
    route: '/announcements',
    readTarget: 'announcements',
    labelEn: 'Announcements',
    labelTa: 'அறிவிப்புகள்',
    confirmEn: 'Opening the Announcements page.',
    confirmTa: 'அறிவிப்புகள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*announcements?|show.*announcements?|read.*announcements?|announcements?|notices?|circulars?|church news|parish news|bulletins?|updates?)\b/i,
      /(அறிவிப்புகள்|அறிவிப்பு|செய்திகள்)/i,
    ],
  },

  // 20. About Church
  {
    id: INTENT_IDS.ABOUT_CHURCH,
    route: '/about',
    readTarget: 'about',
    labelEn: 'About Church',
    labelTa: 'திருச்சபை பற்றி',
    confirmEn: 'Opening the About Church page.',
    confirmTa: 'திருச்சபை பற்றி பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(go.*to.*about.*church|open.*about.*church|about.*church|about.*us|about|church\s*history|parish\s*history|who\s*are\s*we|st\.?\s*john\s*de\s*britto|arulanandhar)\b/i,
      /(அருளானந்தர்|திருச்சபை பற்றி|ஆலய வரலாறு|கோவில் வரலாறு|எங்கள் ஆலயம்|பங்கு பற்றி)/i,
    ],
  },

  // 21. Contact
  {
    id: INTENT_IDS.CONTACT,
    route: '/contact',
    readTarget: 'contact',
    labelEn: 'Contact',
    labelTa: 'தொடர்பு',
    confirmEn: 'Opening the Contact page.',
    confirmTa: 'தொடர்பு பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*contact|go.*to.*contact|contacts?|contact.*us|reach|phone|address|locations?|directions?|where is church)\b/i,
      /(தொடர்பு|முகவரி|தொலைபேசி|எண்|எங்கு உள்ளது)/i,
    ],
  },

  // 22. Mass Timings
  {
    id: INTENT_IDS.MASS_TIMINGS,
    route: '/mass-timings',
    labelEn: 'Mass Timings',
    labelTa: 'திருப்பலி நேரம்',
    confirmEn: 'Opening the Mass Timings page.',
    confirmTa: 'திருப்பலி நேரம் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*mass.*timings?|show.*mass.*timings?|mass.*tim(ing)?s?|tim(ing)?s?.*mass|when.*mass|mass.*schedule?s?|service.*times?|mass.*times?|holy mass|sunday mass)\b/i,
      /(திருப்பலி.*நேர|திருப்பலி.*எப்ப|பூசை.*நேர|ஆராதனை.*நேர|திருப்பலி)/i,
    ],
  },

  // 23. Photo Gallery
  {
    id: INTENT_IDS.GALLERY,
    route: '/gallery',
    labelEn: 'Gallery',
    labelTa: 'காட்சியகம்',
    confirmEn: 'Opening the Gallery page.',
    confirmTa: 'காட்சியகம் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*gallery|show.*gallery|gallery|photos?|pictures?|images?|albums?)\b/i,
      /(படங்கள்|புகைப்படங்கள்|காட்சியகம்|ஆல்பம்)/i,
    ],
  },

  // 24. Public Donations
  {
    id: INTENT_IDS.DONATE,
    route: '/donate',
    labelEn: 'Donations',
    labelTa: 'நன்கொடை',
    confirmEn: 'Opening the Donations page.',
    confirmTa: 'நன்கொடை பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*donations?|donat(e|ion|ions|ing)?|make.*a.*donation|online.*donation|contribut(e|ion)?|offerings?|tithes?|give\s*money|support\s*church)\b/i,
      /(நன்கொடை|காணிக்கை|கொடை|தானம்|பங்களிப்பு)/i,
    ],
  },

  // 25. Rosary
  {
    id: INTENT_IDS.ROSARY,
    route: '/rosary',
    labelEn: 'Rosary',
    labelTa: 'ஜெபமாலை',
    confirmEn: 'Opening the Rosary page.',
    confirmTa: 'ஜெபமாலை பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*rosary|play.*rosary|rosarys?|hail.*mary|holy.*rosary|mysteries)\b/i,
      /(ஜெபமாலை|மாலிகை|மணி)/i,
    ],
  },

  // 26. Catholic Calendar
  {
    id: INTENT_IDS.CALENDAR,
    route: '/calendar',
    labelEn: 'Catholic Calendar',
    labelTa: 'கத்தோலிக்க நாட்காட்டி',
    confirmEn: 'Opening the Catholic Calendar page.',
    confirmTa: 'கத்தோலிக்க நாட்காட்டி பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*calendar|calendars?|liturgical|feast.*days?|holy.*days?|church calendar)\b/i,
      /(நாட்காட்டி|காலண்டர்)/i,
    ],
  },

  // 27. Priests
  {
    id: INTENT_IDS.PRIESTS,
    route: '/priests',
    labelEn: 'Priests',
    labelTa: 'குருக்கள்',
    confirmEn: 'Opening the Priests page.',
    confirmTa: 'குருக்கள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*priests?|priests?|fathers?|pastors?|clergy|parish.*priests?)\b/i,
      /(குருக்கள்|அருட்தந்தை|பங்குத் தந்தை|பாதர்)/i,
    ],
  },

  // 28. Parish Council
  {
    id: INTENT_IDS.PARISH_COUNCIL,
    route: '/parish-council',
    labelEn: 'Parish Council',
    labelTa: 'பரிசத்து சபை',
    confirmEn: 'Opening the Parish Council page.',
    confirmTa: 'பரிசத்து சபை பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*parish.*council|parish\s*council|council(\s*members?)?|governing(\s*body)?|church\s*committee)\b/i,
      /(பரிசத்து சபை|ஆலயக் குழு|திருச்சபை குழு)/i,
    ],
  },

  // 29. Nearby Parishes
  {
    id: INTENT_IDS.NEARBY_PARISHES,
    route: '/nearby-parishes',
    labelEn: 'Nearby Parishes',
    labelTa: 'அருகிலுள்ள கோவில்கள்',
    confirmEn: 'Opening the Nearby Parishes page.',
    confirmTa: 'அருகிலுள்ள கோவில்கள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*nearby.*parishes?|nearby(\s*parishes|\s*churches|\s*shrines)?|shrines?|other\s*church(es)?)\b/i,
      /(அருகிலுள்ள|அருகில் உள்ள)/i,
    ],
  },

  // 30. Team
  {
    id: INTENT_IDS.TEAM,
    route: '/team',
    labelEn: 'Team',
    labelTa: 'எங்கள் குழு',
    confirmEn: 'Opening the Team page.',
    confirmTa: 'எங்கள் குழு பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*team|team|staff|volunteers?|ministry.*team|our team|choir)\b/i,
      /(குழுவினர்|ஊழியர்கள்|எங்கள் குழு)/i,
    ],
  },

  // 31. Anbiyams
  {
    id: INTENT_IDS.ANBIYAMS,
    route: '/anbiyams',
    labelEn: 'Anbiyams',
    labelTa: 'அன்பியங்கள்',
    confirmEn: 'Opening the Anbiyams page.',
    confirmTa: 'அன்பியங்கள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*anbiyams?|anbiyams?|small.*christian.*community|basic.*community|bcc)\b/i,
      /(அன்பியங்கள்|அன்பியம்)/i,
    ],
  },

  // 32. Public Documents & Forms
  {
    id: INTENT_IDS.PUBLIC_DOCUMENTS,
    route: '/documents',
    labelEn: 'Public Documents',
    labelTa: 'பொது ஆவணங்கள்',
    confirmEn: 'Opening Public Documents.',
    confirmTa: 'பொது ஆவணங்கள் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(public.*documents?|church.*documents?|parish.*documents?|downloadable.*forms?)\b/i,
      /(பொது.*ஆவணங்கள்|ஆலய.*படிவங்கள்)/i,
    ],
  },

  // 33. Live Stream
  {
    id: INTENT_IDS.LIVE_STREAM,
    route: '/live',
    labelEn: 'Live Stream',
    labelTa: 'நேரடி ஒளிபரப்பு',
    confirmEn: 'Opening Live Stream.',
    confirmTa: 'நேரடி ஒளிபரப்பு பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(live.*stream|watch.*online|online.*mass|live.*mass)\b/i,
      /(நேரடி.*ஒளிபரப்பு|நேரடி)/i,
    ],
  },

  // 34. FAQ
  {
    id: INTENT_IDS.FAQ,
    route: '/faq',
    labelEn: 'FAQ',
    labelTa: 'கேள்வி பதில்',
    confirmEn: 'Opening the FAQ page.',
    confirmTa: 'கேள்வி பதில் பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*faq|faq|frequent|questions?|frequently.*asked|help)\b/i,
      /(அடிக்கடி கேட்கப்படும்|கேள்வி)/i,
    ],
  },

  // 35. Login
  {
    id: INTENT_IDS.LOGIN,
    route: '/login',
    labelEn: 'Login',
    labelTa: 'உள்நுழைவு',
    confirmEn: 'Opening the Login page.',
    confirmTa: 'உள்நுழைவு பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*login|sign.*in|log.*in|login)\b/i,
      /(உள்நுழை|உள்நுழைவு)/i,
    ],
  },

  // 36. Register
  {
    id: INTENT_IDS.REGISTER,
    route: '/register',
    labelEn: 'Registration',
    labelTa: 'பதிவு',
    confirmEn: 'Opening the Registration page.',
    confirmTa: 'பதிவு பக்கத்தை திறக்கிறேன்.',
    patterns: [
      /\b(open.*register|sign.*up|register|create.*account|new member)\b/i,
      /(பதிவு செய்|பதிவு)/i,
    ],
  },
];

// ─── Ambiguous Commands (Require Clarification Prompt) ─────────────────────────

export const AMBIGUOUS_INTENTS = [
  {
    id: 'AMBIGUOUS_DOCUMENTS',
    patterns: [
      /^(documents?|ஆவணங்கள்)$/i,
    ],
    clarificationType: 'DOCUMENTS',
    clarifyPromptEn: 'Do you want to request a new document or view your existing documents?',
    clarifyPromptTa: 'புதிய ஆவணத்தை கோர விரும்புகிறீர்களா அல்லது உங்கள் ஆவணங்களை பார்க்க விரும்புகிறீர்களா?',
  },
  {
    id: 'AMBIGUOUS_BOOKINGS',
    patterns: [
      /^(bookings?|புக்கிங்)$/i,
    ],
    clarificationType: 'BOOKINGS',
    clarifyPromptEn: 'Do you want to book a new mass or view your existing bookings?',
    clarifyPromptTa: 'புதிய திருப்பலி பதிவு செய்ய வேண்டுமா அல்லது உங்கள் பதிவுகளை பார்க்க வேண்டுமா?',
  },
];

// ─── Inappropriate & Abusive Speech Filter (English & Tamil) ──────────────────
// Strictly bounded with word boundaries \b to NEVER block legitimate terms
// such as "mass", "assistant", "pass", "glass", "church", "priest", etc.

export const INAPPROPRIATE_PATTERNS = [
  // English Profanities & Abusive Terms (strictly word-boundary bounded)
  /\b(fuck|fucking|fucked|fucker|fuk|fck|motherfucker)\b/i,
  /\b(bitch|bitches|bitching)\b/i,
  /\b(shit|shitty|bullshit)\b/i,
  /\b(ass|asshole|arsehole|dumbass|jackass)\b/i,
  /\b(bastard|bastards)\b/i,
  /\b(dick|dickhead|dicks)\b/i,
  /\b(pussy|pussies)\b/i,
  /\b(cunt|cunts)\b/i,
  /\b(cock|cocksucker)\b/i,
  /\b(slut|sluts|whore|whores)\b/i,
  /\b(porn|porno|pornography|xxx|hentai)\b/i,
  /\b(sex|sexy|sexxx|nude|nudes|naked|boobs|vagina|penis)\b/i,
  /\b(rape|rapist|molest)\b/i,
  /\b(kill\s*yourself|suicide)\b/i,

  // Tamil Abusive, Vulgar & Obscene Terms (transliterated & Tamil script)
  /\b(thevidiya|thevadiya|thevdiya|thevidia|thevidiyaal)\b/i,
  /\b(punda|punde|pundamavan|pundachi|koothi|kuthi)\b/i,
  /\b(ootha|othal|ommala|ommle|otha|okala)\b/i,
  /\b(sunni|soothu|poolu|pool|kunju|lavade|lavada)\b/i,
  /\b(kenapunda|mayiru|baadu|badu|kamina|harami|saavuda|othavane|oothavane)\b/i,
  /(தேவிடியா|புண்ட|புண்டை|சூத்து|சுன்னி|பூலு|மயிரு|ஓத்த|நாயே|கூதி)/i,
];

export function scanInappropriateContent(text) {
  if (!text) return { hasInappropriate: false };
  const lower = text.toLowerCase();
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(lower)) {
      return { hasInappropriate: true };
    }
  }
  return { hasInappropriate: false };
}

// ─── Action Commands (Buttons, Form Submits, Downloads) ────────────────────────

export const ACTION_MAP = [
  // Form Submission
  {
    action: 'submit-form',
    patterns: [
      /\b(submit\s+(this\s+)?(booking|ticket|document(\s+request)?|form)|submit\s+it|submit\s+now|send\s+reply)\b/i,
      /^submit$/i,
      /(படிவத்தை.*சமர்ப்பி|^சமர்ப்பி$)/i,
    ],
  },

  // Document & Receipt Downloads
  {
    action: 'download-document',
    patterns: [
      /\b(download.*my.*baptism.*document|download.*document|get.*file|download.*receipt|download.*certificate|download.*official.*receipt|download.*image)\b/i,
      /(பதிவிறக்கு|ஆவணத்தை.*பதிவிறக்கு|ரசீது.*பதிவிறக்கு)/i,
    ],
  },

  // Toggle New Request / New Booking / New Ticket
  {
    action: 'toggle-new',
    patterns: [
      /\b(new.*request|\+\s*new.*request|new.*ticket|\+\s*new.*ticket)\b/i,
      /(புதிய.*கோரிக்கை|புதிய.*டிக்கெட்)/i,
    ],
  },
];

// ─── Control Commands Map ─────────────────────────────────────────────────────

export const WAKE_WORD_REGEX = /(?:\b(?:hey\s*connect|hey\s*connected|hay\s*connect|ok\s*connect|okay\s*connect|hi\s*connect|hello\s*connect)\b|(?:ஹே\s*கனெக்ட்))/i;

/**
 * Checks if a string contains the Hey Connect wake phrase
 * @param {string} text
 * @returns {boolean}
 */
export function isWakeWord(text) {
  if (!text) return false;
  return WAKE_WORD_REGEX.test(text) || /^(connect|கனெக்ட்)$/i.test(text.trim());
}

/**
 * Extracts wake word detection status and any trailing command spoken in the same breath
 * e.g., "Hey Connect book a mass" -> { hasWakeWord: true, command: "book a mass" }
 * @param {string} transcript
 * @returns {{ hasWakeWord: boolean, command: string }}
 */
export function extractWakeCommand(transcript) {
  if (!transcript) return { hasWakeWord: false, command: '' };
  const match = transcript.match(WAKE_WORD_REGEX);
  if (match) {
    const after = transcript.slice(match.index + match[0].length).replace(/^[,.: -]+/, '').trim();
    return { hasWakeWord: true, command: after };
  }
  if (/^(connect|கனெக்ட்)$/i.test(transcript.trim())) {
    return { hasWakeWord: true, command: '' };
  }
  return { hasWakeWord: false, command: '' };
}

export const CONTROL_MAP = [
  // Stop Speaking (Instant speech cancellation)
  {
    action: 'stop-speaking',
    confirmEn: '',
    confirmTa: '',
    patterns: [
      /\b(stop speaking|stop talk(ing)?|shut up|be quiet|silence)\b/i,
      /(பேசுவதை நிறுத்து|அமைதியாக இரு)/i,
    ],
  },

  // Cancel / Close Voice Navigation (Closes voice navigation immediately)
  {
    action: 'cancel',
    confirmEn: 'Closing.',
    confirmTa: 'மூடுகிறேன்.',
    patterns: [
      /\b(cancel|cancel\s+voice|cancel\s+navigation|cancel\s+please|please\s+cancel|dismiss)\b/i,
      /^cancel$/i,
      /\b(close\s+voice|close\s+assistant|close\s+navigation|stop\s+voice|exit\s+voice)\b/i,
      /(ரத்து|ரத்து\s*செய்|ரத்து\s*பண்ணு|குரலை\s*மூடு)/i,
    ],
  },

  // Close Modal or Fallback Assistant Close
  {
    action: 'close',
    confirmEn: 'Closing.',
    confirmTa: 'மூடுகிறேன்.',
    patterns: [
      /\b(close\s+modal|close\s+dialog|close\s+window|close\s+popup)\b/i,
      /^close$/i,
      /(மூடு)/i,
    ],
  },

  // Stop Voice Assistant
  {
    action: 'stop-listening',
    confirmEn: 'Okay. I’ll stop listening.',
    confirmTa: 'சரி, கேட்பதை நிறுத்துகிறேன்.',
    patterns: [
      /\b(stop listening|stop listen|exit|quit|never mind)\b/i,
      /\b(stop\s*pannu)\b/i,
      /^stop$/i,
      /(கேட்பதை.*நிறுத்து|^நிறுத்து$|வெளியேறு|போதும்)/i,
    ],
  },

  // Go Back
  {
    action: 'back',
    confirmEn: "Okay, I'm going back.",
    confirmTa: 'சரி, முந்தைய பக்கத்திற்கு செல்கிறேன்.',
    patterns: [
      /\b(go back|previous page|go previous|back)\b/i,
      /\b(back\s*(po|ponga))\b/i,
      /(முந்தைய பக்கம்|பின்னால் செல்|பின்னே செல்|பின்னே போ|பின்னாடி போ)/i,
    ],
  },

  // Go Forward
  {
    action: 'forward',
    confirmEn: 'Going forward.',
    confirmTa: 'அடுத்த பக்கத்திற்கு செல்கிறேன்.',
    patterns: [
      /\b(go forward|next page|forward)\b/i,
      /(அடுத்த பக்கம்|முன்னே செல்)/i,
    ],
  },

  // Refresh Page
  {
    action: 'refresh',
    confirmEn: 'Refreshing page.',
    confirmTa: 'பக்கத்தை புதுப்பிக்கிறேன்.',
    patterns: [
      /\b(refresh|reload|refresh page|reload page)\b/i,
      /(புதுப்பி)/i,
    ],
  },

  // Scroll Down
  {
    action: 'scroll-down',
    confirmEn: 'Scrolling down.',
    confirmTa: 'கீழே உருட்டுகிறேன்.',
    patterns: [
      /\b(scroll down|go down|move down|down)\b/i,
      /(கீழே உருட்டு|கீழே செல்|கீழே)/i,
    ],
  },

  // Scroll Up
  {
    action: 'scroll-up',
    confirmEn: 'Scrolling up.',
    confirmTa: 'மேலே உருட்டுகிறேன்.',
    patterns: [
      /\b(scroll up|go up|move up)\b/i,
      /(மேலே உருட்டு|மேலே செல்)/i,
    ],
  },

  // Go to Top
  {
    action: 'scroll-top',
    confirmEn: 'Going to top.',
    confirmTa: 'மேலே செல்கிறேன்.',
    patterns: [
      /\b(go to top|scroll to top|top of page|top)\b/i,
      /(உச்சிக்கு செல்|மேலே)/i,
    ],
  },

  // Go to Bottom
  {
    action: 'scroll-bottom',
    confirmEn: 'Scrolling to bottom.',
    confirmTa: 'கீழே செல்கிறேன்.',
    patterns: [
      /\b(go to bottom|scroll to bottom|bottom of page|bottom)\b/i,
      /(அடிக்கு செல்|கீழே)/i,
    ],
  },
];

// ─── Text Normalizer ──────────────────────────────────────────────────────────

export function normalizeSpeech(text) {
  if (!text) return '';
  let cleaned = text
    .toLowerCase()
    .replace(/[.,?!;:()'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading wake phrases
  cleaned = cleaned.replace(/^(hey connect|hey connected|connect|ஹே கனெக்ட்)\s+/i, '').trim();
  return cleaned;
}

// ─── Read Detection Helper ────────────────────────────────────────────────────

const READ_VERBS = [
  /\b(read|recite|speak|read it|read this|read out|tell me about|explain)\b/i,
  /(படி|வாசி|சொல்|விளக்கு)/i,
];

export function isReadCommand(text) {
  if (!text) return false;
  const clean = normalizeSpeech(text);
  return READ_VERBS.some((v) => v.test(clean));
}

// ─── Master Voice Command Resolver ────────────────────────────────────────────

/**
 * Universal voice command resolver following Section 11 priority:
 * 0. Inappropriate content filtering
 * 0.5. Pending action confirmation replies (Yes / No)
 * 1. Control commands (stop-speaking, close, stop-listening, back, scroll)
 * 2. Conversational assistance & queries (What can you do, What is this page, What can I do here, Form guidance, Focus field, Audio control, Pending query)
 * 3. Form & Button actions (submit-form, download-document, toggle-new)
 * 4. Ambiguity / Clarification checks
 * 5. Specific page navigation & dashboard actions
 * 6. Read content commands
 * 7. Unclear or unsupported speech fallbacks
 *
 * @param {string} rawTranscript
 * @param {object} context
 * @returns {object|null}
 */
export function resolveVoiceCommand(rawTranscript, context = {}) {
  if (!rawTranscript) return null;
  const clean = normalizeSpeech(rawTranscript);
  if (!clean) return null;

  // Detect Spoken Language (English vs Tamil / Tanglish)
  const detectedLang = detectSpokenLanguage(clean);

  // 0. Priority 0: Check Bad / Inappropriate words (Sections 24 & 38)
  const inappCheck = scanInappropriateContent(clean);
  if (inappCheck.hasInappropriate) {
    return {
      type: 'INAPPROPRIATE',
      detectedLang,
      warningEn: 'Please use respectful language. I’m here to help you navigate the church website.',
      warningTa: 'தயவுசெய்து மரியாதையான வார்த்தைகளைப் பயன்படுத்துங்கள். இந்த தேவாலய இணையதளத்தை வழிநடத்த நான் உதவுகிறேன்.',
    };
  }

  // 0.5. Check Confirmation Responses when awaiting confirmation
  if (context?.awaitingConfirmation) {
    if (
      /\b(yes|confirm|proceed|submit it|sure|yeah|yep|do it|go ahead)\b/i.test(clean) ||
      /(ஆமாம்|சரி|உறுதி|செய்|தொடரலாம்)/i.test(clean) ||
      /\b(seri|aam|proceed\s*pannu)\b/i.test(clean)
    ) {
      return {
        type: 'CONFIRM_YES',
        detectedLang,
        confirmEn: 'Submitting now.',
        confirmTa: 'இப்போது சமர்ப்பிக்கிறேன்.',
      };
    }
    if (
      /\b(no|cancel|don't submit|dont submit|do not submit|stop|nope)\b/i.test(clean) ||
      /(இல்லை|வேண்டாம்|ரத்து செய்|நிறுத்து)/i.test(clean) ||
      /\b(vendaam|cancel\s*pannu|illai)\b/i.test(clean)
    ) {
      return {
        type: 'CONFIRM_NO',
        detectedLang,
        confirmEn: 'Okay, I won’t submit it.',
        confirmTa: 'சரி, நான் சமர்ப்பிக்கவில்லை.',
      };
    }
  }

  // 1 & 2. Check Control Commands (stop-speaking, close, stop-listening, back, scroll)
  for (const ctrl of CONTROL_MAP) {
    for (const pattern of ctrl.patterns) {
      if (pattern.test(clean)) {
        return {
          type: 'CONTROL',
          action: ctrl.action,
          detectedLang,
          confirmEn: ctrl.confirmEn,
          confirmTa: ctrl.confirmTa,
        };
      }
    }
  }

  // 2.2. Conversational Queries & Assistance:
  // A. WHAT_CAN_YOU_DO / HELP
  if (
    /\b(what\s+(can|do)\s+you\s+do|how\s+can\s+you\s+help|what\s+are\s+your\s+features|tell\s+me\s+what\s+you\s+can\s+do|what\s+can\s+i\s+say|what\s+are\s+the\s+commands|help\s*me|assist\s*me|^help$)\b/i.test(clean) ||
    /(என்ன\s*செய்ய\s*முடியும்|உன்னால்\s*என்ன\s*செய்ய\s*முடியும்|நீ\s*என்ன\s*செய்வாய்|எப்படி\s*உதவுவாய்|உதவி\s*செய்|^உதவி$|^உதவு$)/i.test(clean) ||
    /(help\s*பண்ணு|help\s*பண்ணுங்க)/i.test(clean) ||
    /\b(enna\s+panna\s+mudiyum|unnala\s+enna\s+panna\s+mudiyum|help\s+pannu)\b/i.test(clean)
  ) {
    return {
      type: 'WHAT_CAN_YOU_DO',
      detectedLang,
      responseEn: 'I can help you navigate to any page, book a Mass, request certificates, submit prayer requests, read the Bible verse and Saint of the day, check your pending bookings, and play devotional hymns. Just tell me what you’d like to do.',
      responseTa: 'நான் உங்களுக்கு திருப்பலி முன்பதிவு செய்ய, ஆவணக் கோரிக்கை விடுக்க, ஜெப வேண்டுதல்கள் சமர்ப்பிக்க, இன்றைய விவிலிய வசனம் மற்றும் புனிதரை வாசிக்க, பக்திப் பாடல்களை இயக்க உதவ முடியும். நீங்கள் என்ன செய்ய விரும்புகிறீர்கள் என்று கூறுங்கள்.',
    };
  }

  // B. WHAT_IS_THIS_PAGE / WHERE_AM_I
  if (
    /\b(what\s+(is|is\s+on)\s+this\s+page|where\s+am\s+i|explain\s+this\s+page|what\s+page\s+is\s+this|which\s+page\s+is\s+this)\b/i.test(clean) ||
    /(இது\s*என்ன\s*பக்கம்|நான்\s*எங்கு\s*இருக்கிறேன்|இந்தப்\s*பக்கத்தை\s*விளக்கு)/i.test(clean) ||
    /\b(idhu\s+enna\s+page|naan\s+enga\s+irukken)\b/i.test(clean)
  ) {
    return {
      type: 'WHAT_IS_THIS_PAGE',
      detectedLang,
    };
  }

  // C. WHAT_CAN_I_DO_HERE
  if (
    /\b(what\s+can\s+i\s+do\s+(here|on\s+this\s+page)|actions?\s+on\s+this\s+page|how\s+to\s+use\s+this\s+page)\b/i.test(clean) ||
    /(இங்கு\s*என்ன\s*செய்யலாம்|இந்தப்\s*பக்கத்தில்\s*என்ன\s*செய்யலாம்)/i.test(clean) ||
    /\b(inga\s+enna\s+panna\s+mudiyum|indha\s+page\s+la\s+enna\s+panna\s+mudiyum)\b/i.test(clean)
  ) {
    return {
      type: 'WHAT_CAN_I_DO_HERE',
      detectedLang,
    };
  }

  // D. FORM_WHAT_TO_FILL
  if (
    /\b(what\s+do\s+i\s+need\s+to\s+fill|what\s+fields|what\s+should\s+i\s+enter|how\s+to\s+fill\s+this\s+form|form\s+guidance)\b/i.test(clean) ||
    /(நான்\s*என்ன\s*நிரப்ப\s*வேண்டும்|எந்த\s*விவரங்களை\s*உள்ளிட\s*வேண்டும்|படிவத்தில்\s*என்ன\s*நிரப்ப\s*வேண்டும்)/i.test(clean) ||
    /\b(enna\s+fill\s+panna\s+num|details\s+enna\s+kudukka\s+num)\b/i.test(clean)
  ) {
    return {
      type: 'FORM_WHAT_TO_FILL',
      detectedLang,
    };
  }

  // E. FORM_FOCUS_FIELD
  if (
    /\b(focus|click|go\s+to|select)\s+(on\s+)?(the\s+)?(name|intention|date|phone|email|amount|subject|description|message)\s*(field|box|input)?\b/i.test(clean) ||
    /(பெயர்|நோக்கம்|கருத்து|தேதி|தொலைபேசி|மின்னஞ்சல்|தொகை|தலைப்பு)\s*(கட்டத்திற்கு\s*செல்|பெட்டிக்கு\s*செல்|தேர்ந்தெடு)/i.test(clean) ||
    /\b(name|date|intention|phone|amount)\s+(box|field|input)?\s*(la\s*focus\s*pannu|ku\s*po)\b/i.test(clean)
  ) {
    const fieldName = extractFocusFieldName(clean);
    return {
      type: 'FORM_FOCUS_FIELD',
      fieldName,
      detectedLang,
    };
  }

  // F. AUDIO_CONTROL (Play, pause, resume, stop songs)
  if (
    /\b(play(\s+the)?\s+(song|hymn|music|audio)|resume(\s+the)?\s+(song|music))\b/i.test(clean) ||
    /(பாடலை\s*இயக்கு|பாட்டை\s*பாடு|பாடலை\s*தொடங்கு|பாட்டு\s*போடு|பாடலை\s*போடு)/i.test(clean) ||
    /\b(paattu\s*podu|song\s*play\s*pannu)\b/i.test(clean)
  ) {
    return {
      type: 'AUDIO_CONTROL',
      action: 'play',
      detectedLang,
    };
  }
  if (
    /\b(pause(\s+the)?\s+(song|hymn|music|audio))\b/i.test(clean) ||
    /(பாடலை\s*நிறுத்து|பாட்டை\s*நிறுத்து|இடைநிறுத்து)/i.test(clean) ||
    /\b(song\s*pause\s*pannu)\b/i.test(clean)
  ) {
    return {
      type: 'AUDIO_CONTROL',
      action: 'pause',
      detectedLang,
    };
  }
  if (
    /\b(stop(\s+the)?\s+(song|hymn|music|audio))\b/i.test(clean) ||
    /(பாடலை\s*முற்றிலும்\s*நிறுத்து)/i.test(clean) ||
    /\b(song\s*stop\s*pannu)\b/i.test(clean)
  ) {
    return {
      type: 'AUDIO_CONTROL',
      action: 'stop',
      detectedLang,
    };
  }

  // G. PENDING_QUERY
  if (
    /\b(what\s+is\s+my\s+pending(\s+booking|\s+request|\s+ticket)?|do\s+i\s+have\s+any\s+pending|check\s+pending|pending\s+status)\b/i.test(clean) ||
    /(என்\s*நிலுவையில்\s*உள்ள|நிலுவை\s*நிலை|ஏதேனும்\s*நிலுவை\s*உள்ளதா)/i.test(clean) ||
    /\b(pending\s*enna|pending\s*check\s*pannu)\b/i.test(clean)
  ) {
    return {
      type: 'PENDING_QUERY',
      detectedLang,
    };
  }

  // H. OPEN_THAT_ITEM
  if (
    /\b(open\s+(that|it|the\s+item|the\s+booking|the\s+ticket)|view\s+(that|details))\b/i.test(clean) ||
    /(அதை\s*திற|அந்த\s*பதிவை\s*திற|விவரங்களை\s*காட்டு)/i.test(clean) ||
    /\b(adha\s*open\s*pannu|adhoda\s*details\s*kaatu)\b/i.test(clean)
  ) {
    return {
      type: 'OPEN_THAT_ITEM',
      detectedLang,
    };
  }

  // 3. Check Action Commands (submit form, download document, toggle new)
  for (const act of ACTION_MAP) {
    for (const pattern of act.patterns) {
      if (pattern.test(clean)) {
        return {
          type: 'ACTION',
          action: act.action,
          detectedLang,
        };
      }
    }
  }

  // 4. Check Ambiguous Commands needing clarification
  for (const amb of AMBIGUOUS_INTENTS) {
    for (const pattern of amb.patterns) {
      if (pattern.test(clean)) {
        return {
          type: 'AMBIGUOUS',
          clarificationType: amb.clarificationType,
          needsClarification: true,
          detectedLang,
          clarifyPromptEn: amb.clarifyPromptEn,
          clarifyPromptTa: amb.clarifyPromptTa,
        };
      }
    }
  }

  // 5. Check Navigation & Reading Intents
  const shouldRead = isReadCommand(clean);

  for (const intent of INTENT_MAP) {
    for (const pattern of intent.patterns) {
      if (pattern.test(clean)) {
        return {
          type: 'NAVIGATION',
          intentId: intent.id,
          route: intent.route,
          requiresAuth: intent.requiresAuth || false,
          isFormToggle: intent.isFormToggle || false,
          shouldRead: shouldRead || Boolean(intent.readTarget && clean.includes('read')),
          readTarget: intent.readTarget || null,
          labelEn: intent.labelEn,
          labelTa: intent.labelTa,
          confirmEn: intent.confirmEn,
          confirmTa: intent.confirmTa,
          detectedLang,
          confidence: 0.95,
        };
      }
    }
  }

  // 6. Generic "read it" on current page
  if (shouldRead && /^(read|read\s+it|read\s+this|read\s+page|read\s+this\s+page|read\s+the\s+page|வாசி|படி)$/i.test(clean)) {
    return {
      type: 'READ_CURRENT',
      shouldRead: true,
      readTarget: 'current',
      detectedLang,
    };
  }

  // 7. Unclear or Unrecognized / Unsupported Speech (Sections 24, 25, 37)
  // If extremely short recognition or noise
  if (clean.length <= 2 || /^[^a-z0-9\u0B80-\u0BFF]+$/i.test(clean)) {
    return {
      type: 'UNCLEAR',
      detectedLang,
      messageEn: "Sorry, I didn't understand that. Please try again.",
      messageTa: 'மன்னிக்கவும், எனக்கு புரியவில்லை. தயவுசெய்து மீண்டும் முயற்சி செய்யுங்கள்.',
    };
  }

  // Irrelevant or unsupported speech
  return {
    type: 'UNSUPPORTED',
    detectedLang,
    messageEn: "Sorry, I didn't understand that. Please say a valid command such as Book a Mass, Request a Document, Prayer Request, or Open Events.",
    messageTa: 'மன்னிக்கவும், அது புரியவில்லை. திருப்பலி முன்பதிவு, ஆவணக் கோரிக்கை, ஜெப வேண்டுதல் அல்லது நிகழ்வுகள் போன்ற சரியான கட்டளையைக் கூறுங்கள்.',
  };
}

// Backwards-compatible aliases for useVoiceAssistant
export const resolveIntent = resolveVoiceCommand;
export function resolveControl(rawTranscript) {
  const res = resolveVoiceCommand(rawTranscript);
  return res && res.type === 'CONTROL' ? res : null;
}

// ─── Clarification Response Resolver ──────────────────────────────────────────

/**
 * Resolves user's follow-up reply to an ambiguous question
 * @param {string} reply
 * @param {string} clarificationType 'DOCUMENTS' | 'BOOKINGS'
 * @returns {object|null}
 */
export function resolveClarificationResponse(reply, clarificationType) {
  if (!reply) return null;
  const clean = normalizeSpeech(reply);

  if (clarificationType === 'DOCUMENTS') {
    // Check if user wants to request/create a new document
    if (/\b(request|new|create|apply|கோரிக்கை|புதிய)\b/i.test(clean)) {
      return INTENT_MAP.find((i) => i.id === INTENT_IDS.REQUEST_DOCUMENT);
    }
    // Check if user wants to view existing documents
    if (/\b(view|existing|my|show|see|பார்|என்)\b/i.test(clean)) {
      return INTENT_MAP.find((i) => i.id === INTENT_IDS.MY_DOCUMENTS);
    }
    // Check if user wants public documents
    if (/\b(public|church|பொது)\b/i.test(clean)) {
      return INTENT_MAP.find((i) => i.id === INTENT_IDS.PUBLIC_DOCUMENTS);
    }
  }

  if (clarificationType === 'BOOKINGS') {
    // Check if user wants to book a new mass
    if (/\b(new|book|create|பதிவு|புதிய)\b/i.test(clean)) {
      return INTENT_MAP.find((i) => i.id === INTENT_IDS.BOOK_MASS);
    }
    // Check if user wants to view existing bookings
    if (/\b(view|existing|my|show|all|பார்|என்)\b/i.test(clean)) {
      return INTENT_MAP.find((i) => i.id === INTENT_IDS.MASS_BOOKINGS);
    }
  }

  return null;
}

// ─── Context-Aware Help Suggestions ───────────────────────────────────────────

/**
 * Returns context-aware suggestion based on current route
 * @param {string} currentPath
 * @param {boolean} isTamil
 * @returns {string}
 */
export function getContextAwareHelp(currentPath = '', isTamil = false) {
  if (currentPath.startsWith('/dashboard')) {
    return isTamil
      ? 'மன்னிக்கவும், புரியவில்லை. உங்கள் கட்டுப்பாட்டு அறையில் இருந்து: "திருப்பலி முன்பதிவு", "ஆவணக் கோரிக்கை", "டிக்கெட் பதிவு" அல்லது "என் முன்பதிவுகள்" என்று கூறலாம்.'
      : 'I’m sorry, I didn’t understand that command. From your dashboard, you can say "Book a Mass", "Request a Document", "Raise a Ticket", or "Show my Bookings".';
  }

  return isTamil
    ? 'மன்னிக்கவும், புரியவில்லை. "திருப்பலி முன்பதிவு", "நிகழ்வுகள்", "இன்றைய புனிதர்", "விவிலிய வசனம்" அல்லது "அமைப்புகள்" என்று கூறலாம்.'
    : 'I’m sorry, I didn’t understand that command. You can say things like "Book a Mass", "Request a Document", "Open Events", or "Open Settings".';
}

// ─── Spoken Page Description & Capabilities ───────────────────────────────────

/**
 * Returns natural spoken description of the current page
 * @param {string} pathname
 * @param {boolean} isTamil
 * @returns {string}
 */
export function getPageDescription(pathname = '', isTamil = false) {
  const clean = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

  if (clean === '/dashboard/booking') {
    return isTamil
      ? 'நீங்கள் திருப்பலி முன்பதிவு பக்கத்தில் உள்ளீர்கள். இங்கு உங்கள் வேண்டுதல்கள், குடும்பத்தினர் அல்லது சிறப்பு நிகழ்வுகளுக்காக திருப்பலி பதிவு செய்யலாம்.'
      : 'You are on the Mass Booking page, where you can reserve Masses for your intentions, loved ones, or special occasions.';
  }
  if (clean === '/dashboard/documents') {
    return isTamil
      ? 'நீங்கள் ஆவணக் கோரிக்கை பக்கத்தில் உள்ளீர்கள். இங்கு ஞானஸ்நானம் அல்லது திருமண சான்றிதழ்களை கோரலாம் மற்றும் பதிவிறக்கலாம்.'
      : 'You are on the Document Request page, where you can request certificates such as Baptism or Marriage.';
  }
  if (clean === '/dashboard/tickets') {
    return isTamil
      ? 'நீங்கள் உதவி டிக்கெட் பக்கத்தில் உள்ளீர்கள். இங்கு ஆலய அலுவலகத்திற்கு உங்கள் கேள்விகளையும் கோரிக்கைகளையும் அனுப்பலாம்.'
      : 'You are on the Support Tickets page, where you can submit inquiries or requests directly to the parish office.';
  }
  if (clean === '/dashboard/bookings') {
    return isTamil
      ? 'நீங்கள் உங்கள் திருப்பலி முன்பதிவுகள் பக்கத்தில் உள்ளீர்கள். உங்கள் முன்பதிவுகளின் நிலையை இங்கு கண்காணிக்கலாம்.'
      : 'You are on your Mass Bookings history page, where you can track the status of all your submitted Mass intentions.';
  }
  if (clean === '/prayer-requests') {
    return isTamil
      ? 'நீங்கள் ஜெப வேண்டுதல்கள் பக்கத்தில் உள்ளீர்கள். உங்கள் குடும்பத்தினருக்கான ஜெபக் குறிப்புகளை இங்கு சமர்ப்பிக்கலாம்.'
      : 'You are on the Prayer Requests page, where you can submit intentions to be prayed for by our church community.';
  }
  if (clean === '/bible-verse') {
    return isTamil
      ? 'நீங்கள் விவிலிய வசனம் பக்கத்தில் உள்ளீர்கள். இன்றைய திருவசனம் இங்கு உள்ளது.'
      : "You are on the Bible Verse page, showing today's inspirational Holy Scripture.";
  }
  if (clean === '/daily-mass-readings') {
    return isTamil
      ? 'நீங்கள் தினசரி வாசகங்கள் பக்கத்தில் உள்ளீர்கள். இன்றைய கத்தோலிக்க திருப்பலி வாசகங்கள் இங்கு உள்ளன.'
      : "You are on the Daily Mass Readings page, showing the Catholic liturgical scriptures for today's Mass.";
  }
  if (clean === '/saint-of-the-day') {
    return isTamil
      ? 'நீங்கள் இன்றைய புனிதர் பக்கத்தில் உள்ளீர்கள். இன்றைய புனிதரின் வரலாறு மற்றும் திருநாள் விவரங்கள் இங்கு உள்ளன.'
      : "You are on the Saint of the Day page, showcasing today's patron saint, feast day, and history.";
  }
  if (clean === '/events') {
    return isTamil
      ? 'நீங்கள் ஆலய நிகழ்வுகள் பக்கத்தில் உள்ளீர்கள். வரவிருக்கும் திருவிழாக்கள் மற்றும் வழிபாட்டு நிகழ்வுகள் இங்கு உள்ளன.'
      : 'You are on the Parish Events page, listing upcoming feasts, services, and parish gatherings.';
  }
  if (clean === '/priests') {
    return isTamil
      ? 'நீங்கள் குருக்கள் பக்கத்தில் உள்ளீர்கள். எங்கள் பங்குத் தந்தையர்களைப் பற்றிய விவரங்கள் இங்கு உள்ளன.'
      : 'You are on the Priests page, introducing our parish priests and pastoral leaders.';
  }
  if (clean === '/rosary') {
    return isTamil
      ? 'நீங்கள் ஜெபமாலை பக்கத்தில் உள்ளீர்கள். புனித ஜெபமாலை ரகசியங்களை தியானிக்கலாம்.'
      : 'You are on the Rosary page, where you can meditate upon the mysteries of the Holy Rosary.';
  }
  if (clean.startsWith('/dashboard')) {
    return isTamil
      ? 'நீங்கள் உங்கள் கட்டுப்பாட்டு அறையில் உள்ளீர்கள். இது உங்கள் சுயவிவரம் மற்றும் சேவைகளின் மையம்.'
      : 'You are on your Parish Dashboard, your personal hub for bookings, certificates, and church updates.';
  }

  return isTamil
    ? 'நீங்கள் புனித அருளானந்தர் ஆலய இணையதளத்தில் உள்ளீர்கள்.'
    : 'You are on the St. John De Britto Church website.';
}

/**
 * Returns capabilities of what actions a user can take on the current page
 * @param {string} pathname
 * @param {boolean} isTamil
 * @returns {string}
 */
export function getPageCapabilities(pathname = '', isTamil = false) {
  const clean = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

  if (clean === '/dashboard/booking') {
    return isTamil
      ? 'இங்கு நீங்கள் தேதியைத் தேர்ந்தெடுக்கலாம், திருப்பலி கருத்துக்களை உள்ளிடலாம், அல்லது என்னென்ன விவரங்கள் நிரப்ப வேண்டும் என்று என்னிடம் கேட்கலாம்.'
      : 'Here you can choose a date, enter your intention details, submit a Mass booking, or ask me what fields to fill.';
  }
  if (clean === '/dashboard/documents') {
    return isTamil
      ? 'இங்கு நீங்கள் சான்றிதழ் கோரிக்கைகளை உருவாக்கலாம், முந்தைய நிலையை சரிபார்க்கலாம், அல்லது தயாராக உள்ள சான்றிதழை பதிவிறக்கம் செய்யலாம்.'
      : 'Here you can request a certificate, view previous applications, or download ready certificates.';
  }
  if (clean === '/dashboard/bookings') {
    return isTamil
      ? 'இங்கு உங்கள் திருப்பலி முன்பதிவுகளின் நிலையை சரிபார்க்கலாம் அல்லது நிலுவை பதிவுகளை திறக்கலாம்.'
      : 'Here you can review your upcoming Masses, check pending approvals, or open any booking to see its details.';
  }
  if (clean === '/dashboard/tickets') {
    return isTamil
      ? 'இங்கு புதிய உதவி டிக்கெட் உருவாக்கலாம் அல்லது ஆலய நிர்வாகியின் பதில்களைப் பார்க்கலாம்.'
      : 'Here you can create a new support inquiry, track replies from the parish office, or view past tickets.';
  }
  if (clean === '/prayer-requests') {
    return isTamil
      ? 'இங்கு உங்கள் ஜெபக் குறிப்பை சமர்ப்பிக்கலாம் அல்லது சமுதாய ஜெபங்களை வாசிக்கலாம்.'
      : 'Here you can fill out a prayer petition, read community requests, or ask me to focus on form fields.';
  }
  if (clean === '/bible-verse' || clean === '/saint-of-the-day' || clean === '/daily-mass-readings') {
    return isTamil
      ? 'முழு பகுதியையும் சத்தமாக வாசிக்க என்னிடம் கூறலாம்.'
      : "You can ask me to read the full text aloud, or navigate to today's other liturgical reflections.";
  }

  return isTamil
    ? 'எந்த பக்கத்திற்கும் செல்ல, உள்ளடக்கத்தை வாசிக்க, அல்லது படிவங்களை சமர்ப்பிக்க என்னிடம் கூறலாம்.'
    : 'You can ask me to navigate to any section, read content, submit forms, or guide you through any church service.';
}

/**
 * Returns spoken arrival confirmation when arriving at a page
 * @param {string} intentId
 * @param {boolean} isTamil
 * @returns {string}
 */
export function getArrivalConfirmation(intentId, isTamil = false) {
  switch (intentId) {
    case INTENT_IDS.BOOK_MASS:
      return isTamil
        ? 'திருப்பலி முன்பதிவு பக்கம் இப்போது திறக்கப்பட்டுள்ளது. விவரங்களை பூர்த்தி செய்து சமர்ப்பிக்கலாம்.'
        : "Book a Mass is now open. You can fill in the details and submit your request when you're ready.";
    case INTENT_IDS.REQUEST_DOCUMENT:
      return isTamil
        ? 'ஆவணக் கோரிக்கை பக்கம் இப்போது திறக்கப்பட்டுள்ளது. தேவையான சான்றிதழை தேர்வு செய்து விவரங்களை உள்ளிடலாம்.'
        : 'Document Request is now open. You can select the certificate type and enter your details.';
    case INTENT_IDS.RAISE_TICKET:
      return isTamil
        ? 'உதவி டிக்கெட் பக்கம் திறக்கப்பட்டுள்ளது. புதிய டிக்கெட் உருவாக்க அல்லது பதில்களைப் பார்க்க என்னிடம் கூறலாம்.'
        : 'Support Tickets is open. Let me know if you’d like to create a new ticket or check pending replies.';
    case INTENT_IDS.MASS_BOOKINGS:
      return isTamil
        ? 'உங்கள் திருப்பலி முன்பதிவுகள் திரையில் உள்ளன. நிலுவை பதிவுகளை சரிபார்க்க என்னிடம் கேட்கலாம்.'
        : 'Your Mass Bookings are on screen. You can ask me to check pending bookings or open any item.';
    case INTENT_IDS.MY_DOCUMENTS:
      return isTamil
        ? 'உங்கள் ஆவணங்கள் திரையில் உள்ளன. தயாராக உள்ள சான்றிதழ்களை பதிவிறக்கலாம்.'
        : 'Your documents are on screen. You can download ready certificates or track pending requests.';
    case INTENT_IDS.PRAYER_REQUESTS:
      return isTamil
        ? 'ஜெப வேண்டுதல் பக்கம் திறக்கப்பட்டுள்ளது. உங்கள் கருத்துக்களை இங்கு சமர்ப்பிக்கலாம்.'
        : 'Prayer Requests is open. You can share your petition with our parish community.';
    case INTENT_IDS.BIBLE_VERSE:
      return isTamil
        ? 'இன்றைய விவிலிய வசனம் திரையில் உள்ளது. வாசிக்கச் சொல்ல "இதை படி" என்று கூறவும்.'
        : "Today's Bible verse is on screen. Say 'Read it' if you'd like me to read it to you.";
    case INTENT_IDS.DAILY_READINGS:
    case 'DAILY_MASS_READINGS':
      return isTamil
        ? 'தினசரி திருப்பலி வாசகங்கள் திரையில் உள்ளன. வாசிக்கச் சொல்ல "இதை படி" என்று கூறவும்.'
        : "Daily Mass readings are on screen. Say 'Read it' whenever you'd like me to read them.";
    case INTENT_IDS.SAINT_OF_THE_DAY:
      return isTamil
        ? 'இன்றைய புனிதர் திரையில் உள்ளார். முழு வரலாற்றையும் வாசிக்க என்னிடம் கூறலாம்.'
        : "Saint of the day is on screen. You can ask me to read their feast and life history.";
    default:
      return isTamil
        ? 'நாம் இப்போது இந்தப் பக்கத்தில் உள்ளோம். நான் உங்களுக்கு எப்படி உதவ முடியும்?'
        : "We're now on this page. How can I help you?";
  }
}

/**
 * Extracts form field name from user speech
 * @param {string} text
 * @returns {string}
 */
export function extractFocusFieldName(text = '') {
  const clean = text.toLowerCase();
  if (clean.includes('name') || clean.includes('பெயர்')) return 'name';
  if (clean.includes('intention') || clean.includes('நோக்கம்') || clean.includes('கருத்து')) return 'intention';
  if (clean.includes('date') || clean.includes('தேதி')) return 'date';
  if (clean.includes('phone') || clean.includes('mobile') || clean.includes('தொலைபேசி') || clean.includes('எண்')) return 'phone';
  if (clean.includes('email') || clean.includes('மின்னஞ்சல்')) return 'email';
  if (clean.includes('amount') || clean.includes('தொகை') || clean.includes('காணிக்கை')) return 'amount';
  if (clean.includes('subject') || clean.includes('தலைப்பு')) return 'subject';
  if (clean.includes('description') || clean.includes('message') || clean.includes('செய்தி')) return 'message';
  return 'name';
}

// ─── Route Matcher ────────────────────────────────────────────────────────────

export function matchesRoute(currentPath, intendedPath) {
  if (!intendedPath) return true;
  if (!currentPath) return false;
  const cleanCurrent = currentPath.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const cleanIntended = intendedPath.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

  return (
    cleanCurrent === cleanIntended ||
    cleanCurrent.startsWith(`${cleanIntended}/`)
  );
}

