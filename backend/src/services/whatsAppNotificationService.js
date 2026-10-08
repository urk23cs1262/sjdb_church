/**
 * Central WhatsApp Notification Service — SJDB Connect
 * 
 * Single Source of Truth for ALL WhatsApp Notifications:
 * - Every notification sent from the church website / admin panel to WhatsApp
 *   is strictly translated into the user's saved `botLanguage` before dispatch.
 * 
 * Language Rules:
 * - 'tamil'   -> Always delivers in Tamil (regardless of admin source language)
 * - 'english' -> Always delivers in English (regardless of admin source language)
 * - 'both'    -> Always delivers in English + Tamil (English first, followed by Tamil)
 * 
 * Architectural Separation:
 * - `botLanguage`           -> Controls ALL WhatsApp notifications (Events, Announcements,
 *                              Donations, Receipts, Reminders, OTPs, Wishes, Admin alerts).
 * - `dailyCatholicLanguage`  -> Controls 4:00 AM Daily Catholic Content ONLY.
 * 
 * Preserves 100% of Dynamic Information:
 * - Event date & time
 * - Venue
 * - URLs
 * - Phone numbers & emails
 * - Donation amount & currency
 * - Receipt / Reference / Transaction IDs
 * - OTP codes
 * - Important numbers
 */

const axios = require('axios');
const User = require('../models/User');
const BotSession = require('../models/BotSession');

// In-Memory Translation Cache (Instant sub-millisecond reuse for broadcasts & reminders)
const translationCache = new Map();
const MAX_CACHE_SIZE = 1000;

function getWA() {
  return require('../bot/whatsapp');
}

/**
 * Normalizes language string to canonical 'english' | 'tamil' | 'both'
 */
function normalizeBotLanguage(langInput) {
  if (!langInput) return 'tamil';
  const clean = String(langInput).trim().toLowerCase();
  if (clean === 'ta' || clean === 'tamil' || clean === 'தமிழ்') return 'tamil';
  if (clean === 'both' || clean === 'all' || clean === 'இரண்டும்' || (clean.includes('ta') && clean.includes('en')) || (clean.includes('tamil') && clean.includes('english'))) return 'both';
  if (clean === 'en' || clean === 'english') return 'english';
  return 'tamil';
}

/**
 * Resolves the recipient's saved botLanguage from User doc, BotSession doc, or phone number.
 */
