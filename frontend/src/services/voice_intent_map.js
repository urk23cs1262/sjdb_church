/**
 * voice_intent_map.js  v4 — Centralized Natural Language Intent & Control Resolver
 *
 * Architecture:
 *   VOICE INPUT (English or Tamil)
 *       ↓
 *   CENTRALIZED INTENT RESOLVER (Intent IDs: MASS_TIMINGS, DAILY_READINGS, etc.)
 *       ↓
 *   TARGET ROUTE & METADATA (/mass-timings, /daily-mass-readings, etc.)
 *       ↓
 *   SPOKEN CONFIRMATION & NAVIGATION ("Going to {Page Name}")
 */

export const INTENT_IDS = {
  MASS_TIMINGS: 'MASS_TIMINGS',
  DAILY_READINGS: 'DAILY_READINGS',
  EVENTS: 'EVENTS',
  PRAYER_REQUESTS: 'PRAYER_REQUESTS',
  ABOUT_CHURCH: 'ABOUT_CHURCH',
  CONTACT: 'CONTACT',
  DONATE: 'DONATE',
  ROSARY: 'ROSARY',
  GALLERY: 'GALLERY',
  LIVE_STREAM: 'LIVE_STREAM',
  CALENDAR: 'CALENDAR',
  PRIESTS: 'PRIESTS',
  PARISH_COUNCIL: 'PARISH_COUNCIL',
  NEARBY_PARISHES: 'NEARBY_PARISHES',
  ANNOUNCEMENTS: 'ANNOUNCEMENTS',
  TEAM: 'TEAM',
  ANBIYAMS: 'ANBIYAMS',
  DOCUMENTS: 'DOCUMENTS',
  FAQ: 'FAQ',
  BIBLE_VERSE: 'BIBLE_VERSE',
  SAINT_OF_THE_DAY: 'SAINT_OF_THE_DAY',
  PROFILE: 'PROFILE',
  DASHBOARD: 'DASHBOARD',
  BOOKINGS: 'BOOKINGS',
  TICKETS: 'TICKETS',
  NOTIFICATIONS: 'NOTIFICATIONS',
  SETTINGS: 'SETTINGS',
  LOGIN: 'LOGIN',
  REGISTER: 'REGISTER',
};

// ─── Navigation Intent Definitions ─────────────────────────────────────────────

