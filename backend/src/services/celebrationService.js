/**
 * Annual Catholic Celebrations & Popup Service — SJDB Connect
 * St. John de Britto Church, Kalayarkoil
 *
 * Supported Occasions:
 * 1. User Birthday — user DOB month & day
 * 2. New Year — January 1
 * 3. St. John de Britto Feast — February 4
 * 4. Easter Sunday — dynamically calculated via Gregorian Computus algorithm
 * 5. Christmas — December 25
 */

const User = require('../models/User');
const Notification = require('../models/Notification');
const CelebrationLog = require('../models/CelebrationLog');
const { createNotification } = require('./notificationService');
const { isUserBirthdayToday, getTodayISTParts } = require('./birthdayService');

/**
 * Calculates Easter Sunday for any given Gregorian year using Butcher's algorithm
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Returns all active celebrations for a specific date and optional user
 */
function getCelebrationTypesForDate(istParts, user = null) {
  const { year, month, day } = istParts;
  const activeOccasions = [];

  // 1. Birthday Check
  if (user && user.dob && isUserBirthdayToday(user.dob, month, day)) {
    activeOccasions.push({
      type: 'birthday',
      key: `BIRTHDAY_${year}_${user._id}`
    });
  }

  // 2. New Year Check (Jan 1)
  if (month === 1 && day === 1) {
    activeOccasions.push({
      type: 'new_year',
      key: `NEW_YEAR_${year}_${user ? user._id : 'ALL'}`
    });
  }

  // 3. St. John de Britto Feast (Feb 4)
  if (month === 2 && day === 4) {
    activeOccasions.push({
      type: 'st_john_britto_feast',
      key: `ST_JOHN_DE_BRITTO_FEAST_${year}_${user ? user._id : 'ALL'}`
    });
  }

  // 4. Easter Sunday Check
  const easter = getEasterSunday(year);
  if (month === easter.month && day === easter.day) {
    activeOccasions.push({
      type: 'easter',
      key: `EASTER_${year}_${user ? user._id : 'ALL'}`
    });
  }

  // 5. Christmas Check (Dec 25)
  if (month === 12 && day === 25) {
    activeOccasions.push({
      type: 'christmas',
      key: `CHRISTMAS_${year}_${user ? user._id : 'ALL'}`
    });
  }

  return activeOccasions;
}

/**
 * Returns formatted content (heading, message, buttonText) for an occasion and language
 */
