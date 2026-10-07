/**
 * Canonical Content & Notification Service for SJDB Connect
 * 
 * CORE PRINCIPLE: The Church Website is the Single Source of Truth.
 * WhatsApp, Email, Push notifications, and Web pages consume the EXACT same
 * canonical content objects, descriptions, images, memorial titles, and source URLs.
 * 
 * Channels:
 * Database / Canonical Content -> Canonical Content Service -> Website | WhatsApp | Email | Push
 */

const path = require('path');
const fs = require('fs');
const { getDailySaint, fetchDailySaint, loadCachedSaint, getISTDateParts } = require('./saintService');
const { cleanSaintName } = require('./saintImageResolver');
const { SITE_ROUTES, getSiteUrl, getBaseClientUrl } = require('../config/siteRoutes');
const SiteSettings = require('../models/SiteSettings');
const Announcement = require('../models/Announcement');
const Event = require('../models/Event');
const { normalizeContentLanguage } = require('../utils/userLanguageHelper');

// ─── 1. CANONICAL SAINT OF THE DAY ──────────────────────────────────────────

/**
 * Normalizes and returns the canonical Saint of the Day object matching the website 1:1.
 */
async function getCanonicalSaint(targetDate = new Date()) {
  const { dateKey, dt } = getISTDateParts(targetDate);
  const isToday = dateKey === getISTDateParts().dateKey;

  // 1. Ensure memory holds fresh sync
  let saint = getDailySaint(targetDate);
  const needsDBSync = !saint || saint.date !== dateKey || !saint.description || saint.description.length < 200 || !saint.primarySaint;

  if (needsDBSync) {
    if (typeof loadCachedSaint === 'function') {
      try {
        await loadCachedSaint();
        saint = getDailySaint(targetDate);
      } catch (err) {
        console.warn('[CanonicalContentService] loadCachedSaint notice:', err.message);
      }
    }
  }

  // If still missing or stale, fetch directly
  if (!saint || saint.date !== dateKey || !saint.description || saint.description.length < 200) {
    try {
      saint = await fetchDailySaint(targetDate, false);
    } catch (err) {
      console.warn('[CanonicalContentService] fetchDailySaint fallback notice:', err.message);
      saint = getDailySaint(targetDate);
    }
  }

  if (!saint) {
    saint = getDailySaint(targetDate) || {};
  }

  // 2. Format Dates in English and Tamil (Asia/Kolkata)
  const feastDayEn = saint.feastDay || dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  const monthsTa = [
    'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
    'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'
  ];
  const dayNum = dt.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'Asia/Kolkata' });
  const monthIdx = parseInt(dt.toLocaleDateString('en-US', { month: 'numeric', timeZone: 'Asia/Kolkata' }), 10) - 1;
  const yearNum = dt.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'Asia/Kolkata' });
  const feastDayTa = saint.feastDayTa || `${dayNum} ${monthsTa[monthIdx] || ''} ${yearNum}`.trim();

  // 3. Clean and normalize Saint Names
  const rawNameEn = saint.nameEn || saint.englishName || saint.saintName || saint.name || 'Saint of the Day';
  const nameEn = cleanSaintName(rawNameEn);

  let nameTa = saint.nameTa || saint.tamilName;
  if (!nameTa || nameTa.trim() === 'இன்றைய புனிதர்' || nameTa.trim() === 'புனிதர்') {
    nameTa = saint.primarySaint?.nameTa || saint.primarySaint?.tamilName || nameEn;
  }

  // 4. Celebration & Memorial Titles
  const celebrationType = saint.celebrationType || saint.feastType || saint.primaryCelebration?.type || saint.primarySaint?.celebrationType || 'Memorial';
  let celebrationTypeTa = saint.celebrationTypeTa || saint.feastTypeTa;
  if (!celebrationTypeTa) {
    const lowerType = String(celebrationType).toLowerCase();
    if (lowerType.includes('memorial')) celebrationTypeTa = 'நினைவுநாள்';
    else if (lowerType.includes('solemnity')) celebrationTypeTa = 'பெருவிழா';
    else if (lowerType.includes('patron')) celebrationTypeTa = 'ஆலய பாதுகாவலர் பெருவிழா';
    else celebrationTypeTa = 'திருவிழா';
  }

  const feastTitle = saint.feastTitle || saint.titleEn || saint.primarySaint?.title || saint.primarySaint?.feastName || nameEn;
  const feastTitleTa = saint.feastTitleTa || saint.titleTa || saint.primarySaint?.titleTa || nameTa;

  // 5. Authentic Biography / Description (verbatim as displayed on the website)
  const descriptionEn = (saint.descriptionEn || saint.description || saint.primarySaint?.description || '').trim();
  let descriptionTa = (saint.descriptionTa || saint.primarySaint?.descriptionTa || '').trim();
  if (!descriptionTa || !/[\u0B80-\u0BFF]/.test(descriptionTa)) {
    descriptionTa = 'இன்றைய புனிதரின் வாழ்க்கை வரலாறு மற்றும் அருளுரைகள் எமது ஆலய இணையதளத்தில் வாசிக்கலாம். இறைவனின் ஆசீரும் புனிதரின் பரிந்துரையும் நம்மோடு இருப்பதாக.';
  }

  // 6. Authentic Image and Source URL
  const image = saint.image || saint.imageUrl || saint.remoteUrl || saint.primaryCelebration?.image || saint.primarySaint?.image || null;
  const source = saint.source || (saint.sourceUrl?.includes('wikipedia') ? 'Wikipedia' : 'Vatican News');
  const sourceUrl = saint.primaryCelebration?.sourceUrl || saint.primarySaint?.sourceUrl || saint.sourceUrl || saint.link || 'https://www.vaticannews.va/en/saints.html';

  // 7. Other Saints Commemorated Today
  const rawOtherSaints = saint.otherSaints || [];
  const otherSaints = rawOtherSaints.map(os => ({
    name: cleanSaintName(os.name || os.englishName || os.title),
    nameEn: cleanSaintName(os.englishName || os.name || os.title),
    nameTa: os.nameTa || os.tamilName || cleanSaintName(os.name || os.title),
    celebrationType: os.celebrationType || os.type || 'Saint',
    description: os.description || '',
    image: os.image || null,
    sourceUrl: os.sourceUrl || os.detailUrl || sourceUrl
  }));

  const websiteUrl = getSiteUrl(SITE_ROUTES.SAINT_OF_THE_DAY);

  return {
    date: dateKey,
    name: nameEn,
    nameEn,
    nameTa,
    englishName: nameEn,
    tamilName: nameTa,
    saintName: nameEn,
    feastDay: feastDayEn,
    feastDayEn,
    feastDayTa,
    celebrationType,
    celebrationTypeTa,
    feastTitle,
    feastTitleTa,
    description: descriptionEn,
    descriptionEn,
    descriptionTa,
    image,
    imageUrl: image,
    imageSource: saint.imageSource || (source.toLowerCase().includes('vatican') ? 'vatican' : 'wikipedia'),
    imageSourceUrl: saint.imageSourceUrl || sourceUrl,
    imageFallback: Boolean(saint.imageFallback),
    source,
    sourceUrl,
    link: sourceUrl,
    otherSaints,
    websiteUrl,
    raw: saint
  };
}