export const INTENT_MAP = [
  // 1. Daily Mass Readings / Gospel / Bible
  {
    id: INTENT_IDS.DAILY_READINGS,
    route: '/daily-mass-readings',
    labelEn: 'Daily Readings',
    labelTa: 'தினசரி திருப்பலி வாசகங்கள்',
    patterns: [
      /\b(daily.*read(ing)?s?|today.*read(ing)?s?|mass.*read(ing)?s?|bible.*read(ing)?s?|readings?|gospel|scripture|word.*of.*god|first reading|second reading|today.*gospel|bible.*verses?|verses?)\b/i,
      /(வாசக|நற்செய்தி|வேதாகம|பைபிள்|சுவிசேஷ)/i,
    ],
  },

  // 2. Mass Timings / Schedule
  {
    id: INTENT_IDS.MASS_TIMINGS,
    route: '/mass-timings',
    labelEn: 'Mass Timings',
    labelTa: 'திருப்பலி நேரம்',
    patterns: [
      /\b(mass.*tim(ing)?s?|tim(ing)?s?.*mass|when.*mass|mass.*schedule?s?|service.*times?|mass.*times?|what.*time.*mass|masses|holy mass|sunday mass)\b/i,
      /(திருப்பலி.*நேர|திருப்பலி.*எப்ப|பூசை.*நேர|ஆராதனை.*நேர|திருப்பலி)/i,
    ],
  },

  // 3. Church Events / Programmes
  {
    id: INTENT_IDS.EVENTS,
    route: '/events',
    labelEn: 'Events',
    labelTa: 'ஆலய நிகழ்வுகள்',
    patterns: [
      /\b(events?|upcoming|programmes?|programs?|feasts?|festivals?|happenings?|celebrations?)\b/i,
      /(நிகழ்வு|நிகழ்ச்சி|விழா|திருவிழா|பண்டிகை)/i,
    ],
  },

  // 4. Church Announcements / Notices
  {
    id: INTENT_IDS.ANNOUNCEMENTS,
    route: '/announcements',
    labelEn: 'Announcements',
    labelTa: 'அறிவிப்புகள்',
    patterns: [
      /\b(announcements?|notices?|circulars?|church news|parish news|bulletins?|updates?)\b/i,
      /(அறிவிப்புகள்|அறிவிப்பு|செய்திகள்)/i,
    ],
  },

  // 5. Prayer Requests / Intercessions
  {
    id: INTENT_IDS.PRAYER_REQUESTS,
    route: '/prayer-requests',
    labelEn: 'Prayer Requests',
    labelTa: 'ஜெப வேண்டுதல்',
    patterns: [
      /\b(prayer.*requests?|pray.*for|intercessions?|ask.*prayer|submit.*prayer|need.*prayer|prayers?|prayer intention)\b/i,
      /(ஜெப.*விண்ணப்ப|ஜெப.*வேண்டுதல்|பிரார்த்தனை|வேண்டுதல்|ஜெபம்)/i,
    ],
  },

  // 6. Parish Council (Checked before general About)
  {
    id: INTENT_IDS.PARISH_COUNCIL,
    route: '/parish-council',
    labelEn: 'Parish Council',
    labelTa: 'பரிசத்து சபை',
    patterns: [
      /\b(parish\s*council|council(\s*members?)?|governing(\s*body)?|church\s*committee|committee)\b/i,
      /(பரிசத்து சபை|ஆலயக் குழு|திருச்சபை குழு)/i,
    ],
  },

  // 7. Nearby Parishes / Shrines
  {
    id: INTENT_IDS.NEARBY_PARISHES,
    route: '/nearby-parishes',
    labelEn: 'Nearby Parishes',
    labelTa: 'அருகிலுள்ள கோவில்கள்',
    patterns: [
      /\b(nearby(\s*parishes|\s*churches|\s*shrines)?|shrines?|other\s*church(es)?|closest\s*church(es)?)\b/i,
      /(அருகிலுள்ள|அருகில் உள்ள)/i,
    ],
  },

  // 8. About / Parish History / St. John de Britto
  {
    id: INTENT_IDS.ABOUT_CHURCH,
    route: '/about',
    labelEn: 'About Us',
    labelTa: 'திருச்சபை பற்றி',
    patterns: [
      /\b(about(\s+us|\s+church|\s+parish)?|church\s*history|parish\s*history|who\s*are\s*we|saint\s*john|st\.?\s*john|de\s*britto|arulanandhar|patron\s*saint)\b/i,
      /(அருளானந்தர்|திருச்சபை பற்றி|ஆலய வரலாறு|கோவில் வரலாறு|எங்கள் ஆலயம்|பங்கு பற்றி)/i,
    ],
  },

  // 9. Contact Us / Location / Phone
  {
    id: INTENT_IDS.CONTACT,
    route: '/contact',
    labelEn: 'Contact',
    labelTa: 'தொடர்பு கொள்ளுங்கள்',
    patterns: [
      /\b(contacts?|reach|phone|address|locations?|maps?|call|directions?|how to reach|where is church)\b/i,
      /(தொடர்பு|முகவரி|தொலைபேசி|எண்|எங்கு உள்ளது)/i,
    ],
  },

  // 10. Donate / Contributions
  {
    id: INTENT_IDS.DONATE,
    route: '/donate',
    labelEn: 'Donate',
    labelTa: 'நன்கொடை',
    patterns: [
      /\b(donat(e|ion|ions|ing)?|contribut(e|ion|ions|ing)?|offerings?|tithes?|give\s*money|support\s*church|make\s*a\s*donation|online\s*donation)\b/i,
      /(நன்கொடை|காணிக்கை|கொடை|தானம்|பங்களிப்பு)/i,
    ],
  },

  // 9. Rosary (Virtual Rosary Audio)
  {
    id: INTENT_IDS.ROSARY,
    route: '/rosary',
    labelEn: 'Rosary',
    labelTa: 'ஜெபமாலை',
    patterns: [
      /\b(rosarys?|hail.*mary|holy.*rosary|mysteries|play rosary)\b/i,
      /(ஜெபமாலை|மாலிகை|மணி)/i,
    ],
  },

  // 10. Photo Gallery
  {
    id: INTENT_IDS.GALLERY,
    route: '/gallery',
    labelEn: 'Gallery',
    labelTa: 'காட்சியகம்',
    patterns: [
      /\b(gallery|photos?|pictures?|images?|albums?)\b/i,
      /(படங்கள்|புகைப்படங்கள்|காட்சியகம்|ஆல்பம்)/i,
    ],
  },

  // 11. Live Stream
  {
    id: INTENT_IDS.LIVE_STREAM,
    route: '/live',
    labelEn: 'Live Stream',
    labelTa: 'நேரடி ஒளிபரப்பு',
    patterns: [
      /\b(live|streams?|broadcasts?|watch.*online|online.*mass|live mass)\b/i,
      /(நேரடி.*ஒளிபரப்பு|நேரடி|லைவ்)/i,
    ],
  },

  // 12. Catholic Calendar
  {
    id: INTENT_IDS.CALENDAR,
    route: '/calendar',
    labelEn: 'Calendar',
    labelTa: 'கத்தோலிக்க நாட்காட்டி',
    patterns: [
      /\b(calendars?|liturgical|feast.*days?|holy.*days?|church calendar)\b/i,
      /(நாட்காட்டி|காலண்டர்)/i,
    ],
  },

  // 13. Priests / Clergy
  {
    id: INTENT_IDS.PRIESTS,
    route: '/priests',
    labelEn: 'Priests',
    labelTa: 'குருக்கள்',
    patterns: [
      /\b(priests?|fathers?|pastors?|clergy|parish.*priests?|assistant.*priests?)\b/i,
      /(குருக்கள்|அருட்தந்தை|பங்குத் தந்தை|பாதர்)/i,
    ],
  },



  // 16. Team / Ministry
  {
    id: INTENT_IDS.TEAM,
    route: '/team',
    labelEn: 'Team',
    labelTa: 'எங்கள் குழு',
    patterns: [
      /\b(team|staff|volunteers?|ministry.*team|our team|choir)\b/i,
      /(குழுவினர்|ஊழியர்கள்|எங்கள் குழு)/i,
    ],
  },

  // 17. Anbiyams (Basic Christian Communities)
  {
    id: INTENT_IDS.ANBIYAMS,
    route: '/anbiyams',
    labelEn: 'Anbiyams',
    labelTa: 'அன்பியங்கள்',
    patterns: [
      /\b(anbiyams?|small.*christian.*community|basic.*community|bcc)\b/i,
      /(அன்பியங்கள்|அன்பியம்)/i,
    ],
  },

  // 18. Documents / Certificates / Forms
  {
    id: INTENT_IDS.DOCUMENTS,
    route: '/documents',
    labelEn: 'Documents',
    labelTa: 'ஆவணங்கள்',
    patterns: [
      /\b(documents?|certificates?|forms?|downloads?|baptism.*cert|marriage.*cert)\b/i,
      /(ஆவணங்கள்|படிவங்கள்|சான்றிதழ்)/i,
    ],
  },

  // 19. FAQ
  {
    id: INTENT_IDS.FAQ,
    route: '/faq',
    labelEn: 'FAQ',
    labelTa: 'கேள்வி பதில்',
    patterns: [
      /\b(faq|frequent|questions?|frequently.*asked|help)\b/i,
      /(அடிக்கடி கேட்கப்படும்|கேள்வி)/i,
    ],
  },

  // 20. Saint of the Day
  {
    id: INTENT_IDS.SAINT_OF_THE_DAY,
    route: '/saint-of-the-day',
    labelEn: 'Saint of the Day',
    labelTa: 'இன்றைய புனிதர்',
    patterns: [
      /\b(saint.*today|today.*saint|saint.*day|day.*saint|saint of the day)\b/i,
      /(இன்றைய புனிதர்|புனிதர்)/i,
    ],
  },

  // ── Auth-Protected Routes ──────────────────────────────────────────────────

  // 21. User Profile
  {
    id: INTENT_IDS.PROFILE,
    route: '/dashboard/profile',
    labelEn: 'Profile',
    labelTa: 'என் சுயவிவரம்',
    requiresAuth: true,
    patterns: [
      /\b(profiles?|my.*profile|personal.*info|my.*account|user.*profile)\b/i,
      /(சுயவிவரம்|என் விவரம்)/i,
    ],
  },

  // 22. User Dashboard
  {
    id: INTENT_IDS.DASHBOARD,
    route: '/dashboard',
    labelEn: 'Dashboard',
    labelTa: 'கட்டுப்பாட்டு அறை',
    requiresAuth: true,
    patterns: [
      /\b(dashboards?|user.*dashboard|member.*portal|portal)\b/i,
      /(கட்டுப்பாட்டு அறை|என் பக்கம்)/i,
    ],
  },

  // 23. Mass Bookings
  {
    id: INTENT_IDS.BOOKINGS,
    route: '/dashboard/booking',
    labelEn: 'Bookings',
    labelTa: 'திருப்பலி முன்பதிவு',
    requiresAuth: true,
    patterns: [
      /\b(book.*mass|mass.*bookings?|my.*bookings?|reserve.*mass|bookings?)\b/i,
      /(திருப்பலி முன்பதிவு|முன்பதிவு)/i,
    ],
  },

  // 24. Support Tickets
  {
    id: INTENT_IDS.TICKETS,
    route: '/dashboard/tickets',
    labelEn: 'Support Tickets',
    labelTa: 'உதவி கோரிக்கைகள்',
    requiresAuth: true,
    patterns: [
      /\b(tickets?|support.*ticket|help.*ticket|my.*tickets?|raise.*ticket|customer.*support)\b/i,
      /(டிக்கெட்|உதவி|கோரிக்கை)/i,
    ],
  },

  // 25. Notifications
  {
    id: INTENT_IDS.NOTIFICATIONS,
    route: '/dashboard/notifications',
    labelEn: 'Notifications',
    labelTa: 'அறிவிப்புகள்',
    requiresAuth: true,
    patterns: [
      /\b(notifications?|my.*alerts?|inbox|messages?)\b/i,
      /(என் அறிவிப்புகள்|அறிவிப்பு)/i,
    ],
  },

  // 26. Settings
  {
    id: INTENT_IDS.SETTINGS,
    route: '/dashboard/settings',
    labelEn: 'Settings',
    labelTa: 'அமைப்புகள்',
    requiresAuth: true,
    patterns: [
      /\b(settings?|preferences?|configurations?|account.*settings?)\b/i,
      /(அமைப்புகள்|விருப்பங்கள்)/i,
    ],
  },

  // 27. Sign In / Login
  {
    id: INTENT_IDS.LOGIN,
    route: '/login',
    labelEn: 'Login',
    labelTa: 'உள்நுழைவு',
    patterns: [
      /\b(sign.*in|log.*in|login)\b/i,
      /(உள்நுழை|உள்நுழைவு)/i,
    ],
  },

  // 28. Register / Sign Up
  {
    id: INTENT_IDS.REGISTER,
    route: '/register',
    labelEn: 'Register',
    labelTa: 'பதிவு செய்ய',
    patterns: [
      /\b(sign.*up|register|create.*account|new member)\b/i,
      /(பதிவு செய்|பதிவு)/i,
    ],
  },
];