function getCelebrationContent({ type, userName = 'Parishioner', language = 'en' }) {
  const lang = String(language || 'en').toLowerCase();
  const isTa = lang === 'ta';
  const isBoth = lang === 'both';
  const formattedName = userName.trim();

  switch (type) {
    case 'birthday':
      return {
        type: 'birthday',
        heading: isBoth
          ? `HAPPY BIRTHDAY / இனிய பிறந்தநாள் நல்வாழ்த்துகள்,\n${formattedName}!`
          : isTa
            ? `இனிய பிறந்தநாள் நல்வாழ்த்துகள்,\n${formattedName}!`
            : `HAPPY BIRTHDAY,\n${formattedName}!`,
        message: isBoth
          ? `St. John de Britto Church wishes you a blessed day and year filled with joy and peace.\n\nபுனித அருளானந்தர் திருத்தலம் உங்கள் வாழ்வில் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருள் நிறைய வாழ்த்துகிறது.`
          : isTa
            ? `புனித அருளானந்தர் திருத்தலம் உங்கள் வாழ்வில் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருள் நிறைய வாழ்த்துகிறது.`
            : `St. John de Britto Church wishes you a blessed day and year filled with joy and peace.`,
        buttonText: isBoth ? `Thank You! / நன்றி!` : isTa ? `நன்றி!` : `Thank You!`,
        themeColor: '#d99726'
      };

    case 'new_year':
      return {
        type: 'new_year',
        heading: isBoth
          ? `HAPPY NEW YEAR / இனிய புத்தாண்டு நல்வாழ்த்துகள்!`
          : isTa
            ? `இனிய புத்தாண்டு நல்வாழ்த்துகள்!`
            : `HAPPY NEW YEAR!`,
        message: isBoth
          ? `May the Lord bless you and your family with peace, joy, good health, and abundant grace throughout the new year.\n\nஆண்டவர் இந்த புதிய ஆண்டில் உங்களையும் உங்கள் குடும்பத்தையும் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளால் ஆசீர்வதிப்பாராக.`
          : isTa
            ? `ஆண்டவர் இந்த புதிய ஆண்டில் உங்களையும் உங்கள் குடும்பத்தையும் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளால் ஆசீர்வதிப்பாராக.`
            : `May the Lord bless you and your family with peace, joy, good health, and abundant grace throughout the new year.`,
        buttonText: isBoth ? `Thank You! / நன்றி!` : isTa ? `நன்றி!` : `Thank You!`,
        themeColor: '#d99726'
      };

    case 'st_john_britto_feast':
      return {
        type: 'st_john_britto_feast',
        heading: isBoth
          ? `HAPPY FEAST OF ST. JOHN DE BRITTO /\nபுனித அருளானந்தர் திருவிழா நல்வாழ்த்துகள்!`
          : isTa
            ? `புனித அருளானந்தர் திருவிழா நல்வாழ்த்துகள்!`
            : `HAPPY FEAST OF\nST. JOHN DE BRITTO!`,
        message: isBoth
          ? `May the intercession of St. John de Britto strengthen your faith and inspire you to live with courage, love, and devotion to Christ.\n\nபுனித ஜான் டி பிரிட்டோவின் பரிந்துரை உங்கள் விசுவாசத்தை உறுதிப்படுத்தி, கிறிஸ்துவின் மீது அன்பும் தைரியமும் கொண்டு வாழ உங்களை வழிநடத்தட்டும்.`
          : isTa
            ? `புனித ஜான் டி பிரிட்டோவின் பரிந்துரை உங்கள் விசுவாசத்தை உறுதிப்படுத்தி, கிறிஸ்துவின் மீது அன்பும் தைரியமும் கொண்டு வாழ உங்களை வழிநடத்தட்டும்.`
            : `May the intercession of St. John de Britto strengthen your faith and inspire you to live with courage, love, and devotion to Christ.`,
        buttonText: isBoth ? `Amen / ஆமென்` : isTa ? `ஆமென்` : `Amen`,
        themeColor: '#d99726'
      };

    case 'easter':
      return {
        type: 'easter',
        heading: isBoth
          ? `HAPPY EASTER / இனிய பாஸ்கா திருநாள் வாழ்த்துகள்!`
          : isTa
            ? `இனிய பாஸ்கா திருநாள் வாழ்த்துகள்!`
            : `HAPPY EASTER!`,
        message: isBoth
          ? `Christ is Risen! May the joy of the Resurrection fill your heart and home with hope, peace, love, and God's abundant blessings.\n\nகிறிஸ்து உயிர்த்தெழுந்தார்! உயிர்ப்பின் பெருவிழா உங்கள் உள்ளத்திலும் இல்லத்திலும் நம்பிக்கை, அமைதி, அன்பு மற்றும் ஆசீர்வாதங்களை நிறைக்கட்டும்.`
          : isTa
            ? `கிறிஸ்து உயிர்த்தெழுந்தார்! உயிர்ப்பின் பெருவிழா உங்கள் உள்ளத்திலும் இல்லத்திலும் நம்பிக்கை, அமைதி, அன்பு மற்றும் ஆசீர்வாதங்களை நிறைக்கட்டும்.`
            : `Christ is Risen! May the joy of the Resurrection fill your heart and home with hope, peace, love, and God's abundant blessings.`,
        buttonText: isBoth ? `Alleluia! / அல்லேலூயா!` : isTa ? `அல்லேலூயா!` : `Alleluia!`,
        themeColor: '#d99726'
      };

    case 'christmas':
      return {
        type: 'christmas',
        heading: isBoth
          ? `MERRY CHRISTMAS / இனிய கிறிஸ்துமஸ் நல்வாழ்த்துகள்!`
          : isTa
            ? `இனிய கிறிஸ்துமஸ் நல்வாழ்த்துகள்!`
            : `MERRY CHRISTMAS!`,
        message: isBoth
          ? `May the birth of our Lord Jesus Christ fill your heart and home with peace, joy, hope, and love.\n\nநம் ஆண்டவர் இயேசு கிறிஸ்துவின் பிறப்பு உங்கள் உள்ளத்திலும் இல்லத்திலும் அமைதி, மகிழ்ச்சி, நம்பிக்கை மற்றும் அன்பை நிறைக்கட்டும்.`
          : isTa
            ? `நம் ஆண்டவர் இயேசு கிறிஸ்துவின் பிறப்பு உங்கள் உள்ளத்திலும் இல்லத்திலும் அமைதி, மகிழ்ச்சி, நம்பிக்கை மற்றும் அன்பை நிறைக்கட்டும்.`
            : `May the birth of our Lord Jesus Christ fill your heart and home with peace, joy, hope, and love.`,
        buttonText: isBoth ? `Amen / ஆமென்` : isTa ? `ஆமென்` : `Amen`,
        themeColor: '#d99726'
      };

    default:
      return {
        type,
        heading: `GREETINGS FROM ST. JOHN DE BRITTO CHURCH!`,
        message: `May God bless you with abundant peace and joy.`,
        buttonText: `Amen`,
        themeColor: '#d99726'
      };
  }
}

/**
 * Returns pending / active celebrations for a user
 * When ignoreAcknowledged is true (default for active celebrations), celebrations for today
 * are always returned so that refreshing the page displays the celebratory wishes note popup.
 */