/**
 * Formats Saint of the Day into the canonical WhatsApp message template.
 * Uses the EXACT same presentation logic, wording, ordering, and source links as the website.
 */
function formatCanonicalSaintWhatsApp({ saint, language = 'ta' }) {
  const lang = normalizeContentLanguage(language);
  const s = saint;

  const otherSaintsList = s.otherSaints || [];

  // ── 1. ENGLISH ONLY ────────────────────────────────────────────────────────
  if (lang === 'en') {
    let msg = `✨ *Today's Saint*\n\n`;
    msg += `👑 *${s.nameEn}*\n`;
    if (s.celebrationType && s.celebrationType !== 'Saint') {
      msg += `🎉 *${s.celebrationType}*\n`;
    }
    msg += `📅 *${s.feastDayEn}*\n\n`;

    msg += `📖 *About the Saint:*\n`;
    msg += `${s.descriptionEn}\n\n`;

    if (otherSaintsList.length > 0) {
      msg += `🕊️ *Other Saints Commemorated Today:*\n`;
      otherSaintsList.forEach(os => {
        msg += `• *${os.nameEn}*${os.celebrationType && os.celebrationType !== 'Saint' ? ` (${os.celebrationType})` : ''}\n`;
      });
      msg += `\n`;
    }

    msg += `🌐 *Source:* ${s.source}\n${s.sourceUrl}\n\n`;
    msg += `🌐 *Read on Church Website:*\n${s.websiteUrl}\n\n`;
    msg += `— *St. John de Britto Church, Kalayarkoil*\n_SJDB Connect_`;

    return msg.trim();
  }

  // ── 2. BILINGUAL (TAMIL + ENGLISH) ─────────────────────────────────────────
  if (lang === 'both') {
    let msg = `✨ *Today's Saint / இன்றைய புனிதர்*\n\n`;

    msg += `👑 *${s.nameEn}*\n`;
    msg += `👑 *${s.nameTa}*\n`;
    if (s.celebrationType && s.celebrationTypeTa) {
      msg += `🎉 *${s.celebrationType} / ${s.celebrationTypeTa}*\n`;
    } else if (s.celebrationType) {
      msg += `🎉 *${s.celebrationType}*\n`;
    }
    msg += `📅 *${s.feastDayEn}* / *${s.feastDayTa}*\n\n`;

    msg += `🇬🇧 *About the Saint (English):*\n`;
    msg += `${s.descriptionEn}\n\n`;

    msg += `🇮🇳 *புனிதரைப் பற்றி (தமிழ்):*\n`;
    msg += `${s.descriptionTa}\n\n`;

    if (otherSaintsList.length > 0) {
      msg += `🕊️ *Other Saints / பிற புனிதர்கள்:*\n`;
      otherSaintsList.forEach(os => {
        msg += `• *${os.nameEn}* / *${os.nameTa}*\n`;
      });
      msg += `\n`;
    }

    msg += `🌐 *Source / தகவல் மூலம்:* ${s.source}\n${s.sourceUrl}\n\n`;
    msg += `🌐 *View on Church Website / இணையதளம்:*\n${s.websiteUrl}\n\n`;
    msg += `— *St. John de Britto Church, Kalayarkoil*\n_புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்_\n_SJDB Connect_`;

    return msg.trim();
  }

  // ── 3. TAMIL ONLY (Strict default) ─────────────────────────────────────────
  let msg = `✨ *இன்றைய புனிதர்*\n\n`;
  msg += `👑 *${s.nameTa}*\n`;
  if (s.celebrationTypeTa) {
    msg += `🎉 *${s.celebrationTypeTa}*\n`;
  }
  msg += `📅 *திருவிழா நாள்:* ${s.feastDayTa}\n\n`;

  msg += `📖 *புனிதரைப் பற்றி:*\n`;
  msg += `${s.descriptionTa}\n\n`;

  if (otherSaintsList.length > 0) {
    msg += `🕊️ *இன்று நினைவுகூரப்படும் பிற புனிதர்கள்:*\n`;
    otherSaintsList.forEach(os => {
      msg += `• *${os.nameTa || os.nameEn}*${os.celebrationType && os.celebrationType !== 'Saint' ? ` (${os.celebrationType})` : ''}\n`;
    });
    msg += `\n`;
  }

  msg += `🌐 *தகவல் மூலம்:* ${s.source}\n${s.sourceUrl}\n\n`;
  msg += `🌐 *ஆலய இணையதளத்தில் வாசிக்க:*\n${s.websiteUrl}\n\n`;
  msg += `— *புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்*\n_SJDB Connect_`;

  return msg.trim();
}