// ─── Control Commands Map ─────────────────────────────────────────────────────

export const CONTROL_MAP = [
  {
    action: 'home',
    route: '/',
    labelEn: 'Going to Home.',
    labelTa: 'முகப்பு பக்கத்திற்கு செல்கிறேன்.',
    patterns: [
      /\b(go to home|take me home|go home|home page|main page|home)\b/i,
      /(முகப்பு|ஹோம்|வீட்டு பக்கம்)/i,
    ],
  },
  {
    action: 'back',
    labelEn: 'Going back.',
    labelTa: 'முந்தைய பக்கத்திற்கு செல்கிறேன்.',
    patterns: [
      /\b(go back|previous page|go previous|back)\b/i,
      /(முந்தைய பக்கம்|பின்னால் செல்|பின்னே செல்)/i,
    ],
  },
  {
    action: 'scroll-down',
    labelEn: 'Scrolling down.',
    labelTa: 'கீழே உருட்டுகிறேன்.',
    patterns: [
      /\b(scroll down|go down|move down|down)\b/i,
      /(கீழே உருட்டு|கீழே செல்|கீழே)/i,
    ],
  },
  {
    action: 'scroll-up',
    labelEn: 'Scrolling up.',
    labelTa: 'மேலே உருட்டுகிறேன்.',
    patterns: [
      /\b(scroll up|go up|move up|top|go to top)\b/i,
      /(மேலே உருட்டு|மேலே செல்|மேலே)/i,
    ],
  },
  {
    action: 'close',
    labelEn: 'Closing.',
    labelTa: 'மூடுகிறேன்.',
    patterns: [
      /\b(close|close this|close connect|close assistant|cancel|dismiss|stop|never mind)\b/i,
      /(மூடு|ரத்து செய்|நிறுத்து)/i,
    ],
  },
];