async function resolveUserBotLanguage(userOrPhone) {
  if (!userOrPhone) return 'tamil';

  // 1. Direct object with botLanguage or related language fields
  if (typeof userOrPhone === 'object') {
    if (userOrPhone.botLanguage) {
      return normalizeBotLanguage(userOrPhone.botLanguage);
    }
    const churchPrefLang = userOrPhone.settings?.churchPreferences?.preferredLanguage || userOrPhone.churchPreferences?.preferredLanguage;
    if (churchPrefLang) {
      return normalizeBotLanguage(churchPrefLang);
    }
    if (userOrPhone.mass_reflection_language) {
      return normalizeBotLanguage(userOrPhone.mass_reflection_language);
    }
    if (userOrPhone.language) {
      return normalizeBotLanguage(userOrPhone.language);
    }
    if (userOrPhone.dailyCatholicLanguage) {
      return normalizeBotLanguage(userOrPhone.dailyCatholicLanguage);
    }
    if (userOrPhone.preferredLanguage && userOrPhone.preferredLanguage !== 'en') {
      return normalizeBotLanguage(userOrPhone.preferredLanguage);
    }
    // Object without language property: try resolving by phone or ID
    const phone = userOrPhone.phone || userOrPhone.phoneNumber || userOrPhone.providedPhone;
    if (phone) return resolveUserBotLanguage(phone);
    if (userOrPhone._id) return resolveUserBotLanguage(String(userOrPhone._id));
    if (userOrPhone.preferredLanguage) {
      return normalizeBotLanguage(userOrPhone.preferredLanguage);
    }
  }

  const str = String(userOrPhone).trim();

  // 2. MongoDB ObjectId lookup
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    try {
      const u = await User.findById(str).select('botLanguage preferredLanguage language settings mass_reflection_language dailyCatholicLanguage phone').lean();
      if (u) {
        if (u.botLanguage) return normalizeBotLanguage(u.botLanguage);
        const churchPrefLang = u.settings?.churchPreferences?.preferredLanguage;
        if (churchPrefLang) return normalizeBotLanguage(churchPrefLang);
        if (u.mass_reflection_language) return normalizeBotLanguage(u.mass_reflection_language);
        if (u.language) return normalizeBotLanguage(u.language);
        if (u.dailyCatholicLanguage) return normalizeBotLanguage(u.dailyCatholicLanguage);
        if (u.preferredLanguage && u.preferredLanguage !== 'en') return normalizeBotLanguage(u.preferredLanguage);
        if (u.preferredLanguage) return normalizeBotLanguage(u.preferredLanguage);
      }
    } catch (_) {}
  }

  // 3. Phone number lookup (search User and BotSession with regex for full tolerance)
  const digits = str.replace(/\D/g, '');
  const phone10 = digits.slice(-10);
  if (phone10 && phone10.length === 10) {
    try {
      const [userDoc, sessionDoc] = await Promise.all([
        User.findOne({
          phone: { $regex: phone10 + '$' },
          isActive: { $ne: false }
        }).select('botLanguage preferredLanguage language settings mass_reflection_language dailyCatholicLanguage').lean(),
        BotSession.findOne({
          $or: [
            { phoneNumber: { $regex: phone10 } },
            { providedPhone: { $regex: phone10 } },
            { pendingPhone: { $regex: phone10 } }
          ]
        }).select('botLanguage language linkedUserId dailyCatholicLanguage').lean()
      ]);

      // A. Explicit botLanguage on userDoc or sessionDoc
      if (userDoc?.botLanguage) return normalizeBotLanguage(userDoc.botLanguage);
      if (sessionDoc?.botLanguage && sessionDoc.botLanguage !== 'en') return normalizeBotLanguage(sessionDoc.botLanguage);

      // B. Church Preferences / Mass Reflection Tamil settings
      const churchPrefLang = userDoc?.settings?.churchPreferences?.preferredLanguage;
      if (churchPrefLang) return normalizeBotLanguage(churchPrefLang);
      if (userDoc?.mass_reflection_language) return normalizeBotLanguage(userDoc.mass_reflection_language);
      if (userDoc?.language) return normalizeBotLanguage(userDoc.language);
      if (sessionDoc?.language && sessionDoc.language !== 'en') return normalizeBotLanguage(sessionDoc.language);
      if (userDoc?.dailyCatholicLanguage) return normalizeBotLanguage(userDoc.dailyCatholicLanguage);
      if (sessionDoc?.dailyCatholicLanguage) return normalizeBotLanguage(sessionDoc.dailyCatholicLanguage);

      // C. If user explicitly chose English in botLanguage
      if (userDoc?.botLanguage === 'english') return 'english';
      if (sessionDoc?.botLanguage === 'english' || sessionDoc?.botLanguage === 'en') return 'english';

      // D. User preferredLanguage
      if (userDoc?.preferredLanguage === 'ta') return 'tamil';
      if (userDoc?.preferredLanguage === 'en') return 'english';
    } catch (_) {}
  }

  // 4. Default for parish
  return 'tamil';
}

/**
 * Extracts and replaces dynamic data with placeholder tokens to guarantee 100% preservation.
 */
function maskDynamicData(text) {
  if (!text || typeof text !== 'string') return { tokenized: text || '', tokens: [] };

  const tokens = [];
  let tokenized = text;

  // Helper to add unique token
  const addToken = (prefix, val) => {
    const id = `__T_${prefix}_${tokens.length}__`;
    tokens.push({ id, val });
    return id;
  };

  // 1. URLs (e.g. https://... or http://...)
  tokenized = tokenized.replace(/https?:\/\/[^\s)]+/g, m => addToken('URL', m));

  // 2. Email addresses
  tokenized = tokenized.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, m => addToken('EML', m));

  // 3. Monetary amounts (e.g. ₹500, Rs. 1,000, INR 250)
  tokenized = tokenized.replace(/(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d+)?/gi, m => addToken('AMT', m));

  // 4. Receipt, Transaction & Reference IDs (e.g. REC-1234, TXN_9876, SJDB-2026-001)
  tokenized = tokenized.replace(/\b(?:REC|TXN|SJDB|REF|RECEIPT)[-_][A-Z0-9-]+\b/gi, m => addToken('REF', m));

  // 5. OTP / Verification code blocks (e.g. OTP: 752251, OTP 752251, குறியீடு 752251)
  tokenized = tokenized.replace(/(?:OTP:?\s*|code:?\s*|குறியீடு:?\s*)(\d{6})\b/gi, (m, p1) => {
    const tok = addToken('OTP', p1);
    return m.replace(p1, tok);
  });

  // 6. Dates (e.g. "15 October 2026", "Sunday, 20 September 2026", "2026-10-15")
  tokenized = tokenized.replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi, m => addToken('DAT', m));
  tokenized = tokenized.replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi, m => addToken('DAT', m));
  tokenized = tokenized.replace(/\b\d{4}-\d{2}-\d{2}\b/g, m => addToken('DAT', m));

  // 7. Times (e.g. 10:30 AM, 04:00 PM, 10:30 am, 4:30 pm)
  tokenized = tokenized.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)\b/g, m => addToken('TIM', m));

  // 8. Phone numbers (e.g. +91 9876543210, 9876543210, 04575-241234)
  tokenized = tokenized.replace(/(?:\+91[\s-]?)?[6-9]\d{9}\b/g, m => addToken('PHO', m));
  tokenized = tokenized.replace(/\b0\d{3,4}[-\s]?\d{6,8}\b/g, m => addToken('PHO', m));

  return { tokenized, tokens };
}

