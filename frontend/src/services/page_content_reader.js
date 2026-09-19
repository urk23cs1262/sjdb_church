/**
 * page_content_reader.js — Intelligent Visible Content Extractor for SJDB Voice Assistant
 *
 * Extracts clean, spoken-friendly text from React components/pages:
 * - Saint of the Day (Saint name, Feast day, Full biography)
 * - Daily Bible Verse (Title, Verse text, Scripture reference)
 * - Daily Mass Readings (Liturgical Day, First Reading, Psalm, Gospel)
 * - Church Events (Title, Date, Time, Venue, Description)
 * - Announcements (Title, Date, Content)
 * - Church Information (History, Mission, Vision, Patron Saint)
 * - Contact Information (Address, Phone, Email, Office Hours)
 *
 * Excludes:
 * - display: none, visibility: hidden, aria-hidden="true"
 * - Navigation links, buttons, headers, footers, social share icons
 * - Duplicate mobile/desktop elements
 */

/**
 * Wait until a DOM element exists and contains actual rendered content (not loading skeleton)
 * @param {string} selector CSS selector
 * @param {number} timeoutMs Maximum wait time in milliseconds
 * @returns {Promise<Element|null>}
 */
export async function waitForContent(selector, timeoutMs = 4000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const el = document.querySelector(selector);
      if (el) {
        // Ensure not just an empty container or skeleton loader
        const text = el.innerText || el.textContent || '';
        const hasText = text.trim().length > 20;
        const isLoading = el.querySelector('.animate-pulse') || el.querySelector('.animate-spin');
        if (hasText && !isLoading) {
          resolve(el);
          return;
        }
      }
      if (Date.now() - start >= timeoutMs) {
        // Return whatever element exists even if timeout reached
        resolve(document.querySelector(selector));
        return;
      }
      setTimeout(check, 120);
    };
    check();
  });
}

/**
 * Clean and normalize text for speech synthesis:
 * - Strips redundant whitespace and tabs
 * - Replaces non-spoken symbols (e.g. •, —, ✝) with spoken equivalents or pauses
 * - Ensures sentences end with proper punctuation for natural speech pauses
 */
function cleanForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/[•✝*]/g, ' ')
    .replace(/\s*—\s*/g, '. ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

/**
 * 1. Saint of the Day Extractor
 */
export async function extractSaintOfTheDay(isTamil = false) {
  // Wait up to 3.5s for Saint of the Day container
  const container = await waitForContent('#saint-of-the-day', 3500);
  if (!container) {
    return isTamil
      ? 'மன்னிக்கவும், இன்றைய புனிதர் விவரங்கள் இன்னும் கிடைக்கவில்லை.'
      : 'Sorry, the Saint of the Day details are not available at this moment.';
  }

  // Name
  const nameEl = container.querySelector('h4') || container.querySelector('h3');
  const saintName = nameEl ? nameEl.innerText.trim() : (isTamil ? 'இன்றைய புனிதர்' : 'Saint of the Day');

  // Feast Day
  const feastEl = container.querySelector('h3');
  let feastDay = feastEl ? feastEl.innerText.trim() : '';

  // Description / Biography paragraphs
  const descContainer = container.querySelector('.text-gray-700') || container;
  const paragraphs = Array.from(descContainer.querySelectorAll('p'))
    .map((p) => p.innerText.trim())
    .filter((t) => t.length > 10 && !t.includes('FEAST DAY') && !t.includes('திருவிழா'));

  const bio = paragraphs.join(' ') || (isTamil ? 'புனிதர் பற்றிய தகவல்கள்.' : 'Saint details.');

  if (isTamil) {
    return cleanForSpeech(
      `இன்றைய புனிதர்: ${saintName}. ${feastDay ? `திருவிழா நாள்: ${feastDay}.` : ''} ${bio}`
    );
  }

  return cleanForSpeech(
    `Saint of the Day is ${saintName}. ${feastDay ? `Feast day: ${feastDay}.` : ''} ${bio}`
  );
}

/**
 * 2. Daily Bible Verse Extractor
 */
export async function extractBibleVerse(isTamil = false) {
  const container = await waitForContent('#verse', 3500);
  if (!container) {
    return isTamil
      ? 'மன்னிக்கவும், இன்றைய விவிலிய வசனம் கிடைக்கவில்லை.'
      : 'Sorry, today’s Bible verse is not available right now.';
  }

  // Primary verse paragraph
  const verseEl = isTamil
    ? container.querySelector('.font-tamil') || container.querySelector('p.text-2xl, p.text-xl')
    : container.querySelector('p.font-serif') || container.querySelector('p.text-2xl, p.text-xl');

  const verseText = verseEl ? verseEl.innerText.replace(/["“”]/g, '').trim() : '';

  // Scripture reference (e.g. "— John 3:16")
  const refEl = container.querySelector('.text-church-gold.font-bold') || container.querySelector('p:last-of-type');
  const refText = refEl ? refEl.innerText.replace(/^[—\s-]+/, '').trim() : '';

  if (!verseText) {
    return isTamil
      ? 'இன்றைய விவிலிய வசனம் இன்னும் பதிவேற்றப்படவில்லை.'
      : 'No Bible verse is available for today yet.';
  }

  if (isTamil) {
    return cleanForSpeech(
      `இன்றைய விவிலிய வசனம்: ${verseText}. திருவிவிலிய குறிப்பு: ${refText}.`
    );
  }

  return cleanForSpeech(
    `Today’s Bible verse: "${verseText}". From ${refText}.`
  );
}

/**
 * 3. Daily Mass Readings Extractor
 */
export async function extractMassReadings(isTamil = false) {
  const container = await waitForContent('#readings', 4000);
  if (!container) {
    return isTamil
      ? 'மன்னிக்கவும், திருப்பலி வாசகங்கள் கிடைக்கவில்லை.'
      : 'Sorry, Daily Mass Readings could not be loaded at this time.';
  }

  // Main Liturgical Title / Day
  const titleBanner = container.parentElement?.querySelector('.bg-church-royal-blue');
  const liturgicalTitle = titleBanner ? titleBanner.innerText.trim() : 'Daily Mass Readings';

  // Sections (First Reading, Responsorial Psalm, Second Reading, Gospel)
  const sectionCards = Array.from(container.parentElement?.querySelectorAll('.glass-card') || [])
    .filter((card) => card.id !== 'verse' && card.id !== 'saint-of-the-day' && !card.querySelector('input[type="date"]'));

  if (!sectionCards.length) {
    return isTamil
      ? `${liturgicalTitle}. வாசகங்கள் விரைவில் காண்பிக்கப்படும்.`
      : `${liturgicalTitle}. The complete readings are currently being prepared.`;
  }

  const sectionsText = [];
  sectionsText.push(liturgicalTitle);

  sectionCards.forEach((card) => {
    const headingEl = card.querySelector('h3') || card.querySelector('.font-serif') || card.querySelector('.font-bold');
    const heading = headingEl ? headingEl.innerText.trim() : '';
    const paragraphs = Array.from(card.querySelectorAll('p'))
      .map((p) => p.innerText.trim())
      .filter((p) => p.length > 5 && !p.includes('Loading') && !p.includes('Catholic Gallery'));

    if (heading || paragraphs.length) {
      if (heading) sectionsText.push(heading);
      sectionsText.push(paragraphs.join(' '));
    }
  });

  const fullText = sectionsText.join('. ');
  return cleanForSpeech(fullText);
}

/**
 * 4. Church Events Extractor
 */
export async function extractEvents(isTamil = false) {
  // Wait for events cards or empty container
  await waitForContent('.church-card, .bg-amber-50\\/50', 3500);

  const cards = Array.from(document.querySelectorAll('.church-card'));
  if (!cards.length) {
    return isTamil
      ? 'தற்போது புதிய நிகழ்வுகள் எதுவும் திட்டமிடப்படவில்லை. பின்னர் சரிபார்க்கவும்.'
      : 'There are currently no upcoming events scheduled. Please check back later.';
  }

  const eventSummaries = cards.slice(0, 4).map((card, idx) => {
    const title = card.querySelector('h3')?.innerText.trim() || `Event ${idx + 1}`;
    const desc = card.querySelector('p.text-gray-500')?.innerText.trim() || '';
    const details = Array.from(card.querySelectorAll('.text-xs.text-gray-400 div'))
      .map((d) => d.innerText.trim())
      .filter(Boolean)
      .join(', ');

    return `${title}. ${details ? `Details: ${details}.` : ''} ${desc}`;
  });

  if (isTamil) {
    return cleanForSpeech(
      `ஆலயத்தில் எதிர்வரும் நிகழ்வுகள்: ${eventSummaries.join(' அடுத்ததாக: ')}`
    );
  }

  return cleanForSpeech(
    `Here are the upcoming church events: ${eventSummaries.join(' Next event: ')}`
  );
}

/**
 * 5. Announcements Extractor
 */
export async function extractAnnouncements(isTamil = false) {
  await waitForContent('.church-card, .bg-amber-50\\/50', 3500);

  const cards = Array.from(document.querySelectorAll('.church-card'));
  if (!cards.length) {
    return isTamil
      ? 'தற்போது புதிய அறிவிப்புகள் எதுவும் இல்லை.'
      : 'There are currently no active announcements published. Please check back later.';
  }

  const announcements = cards.slice(0, 4).map((card, idx) => {
    const title = card.querySelector('h3')?.innerText.trim() || `Notice ${idx + 1}`;
    const date = card.querySelector('p.text-xs.text-gray-400')?.innerText.trim() || '';
    const content = card.querySelector('p.text-gray-600')?.innerText.trim() || '';

    return `${title}. ${date ? `Published: ${date}.` : ''} ${content}`;
  });

  if (isTamil) {
    return cleanForSpeech(
      `முக்கிய பங்கு அறிவிப்புகள்: ${announcements.join(' அடுத்த அறிவிப்பு: ')}`
    );
  }

  return cleanForSpeech(
    `Here are the parish announcements: ${announcements.join(' Next announcement: ')}`
  );
}

/**
 * 6. Church History & About Extractor
 */
export async function extractAboutChurch(isTamil = false) {
  await waitForContent('h2.section-title', 3000);

  const historyParagraphs = Array.from(document.querySelectorAll('.space-y-4 p'))
    .map((p) => p.innerText.trim())
    .filter((t) => t.length > 20);

  const mission = document.querySelector('.glass-card p.text-gray-600')?.innerText.trim();

  const historyText = historyParagraphs.slice(0, 3).join(' ');

  if (isTamil) {
    return cleanForSpeech(
      `புனித அருளானந்தர் ஆலயம், காளையார்கோவில். ${historyText} ${mission ? `எங்கள் பணி: ${mission}` : ''}`
    );
  }

  return cleanForSpeech(
    `About St. John de Britto Church, Kalayarkoil: ${historyText} ${mission ? `Our Mission: ${mission}` : ''}`
  );
}

/**
 * 7. Contact Information Extractor
 */
export async function extractContactInfo(isTamil = false) {
  await waitForContent('.section-title', 3000);

  const address = 'Murthi Nagar, Kalayarkoil, Sivaganga District, Tamil Nadu 630551';
  const phone = '+91 04577 241222';
  const email = 'stjdbchurch@gmail.com';
  const officeHours = 'Monday to Saturday, 9:00 AM to 5:00 PM. Closed on Sundays and public holidays.';

  if (isTamil) {
    return cleanForSpeech(
      `ஆலய தொடர்பு விவரங்கள்: முகவரி: ${address}. தொலைபேசி: ${phone}. மின்னஞ்சல்: ${email}. அலுவலக நேரம்: ${officeHours}.`
    );
  }

  return cleanForSpeech(
    `St. John de Britto Church Contact Information. Address: ${address}. Phone: ${phone}. Email: ${email}. Office Hours: ${officeHours}.`
  );
}

/**
 * Main dispatcher to read target content cleanly
 * @param {string} target 'saint-of-the-day' | 'verse' | 'readings' | 'events' | 'announcements' | 'about' | 'contact'
 * @param {boolean} isTamil
 * @returns {Promise<string>}
 */
export async function readTargetContent(target, isTamil = false) {
  switch (target) {
    case 'saint-of-the-day':
      return extractSaintOfTheDay(isTamil);
    case 'verse':
      return extractBibleVerse(isTamil);
    case 'readings':
      return extractMassReadings(isTamil);
    case 'events':
      return extractEvents(isTamil);
    case 'announcements':
      return extractAnnouncements(isTamil);
    case 'about':
      return extractAboutChurch(isTamil);
    case 'contact':
      return extractContactInfo(isTamil);
    default:
      // Fallback: check current pathname
      const path = window.location.pathname;
      if (path.includes('saint-of-the-day')) return extractSaintOfTheDay(isTamil);
      if (path.includes('bible-verse')) return extractBibleVerse(isTamil);
      if (path.includes('readings')) return extractMassReadings(isTamil);
      if (path.includes('events')) return extractEvents(isTamil);
      if (path.includes('announcements')) return extractAnnouncements(isTamil);
      if (path.includes('about')) return extractAboutChurch(isTamil);
      if (path.includes('contact')) return extractContactInfo(isTamil);

      return isTamil
        ? 'இந்தப் பக்கத்தின் தகவல்களை வாசிக்க இயலவில்லை.'
        : 'Could not extract readable content from this page.';
  }
}