/**
 * Builds the WhatsApp media payload for Saint of the Day portrait.
 */
function getCanonicalSaintImagePayload({ saint, language = 'ta' }) {
  if (!saint) return null;
  const lang = normalizeContentLanguage(language);
  const imageUrl = saint.image || saint.imageUrl || saint.remoteUrl;
  if (!imageUrl) return null;

  let caption = '';
  if (lang === 'en') {
    caption = `✨ *Today's Saint:* ${saint.nameEn} (${saint.feastDayEn})`;
  } else if (lang === 'both') {
    caption = `✨ *Today's Saint:* ${saint.nameEn} / ${saint.nameTa} (${saint.feastDayEn})`;
  } else {
    caption = `✨ *இன்றைய புனிதர்:* ${saint.nameTa} (${saint.feastDayTa})`;
  }

  // Check if a local file exists for direct buffer delivery
  let buffer = null;
  const localCandidates = [saint.raw?.localPath, saint.raw?.localUrl].filter(Boolean);
  for (const c of localCandidates) {
    let p = c;
    if (typeof c === 'string' && c.startsWith('/uploads/')) {
      p = path.join(__dirname, '../../', c);
    }
    if (fs.existsSync(p)) {
      try {
        buffer = fs.readFileSync(p);
        break;
      } catch (e) {}
    }
  }

  return {
    url: imageUrl,
    caption,
    buffer,
    mimetype: 'image/jpeg',
    filename: 'saint_of_the_day.jpg'
  };
}

// ─── 2. CANONICAL DAILY CATHOLIC CONTENT PACKAGE ────────────────────────────

/**
 * Aggregates complete canonical daily spiritual package (Verse, Readings, Reflection, Saint).
 */
async function getCanonicalDailyCatholicContent(targetDate = new Date()) {
  const { getTodayDailyContent } = require('./dailyContentService');
  const baseContent = await getTodayDailyContent(targetDate);
  const canonicalSaint = await getCanonicalSaint(targetDate);

  // Bind canonical saint directly into dailyContent package
  baseContent.saint = canonicalSaint;
  baseContent.saintName = canonicalSaint.nameEn;
  baseContent.saintNameTa = canonicalSaint.nameTa;
  baseContent.saintDescription = canonicalSaint.descriptionEn;
  baseContent.saintDescriptionTa = canonicalSaint.descriptionTa;
  baseContent.saintImage = canonicalSaint.image;
  baseContent.saintFeastDay = canonicalSaint.feastDayEn;
  baseContent.saintFeastDayTa = canonicalSaint.feastDayTa;
  baseContent.celebrationType = canonicalSaint.celebrationType;
  baseContent.celebrationTypeTa = canonicalSaint.celebrationTypeTa;
  baseContent.otherSaints = canonicalSaint.otherSaints;

  return baseContent;
}

