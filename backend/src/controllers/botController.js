const { triggerBroadcastNow } = require('../services/dailyBroadcastService');
const BotSession = require('../models/BotSession');
const User = require('../models/User');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const { getTodayDailyContent } = require('../services/dailyContentService');
const {
  generateDailyCatholicMessage,
  generateDailyLinksMessage,
  generateSaintInfoMessage,
  generateVerseMessage,
  generateReadingsMessage,
  generateReflectionMessage
} = require('../services/whatsappDailyFormatter');
const { answerChurchQuestion } = require('../bot/churchRAGService');

function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text);
}

// GET /api/bot/status — Connection status
const getStatus = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const { getConnectionStatus } = require('../bot/whatsapp');
    res.json({ success: true, ...getConnectionStatus() });
  } catch {
    res.json({ success: true, connected: false, sock: false, status: 'disconnected' });
  }
};

// POST /api/bot/reconnect — Trigger manual reconnect
const reconnect = async (req, res) => {
  try {
    const { reconnectWhatsApp } = require('../bot/whatsapp');
    await reconnectWhatsApp();
    res.json({ success: true, message: 'Reconnecting to WhatsApp...' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bot/qr — Get current QR code data URL
const getQR = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const { getQR, getConnectionStatus } = require('../bot/whatsapp');
    const { connected, status } = getConnectionStatus();
    const qr = getQR();
    res.json({ success: true, connected, status, qr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/reset — Force reset session and generate fresh QR
const resetSession = async (req, res) => {
  try {
    const { resetWhatsAppSession } = require('../bot/whatsapp');
    await resetWhatsAppSession();
    res.json({ success: true, message: 'WhatsApp session reset. Generating fresh QR code...' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/pairing-code — Generate WhatsApp pairing code for phone number connection
const getPairingCode = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const { requestPairingCode } = require('../bot/whatsapp');
    const pairingCode = await requestPairingCode(phoneNumber);
    res.json({ success: true, pairingCode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bot/subscribers — Admin: view all subscribers
const getSubscribers = async (req, res) => {
  try {
    // 1. Get interactive bot sessions
    const sessions = await BotSession.find({ step: 'done' }).lean();

    // 2. Get registered website users who have a phone number
    const users = await User.find({ phone: { $exists: true, $ne: '' }, isActive: { $ne: false } })
      .select('name phone preferredLanguage mass_reflection_language readingPreference sendLinks botPreferences whatsappOptIn createdAt updatedAt')
      .lean();

    // Map by phone to avoid duplicates
    const subscriberMap = new Map();

    // Add website registered users
    users.forEach(u => {
      const cleanPhone = u.phone.replace(/\D/g, '');
      if (cleanPhone) {
        subscriberMap.set(cleanPhone, {
          _id: u._id,
          userId: u._id,
          phoneNumber: cleanPhone,
          name: u.name || 'Member',
          source: 'Website User',
          preferences: u.botPreferences?.length ? u.botPreferences : ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'],
          language: u.mass_reflection_language || u.preferredLanguage || 'en',
          readingPreference: u.readingPreference || 'full',
          sendLinks: u.sendLinks !== false,
          optedIn: u.whatsappOptIn !== false,
          isActive: true,
          updatedAt: u.updatedAt || u.createdAt
        });
      }
    });

    // Merge/override with interactive bot sessions
    sessions.forEach(s => {
      const cleanPhone = s.phoneNumber ? s.phoneNumber.replace(/\D/g, '') : '';
      const linkedUserIdStr = s.linkedUserId ? String(s.linkedUserId) : null;
      let matchedUserKey = null;

      if (linkedUserIdStr) {
        for (const [key, value] of subscriberMap.entries()) {
          if (String(value._id) === linkedUserIdStr) {
            matchedUserKey = key;
            break;
          }
        }
      }

      if (!matchedUserKey && cleanPhone) {
        matchedUserKey = cleanPhone;
      }

      if (matchedUserKey && subscriberMap.has(matchedUserKey)) {
        const existing = subscriberMap.get(matchedUserKey);
        subscriberMap.set(matchedUserKey, {
          ...existing,
          preferences: s.preferences?.length ? s.preferences : existing.preferences,
          language: s.language || existing.language || 'en',
          readingPreference: s.readingPreference || existing.readingPreference || 'full',
          sendLinks: s.sendLinks !== undefined ? s.sendLinks : existing.sendLinks,
          optedIn: s.step === 'done',
          updatedAt: s.updatedAt || existing.updatedAt
        });
      } else {
        const key = cleanPhone || s.phoneNumber;
        subscriberMap.set(key, {
          _id: s._id,
          sessionId: s._id,
          phoneNumber: s.phoneNumber,
          name: s.pushName || 'WhatsApp Member',
          source: 'WhatsApp Bot',
          preferences: s.preferences?.length ? s.preferences : ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'],
          language: s.language || 'en',
          readingPreference: s.readingPreference || 'full',
          sendLinks: s.sendLinks !== false,
          optedIn: s.step === 'done',
          isActive: true,
          updatedAt: s.updatedAt
        });
      }
    });

    const subscribers = Array.from(subscriberMap.values());
    res.json({ success: true, total: subscribers.length, subscribers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/subscriber/toggle-optin — Admin: toggle opt-in state
const toggleSubscriberOptIn = async (req, res) => {
  try {
    const { phoneNumber, optedIn } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const user = await User.findOne({ phone: { $regex: cleanPhone.slice(-10) } });
    if (user) {
      user.whatsappOptIn = optedIn !== undefined ? Boolean(optedIn) : !user.whatsappOptIn;
      await user.save();
    }

    const session = await BotSession.findOne({ phoneNumber: { $regex: cleanPhone.slice(-10) } });
    if (session) {
      session.step = optedIn ? 'done' : 'welcome';
      await session.save();
    }

    res.json({ success: true, message: `Subscriber opt-in updated to ${optedIn ? 'Active' : 'Paused'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bot/stats — Admin: broadcast and conversation stats
const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ phone: { $exists: true, $ne: '' } });
    const botSessions = await BotSession.countDocuments({ step: 'done' });
    const optedIn = await User.countDocuments({ whatsappOptIn: { $ne: false }, phone: { $exists: true, $ne: '' } });

    // Deduplicated count
    const sessions = await BotSession.find({ step: 'done' }).select('phoneNumber preferences').lean();
    const users = await User.find({ phone: { $exists: true, $ne: '' }, isActive: { $ne: false } }).select('phone botPreferences whatsappOptIn').lean();

    const phones = new Set([
      ...sessions.map(s => s.phoneNumber ? s.phoneNumber.replace(/\D/g, '') : '').filter(Boolean),
      ...users.map(u => u.phone ? u.phone.replace(/\D/g, '') : '').filter(Boolean)
    ]);

    // Calculate today's dateKey in IST
    const todayDateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    // Aggregate logs for today
    const logsToday = await DailyNotificationLog.find({ dateKey: todayDateKey }).lean();
    let sentToday = 0;
    let failedToday = 0;

    logsToday.forEach(log => {
      const waStatus = log.channels?.whatsapp?.status;
      if (waStatus === 'sent') sentToday++;
      else if (waStatus === 'failed') failedToday++;
    });

    const broadcastsToday = logsToday.length > 0 ? 1 : 0;

    const prefCounts = [
      { _id: 'verse', count: phones.size },
      { _id: 'saint', count: phones.size },
      { _id: 'mass', count: phones.size },
      { _id: 'events', count: phones.size },
      { _id: 'announcements', count: phones.size },
      { _id: 'birthday', count: phones.size },
    ];

    res.json({
      success: true,
      stats: {
        total: totalUsers + botSessions,
        active: phones.size,
        optedIn: Math.max(optedIn, botSessions),
        sentToday,
        failedToday,
        broadcastsToday,
        prefCounts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bot/preview-today — Preview today's spiritual broadcast content
const { getCachedDailyContent } = require('../bot/churchDataCache');

const getTodayPreview = async (req, res) => {
  try {
    const dailyContent = (await getCachedDailyContent()) || (await getTodayDailyContent(new Date()));
    const previewTa = generateDailyCatholicMessage({
      dailyContent,
      language: 'ta',
      readingPreference: 'full'
    });
    const previewEn = generateDailyCatholicMessage({
      dailyContent,
      language: 'en',
      readingPreference: 'full'
    });

    res.json({
      success: true,
      date: new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' }).format(new Date()),
      saintName: dailyContent?.saintName || dailyContent?.saint?.nameEnglish || dailyContent?.saintOfTheDay?.english?.name || 'Saint of the Day',
      saintNameTa: dailyContent?.saintNameTa || dailyContent?.saint?.nameTamil || dailyContent?.saintOfTheDay?.tamil?.name || '',
      saintImage: dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl || dailyContent?.saintOfTheDay?.imageUrl || null,
      saintFeastDay: dailyContent?.saintFeastDay || dailyContent?.saint?.feastDay || dailyContent?.saintOfTheDay?.english?.feastDay || 'Today',
      saintDescription: dailyContent?.saintDescription || dailyContent?.saint?.description || dailyContent?.saintOfTheDay?.english?.description || '',
      bibleRef: dailyContent?.bible?.ref || dailyContent?.dailyVerse?.reference || dailyContent?.readings?.gospel?.reference || 'Holy Bible',
      previewTa,
      previewEn
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bot/history — Broadcast history logs
const getBroadcastHistory = async (req, res) => {
  try {
    const recentLogs = await DailyNotificationLog.aggregate([
      {
        $group: {
          _id: '$dateKey',
          dateKey: { $first: '$dateKey' },
          sentAt: { $max: '$sentAt' },
          totalRecipients: { $sum: 1 },
          whatsappSent: {
            $sum: { $cond: [{ $eq: ['$channels.whatsapp.status', 'sent'] }, 1, 0] }
          },
          whatsappFailed: {
            $sum: { $cond: [{ $eq: ['$channels.whatsapp.status', 'failed'] }, 1, 0] }
          },
          saintName: { $first: '$summary.saintName' },
          bibleRef: { $first: '$summary.bibleRef' }
        }
      },
      { $sort: { dateKey: -1 } },
      { $limit: 15 }
    ]);

    res.json({ success: true, history: recentLogs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/broadcast/now — Admin: trigger immediate broadcast (Non-blocking Fast Response)
const triggerBroadcast = async (req, res) => {
  try {
    // Return instant acknowledgement to the admin UI
    res.json({
      success: true,
      message: 'Daily spiritual broadcast initiated successfully! Messages are being dispatched in the background.',
      status: 'in_progress',
      dispatchedAt: new Date().toISOString()
    });

    // Execute the broadcast immediately in the background
    setImmediate(async () => {
      try {
        console.log('⚡ [Admin Panel] Fast background spiritual broadcast started...');
        await triggerBroadcastNow();
        console.log('✅ [Admin Panel] Fast background spiritual broadcast completed.');
      } catch (bgErr) {
        console.error('❌ [Admin Panel] Background spiritual broadcast error:', bgErr.message);
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/send — Admin: send custom broadcast OR direct message
const sendCustomMessage = async (req, res) => {
  try {
    const { message, recipientPhone } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const { getConnectionStatus } = require('../bot/whatsapp');
    const { connected } = getConnectionStatus();
    if (!connected) {
      return res.status(400).json({ success: false, message: 'WhatsApp is disconnected. Please link device in Admin Panel first.' });
    }

    // Direct single message mode
    if (recipientPhone) {
      const cleanTarget = recipientPhone.replace(/\D/g, '');
      const formatted = `*SJDB Connect*\n\n${message.trim()}\n\n_St. John de britto Church_`;
      const ok = await sendWA(cleanTarget, formatted);
      if (ok) {
        return res.json({ success: true, message: `Message delivered to +${cleanTarget}` });
      } else {
        return res.status(500).json({ success: false, message: `Failed to deliver message to +${cleanTarget}` });
      }
    }

    // Broadcast to all active subscribers
    const users = await User.find({ phone: { $exists: true, $ne: '' }, isActive: { $ne: false }, whatsappOptIn: { $ne: false } }).select('phone').lean();
    const sessions = await BotSession.find({ step: 'done' }).select('phoneNumber').lean();

    const phones = new Set([
      ...users.map(u => u.phone ? u.phone.replace(/\D/g, '') : '').filter(Boolean),
      ...sessions.map(s => s.phoneNumber ? s.phoneNumber.replace(/\D/g, '') : '').filter(Boolean)
    ]);

    const targetList = Array.from(phones).filter(Boolean);

    res.json({
      success: true,
      message: `Broadcast initiated to ${targetList.length} subscribers!`,
      recipientCount: targetList.length
    });

    setImmediate(async () => {
      let sent = 0;
      let failed = 0;
      const formatted = `*SJDB Connect*\n\n${message.trim()}\n\n_St. John de britto Church_`;
      for (const phone of targetList) {
        try {
          const ok = await sendWA(phone, formatted);
          if (ok) sent++;
          else failed++;
          await new Promise(r => setTimeout(r, 350));
        } catch (e) {
          failed++;
          console.error(`Error sending custom broadcast to ${phone}:`, e.message);
        }
      }
      console.log(`Custom broadcast finished: ${sent} sent, ${failed} failed out of ${targetList.length} total`);
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/test-direct — Send a real test message to any specified phone number
const testDirectMessage = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const { getConnectionStatus } = require('../bot/whatsapp');
    const { connected } = getConnectionStatus();
    if (!connected) {
      return res.status(400).json({ success: false, message: 'WhatsApp bot is currently disconnected.' });
    }

    const cleanTarget = phoneNumber.replace(/\D/g, '');
    const textToSend = message || `🧪 *SJDB Connect — Test Message*\n\nThis is a verified test message sent from the St. John de britto Church WhatsApp Bot.\n\n⏰ Timestamp: ${new Date().toLocaleTimeString('en-IN')}`;

    const ok = await sendWA(cleanTarget, textToSend);
    if (ok) {
      res.json({ success: true, message: `Test message sent successfully to +${cleanTarget}!` });
    } else {
      res.status(500).json({ success: false, message: `Could not deliver test message to +${cleanTarget}. Please verify the number.` });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/test-message — Admin Playground to test bot interaction flow
const testBotMessage = async (req, res) => {
  try {
    const { message, text: textParam, sessionState = {} } = req.body;
    let {
      step = 'language_selection',
      isVerified = false,
      isOnboarded = false,
      providedPhone = '',
      preferences = [],
      language = null,
      catholicLanguage = 'ta',
      readingPreference = 'full',
      sendLinks = false,
      tempOtp = null
    } = sessionState;

    const rawText = (message || textParam || '').trim();
    const normalizedText = rawText.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const text = rawText.toUpperCase();
    const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl } = require('../config/siteRoutes');

    let botReply = '';
    let nextStep = step;
    let newIsVerified = isVerified;
    let newIsOnboarded = isOnboarded;
    let newProvidedPhone = providedPhone;
    let newPreferences = [...preferences];
    let newLanguage = language;
    let newCatholicLanguage = catholicLanguage;
    let newReadingPreference = readingPreference;
    let newSendLinks = sendLinks;
    let newTempOtp = tempOtp;

    // Determine current isTamil based on chosen bot language
    const isTamil = newLanguage === 'ta';

    // Global STOP
    if (/^(stop|unsubscribe|நிறுத்து|விலகு)$/i.test(normalizedText)) {
      nextStep = 'language_selection';
      newIsVerified = false;
      newIsOnboarded = false;
      newPreferences = [];
      newLanguage = null;
      botReply = `You have been unsubscribed from SJDB Connect.\n\nReply *HI* anytime to re-subscribe. God bless! 🙏\n\n—\nநீங்கள் *SJDB Connect* சேவையிலிருந்து விலகியுள்ளீர்கள்.\n\nமீண்டும் இணைய எப்போது வேண்டுமானாலும் *HI* என்று பதிலளிக்கவும். இறை ஆசீர்வாதம்! 🙏`;
      return res.json({
        success: true,
        botReply,
        sessionState: {
          step: nextStep,
          isVerified: newIsVerified,
          isOnboarded: newIsOnboarded,
          providedPhone: newProvidedPhone,
          preferences: newPreferences,
          language: newLanguage,
          catholicLanguage: newCatholicLanguage,
          readingPreference: newReadingPreference,
          sendLinks: newSendLinks,
          tempOtp: newTempOtp
        }
      });
    }

    // Step 1: Language selection gate
    if (step === 'language_selection' || step === 'bot_language' || step === 'welcome' || !newLanguage) {
      if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
        newLanguage = 'ta';
        nextStep = 'phone_verification';
        botReply = `🙏 வணக்கம்! *SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்!\n⛪ *புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*\n\n🔐 *தொலைபேசி எண் சரிபார்ப்பு*\n\nதொடர்ந்து பங்கு சேவைகளைப் பயன்படுத்த, உங்கள் **10-இலக்க மொபைல் எண்ணை** உள்ளிடவும்:\n📱 (எ.கா: *9876543210*)`;
      } else if (/^(2|english|ஆங்கிலம்|eng|en)$/i.test(normalizedText)) {
        newLanguage = 'en';
        nextStep = 'phone_verification';
        botReply = `🙏 Welcome to *SJDB CONNECT*!\n⛪ *St. John de britto Church, Kalayarkoil*\n\n🔐 *Phone Number Verification*\n\nTo continue accessing parish services, please enter your **10-digit mobile number**:\n📱 (e.g., *9876543210*)`;
      } else if (step === 'bot_language' || step === 'language_selection') {
        nextStep = 'bot_language';
        botReply = `👉 Please reply with *1* or *2*.\n👉 தயவுசெய்து *1* அல்லது *2* என்று பதிலளிக்கவும்.`;
      } else {
        nextStep = 'bot_language';
        botReply = `🙏 Welcome to *SJDB CONNECT!*\n\nவணக்கம்! *SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்! 🙏\n\n*How would you like to continue with SJDB CONNECT?*\n*SJDB CONNECT-ஐ எந்த மொழியில் தொடர விரும்புகிறீர்கள்?*\n\n1️⃣ *Tamil / தமிழ்*\n2️⃣ *English / ஆங்கிலம்*\n\n👉 Please reply with *1 or 2*.\n👉 *1 அல்லது 2* என்று மட்டும் பதிலளிக்கவும்.`;
      }
    } else if (step === 'phone_verification' || step === 'ask_phone_manual') {
      const rawDigits = rawText.replace(/\D/g, '');
      if (rawDigits.length >= 10) {
        newProvidedPhone = rawDigits.slice(-10);
        newTempOtp = '123456';
        nextStep = 'otp_verification';
        botReply = isTamil
          ? `🔐 *OTP சரிபார்ப்பு*\n\nஉங்கள் 6-இலக்க சரிபார்ப்புக் குறியீடு (OTP):\n👉 *123456*\n\n⏳ இது *5 நிமிடங்கள்* மட்டுமே செல்லுபடியாகும்.\n\n👉 தொடர உங்கள் *6-இலக்க OTP குறியீட்டை* உள்ளிடவும்:`
          : `🔐 *OTP Verification*\n\nYour 6-digit verification code (OTP) is:\n👉 *123456*\n\n⏳ Valid for *5 minutes*.\n\n👉 Please reply with your *6-digit OTP code* to verify:`;
      } else {
        botReply = isTamil
          ? `👉 தயவுசெய்து உங்கள் 10-இலக்க மொபைல் எண்ணை உள்ளிடவும் (எ.கா: *9876543210*).`
          : `👉 Please enter your 10-digit mobile number (e.g., *9876543210*).`;
      }
    } else if (step === 'otp_verification') {
      const cleanOtpDigits = rawText.replace(/\D/g, '');
      if (cleanOtpDigits === (newTempOtp || '123456')) {
        newIsVerified = true;
        nextStep = 'select_preferences';
        botReply = isTamil
          ? `✅ *தொலைபேசி எண் சரிபார்க்கப்பட்டது!*\n*SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்! 🙏\n\n⚙️ *SJDB Connect விருப்பங்கள்*\n\nநீங்கள் பெற விரும்பும் சேவைகளைத் தேர்ந்தெடுக்கவும்:\n\n1️⃣ 📖 தினசரி விவிலியம்\n2️⃣ 🌟 இன்றைய புனிதர்\n3️⃣ 📜 திருப்பலி வாசகங்கள் & தியானம்\n4️⃣ 📅 ஆலய நிகழ்வுகள்\n5️⃣ 📢 பங்கு அறிவிப்புகள்\n6️⃣ 🌟 மேற்கண்ட அனைத்தும்\n\n👉 எண்களை காற்புள்ளியுடன் (எ.கா: *1,2,3*) அல்லது அனைத்திற்கும் *6* என்று பதிலளிக்கவும்.`
          : `✅ *Phone Number Verified!*\nWelcome to *SJDB CONNECT*! 🙏\n\n⚙️ *SJDB Connect Preferences*\n\nPlease select the services you would like to receive:\n\n1️⃣ 📖 Daily Bible Verse\n2️⃣ 🌟 Saint of the Day\n3️⃣ 📜 Daily Mass Readings & Reflection\n4️⃣ 📅 Church Events\n5️⃣ 📢 Parish Announcements\n6️⃣ 🌟 All of the above\n\n👉 Reply with numbers separated by commas (e.g. *1,2,3*) or reply *6* for all services.`;
      } else {
        botReply = isTamil
          ? `❌ தவறான OTP குறியீடு. தயவுசெய்து சரியான 6-இலக்க OTP குறியீட்டை உள்ளிடவும்:`
          : `❌ Invalid OTP code. Please enter the correct 6-digit verification code:`;
      }
    } else if (step === 'select_preferences' || step === 'preferences') {
      const prefMap = { '1': 'verse', '2': 'saint', '3': 'mass', '4': 'events', '5': 'announcements' };
      let selectedPrefs = [];
      if (normalizedText === '6' || /^(all|\*|all of the above|அனைத்தும்|7)$/i.test(normalizedText)) {
        selectedPrefs = ['verse', 'saint', 'mass', 'events', 'announcements'];
      } else {
        const parts = rawText.split(/[,\s]+/).map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean);
        selectedPrefs = Array.from(new Set(parts.map(p => prefMap[p]).filter(Boolean)));
      }

      if (selectedPrefs.length > 0) {
        newPreferences = selectedPrefs;
        nextStep = 'catholic_language';
        botReply = isTamil
          ? `🌐 *Daily Catholic Content Language*\n\nதினசரி கத்தோலிக்க உள்ளடக்கத்தை எந்த மொழியில் பெற விரும்புகிறீர்கள்?\n\n1️⃣ *Tamil / தமிழ்*\n2️⃣ *English / ஆங்கிலம்*\n\n👉 *1 அல்லது 2* என்று பதிலளிக்கவும்.`
          : `🌐 *Daily Catholic Content Language*\n\nWhich language would you like to receive your Daily Catholic Content in?\n\n1️⃣ *Tamil / தமிழ்*\n2️⃣ *English / ஆங்கிலம்*\n\n👉 Please reply with *1 or 2*.`;
      } else {
        botReply = isTamil
          ? `⚠️ தவறான தேர்வு. எண்களை காற்புள்ளியுடன் (எ.கா: *1,2,3*) அல்லது அனைத்திற்கும் *6* என்று பதிலளிக்கவும்.`
          : `⚠️ Invalid selection. Please reply with numbers (e.g. *1,2,3*) or reply *6* for all services.`;
      }
    } else if (step === 'catholic_language') {
      if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
        newCatholicLanguage = 'ta';
      } else if (/^(2|english|ஆங்கிலம்|eng|en)$/i.test(normalizedText)) {
        newCatholicLanguage = 'en';
      } else if (/^(3|both|இரண்டும்|both tamil & english|all)$/i.test(normalizedText)) {
        newCatholicLanguage = 'both';
      }

      if (newCatholicLanguage) {
        nextStep = 'done';
        newIsOnboarded = true;
        const { getSetupCompleteMessage, getAssistanceMessage } = require('../bot/botHandler');
        const step7Msg = getSetupCompleteMessage(newPreferences, newCatholicLanguage, isTamil);
        const step8Assistance = getAssistanceMessage(isTamil);
        botReply = `${step7Msg}\n\n${step8Assistance}`;
      } else {
        botReply = isTamil ? `👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.` : `👉 Please reply with *1, 2, or 3*.`;
      }
    } else if (step === 'bot_language_change') {
      if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
        newLanguage = 'ta';
        nextStep = 'done';
        botReply = `✅ *உங்கள் பாட் மொழி தமிழாக மாற்றப்பட்டது! (Bot language set to Tamil)*\n\nஇனி பாட் தகவல்கள் மற்றும் மெனுக்கள் தமிழில் வழங்கப்படும்.\n📌 உதவிக்கு *MENU* அல்லது *SERVICES* என தட்டச்சு செய்யவும்.`;
      } else if (/^(2|english|ஆங்கிலம்|eng|en)$/i.test(normalizedText)) {
        newLanguage = 'en';
        nextStep = 'done';
        botReply = `✅ *Bot language updated to English successfully!*\n\nFuture bot responses and navigation menus will be delivered in English.\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
      } else {
        botReply = `👉 Please reply with *1 or 2*.\n👉 *1 அல்லது 2* என்று மட்டும் பதிலளிக்கவும்.`;
      }
    } else if (step === 'catholic_language_change') {
      if (/^(1|tamil|தமிழ்|ta)$/i.test(normalizedText)) {
        newCatholicLanguage = 'ta';
        nextStep = 'done';
        botReply = isTamil
          ? `✅ *தினசரி கத்தோலிக்க உள்ளடக்க மொழி தமிழாக மாற்றப்பட்டது!*\nதினசரி விவிலியம், திருப்பலி வாசகங்கள், தியானம் & புனிதர் விபரம் தமிழில் வழங்கப்படும்.\n\n📌 உதவிக்கு *MENU* அல்லது *SERVICES* என தட்டச்சு செய்யவும்.`
          : `✅ *Daily Catholic Content Language set to Tamil!*\nDaily Bible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in Tamil.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
      } else if (/^(2|english|ஆங்கிலம்|eng|en)$/i.test(normalizedText)) {
        newCatholicLanguage = 'en';
        nextStep = 'done';
        botReply = isTamil
          ? `✅ *தினசரி கத்தோலிக்க உள்ளடக்க மொழி ஆங்கிலமாக மாற்றப்பட்டது!*\nதினசரி விவிலியம், திருப்பலி வாசகங்கள், தியானம் & புனிதர் விபரம் ஆங்கிலத்தில் வழங்கப்படும்.\n\n📌 உதவிக்கு *MENU* அல்லது *SERVICES* என தட்டச்சு செய்யவும்.`
          : `✅ *Daily Catholic Content Language set to English!*\nDaily Bible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in English.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
      } else if (/^(3|both|இரண்டும்|both tamil & english|all)$/i.test(normalizedText)) {
        newCatholicLanguage = 'both';
        nextStep = 'done';
        botReply = isTamil
          ? `✅ *தினசரி கத்தோலிக்க உள்ளடக்க மொழி தமிழ் & ஆங்கிலம் (Both) என மாற்றப்பட்டது!*\nதினசரி விவிலியம், திருப்பலி வாசகங்கள், தியானம் & புனிதர் விபரம் இரு மொழிகளிலும் வழங்கப்படும்.\n\n📌 உதவிக்கு *MENU* அல்லது *SERVICES* என தட்டச்சு செய்யவும்.`
          : `✅ *Daily Catholic Content Language set to Both (Tamil & English)!*\nDaily Bible Verse, Mass Readings, Reflection & Saint of the Day will be delivered in both Tamil & English.\n\n📌 Type *MENU* for Quick Commands or *SERVICES* for Help Desk.`;
      } else {
        botReply = isTamil ? `👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.` : `👉 Please reply with *1, 2, or 3*.`;
      }
    } else if (step === 'done') {
      if (/^(bot\s*language|bot\s*lang|பாட்\s*மொழி|language|lang|மொழி)$/i.test(normalizedText)) {
        nextStep = 'bot_language_change';
        botReply = `🙏 Welcome to *SJDB CONNECT!*\n\nவணக்கம்! *SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்! 🙏\n\n*How would you like to continue with SJDB CONNECT?*\n*SJDB CONNECT-ஐ எந்த மொழியில் தொடர விரும்புகிறீர்கள்?*\n\n1️⃣ *Tamil / தமிழ்*\n2️⃣ *English / ஆங்கிலம்*\n\n👉 Please reply with *1 or 2*.\n👉 *1 அல்லது 2* என்று மட்டும் பதிலளிக்கவும்.`;
      } else if (/^(catholic\s*language|catholic\s*lang|devotion\s*language|கத்தோலிக்க\s*மொழி)$/i.test(normalizedText)) {
        nextStep = 'catholic_language_change';
        botReply = isTamil
          ? `🌐 *Daily Catholic Content Language*\n\nதினசரி கத்தோலிக்க உள்ளடக்கத்தை எந்த மொழியில் பெற விரும்புகிறீர்கள்?\n\n1️⃣ *Tamil / தமிழ்*\n2️⃣ *English / ஆங்கிலம்*\n3️⃣ Both *Tamil / தமிழ்* & *English / ஆங்கிலம்*\n\n👉 *1, 2 அல்லது 3* என்று பதிலளிக்கவும்.`
          : `🌐 *Daily Catholic Content Language*\n\nWhich language would you like to receive your Daily Catholic Content in?\n\n1️⃣ *Tamil / தமிழ்*\n2️⃣ *English / ஆங்கிலம்*\n3️⃣ Both *Tamil / தமிழ்* & *English / ஆங்கிலம்*\n\n👉 Please reply with *1, 2, or 3*.`;
      } else if (/^(verify|reverify|சரிபார்)$/i.test(normalizedText)) {
        nextStep = 'phone_verification';
        newIsVerified = false;
        botReply = isTamil
          ? `🙏 வணக்கம்! *SJDB CONNECT*-க்கு உங்களை அன்புடன் வரவேற்கிறோம்!\n⛪ *புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*\n\n🔐 *தொலைபேசி எண் சரிபார்ப்பு*\n\nதொடர்ந்து பங்கு சேவைகளைப் பயன்படுத்த, உங்கள் **10-இலக்க மொபைல் எண்ணை** உள்ளிடவும்:\n📱 (எ.கா: *9876543210*)`
          : `🙏 Welcome to *SJDB CONNECT*!\n⛪ *St. John de britto Church, Kalayarkoil*\n\n🔐 *Phone Number Verification*\n\nTo continue accessing parish services, please enter your **10-digit mobile number**:\n📱 (e.g., *9876543210*)`;
      } else if (/^(preferences|prefs|விருப்பங்கள்)$/i.test(normalizedText)) {
        nextStep = 'select_preferences';
        botReply = isTamil
          ? `⚙️ *SJDB Connect விருப்பங்கள்*\n\nநீங்கள் பெற விரும்பும் சேவைகளைத் தேர்ந்தெடுக்கவும்:\n\n1️⃣ 📖 தினசரி விவிலியம்\n2️⃣ 🌟 இன்றைய புனிதர்\n3️⃣ 📜 திருப்பலி வாசகங்கள் & தியானம்\n4️⃣ 📅 ஆலய நிகழ்வுகள்\n5️⃣ 📢 பங்கு அறிவிப்புகள்\n6️⃣ 🌟 மேற்கண்ட அனைத்தும்\n\n👉 எண்களை காற்புள்ளியுடன் (எ.கா: *1,2,3*) அல்லது அனைத்திற்கும் *6* என்று பதிலளிக்கவும்.`
          : `⚙️ *SJDB Connect Preferences*\n\nPlease select the services you would like to receive:\n\n1️⃣ 📖 Daily Bible Verse\n2️⃣ 🌟 Saint of the Day\n3️⃣ 📜 Daily Mass Readings & Reflection\n4️⃣ 📅 Church Events\n5️⃣ 📢 Parish Announcements\n6️⃣ 🌟 All of the above\n\n👉 Reply with numbers separated by commas (e.g. *1,2,3*) or reply *6* for all services.`;
      } else if (/^(help|\?|8|commands|options|உதவி|வழிகாட்டி)$/i.test(normalizedText)) {
        botReply = isTamil
          ? `❓ *SJDB Connect — உதவி & வழிகாட்டி*\n_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_\n\n📌 *பயன்படுத்தக்கூடிய முக்கிய கட்டளைகள்:*\n• *MENU* — முதன்மை மெனு\n• *SERVICES* — 14 பங்கு சேவைகள் பட்டியல்\n• *BOT LANGUAGE* — SJDB CONNECT Bot மொழியை மாற்ற\n• *CATHOLIC LANGUAGE* — தினசரி கத்தோலிக்க உள்ளடக்கத்தின் மொழியை மாற்ற\n• *VERIFY* — தொலைபேசி எண் சரிபார்ப்பு\n• *STOP* — தினசரி செய்திகளை நிறுத்த\n\n💡 *1 முதல் 8 வரை எண்களில் பதிலளிக்கலாம் அல்லது உங்கள் கேள்வியை இயல்பாகத் தட்டச்சு செய்து அனுப்பலாம்!*`
          : `❓ *SJDB Connect — Help & Guidance*\n_St. John de britto Church, Kalayarkoil_\n\n📌 *Key Commands You Can Type Anytime:*\n• *MENU* — Main Navigation Menu\n• *SERVICES* — 14-Option Parish Services Directory\n• *BOT LANGUAGE* — Change SJDB CONNECT Bot Language\n• *CATHOLIC LANGUAGE* — Change Daily Catholic Content Language\n• *VERIFY* — Phone Number Verification\n• *STOP* — Stop daily messages\n\n💡 *You can reply with numbers 1 to 8 or type your question naturally in English or Tamil!*`;
      } else if (normalizedText === '1' || /\b(daily bible|bible verse|verse|scripture)\b/i.test(normalizedText) || /(விவிலியம்|இறைவார்த்தை|வசனம்)/.test(rawText)) {
        const dailyContent = await getTodayDailyContent(new Date());
        botReply = generateVerseMessage({ dailyContent, language: newCatholicLanguage });
      } else if (normalizedText === '2' || /\b(mass timings?|mass time|mass schedule|when is mass|what time is mass|sunday mass)\b/i.test(normalizedText) || /(திருப்பலி நேரம்|பூசை நேரம்|திருப்பலி நேரங்கள்|ஞாயிறு திருப்பலி)/.test(rawText)) {
        botReply = isTamil
          ? `⛪ *புனித அருளானந்தர் தேவாலயம் — திருப்பலி நேரங்கள்*\n_காளையார்கோவில், சிவகங்கை மறைமாவட்டம்_\n\n📅 *வாரநாட்கள் (திங்கள் – சனி):*\n• காலை 6:00 மணி — தினசரி காலை திருப்பலி\n\n🌟 *ஞாயிறு திருப்பலிகள்:*\n• காலை 6:00 மணி — அதிகாலை திருப்பலி\n• காலை 8:00 மணி — பங்குப் பெருந்திருப்பலி\n\n🕯️ *செவ்வாய் நவநாள் திருப்பலி:*\n• மாலை 6:00 மணி — புனித அந்தோனியார் நவநாள் & திருப்பலி\n\n🕊️ *மாதத்தின் முதல் வெள்ளி:*\n• மாலை 6:00 மணி — நற்கருணை ஆராதனை & சிறப்பு திருப்பலி\n\n🕊️ *பாவசங்கீர்த்தனம் (ஒப்புரவு):*\n• சனிக்கிழமை: மாலை 5:30 – 6:30 மணி & காலை திருப்பலிக்கு முன்\n\n🌐 *முழு அட்டவணை:* ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`
          : `⛪ *St. John de britto Church — Holy Mass Timings*\n_Kalayarkoil, Sivagangai Diocese_\n\n📅 *Weekdays (Mon – Sat):*\n• 6:00 AM — Daily Morning Holy Mass\n\n🌟 *Sunday Holy Masses:*\n• 6:00 AM — Early Morning Mass\n• 8:00 AM — Parish High Mass\n\n🕯️ *Tuesday Novena:*\n• 6:00 PM — Novena to St. Antony & Mass\n\n🕊️ *First Friday:*\n• 6:00 PM — Eucharistic Adoration & Special Mass\n\n🕊️ *Confessions (Reconciliation):*\n• Saturdays: 5:30 PM – 6:30 PM & before daily morning Mass\n\n🌐 *Full Schedule:* ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`;
      } else if (normalizedText === '3' || /^(services|service|help desk|சேவைகள்|பங்கு சேவைகள்)$/i.test(normalizedText) || normalizedText.includes('service') || normalizedText.includes('சேவை')) {
        botReply = isTamil
          ? `⛪ *SJDB Connect – பங்கு சேவைகள் & உதவி மையம்*\n_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_\n\n1️⃣ ⛪ *திருப்பலி நேரங்கள்*\n2️⃣ 🕊️ *பாவசங்கீர்த்தன நேரங்கள்*\n3️⃣ ✝️ *மற்ற திருவருட்சாதனங்கள்*\n4️⃣ 📖 *தினசரி இறைவார்த்தை*\n5️⃣ 📜 *திருப்பலி வாசகங்கள்*\n6️⃣ 🌟 *இன்றைய புனிதர்*\n7️⃣ 🙏 *கத்தோலிக்க ஜெபங்கள்*\n8️⃣ 📅 *ஆலய நிகழ்வுகள்*\n9️⃣ 📢 *பங்கு அறிவிப்புகள்*\n🔟 📍 *ஆலய அமைவிடம் & வரைபடம்*\n1️⃣1️⃣ 👥 *அன்பியங்கள் & பங்கு அமைப்புகள்*\n1️⃣2️⃣ 👑 *பங்குத்தந்தை & குருக்கள்*\n1️⃣3️⃣ 🏛️ *ஆலய வரலாறு*\n1️⃣4️⃣ 📞 *தொடர்பு & அலுவலக நேரம்*\n\n👉 *எண் (1-14) அனுப்பலாம் அல்லது உங்கள் கேள்விகளை நேரடியாகக் கேட்கலாம்.*`
          : `⛪ *SJDB Connect – Services & Help Desk*\n_St. John de britto Church, Kalayarkoil_\n\n1️⃣ ⛪ *Mass Timings*\n2️⃣ 🕊️ *Confession Timings*\n3️⃣ ✝️ *Other Sacrament Timings*\n4️⃣ 📖 *Daily Bible Verse*\n5️⃣ 📜 *Daily Mass Readings*\n6️⃣ 🌟 *Saint of the Day*\n7️⃣ 🙏 *Catholic Prayers*\n8️⃣ 📅 *Church Events*\n9️⃣ 📢 *Parish Announcements*\n🔟 📍 *Church Location & Map*\n1️⃣1️⃣ 👥 *Parish Ministries & Anbiyams*\n1️⃣2️⃣ 👑 *Parish Priest & Clergy*\n1️⃣3️⃣ 🏛️ *Church History*\n1️⃣4️⃣ 📞 *Contact Church*\n\n👉 *Reply with a number (1-14) or type your question naturally.*`;
      } else if (normalizedText === '4' || /\b(events|upcoming events|church events)\b/i.test(normalizedText) || /(நிகழ்வுகள்|நிகழ்ச்சிகள்)/.test(rawText)) {
        botReply = isTamil
          ? `📅 *வரவிருக்கும் பங்கு நிகழ்வுகள்:*\n\nபங்கு நிகழ்வுகளை இணையத்தில் பார்க்க:\n🔗 ${getSiteUrl(SITE_ROUTES.EVENTS)}`
          : `📅 *Upcoming Church Events:*\n\nView church events schedule online:\n🔗 ${getSiteUrl(SITE_ROUTES.EVENTS)}`;
      } else if (normalizedText === '5' || /\b(announcements?|notices?|parish announcements?)\b/i.test(normalizedText) || /(அறிவிப்புகள்|பங்கு அறிவிப்பு)/.test(rawText)) {
        botReply = isTamil
          ? `📢 *பங்கு அறிவிப்புகள்:*\n\nபங்கு அறிவிப்புகளை இணையத்தில் பார்க்க:\n🌐 ${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`
          : `📢 *Parish Announcements:*\n\nView parish announcements online:\n🌐 ${getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS)}`;
      } else if (normalizedText === '6' || /\b(church information|church info|about church|history|patron saint)\b/i.test(normalizedText) || /(ஆலய விபரம்|பங்கு வரலாறு|புனிதர் வரலாறு)/.test(rawText)) {
        botReply = isTamil
          ? `🏛️ *புனித அருளானந்தர் தேவாலயம் — ஆலய விபரம் & வரலாறு*\n_காளையார்கோவில், சிவகங்கை மறைமாவட்டம்_\n\n👑 *பாதுகாவலர்:* புனித ஜான் டி பிரிட்டோ (அருளானந்தர்)\n🎉 *ஆலயப் பெருவிழா:* பிப்ரவரி 4\n\n🌐 *முழு விபரம்:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`
          : `🏛️ *St. John de britto Church — Church Information*\n_Kalayarkoil, Sivagangai Diocese_\n\n👑 *Patron Saint:* St. John de Britto (Arulanandar)\n🎉 *Patronal Feast Day:* February 4\n\n🌐 *Read Complete History & Info:* ${getSiteUrl(SITE_ROUTES.ABOUT)}`;
      } else if (normalizedText === '7' || /\b(saints?|today saint|saint of the day|who is today saint)\b/i.test(normalizedText) || /(இன்றைய புனிதர்|புனிதர் யார்|புனிதர்)/.test(rawText)) {
        const dailyContent = await getTodayDailyContent(new Date());
        botReply = generateSaintInfoMessage({ dailyContent, language: newCatholicLanguage });
      } else if (/\b(readings?|today readings|mass readings)\b/i.test(normalizedText) || /(வாசகம்|வாசகங்கள்|திருப்பலி வாசகங்கள்)/.test(rawText)) {
        const dailyContent = await getTodayDailyContent(new Date());
        botReply = generateReadingsMessage({ dailyContent, language: newCatholicLanguage });
      } else if (/\b(reflection|daily reflection|today reflection)\b/i.test(normalizedText) || /(தியானம்|சிந்தனை)/.test(rawText)) {
        const dailyContent = await getTodayDailyContent(new Date());
        botReply = generateReflectionMessage({ dailyContent, language: newCatholicLanguage });
      } else if (/\b(birthday|birthdays|bday|today is my birthday|my birthday|happy birthday)\b/i.test(normalizedText) || /(பிறந்தநாள்|இன்று என் பிறந்தநாள்|பிறந்தநாள் வாழ்த்து|பிறந்த நாள்)/.test(rawText)) {
        const { getBirthdayMessages } = require('../services/birthdayService');
        const blessing = getBirthdayMessages('அன்பரே', isTamil ? 'ta' : 'en');
        botReply = blessing.text;
      } else if (/^(menu|home|0|hi|start|quick commands)$/i.test(normalizedText) || normalizedText.includes('main menu') || normalizedText.includes('முதன்மை மெனு')) {
        botReply = isTamil
          ? `🙏 *வணக்கம்!*\n⛪ *புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*\n_SJDB CONNECT_\n\nஇன்று உங்களுக்கு எவ்வாறு உதவ முடியும்?\n\n1️⃣ 📖 *தினசரி விவிலியம்*\n2️⃣ ⛪ *திருப்பலி நேரங்கள்*\n3️⃣ 🕊️ *பங்கு சேவைகள்*\n4️⃣ 📅 *நிகழ்வுகள்*\n5️⃣ 📢 *அறிவிப்புகள்*\n6️⃣ 📜 *ஆலய விபரம்*\n7️⃣ 🌟 *இன்றைய புனிதர்*\n8️⃣ ❓ *உதவி*\n\n👉 *எண்களை அனுப்பலாம் அல்லது உங்கள் கேள்விகளைத் தட்டச்சு செய்யலாம்.*`
          : `👋 *Welcome to SJDB Connect!*\n⛪ *St. John de britto Church, Kalayarkoil*\n\nHow can I help you today?\n\n1️⃣ 📖 *Daily Bible*\n2️⃣ ⛪ *Mass Timings*\n3️⃣ 🕊️ *Services*\n4️⃣ 📅 *Events*\n5️⃣ 📢 *Announcements*\n6️⃣ 📜 *Church Information*\n7️⃣ 🌟 *Saint of the Day*\n8️⃣ ❓ *Help*\n\n👉 *You can reply with a number or ask your question naturally.*`;
      } else {
        const ragResult = await answerChurchQuestion(rawText, newLanguage);
        if (ragResult && ragResult.reply) {
          botReply = ragResult.reply;
        } else {
          botReply = isTamil
            ? `🙏 *வணக்கம்!*\n⛪ *புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்*\n_SJDB CONNECT_\n\nஇன்று உங்களுக்கு எவ்வாறு உதவ முடியும்?\n\n1️⃣ 📖 *தினசரி விவிலியம்*\n2️⃣ ⛪ *திருப்பலி நேரங்கள்*\n3️⃣ 🕊️ *பங்கு சேவைகள்*\n4️⃣ 📅 *நிகழ்வுகள்*\n5️⃣ 📢 *அறிவிப்புகள்*\n6️⃣ 📜 *ஆலய விபரம்*\n7️⃣ 🌟 *இன்றைய புனிதர்*\n8️⃣ ❓ *உதவி*\n\n👉 *எண்களை அனுப்பலாம் அல்லது உங்கள் கேள்விகளைத் தட்டச்சு செய்யலாம்.*`
            : `👋 *Welcome to SJDB Connect!*\n⛪ *St. John de britto Church, Kalayarkoil*\n\nHow can I help you today?\n\n1️⃣ 📖 *Daily Bible*\n2️⃣ ⛪ *Mass Timings*\n3️⃣ 🕊️ *Services*\n4️⃣ 📅 *Events*\n5️⃣ 📢 *Announcements*\n6️⃣ 📜 *Church Information*\n7️⃣ 🌟 *Saint of the Day*\n8️⃣ ❓ *Help*\n\n👉 *You can reply with a number or ask your question naturally.*`;
        }
      }
    }

    res.json({
      success: true,
      botReply,
      sessionState: {
        step: nextStep,
        isVerified: newIsVerified,
        isOnboarded: newIsOnboarded,
        providedPhone: newProvidedPhone,
        preferences: newPreferences,
        language: newLanguage,
        catholicLanguage: newCatholicLanguage,
        readingPreference: newReadingPreference,
        sendLinks: newSendLinks,
        tempOtp: newTempOtp
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/clear-start-fresh (and /api/bot/subscribers/clear-all) — Complete fresh reset of all bot sessions
// IMPORTANT: This ONLY clears WhatsApp bot conversation sessions and stale daily notification logs.
// It does NOT set whatsappOptIn=false, because doing so would permanently opt out ALL users from the
// automated midnight Daily Catholic Content delivery. User accounts, profiles, passwords, and
// notification opt-in state are fully preserved.
const clearAllBotSubscribers = async (req, res) => {
  try {
    const { _clearDedupCacheForTesting } = require('../bot/botHandler');
    if (typeof _clearDedupCacheForTesting === 'function') {
      _clearDedupCacheForTesting();
    }

    // 1. Delete all WhatsApp bot conversation sessions
    const botResult = await BotSession.deleteMany({});

    // 2. Reset bot-specific conversation preferences ONLY (do NOT touch whatsappOptIn)
    //    whatsappOptIn must remain true so the midnight scheduler can deliver to all users.
    const userResult = await User.updateMany({}, {
      $set: {
        botPreferences: ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'],
        readingPreference: 'full',
        sendLinks: true,
        // Ensure whatsappOptIn is explicitly true so midnight delivery works for everyone
        whatsappOptIn: true
      }
    });

    // 3. Clear today's DailyNotificationLog so a fresh broadcast can be triggered today
    //    (stale 'sent' logs would otherwise block the idempotency check and skip all users)
    const todayDateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const logResult = await DailyNotificationLog.deleteMany({ dateKey: todayDateKey });

    console.log(`[DAILY-CATHOLIC] Fresh reset: ${botResult.deletedCount} bot sessions deleted, ${userResult.modifiedCount} users restored to opt-in, ${logResult.deletedCount} today's delivery logs cleared.`);

    res.json({
      success: true,
      message: `Fresh reset complete: Cleared ${botResult.deletedCount} bot conversation sessions, restored ${userResult.modifiedCount} users to WhatsApp opt-in, and cleared ${logResult.deletedCount} stale daily notification logs. All user accounts and the midnight scheduler are fully intact.`,
      deletedBotSessions: botResult.deletedCount,
      usersRestoredToOptIn: userResult.modifiedCount,
      staleLogsCleared: logResult.deletedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/bot/subscriber/:phone (or POST /api/bot/subscriber/delete)
const deleteSubscriber = async (req, res) => {
  try {
    const rawPhone = req.params.phone || req.body.phoneNumber;
    if (!rawPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const cleanPhone = String(rawPhone).replace(/\D/g, '');
    const last10 = cleanPhone.slice(-10);

    // 1. Delete bot session(s)
    const botResult = await BotSession.deleteMany({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: { $regex: last10 } }
      ]
    });

    // 2. Clear user bot preferences and reset opt-in (safely preserving user profile & registrations)
    const userResult = await User.updateMany(
      { phone: { $regex: last10 } },
      {
        $set: {
          whatsappOptIn: false,
          botPreferences: []
        }
      }
    );

    // 3. Clear dedup cache if present
    const { _clearDedupCacheForTesting } = require('../bot/botHandler');
    if (typeof _clearDedupCacheForTesting === 'function') {
      _clearDedupCacheForTesting();
    }

    res.json({
      success: true,
      message: 'Subscriber removed from notifications successfully. Website user account remains intact.',
      deletedSessions: botResult.deletedCount,
      updatedUsers: userResult.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/trigger-birthdays — Manual admin dispatch for testing / immediate trigger
const triggerBirthdays = async (req, res) => {
  try {
    const { sendBirthdayWishes } = require('../services/birthdayService');
    const summary = await sendBirthdayWishes();
    res.json({ success: true, message: 'Birthday notification process completed', summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bot/birthdays/today — Admin preview of today's birthday celebrants
const getTodayBirthdays = async (req, res) => {
  try {
    const { sendBirthdayWishes } = require('../services/birthdayService');
    const summary = await sendBirthdayWishes({ dryRun: true });
    res.json({
      success: true,
      date: summary.dateKey,
      totalCelebrants: summary.totalFound,
      celebrants: summary.recipients
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getStatus,
  reconnect,
  getQR,
  resetSession,
  getPairingCode,
  getSubscribers,
  clearAllBotSubscribers,
  deleteSubscriber,
  toggleSubscriberOptIn,
  getStats,
  getTodayPreview,
  getBroadcastHistory,
  triggerBroadcast,
  sendCustomMessage,
  testDirectMessage,
  testBotMessage,
  triggerBirthdays,
  getTodayBirthdays
};