async function getPendingCelebrationsForUser(userId, forceDate = null, ignoreAcknowledged = true) {
  if (!userId) return [];

  const user = await User.findById(userId);
  if (!user || user.isActive === false || user.isSuspended === true) return [];

  const istParts = getTodayISTParts(forceDate ? new Date(forceDate) : new Date());
  const activeOccasions = getCelebrationTypesForDate(istParts, user);

  // Also check if user has a birthday notification created in the last 48 hours
  const recentBirthdayNotif = await Notification.findOne({
    userId,
    category: 'birthday',
    createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
  }).sort({ createdAt: -1 });

  if (recentBirthdayNotif && !activeOccasions.some(o => o.type === 'birthday')) {
    activeOccasions.push({ type: 'birthday', year: istParts.year, notificationId: recentBirthdayNotif._id });
  }

  if (!activeOccasions.length) return [];

  let acknowledgedTypes = new Set();
  if (!ignoreAcknowledged) {
    const acknowledgedLogs = await CelebrationLog.find({
      userId,
      year: istParts.year
    }).select('celebrationType celebrationKey');
    acknowledgedTypes = new Set(acknowledgedLogs.map(l => l.celebrationType));
  }

  const pending = [];
  const userLang = user.preferredLanguage || user.settings?.language || 'en';

  for (const occ of activeOccasions) {
    if (ignoreAcknowledged || !acknowledgedTypes.has(occ.type)) {
      // Find matching notification if exists
      const notif = occ.notificationId
        ? await Notification.findById(occ.notificationId)
        : await Notification.findOne({
            userId,
            category: occ.type === 'birthday' ? 'birthday' : { $in: ['general', 'spiritual', 'celebration', 'events'] }
          }).sort({ createdAt: -1 });

      const content = getCelebrationContent({
        type: occ.type,
        userName: user.name || (user.role === 'admin' ? 'Parish Admin' : 'Parishioner'),
        language: userLang
      });

      pending.push({
        celebrationType: occ.type,
        celebrationKey: `${occ.type.toUpperCase()}_${istParts.year}_${user._id}`,
        year: istParts.year,
        userName: user.name || (user.role === 'admin' ? 'Parish Admin' : 'Parishioner'),
        notificationId: notif?._id || null,
        language: userLang,
        heading: content.heading,
        message: content.message,
        buttonText: content.buttonText,
        themeColor: content.themeColor
      });
    }
  }

  return pending;
}

/**
 * Acknowledges a celebration, recording the acknowledgment and marking notifications as read
 */
async function acknowledgeCelebration({ userId, celebrationType, year, celebrationKey, notificationId = null }) {
  if (!userId || !celebrationType || !year) {
    throw new Error('userId, celebrationType, and year are required');
  }

  const finalKey = celebrationKey || `${celebrationType.toUpperCase()}_${year}_${userId}`;

  // Upsert CelebrationLog
  const log = await CelebrationLog.findOneAndUpdate(
    { userId, celebrationType, year },
    {
      userId,
      celebrationType,
      year,
      celebrationKey: finalKey,
      notificationId: notificationId || null,
      acknowledgedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Mark notification as read if provided or find matching unread notification
  if (notificationId) {
    await Notification.findByIdAndUpdate(notificationId, { isRead: true }).catch(() => {});
  } else {
    // Mark matching category notification as read
    const searchCategory = celebrationType === 'birthday' ? 'birthday' : { $in: ['general', 'spiritual', 'celebration', 'events'] };
    await Notification.updateMany(
      { userId, category: searchCategory, isRead: false },
      { isRead: true }
    ).catch(() => {});
  }

  return log;
}

/**
 * Midnight automated annual celebration broadcast (New Year, Feast, Easter, Christmas)
 */
async function runAnnualCelebrationMidnightCron(forceDate = null) {
  const ist = getTodayISTParts(forceDate ? new Date(forceDate) : new Date());
  const generalOccasions = getCelebrationTypesForDate(ist, null); // excludes birthday

  if (!generalOccasions.length) return { executed: false, message: 'No general church celebration today' };

  console.log(`🎉 [Celebration Service] Processing church celebration for ${ist.dateKey}:`, generalOccasions.map(o => o.type));

  const allUsers = await User.find({ isActive: { $ne: false }, isSuspended: { $ne: true } });

  for (const occ of generalOccasions) {
    for (const user of allUsers) {
      const userLang = user.preferredLanguage || user.settings?.language || 'en';
      const content = getCelebrationContent({
        type: occ.type,
        userName: user.name,
        language: userLang
      });

      // Create notification
      await createNotification({
        userId: user._id,
        isBroadcast: false,
        title: content.heading.split('\n')[0].replace(/,/g, ''),
        message: content.message,
        type: 'general',
        category: 'general',
        priority: 'high',
        recipient: 'user',
        actionUrl: '/dashboard',
        channels: ['inApp', 'push']
      }).catch(err => console.warn(`[Celebration Service] Error creating notification for ${user.name}:`, err.message));
    }
  }

  return { executed: true, occasions: generalOccasions.map(o => o.type), userCount: allUsers.length };
}

module.exports = {
  getEasterSunday,
  getCelebrationTypesForDate,
  getCelebrationContent,
  getPendingCelebrationsForUser,
  acknowledgeCelebration,
  runAnnualCelebrationMidnightCron
};