// ─── Normalize text ────────────────────────────────────────────────────────────

export function normalizeSpeech(text) {
  if (!text) return '';
  let cleaned = text
    .toLowerCase()
    .replace(/[.,?!;:()'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading wake phrases if present (e.g. "hey connect show mass timings" -> "show mass timings")
  cleaned = cleaned.replace(/^(hey connect|hey connected|connect|ஹே கனெக்ட்)\s+/i, '').trim();
  return cleaned;
}

// ─── Ambiguity & Informational Patterns ────────────────────────────────────────

export const AMBIGUOUS_PATTERNS = [
  /^(show (me )?(that|this|something|it|there)( page)?|open (that|this|something|it|there)( page)?|go (to )?(that|this|there)( page)?|take me (to )?(that|this|there)( page)?|(that|this) page)$/i,
  /^(அதை காட்டு|அதை திற|அந்த பக்கம்|அந்த பக்கத்தை|ஏதாவது காட்டு|அங்கே செல்)$/i,
];

// Patterns where the user mentions a page/topic but is asking an informational/conversational question
export const INFORMATIONAL_PATTERNS = [
  /\b(tell me about .* and why|why (are|is|do)|explain|importance of|what is the (importance|meaning|purpose) of|teach me|can you explain)\b/i,
  /(ஏன்|விளக்கு|முக்கியத்துவம்|பற்றி சொல்|காரணம் என்ன)/i,
];

// Navigation action verbs indicating high intent confidence
export const NAV_ACTION_VERBS = [
  /\b(show|open|go to|take me to|navigate to|view|display|browse|bring up|switch to)\b/i,
  /(காட்டு|திற|செல்|கொண்டு செல்|பார்க்க)/i,
];

// Affirmative responses for clarification follow-ups
export const AFFIRMATIVE_PATTERNS = [
  /^(yes|yeah|yep|sure|ok|okay|please|open it|go ahead|do it|yes please|yes open)$/i,
  /^(ஆம்|சரி|திற|திறக்கலாம்|போகலாம்|சரி காட்டு|சரி திற)$/i,
];

// Negative responses for clarification follow-ups
export const NEGATIVE_PATTERNS = [
  /^(no|nope|cancel|don't|stop|never mind|nothing|no thanks)$/i,
  /^(இல்லை|வேண்டாம்|ரத்து|நிறுத்து)$/i,
];

export function isAffirmative(text) {
  if (!text) return false;
  const clean = normalizeSpeech(text);
  return AFFIRMATIVE_PATTERNS.some((p) => p.test(clean));
}

export function isNegative(text) {
  if (!text) return false;
  const clean = normalizeSpeech(text);
  return NEGATIVE_PATTERNS.some((p) => p.test(clean));
}

export const CONFIDENCE_THRESHOLD = 0.70;

// ─── Resolve Intent (with Confidence & Ambiguity Handling) ─────────────────────

/**
 * Resolve spoken transcript to a navigation intent with confidence scoring.
 * Enforces: Speech → normalized text → intent resolution → confidence → navigation
 *
 * @param {string} rawTranscript
 * @returns {object|null} Matched intent entry with confidence score or null
 */
export function resolveIntent(rawTranscript) {
  if (!rawTranscript) return null;
  const clean = normalizeSpeech(rawTranscript);
  if (!clean) return null;

  // 1. Check for informational / conversational markers ("tell me about mass timings and why they are important")
  const isInformational = INFORMATIONAL_PATTERNS.some((p) => p.test(clean));

  // 2. Scan intent map first
  for (const intent of INTENT_MAP) {
    for (const pattern of intent.patterns) {
      if (pattern.test(clean)) {
        // If informational query detected, do not navigate directly
        if (isInformational) {
          return {
            ...intent,
            confidence: 0.45,
            isInformational: true,
            needsClarification: true,
            clarifyPromptEn: `Would you like me to open the ${intent.labelEn} page?`,
            clarifyPromptTa: `${intent.labelTa} பக்கத்தை திறக்கட்டுமா?`,
          };
        }

        // Check for navigation action verbs ("show", "open", "go to", "காட்டு", etc.)
        const hasActionVerb = NAV_ACTION_VERBS.some((v) => v.test(clean));
        const wordCount = clean.split(/\s+/).length;

        // Score confidence:
        // - Direct command with action verb: 0.95 (High)
        // - Concise direct query (<= 5 words, e.g. "mass timings"): 0.92 (High)
        // - Moderately sized query (<= 8 words): 0.85 (High)
        // - Long rambling query (> 8 words without action verbs): 0.60 (Needs clarification)
        let confidence = 0.85;
        if (hasActionVerb) {
          confidence = 0.95;
        } else if (wordCount <= 5) {
          confidence = 0.92;
        } else if (wordCount <= 8) {
          confidence = 0.85;
        } else {
          confidence = 0.60;
        }

        const needsClarification = confidence < CONFIDENCE_THRESHOLD;

        return {
          ...intent,
          confidence,
          isAmbiguous: false,
          needsClarification,
          clarifyPromptEn: needsClarification
            ? `Would you like me to open the ${intent.labelEn} page?`
            : null,
          clarifyPromptTa: needsClarification
            ? `${intent.labelTa} பக்கத்தை திறக்கட்டுமா?`
            : null,
        };
      }
    }
  }

  // 3. Check for ambiguous / underspecified requests ("show me that", "open that page")
  // Only if no specific page was matched above
  const isAmbiguous = AMBIGUOUS_PATTERNS.some((pattern) => pattern.test(clean));
  if (isAmbiguous) {
    return {
      id: 'AMBIGUOUS',
      isAmbiguous: true,
      needsClarification: true,
      confidence: 0.2,
      clarifyPromptEn: 'Which page would you like me to open?',
      clarifyPromptTa: 'எந்த பக்கத்திற்கு செல்ல வேண்டும்?',
    };
  }

  return null;
}

// ─── Resolve Control ──────────────────────────────────────────────────────────

/**
 * Resolve spoken transcript to a control action (back, scroll, home, close).
 * @param {string} rawTranscript
 * @returns {object|null} Matched control entry or null
 */
export function resolveControl(rawTranscript) {
  if (!rawTranscript) return null;
  const clean = normalizeSpeech(rawTranscript);
  if (!clean) return null;

  for (const ctrl of CONTROL_MAP) {
    for (const pattern of ctrl.patterns) {
      if (pattern.test(clean)) {
        return ctrl;
      }
    }
  }

  return null;
}

// ─── Route Verification Matcher ───────────────────────────────────────────────

/**
 * Safe route boundary matcher for post-navigation verification.
 * Prevents false positives like /events matching /events-old,
 * and handles query parameters and hashes cleanly.
 *
 * @param {string} currentPath
 * @param {string} intendedPath
 * @returns {boolean}
 */
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