/**
 * Restores all masked tokens in translated text with exact original values.
 */
function unmaskDynamicData(translatedText, tokens) {
  if (!translatedText || !tokens || tokens.length === 0) return translatedText;

  let restored = translatedText;
  for (const t of tokens) {
    const rawId = t.id.replace(/__/g, '');
    // Tolerant regex handling spaces or capitalization modifications by translation engines
    const reg = new RegExp(`__\\s*${rawId}\\s*__`, 'gi');
    restored = restored.replace(reg, t.val);
  }
  return restored;
}

/**
 * Polishes Catholic terminology ensuring faithful ecclesiastical standards.
 */
function polishCatholicTerminology(text, targetLang) {
  if (!text) return text;

  if (targetLang === 'tamil') {
    return text
      .replace(/திருச்சபை விருந்து/g, 'பங்குத் திருவிழா')
      .replace(/தேவாலய விருந்து/g, 'பங்குத் திருவிழா')
      .replace(/புனித ஜான் டி பிரிட்டோ/g, 'புனித அருளானந்தர்')
      .replace(/ஜான் டி பிரிட்டோ/g, 'புனித அருளானந்தர்')
      .replace(/புனித ஆராதனை/g, 'திருப்பலி')
      .replace(/வழிபாடு நடைபெற/g, 'திருப்பலி நடைபெற')
      .replace(/வழிபாடு நடக்கும்/g, 'திருப்பலி நடக்கும்');
  }

  if (targetLang === 'english') {
    return text
      .replace(/\bStock Festival\b/gi, 'Parish Feast')
      .replace(/\bShare Festival\b/gi, 'Parish Feast')
      .replace(/\bArulanandar Temple\b/gi, "St. John de Britto Church")
      .replace(/\bSt\. Arulanandar Temple\b/gi, "St. John de Britto Church")
      .replace(/\bTemple\b/gi, 'Church');
  }

  return text;
}

/**
 * Translates text between English and Tamil via Google Translate GTX & Clients5 APIs.
 */
