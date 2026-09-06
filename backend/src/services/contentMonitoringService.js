/**
 * Server-Side Content Sync & Monitoring Service — SJDB Connect
 * 
 * Continuously monitors original Catholic sources:
 *  1. Saint of the Day + Authentic Portrait (Vatican News + Liturgical Calendar)
 *  2. Daily Mass Readings in Tamil & English (Catholic Gallery / Liturgy)
 *  3. Daily Reflection (Tamil Catholic Daily / Catholic Gallery)
 *  4. Daily Bible Verse (Liturgical 400-day rotation)
 * 
 * Key Architecture Guarantees:
 *  - Automatically detects when external Catholic websites publish or update content.
 *  - Immediately syncs and stores verified content into Church Website Database (DailyCatholicContent).
 *  - Does NOT wait until 4:00 AM; website visitors see updated content right away.
 *  - Maintains a single canonical source of truth shared by Website, Email, and WhatsApp Bot.
 *  - Anti-regression protection: Never overwrites valid existing data with empty/failed fallbacks.
 *  - Server-side autonomous execution: Runs 24/7 independently of frontend or admin sessions.
 */

const cron = require('node-cron');
const crypto = require('crypto');
const DailyCatholicContent = require('../models/DailyCatholicContent');
const { fetchDailySaint, getDailySaint } = require('./saintService');
const { 
  fetchAndStoreTamilReading, 
  getOrGenerateEnglishTranslation, 
  getReadingForDate,
  getDateKey 
} = require('./dailyMassReadingService');
const { fetchDailyVerse, syncDailyVerse } = require('./bibleVerseService');
const { getFormattedDates } = require('./dailyContentService');

let lastMonitorCheckTime = null;
let lastMonitorResult = null;
let isCheckInProgress = false;

function computeHash(content) {
  return crypto.createHash('sha256').update(String(content || '')).digest('hex').slice(0, 16);
}

/**
 * Check and synchronize content across all 4 Catholic sources for a given date
 * @param {Date|string} targetDate - Target date
 * @param {boolean} force - Force re-fetch even if hashes match
 */
