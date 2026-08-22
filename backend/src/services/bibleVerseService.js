/**
 * Bible Verse Service & Automated 12:00 AM Scheduler
 * Automatically rotates and syncs Daily Bible Verses at 12:00 AM IST daily via node-cron
 */
const cron = require('node-cron');
const { getTodayVerseData } = require('../controllers/dailyVerseController');

let cachedVerse = null;

async function syncDailyVerse() {
  try {
    const verseData = await getTodayVerseData();
    cachedVerse = verseData;
    console.log(` Daily Bible Verse automatically updated (12:00 AM IST): ${verseData.ref} (Day ${verseData.dayOfYear} of ${verseData.totalVerses})`);
    return verseData;
  } catch (err) {
    console.error(' Error in automated daily Bible verse rotation:', err.message);
    return null;
  }
}

async function fetchDailyVerse() {
  if (cachedVerse) {
    return cachedVerse;
  }
  return await syncDailyVerse();
}

// Initial sync on startup
syncDailyVerse();

// Automated Cron Job: Runs at 12:00 AM IST every day
cron.schedule('0 0 * * *', () => {
  console.log(' 12:00 AM IST — Executing automated Daily Bible Verse rotation job...');
  syncDailyVerse();
}, {
  timezone: 'Asia/Kolkata'
});

module.exports = {
  fetchDailyVerse,
  syncDailyVerse
};
