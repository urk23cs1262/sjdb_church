/**
 * High-Performance In-Memory Church Data & Intent Cache
 * 
 * Provides sub-millisecond data retrieval for the 24/7 WhatsApp Bot:
 * - Church Details, History & Parish Clergy
 * - Liturgical Mass Timings & Confession Schedule
 * - Location, Maps & Office Contacts
 * - Daily Liturgy (Bible Verse, Mass Readings, Reflection, Saint of the Day)
 * - Active Events & Announcements
 * 
 * Includes cache warm-up on server boot and TTL invalidation.
 */

const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const Priest = require('../models/Priest');
const { getTodayDailyContent } = require('../services/dailyContentService');

// In-Memory Fast Cache Store
const cache = {
  massTimings: null,
  massTimingsExpiry: 0,

  priests: null,
  priestsExpiry: 0,

  events: null,
  eventsExpiry: 0,

  announcements: null,
  announcementsExpiry: 0,

  dailyContent: null,
  dailyContentDateKey: '',

  stats: {
    hits: 0,
    misses: 0,
    lastWarmedAt: null
  }
};

const TTL = {
  MASS_TIMINGS: 15 * 60 * 1000,    // 15 minutes
  PRIESTS: 15 * 60 * 1000,         // 15 minutes
  EVENTS: 3 * 60 * 1000,           // 3 minutes
  ANNOUNCEMENTS: 3 * 60 * 1000     // 3 minutes
};

/**
 * Warm up all caches at server startup
 */
async function warmUpCache() {
  try {
    const start = Date.now();
    await Promise.allSettled([
      getCachedDailyContent(),
      getCachedPriests(),
      getCachedEvents(),
      getCachedAnnouncements()
    ]);
    cache.stats.lastWarmedAt = new Date();
    console.log(`⚡ [ChurchDataCache] Cache warmed up in ${Date.now() - start}ms.`);
  } catch (err) {
    console.warn('[ChurchDataCache] Warm-up notice:', err.message);
  }
}

/**
 * Get cached today's daily Catholic content (Verse, Readings, Reflection, Saint)
 */
async function getCachedDailyContent() {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (cache.dailyContent && cache.dailyContentDateKey === todayKey) {
    cache.stats.hits++;
    return cache.dailyContent;
  }

  cache.stats.misses++;
  try {
    const data = await getTodayDailyContent(new Date());
    cache.dailyContent = data;
    cache.dailyContentDateKey = todayKey;
    return data;
  } catch (err) {
    console.error('[ChurchDataCache] Failed fetching daily content:', err.message);
    return cache.dailyContent || {};
  }
}

/**
 * Get cached parish priests list
 */
async function getCachedPriests() {
  const now = Date.now();
  if (cache.priests && now < cache.priestsExpiry) {
    cache.stats.hits++;
    return cache.priests;
  }

  cache.stats.misses++;
  try {
    const priests = await Priest.find({ isActive: { $ne: false } }).sort({ order: 1, createdAt: 1 }).lean();
    cache.priests = priests;
    cache.priestsExpiry = now + TTL.PRIESTS;
    return priests;
  } catch (err) {
    return cache.priests || [];
  }
}

/**
 * Get cached active upcoming church events
 */
async function getCachedEvents() {
  const now = Date.now();
  if (cache.events && now < cache.eventsExpiry) {
    cache.stats.hits++;
    return cache.events;
  }

  cache.stats.misses++;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await Event.find({
      status: { $nin: ['completed', 'cancelled', 'deleted'] },
      $or: [
        { date: { $gte: today } },
        { isRecurring: true }
      ]
    })
    .sort({ date: 1 })
    .limit(10)
    .lean();

    cache.events = events;
    cache.eventsExpiry = now + TTL.EVENTS;
    return events;
  } catch (err) {
    return cache.events || [];
  }
}

/**
 * Get cached active parish announcements
 */
async function getCachedAnnouncements() {
  const now = Date.now();
  if (cache.announcements && now < cache.announcementsExpiry) {
    cache.stats.hits++;
    return cache.announcements;
  }

  cache.stats.misses++;
  try {
    const announcements = await Announcement.find({
      isActive: { $ne: false },
      status: { $nin: ['completed', 'cancelled', 'deleted'] }
    })
    .sort({ priority: -1, createdAt: -1 })
    .limit(10)
    .lean();

    cache.announcements = announcements;
    cache.announcementsExpiry = now + TTL.ANNOUNCEMENTS;
    return announcements;
  } catch (err) {
    return cache.announcements || [];
  }
}

/**
 * Invalidate specific cache when admin creates/updates/deletes records
 */
function invalidateCache(type) {
  if (type === 'events') cache.eventsExpiry = 0;
  if (type === 'announcements') cache.announcementsExpiry = 0;
  if (type === 'priests') cache.priestsExpiry = 0;
  if (type === 'dailyContent') cache.dailyContentDateKey = '';
  if (type === 'all') {
    cache.eventsExpiry = 0;
    cache.announcementsExpiry = 0;
    cache.priestsExpiry = 0;
    cache.dailyContentDateKey = '';
  }
}

function getCacheDiagnostics() {
  return {
    hits: cache.stats.hits,
    misses: cache.stats.misses,
    lastWarmedAt: cache.stats.lastWarmedAt,
    hasDailyContent: !!cache.dailyContent,
    cachedPriestsCount: cache.priests ? cache.priests.length : 0,
    cachedEventsCount: cache.events ? cache.events.length : 0,
    cachedAnnouncementsCount: cache.announcements ? cache.announcements.length : 0
  };
}

module.exports = {
  warmUpCache,
  getCachedDailyContent,
  getCachedPriests,
  getCachedEvents,
  getCachedAnnouncements,
  invalidateCache,
  getCacheDiagnostics
};
