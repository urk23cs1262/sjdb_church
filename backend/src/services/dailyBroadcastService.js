/**
 * Daily Broadcast Service — SJDB Connect
 * Runs at 6:00 AM IST every day via node-cron
 * 
 * Sends personalized WhatsApp messages to opted-in users based on their preferences:
 * - Saint of the Day
 * - Daily Bible Verse (English/Tamil/Both)
 * - Daily Mass Readings link
 * - Church branding
 */
const cron = require('node-cron');
const User = require('../models/User');
const { getDailySaint } = require('./saintService');
const { fetchDailyVerse } = require('./bibleVerseService');
// Lazy-load Baileys to avoid load-order issues
function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text);
}

const CLIENT_URL = process.env.CLIENT_URL || 'https://st-jb-church.vercel.app';

// ─── Message Formatters ────────────────────────────────────────────────────

function formatSaintMessage(saint, lang) {
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return ` *Saint of the Day*
 ${dateStr}

 *${saint.name}*
 Feast Day: ${saint.feastDay || dateStr}

${saint.description || ''}

 ${saint.link || CLIENT_URL}

 _SJDB Connect — Connecting Faith & Community_`;
}

function formatVerseMessage(verse, lang) {
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  let text = ` *Daily Bible Verse*\n ${dateStr}\n\n`;

  const enText = verse.verseTextEn || verse.english || '';
  const taText = verse.verseTextTa || verse.tamil || enText;
  const refText = verse.verseRef || verse.ref || verse.reference || '';

  if (lang === 'en' || lang === 'both') {
    text += `_"${enText}"_\n— *${refText}*\n\n`;
  }
  if (lang === 'ta' || lang === 'both') {
    text += ` *தினசரி வேத வாக்கியம்*\n_"${taText}"_\n— *${refText}*\n\n`;
  }

  text += ` _SJDB Connect — Connecting Faith & Community_`;
  return text;
}

function formatMassReadingMessage(lang) {
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  return ` *Daily Mass Readings*
 ${dateStr}

 Read today's complete mass readings on our website:
 ${CLIENT_URL}/bible-verse

 May this day bring you closer to God.

 _SJDB Connect — St. John de Britto's Church_`;
}

function formatBirthdayMessage(user) {
  return ` *Happy Birthday, ${user.name}!* 

 *"May the Lord bless you and keep you;
May the Lord make his face shine on you
and be gracious to you."*
— Numbers 6:24-25

May God fill your life with joy, peace, and abundant blessings today and always!

With love & prayers,
 *St. John de Britto's Church*
 _SJDB Connect — Connecting Faith & Community_`;
}

// ─── Send to All Opted-in Users ─────────────────────────────────────────────

async function runDailyBroadcast() {
  console.log(' Starting daily broadcast at 6:00 AM IST...');
  try {
    const saint = getDailySaint();
    const verse = await fetchDailyVerse();

    // Get all website users with phone numbers + all active BotSession subscribers
    const BotSession = require('../models/BotSession');

    const dbUsers = await User.find({
      whatsappOptIn: { $ne: false },
      isActive: { $ne: false },
      phone: { $exists: true, $ne: '' }
    }).lean();

    const dbSessions = await BotSession.find({ step: 'done' }).lean();

    const subscriberMap = new Map();

    dbUsers.forEach(u => {
      const p = u.phone ? u.phone.trim() : '';
      const cleanP = p.replace(/\D/g, '');
      if (cleanP) {
        subscriberMap.set(cleanP, {
          name: u.name,
          phone: p,
          lang: u.preferredLanguage || 'en',
          prefs: u.botPreferences?.length ? u.botPreferences : ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday']
        });
      }
    });

    dbSessions.forEach(s => {
      const jidKey = s.phoneNumber ? s.phoneNumber.trim() : '';
      const cleanP = jidKey.replace(/\D/g, '');
      if (jidKey) {
        const mapKey = jidKey.includes('@lid') ? jidKey : (cleanP || jidKey);
        const existing = subscriberMap.get(cleanP) || subscriberMap.get(mapKey);
        subscriberMap.set(mapKey, {
          name: existing?.name || 'WhatsApp Member',
          phone: jidKey, // Preserve @lid so sendWhatsAppMessage routes correctly
          lang: s.language || 'en',
          prefs: s.preferences?.length ? s.preferences : ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday']
        });
      }
    });


    const subscribers = Array.from(subscriberMap.values());
    console.log(` Broadcasting to ${subscribers.length} total subscribers (website + WhatsApp)...`);

    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      const prefs = sub.prefs;
      const lang = sub.lang;
      const phone = sub.phone;

      // Add a small delay between messages to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));

      try {
        // Saint of the Day
        if (prefs.includes('saint') && saint) {
          await sendWA(phone, formatSaintMessage(saint, lang));
          await new Promise(r => setTimeout(r, 300));
        }

        // Bible Verse
        if (prefs.includes('verse') && verse) {
          await sendWA(phone, formatVerseMessage(verse, lang));
          await new Promise(r => setTimeout(r, 300));
        }

        // Mass Readings
        if (prefs.includes('mass')) {
          await sendWA(phone, formatMassReadingMessage(lang));
          await new Promise(r => setTimeout(r, 300));
        }

        sent++;
      } catch (err) {
        console.error(` Failed to send to ${user.name} (${phone}):`, err.message);
        failed++;
      }
    }

    console.log(` Daily broadcast complete: ${sent} sent, ${failed} failed`);
  } catch (err) {
    console.error(' Daily broadcast error:', err.message);
  }
}

// ─── Birthday Wishes via WhatsApp ────────────────────────────────────────────

async function runWhatsAppBirthdayWishes() {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const birthdayUsers = await User.find({
      whatsappOptIn: { $ne: false },
      isActive: { $ne: false },
      phone: { $exists: true, $ne: '' },
      $expr: {
        $and: [
          { $eq: [{ $month: '$dob' }, month] },
          { $eq: [{ $dayOfMonth: '$dob' }, day] }
        ]
      }
    });

    for (const user of birthdayUsers) {
      const phone = user.phone?.replace(/\D/g, '');
      if (!phone) continue;
      try {
        await sendWA(phone, formatBirthdayMessage(user));
        console.log(` Birthday WhatsApp sent to ${user.name}`);
      } catch (err) {
        console.error(` Birthday WhatsApp failed for ${user.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error(' WhatsApp Birthday Service Error:', err.message);
  }
}

// ─── Manual Trigger (for admin API) ─────────────────────────────────────────

async function triggerBroadcastNow() {
  return runDailyBroadcast();
}

// ─── Cron Jobs ────────────────────────────────────────────────────────────────

// 5:00 AM IST daily broadcast (Daily Verses, Saint of the Day, Mass Readings, Spiritual Content)
cron.schedule('0 5 * * *', () => {
  console.log(' 5:00 AM IST — Running daily spiritual content broadcast from WhatsApp bot...');
  runDailyBroadcast();
}, { timezone: 'Asia/Kolkata' });

// Midnight birthday wishes
cron.schedule('0 0 * * *', () => {
  console.log(' Midnight IST — Running WhatsApp birthday wishes...');
  runWhatsAppBirthdayWishes();
}, { timezone: 'Asia/Kolkata' });

module.exports = { runDailyBroadcast, triggerBroadcastNow, runWhatsAppBirthdayWishes };