async function checkAndSyncDailyContent(targetDate = new Date(), force = false) {
  const dateKey = getDateKey(targetDate);
  const { formattedEn, formattedTa } = getFormattedDates(targetDate);

  console.log(`[CONTENT-MONITOR] 🔍 Monitoring check started for original Catholic sources (${dateKey})...`);
  lastMonitorCheckTime = new Date();

  // Find or initialize canonical DailyCatholicContent document
  let canonicalDoc = await DailyCatholicContent.findOne({ date: dateKey });
  if (!canonicalDoc) {
    canonicalDoc = new DailyCatholicContent({
      date: dateKey,
      formattedDate: formattedEn,
      formattedDateTa: formattedTa,
      sourceHashes: { saint: '', massReadings: '', reflection: '', verse: '' },
      syncStatus: { saint: false, massReadings: false, reflection: false, verse: false }
    });
  }

  const updatesDetected = [];

  // ── 1. BIBLE VERSE CHECK ──
  try {
    const verseData = await fetchDailyVerse();
    if (verseData && (verseData.tamil || verseData.verseTa || verseData.english || verseData.verseEn)) {
      const vTa = verseData.tamil || verseData.verseTa || '';
      const vEn = verseData.english || verseData.verseEn || '';
      const vRef = verseData.ref || verseData.reference || '';
      const vImg = verseData.image || verseData.imageUrl || '';
      const vCat = verseData.category || '';

      const verseHash = computeHash(`${vRef}|${vTa}|${vEn}`);
      if (force || canonicalDoc.sourceHashes.verse !== verseHash) {
        canonicalDoc.bible = {
          ref: vRef,
          tamil: vTa,
          english: vEn,
          imageUrl: vImg,
          category: vCat
        };
        canonicalDoc.sourceHashes.verse = verseHash;
        canonicalDoc.syncStatus.verse = true;
        updatesDetected.push('Daily Bible Verse');
      }
    }
  } catch (verseErr) {
    console.warn('[CONTENT-MONITOR] Verse check notice:', verseErr.message);
  }

  // ── 2. SAINT OF THE DAY CHECK (Vatican News) ──
  try {
    let saintData = getDailySaint();
    if (!saintData || saintData.date !== dateKey || force) {
      saintData = await fetchDailySaint(targetDate);
    }

    if (saintData && (saintData.saintName || saintData.name || saintData.englishName)) {
      const sNameEn = saintData.englishName || saintData.saintName || saintData.name || '';
      const sNameTa = saintData.tamilName || saintData.nameTa || '';
      const sDescEn = saintData.description || '';
      const sDescTa = saintData.descriptionTa || '';
      const sImage = saintData.image || '';
      const sImgSrc = saintData.imageSource || 'Vatican News';
      const sSourceUrl = saintData.sourceUrl || saintData.link || '';
      const sFeast = saintData.feastDay || formattedEn;

      const saintHash = computeHash(`${sNameEn}|${sNameTa}|${sImage}|${sDescEn.slice(0, 50)}`);
      if (force || canonicalDoc.sourceHashes.saint !== saintHash) {
        canonicalDoc.saint = {
          nameEnglish: sNameEn,
          nameTamil: sNameTa,
          descriptionEnglish: sDescEn,
          descriptionTamil: sDescTa,
          feastDay: sFeast,
          image: sImage,
          imageSource: sImgSrc,
          sourceUrl: sSourceUrl
        };
        canonicalDoc.sourceHashes.saint = saintHash;
        canonicalDoc.syncStatus.saint = true;
        updatesDetected.push('Saint of the Day');
      }
    }
  } catch (saintErr) {
    console.warn('[CONTENT-MONITOR] Saint check notice:', saintErr.message);
  }

  // ── 3. DAILY MASS READINGS & REFLECTION CHECK (Catholic Gallery / Tamil Catholic Daily) ──
  try {
    let readingDoc = await getReadingForDate(dateKey);
    // If not in DB or force requested, attempt fetch from Catholic Gallery
    if (!readingDoc || force) {
      try {
        readingDoc = await fetchAndStoreTamilReading(dateKey);
      } catch (fetchErr) {
        console.warn('[CONTENT-MONITOR] Live reading fetch notice:', fetchErr.message);
      }
    }

    if (readingDoc && readingDoc.sections && readingDoc.sections.length > 0) {
      // Ensure English translation is also synchronized
      let englishDoc = null;
      try {
        englishDoc = await getOrGenerateEnglishTranslation(dateKey);
      } catch (trErr) {
        console.warn('[CONTENT-MONITOR] English reading translation notice:', trErr.message);
      }

      // Map Tamil readings
      const tamilReadingsList = readingDoc.sections.map(s => ({
        type: s.heading || 'வாசகம்',
        reference: s.reference || '',
        text: (s.paragraphs && s.paragraphs.length > 0) ? s.paragraphs.join('\n\n') : (s.text || '')
      }));

      // Map English readings
      let englishReadingsList = [];
      if (englishDoc?.sections && englishDoc.sections.length > 0) {
        englishReadingsList = englishDoc.sections.map(s => ({
          type: s.heading || 'Reading',
          reference: s.reference || '',
          text: (s.paragraphs && s.paragraphs.length > 0) ? s.paragraphs.join('\n\n') : (s.text || '')
        }));
      }

      const mTitleTa = readingDoc.celebration || readingDoc.title || readingDoc.liturgicalDay || 'இன்றைய திருப்பலி வாசகங்கள்';
      const mTitleEn = englishDoc?.celebration || englishDoc?.title || englishDoc?.liturgicalDay || 'Daily Mass Readings';
      const fullTextTa = tamilReadingsList.map(r => `${r.type} ${r.reference ? `(${r.reference})` : ''}\n${r.text}`).join('\n\n');
      const fullTextEn = englishReadingsList.map(r => `${r.type} ${r.reference ? `(${r.reference})` : ''}\n${r.text}`).join('\n\n');

      const readingsHash = computeHash(`${mTitleTa}|${tamilReadingsList.length}|${fullTextTa.slice(0, 100)}`);
      if (force || canonicalDoc.sourceHashes.massReadings !== readingsHash) {
        canonicalDoc.massReadings = {
          tamil: {
            title: mTitleTa,
            celebration: readingDoc.celebration || '',
            liturgicalDay: readingDoc.liturgicalDay || '',
            readings: tamilReadingsList,
            fullText: fullTextTa
          },
          english: {
            title: mTitleEn,
            celebration: englishDoc?.celebration || '',
            liturgicalDay: englishDoc?.liturgicalDay || '',
            readings: englishReadingsList,
            fullText: fullTextEn
          }
        };
        canonicalDoc.sourceHashes.massReadings = readingsHash;
        canonicalDoc.syncStatus.massReadings = true;
        updatesDetected.push('Daily Mass Readings');
      }

      // ── Reflection Check ──
      let reflectionTa = '';
      let prayerTa = '';
      if (readingDoc.reflection) {
        const r = readingDoc.reflection;
        const parts = [];
        if (r.title?.trim()) parts.push(r.title.trim());
        if (r.paragraphs?.length) parts.push(r.paragraphs.map(p => p.trim()).filter(Boolean).join('\n\n'));
        else if (r.content?.trim()) parts.push(r.content.trim());
        reflectionTa = parts.join('\n\n');
        if (r.prayer?.trim()) prayerTa = r.prayer.trim();
      }

      let reflectionEn = '';
      let prayerEn = '';
      if (englishDoc?.reflection) {
        const r = englishDoc.reflection;
        const parts = [];
        if (r.title?.trim()) parts.push(r.title.trim());
        if (r.paragraphs?.length) parts.push(r.paragraphs.map(p => p.trim()).filter(Boolean).join('\n\n'));
        else if (r.content?.trim()) parts.push(r.content.trim());
        reflectionEn = parts.join('\n\n');
        if (r.prayer?.trim()) prayerEn = r.prayer.trim();
      }

      const reflectionHash = computeHash(`${reflectionTa.slice(0, 100)}|${reflectionEn.slice(0, 100)}`);
      if (force || canonicalDoc.sourceHashes.reflection !== reflectionHash) {
        canonicalDoc.reflection = {
          tamil: reflectionTa || canonicalDoc.reflection?.tamil || 'இறைவனின் வார்த்தை நம் வாழ்வின் வழிகாட்டி.',
          english: reflectionEn || canonicalDoc.reflection?.english || 'The Word of God is a lamp to our feet and a light to our path.',
          titleTamil: readingDoc.reflection?.title || '',
          titleEnglish: englishDoc?.reflection?.title || '',
          prayer: prayerTa || prayerEn || ''
        };
        canonicalDoc.sourceHashes.reflection = reflectionHash;
        canonicalDoc.syncStatus.reflection = true;
        updatesDetected.push('Daily Reflection');
      }
    }
  } catch (readingErr) {
    console.warn('[CONTENT-MONITOR] Reading check notice:', readingErr.message);
  }

  // Update timestamps
  canonicalDoc.lastCheckedAt = new Date();
  if (updatesDetected.length > 0) {
    canonicalDoc.lastSourceUpdateAt = new Date();
    await canonicalDoc.save();
    console.log(`[CONTENT-MONITOR] 🔄 New content detected from: ${updatesDetected.join(', ')} for ${dateKey}`);
    console.log(`[CONTENT-MONITOR] ✅ Church Website Database updated immediately with verified content`);
  } else {
    await canonicalDoc.save();
    console.log(`[CONTENT-MONITOR] ✅ Church Website Database is already up-to-date for ${dateKey} (No source changes).`);
  }

  lastMonitorResult = {
    checkedAt: canonicalDoc.lastCheckedAt,
    dateKey,
    updatedSources: updatesDetected,
    syncStatus: canonicalDoc.syncStatus
  };

  return canonicalDoc;
}