// ─── 3. CANONICAL ANNOUNCEMENTS ─────────────────────────────────────────────

/**
 * Retrieves the fresh, authoritative announcement record from MongoDB.
 * Enforces universal expiration rules: if expired, marks as 'expired' and returns expired status.
 */
async function getCanonicalAnnouncement(announcementId) {
  if (!announcementId) return null;
  const ann = await Announcement.findById(announcementId);
  if (!ann) return null;

  const now = new Date();

  // Automatic expiration transition
  if (ann.expiresAt && new Date(ann.expiresAt) <= now) {
    if (ann.status !== 'expired') {
      ann.status = 'expired';
      ann.reminderStatus = 'expired';
      await ann.save().catch(() => {});
    }
    return { ...ann.toObject(), isExpired: true };
  }

  if (ann.status === 'unpublished' || ann.status === 'deleted' || ann.isPublished === false) {
    return { ...ann.toObject(), isInactive: true };
  }

  return ann;
}

/**
 * Formats an Announcement into the exact WhatsApp message template.
 */
function formatCanonicalAnnouncement({ announcement, language = 'both' }) {
  const cleanTitle = (announcement.title || 'Parish Announcement').trim();
  let content = (announcement.content || announcement.description || '').trim();

  const expiryFormatted = announcement.expiresAt ? new Date(announcement.expiresAt).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : 'Valid until further notice';

  const category = (announcement.type || 'GENERAL').toUpperCase();
  const priority = (announcement.priority || 'NORMAL').toUpperCase();
  const announcementsUrl = `${getBaseClientUrl()}/announcements`;

  return `📢 *PARISH ANNOUNCEMENT*
⛪ *St. John de Britto Church, Kalayarkoil*

*${cleanTitle}*
📌 *Category:* ${category}
⚡ *Priority:* ${priority}
⏰ *Valid Until:* ${expiryFormatted}

${content}

🔗 *View Announcements on Church Website:*
${announcementsUrl}

— *புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்*
_SJDB Connect_`.trim();
}

// ─── 4. CANONICAL EVENTS ────────────────────────────────────────────────────

/**
 * Retrieves the fresh event document from MongoDB.
 */
async function getCanonicalEvent(eventId) {
  if (!eventId) return null;
  const event = await Event.findById(eventId);
  if (!event) return null;

  if (event.status === 'cancelled' || event.status === 'deleted') {
    return { ...event.toObject(), isCancelled: true };
  }

  return event;
}

/**
 * Formats an Event into the exact WhatsApp message template.
 */
function formatCanonicalEvent({ event, language = 'both' }) {
  const cleanTitle = (event.title || 'Parish Event').trim();
  const desc = (event.description || '').trim();

  const dateFormatted = event.date ? new Date(event.date).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : '';

  const timeVal = (event.time || event.startTime || '').trim();
  const venueVal = (event.venue || event.location || '').trim();
  const organizerVal = (event.organizer || '').trim();

  const isRegRequired = event.registrationRequired === true ||
    event.registrationRequired === 'true' ||
    event.requiresRegistration === true ||
    event.requiresRegistration === 'true';

  const infoLines = [];
  if (dateFormatted) infoLines.push(`📅 *Date:* ${dateFormatted}`);
  if (timeVal) infoLines.push(`🕕 *Time:* ${timeVal}`);
  if (venueVal) infoLines.push(`📍 *Venue:* ${venueVal}`);
  if (organizerVal) infoLines.push(`👤 *Organizer:* ${organizerVal}`);

  const infoSection = infoLines.join('\n');
  const regMessage = isRegRequired
    ? `All parishioners and families are encouraged to participate.\n📝 *Registration is required.*`
    : `All parishioners and families are warmly welcome to participate.`;

  const eventsUrl = `${getBaseClientUrl()}/events`;

  return `📅 *PARISH EVENT*
⛪ *St. John de Britto Church, Kalayarkoil*

*${cleanTitle}*

${infoSection ? `${infoSection}\n\n` : ''}${desc}

${regMessage}

🔗 *View Events & Register Online:*
${eventsUrl}

— *புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்*
_SJDB Connect_`.trim();
}

module.exports = {
  getCanonicalSaint,
  getCanonicalSaintOfTheDay: getCanonicalSaint,
  formatCanonicalSaintWhatsApp,
  getCanonicalSaintImagePayload,
  getCanonicalDailyCatholicContent,
  getCanonicalAnnouncement,
  formatCanonicalAnnouncement,
  getCanonicalEvent,
  formatCanonicalEvent
};