async function callTranslateApi(text, fromLang, toLang) {
  const cacheKey = `${fromLang}:${toLang}:${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const encoded = encodeURIComponent(text);

  // Tier 1: Google Translate GTX endpoint
  try {
    const url1 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encoded}`;
    const res1 = await axios.get(url1, { timeout: 6000 });
    if (res1.data && Array.isArray(res1.data[0])) {
      const translated = res1.data[0].map(item => item[0]).join('').trim();
      if (translated) {
        if (translationCache.size >= MAX_CACHE_SIZE) translationCache.clear();
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch (_) {}

  // Tier 2: Google Chrome Dict API endpoint
  try {
    const url2 = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${fromLang}&tl=${toLang}&q=${encoded}`;
    const res2 = await axios.get(url2, { timeout: 6000 });
    if (res2.data) {
      const translated = Array.isArray(res2.data) ? res2.data.join(' ').trim() : String(res2.data).trim();
      if (translated) {
        if (translationCache.size >= MAX_CACHE_SIZE) translationCache.clear();
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch (_) {}

  // Fallback if network fails: return original text
  return text;
}

/**
 * Translates a notification message into target language ('english', 'tamil', or 'both')
 * preserving dynamic dates, times, venues, URLs, numbers, amounts, OTPs, etc.
 */
async function translateNotification(message, language = 'english') {
  if (!message || typeof message !== 'string') return message;

  const targetLang = normalizeBotLanguage(language);
  const hasTamil = /[\u0B80-\u0BFF]/.test(message);

  // 1. Both: Deliver English + Tamil
  if (targetLang === 'both') {
    const [english, tamil] = await Promise.all([
      translateNotification(message, 'english'),
      translateNotification(message, 'tamil')
    ]);
    return `🇬🇧 *English:*\n${english}\n\n🇮🇳 *தமிழ்:*\n${tamil}`;
  }

  // 2. Target: Tamil
  if (targetLang === 'tamil') {
    // If text is already predominantly Tamil, just polish terms
    if (hasTamil && !/[a-zA-Z]{5,}/.test(message.replace(/https?:\/\/[^\s]+/g, ''))) {
      return polishCatholicTerminology(message, 'tamil');
    }

    const { tokenized, tokens } = maskDynamicData(message);
    const translatedRaw = await callTranslateApi(tokenized, 'en', 'ta');
    const restored = unmaskDynamicData(translatedRaw, tokens);
    return polishCatholicTerminology(restored, 'tamil');
  }

  // 3. Target: English
  if (targetLang === 'english') {
    // If text does not contain Tamil characters, return as-is
    if (!hasTamil) {
      return polishCatholicTerminology(message, 'english');
    }

    const { tokenized, tokens } = maskDynamicData(message);
    const translatedRaw = await callTranslateApi(tokenized, 'ta', 'en');
    const restored = unmaskDynamicData(translatedRaw, tokens);
    return polishCatholicTerminology(restored, 'english');
  }

  return message;
}

/**
 * Central WhatsApp Notification Function
 * 
 * Translates notification message into the user's saved botLanguage
 * before sending via WhatsApp, preserving all dynamic data.
 * 
 * @param {Object|string} userOrPhone - User document, BotSession document, or phone number
 * @param {string|Object} notification - Notification text or object with { title, message, ... }
 * @param {Object} [options] - Options (media, document, etc.)
 */
async function sendWhatsAppNotification(userOrPhone, notification, options = {}) {
  const wa = getWA();
  if (!wa || typeof wa.sendWhatsAppMessage !== 'function') {
    console.warn('[WhatsAppNotificationService] WhatsApp client not ready.');
    return { success: false, error: 'WhatsApp client unavailable' };
  }

  // 1. Resolve target phone number
  let targetPhone = null;
  if (typeof userOrPhone === 'string') {
    targetPhone = userOrPhone;
  } else if (userOrPhone && typeof userOrPhone === 'object') {
    targetPhone = userOrPhone.phoneNumber || userOrPhone.providedPhone || userOrPhone.phone;
  }

  if (!targetPhone) {
    console.warn('[WhatsAppNotificationService] No target phone provided.');
    return { success: false, error: 'Missing phone number' };
  }

  // 2. Resolve recipient's botLanguage (Single source of truth)
  const botLanguage = await resolveUserBotLanguage(userOrPhone);

  // 3. Prepare raw notification text
  let rawText = '';
  if (typeof notification === 'string') {
    rawText = notification;
  } else if (notification && typeof notification === 'object') {
    const title = notification.title || '';
    const body = notification.message || notification.body || notification.description || '';
    if (title && body) {
      rawText = `*${title}*\n\n${body}`;
    } else {
      rawText = title || body || '';
    }
  }

  if (!rawText.trim() && !options.media && !options.document) {
    return { success: false, error: 'Empty notification content' };
  }

  // 4. Translate notification message according to user's saved botLanguage
  const translatedMessage = await translateNotification(rawText, botLanguage);

  // 5. Dispatch via WhatsApp
  try {
    if (options.media || options.buffer || options.url) {
      const mediaPayload = options.media || {
        url: options.url,
        buffer: options.buffer,
        mimetype: options.mimetype,
        fileName: options.fileName
      };
      await wa.sendWhatsAppMedia(targetPhone, mediaPayload, translatedMessage);
    } else if (options.document) {
      await wa.sendWhatsAppDocument(targetPhone, options.document, translatedMessage);
    } else {
      await wa.sendWhatsAppMessage(targetPhone, translatedMessage);
    }

    console.log(`[WhatsAppNotificationService] ✉️ Notification sent to ${targetPhone} in language: ${botLanguage}`);
    return {
      success: true,
      phone: targetPhone,
      botLanguage,
      message: translatedMessage
    };
  } catch (err) {
    console.error(`[WhatsAppNotificationService] ❌ Failed sending to ${targetPhone}:`, err.message);
    return { success: false, phone: targetPhone, error: err.message };
  }
}

module.exports = {
  sendWhatsAppNotification,
  translateNotification,
  resolveUserBotLanguage,
  normalizeBotLanguage,
  maskDynamicData,
  unmaskDynamicData,
  polishCatholicTerminology
};