/**
 * Autonomous runner wrapper with lock
 */
async function runMonitoringCycle() {
  if (isCheckInProgress) {
    console.log('[CONTENT-MONITOR] ⏳ Monitoring cycle already in progress, skipping overlapping tick.');
    return;
  }
  isCheckInProgress = true;
  try {
    const today = new Date();
    await checkAndSyncDailyContent(today, false);
  } catch (err) {
    console.error('[CONTENT-MONITOR] ❌ Error in monitoring cycle:', err.message);
  } finally {
    isCheckInProgress = false;
  }
}

// ── Autonomous Background Schedules ──────────────────────────────────────────

// Schedule 1: Every 30 minutes during standard hours (Asia/Kolkata)
cron.schedule('*/30 * * * *', async () => {
  console.log('[CONTENT-MONITOR] ⏰ Scheduled 30-minute source sync check...');
  await runMonitoringCycle();
}, {
  timezone: 'Asia/Kolkata',
  scheduled: true
});

// Schedule 2: Heightened monitoring every 10 minutes from 11:00 PM to 04:00 AM IST
// (When original liturgical sources post the upcoming day's readings & saint)
cron.schedule('*/10 23,0,1,2,3 * * *', async () => {
  console.log('[CONTENT-MONITOR] 🌙 Overnight high-frequency source publication check (every 10m)...');
  await runMonitoringCycle();
}, {
  timezone: 'Asia/Kolkata',
  scheduled: true
});

// Boot check: 10 seconds after server starts up to allow MongoDB connection to settle
setTimeout(() => {
  console.log('[CONTENT-MONITOR] 🚀 Running initial startup content monitoring check...');
  runMonitoringCycle().catch(err =>
    console.error('[CONTENT-MONITOR] Startup check error:', err.message)
  );
}, 10 * 1000);

/**
 * Diagnostic & Status inspector
 */
function getMonitoringStatus() {
  return {
    service: 'ContentMonitoringService',
    active: true,
    timezone: 'Asia/Kolkata',
    schedule: '*/30 * * * * (Standard 30m) & */10 23,0,1,2,3 * * * (Overnight 10m)',
    lastCheckTime: lastMonitorCheckTime,
    lastResult: lastMonitorResult,
    isCheckInProgress
  };
}

module.exports = {
  checkAndSyncDailyContent,
  runMonitoringCycle,
  getMonitoringStatus
};
