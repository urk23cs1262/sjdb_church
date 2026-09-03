const { triggerBroadcastNow } = require('../services/dailyBroadcastService');
const BotSession = require('../models/BotSession');
const User = require('../models/User');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const { getTodayDailyContent } = require('../services/dailyContentService');
const { generateDailyCatholicMessage, generateDailyLinksMessage, generateSaintInfoMessage } = require('../services/whatsappDailyFormatter');
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
      const formatted = `*SJDB Connect*\n\n${message.trim()}\n\n_St. John de Britto's Church_`;
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
      const formatted = `*SJDB Connect*\n\n${message.trim()}\n\n_St. John de Britto's Church_`;
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
    const textToSend = message || `🧪 *SJDB Connect — Test Message*\n\nThis is a verified test message sent from the St. John de Britto's Church WhatsApp Bot.\n\n⏰ Timestamp: ${new Date().toLocaleTimeString('en-IN')}`;

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
    const { message, sessionState = {} } = req.body;
    let {
      step = 'welcome',
      isVerified = false,
      providedPhone = '',
      preferences = [],
      language = 'en',
      readingPreference = 'full',
      sendLinks = false
    } = sessionState;

    const rawText = (message || '').trim();
    const text = rawText.toUpperCase();
    const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl } = require('../config/siteRoutes');

    let botReply = '';
    let nextStep = step;
    let newIsVerified = isVerified;
    let newProvidedPhone = providedPhone;
    let newPreferences = [...preferences];
    let newLanguage = language;
    let newReadingPreference = readingPreference;
    let newSendLinks = sendLinks;

    const normalizedForTrigger = rawText.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isStartTrigger = /^(hi|hello|hey|start|reset|menu|வணக்கம்)$/i.test(normalizedForTrigger) ||
      normalizedForTrigger.includes('sjdb connect') ||
      normalizedForTrigger.includes('connecting faith & community') ||
      normalizedForTrigger.includes('connecting faith and community') ||
      (normalizedForTrigger.includes('hi') && normalizedForTrigger.includes('sjdb'));

    if (isStartTrigger) {
      if (newIsVerified && newProvidedPhone) {
        nextStep = 'done';
        botReply = `👋 *Welcome to SJDB Connect!*
⛪ *St. John de Britto's Church, Kalayarkoil*

How can I help you today?

1️⃣ 📖 *Daily Bible*
2️⃣ ⛪ *Mass Timings*
3️⃣ 🕊️ *Services*
4️⃣ 📅 *Events*
5️⃣ 📢 *Announcements*
6️⃣ 📜 *Church Information*
7️⃣ 🌟 *Saint of the Day*
8️⃣ ❓ *Help*

👉 *You can reply with a number or ask your question naturally.*`;
      } else {
        nextStep = 'phone_verification';
        botReply = `👋 *Welcome to SJDB Connect!*
⛪ *St. John de Britto's Church, Kalayarkoil*
_Connecting Faith & Community_

🔐 *Phone Number Verification*

To start chatting and access church services, please enter your **10-digit mobile phone number** to verify your account.

📱 *Please reply with your 10-digit mobile number (e.g., 9876543210):*`;
      }
    } else if (step === 'welcome') {
      botReply = `👋 *Welcome to SJDB Connect!*\n⛪ *St. John de Britto's Church, Kalayarkoil*\n\nPlease reply with *Hi* or enter your 10-digit mobile number to verify your account.`;
    } else if (step === 'phone_verification' || step === 'ask_phone') {
      const rawDigits = rawText.replace(/\D/g, '');
      if (!rawDigits || rawDigits.length < 10) {
        botReply = `⚠️ Please enter a valid 10-digit mobile phone number (e.g., *9876543210*).\n\n📱 *Please reply with your 10-digit mobile number:*`;
      } else {
        const clean10Digits = rawDigits.slice(-10);
        newProvidedPhone = clean10Digits;
        newIsVerified = true;
        nextStep = 'preferences';

        const parishUser = await User.findOne({ phone: { $regex: clean10Digits } });
        let ackHeader = '';

        if (parishUser) {
          const zoneOrAnbiyam = parishUser.anbiyam || parishUser.subStation || parishUser.parishZone || 'Parishioner';
          ackHeader = `✅ *Phone Number Verified!*\nWelcome, *${parishUser.name}* (${zoneOrAnbiyam})! 🙏\n\n`;
        } else {
          ackHeader = `✅ *Phone Number Verified!*\n📱 Phone: *+91 ${clean10Digits}*\n\n`;
        }

        const prefMenu = `📋 *SJDB Connect Preferences*

Please select the services you would like to receive:

1️⃣ Daily Bible Verse
2️⃣ Saint of the Day
3️⃣ Daily Mass Readings & Reflection
4️⃣ Church Events
5️⃣ Parish Announcements
6️⃣ Birthday Wishes
7️⃣ All of the above

👉 Reply with numbers separated by commas (e.g. 1,2,3) or reply *7 / ALL* for all services.

➡️ Type *Menu* for Quick Commands
➡️ Type *Services* for Help Desk`;
        botReply = `${ackHeader}${prefMenu}`;
      }
    } else if (step === 'preferences') {
      const prefMap = { '1': 'verse', '2': 'saint', '3': 'mass', '4': 'events', '5': 'announcements', '6': 'birthday' };
      const cleanInput = rawText.toLowerCase().trim();
      let selectedPrefs = [];

      if (cleanInput === '7' || /^(all|\*|all of the above)$/i.test(cleanInput)) {
        selectedPrefs = ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'];
      } else {
        const parts = rawText.split(/[,\s]+/).map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean);
        selectedPrefs = Array.from(new Set(parts.map(p => prefMap[p]).filter(Boolean)));
      }

      if (selectedPrefs.length > 0) {
        newPreferences = selectedPrefs;
        nextStep = 'language';
        botReply = `🌐 *Daily Catholic Content Language*

Select your preferred language for Daily Bible Verse, Mass Readings, Reflection & Saint of the Day:

1️⃣ Tamil (தமிழ்)
2️⃣ English
3️⃣ Both (Tamil + English)

👉 Reply with *1*, *2*, or *3*.`;
      } else {
        botReply = `⚠️ Invalid selection. Please reply with numbers separated by commas (e.g., *1,2,3*) or reply *7 / ALL* for all services.`;
      }
    } else if (step === 'language') {
      let chosenLang = null;
      const cleanChoice = rawText.toLowerCase().trim();
      if (/^(1|tamil|தமிழ்|ta)$/i.test(cleanChoice)) {
        chosenLang = 'ta';
      } else if (/^(2|english|eng|en)$/i.test(cleanChoice)) {
        chosenLang = 'en';
      } else if (/^(3|both|tamil \+ english|all)$/i.test(cleanChoice)) {
        chosenLang = 'both';
      }

      if (chosenLang) {
        newLanguage = chosenLang;
        nextStep = 'done';

        const prefLabels = {
          verse: '📖 Daily Bible Verse',
          saint: '🕊️ Saint of the Day',
          mass: '⛪ Daily Mass Readings & Reflection',
          events: '📅 Church Events',
          announcements: '📢 Parish Announcements',
          birthday: '🎂 Birthday Wishes'
        };

        const prefText = newPreferences.map(p => `• ${prefLabels[p] || p}`).join('\n');
        const langText = chosenLang === 'ta' ? 'Tamil (தமிழ்)' : chosenLang === 'both' ? 'Both (Tamil + English)' : 'English';

        const confirmMsg = `✅ *You're all set!*

📋 *Your Subscribed Services:*
${prefText || '• 📖 Daily Bible Verse\n• ⛪ Daily Mass Readings & Reflection\n• 🕊️ Saint of the Day'}

🌐 Daily Catholic Content Language: *${langText}*
⏰ Daily Catholic broadcast is delivered sharply at *12:00 AM IST*.

May God bless you and your family! 🙏❤️
— *SJDB Connect*
➡️ Type *Menu* for Quick Commands
➡️ Type *Services* for Help Desk`;

        botReply = confirmMsg;
      } else {
        botReply = `⚠️ Please reply with *1*, *2*, or *3* to choose your Daily Catholic Content language:\n\n1️⃣ Tamil (தமிழ்)\n2️⃣ English\n3️⃣ Both (Tamil + English)`;
      }
    } else if (step === 'done') {
      if (text === 'STOP' || text === 'UNSUBSCRIBE') {
        nextStep = 'welcome';
        newPreferences = [];
        newIsVerified = false;
        botReply = `You have been unsubscribed from SJDB Connect.\n\nReply *HI* anytime to re-subscribe. God bless! 🙏`;
      } else if (text === 'VERIFY' || text === 'REVERIFY') {
        nextStep = 'phone_verification';
        newIsVerified = false;
        botReply = `🔐 *Phone Number Verification*\n\n📱 Please enter your 10-digit mobile phone number (e.g., *9876543210*) to verify:`;
      } else if (text === 'PREFERENCES' || text === 'PREFS') {
        nextStep = 'preferences';
        botReply = `📋 *SJDB Connect Preferences*

Please select the services you would like to receive:

1️⃣ Daily Bible Verse
2️⃣ Saint of the Day
3️⃣ Daily Mass Readings & Reflection
4️⃣ Church Events
5️⃣ Parish Announcements
6️⃣ Birthday Wishes
7️⃣ All of the above

👉 Reply with numbers separated by commas (e.g. 1,2,3) or reply *7 / ALL* for all services.

Type *Menu* for Quick Commands
Type *Services* for Help Desk`;
      } else if (text === 'LANGUAGE' || text === 'LANG') {
        nextStep = 'language';
        botReply = `🌐 *Daily Catholic Content Language*

Select your preferred language for Daily Bible Verse, Mass Readings, Reflection & Saint of the Day:

1️⃣ Tamil (தமிழ்)
2️⃣ English
3️⃣ Both (Tamil + English)

👉 Reply with *1*, *2*, or *3*.`;
      } else if (text === '1' || /\b(READINGS?|TODAY READINGS|MASS READINGS|DAILY BIBLE)\b/i.test(text)) {
        const dailyContent = await getTodayDailyContent(new Date());
        const msg1 = generateDailyCatholicMessage({
          dailyContent,
          language: newLanguage,
          readingPreference: 'full'
        });
        botReply = msg1;
      } else if (text === '7' || text === '6' || /\b(SAINTS?|TODAY SAINT|SAINT OF THE DAY|WHO IS TODAY SAINT)\b/i.test(text) || /(இன்றைய புனிதர்|புனிதர் யார்)/.test(rawText)) {
        const dailyContent = await getTodayDailyContent(new Date());
        const saintInfo = generateSaintInfoMessage({ dailyContent, language: newLanguage });
        botReply = saintInfo;
      } else if (text === 'SERVICES' || text.toLowerCase().includes('service')) {
        botReply = `⛪ *SJDB Connect – Services & Help Desk*
_St. John de Britto's Church, Kalayarkoil_

1️⃣ ⛪ *Mass Timings*
2️⃣ 🕊️ *Confession Timings*
3️⃣ ✝️ *Other Sacrament Timings*
4️⃣ 📖 *Daily Bible Verse*
5️⃣ 📜 *Daily Mass Readings*
6️⃣ 🌟 *Saint of the Day*
7️⃣ 🙏 *Catholic Prayers*
8️⃣ 📅 *Church Events*
9️⃣ 📢 *Parish Announcements*
🔟 📍 *Church Location & Map*
1️⃣1️⃣ 👥 *Parish Ministries & Anbiyams*
1️⃣2️⃣ 👑 *Parish Priest & Clergy*
1️⃣3️⃣ 🏛️ *Church History*
1️⃣4️⃣ 📞 *Contact Church*

👉 *Reply with a number (1-14) or type your question naturally.*`;
      } else if (text === 'MENU' || text === 'HOME' || text === '0') {
        botReply = `👋 *Welcome to SJDB Connect!*
⛪ *St. John de Britto's Church, Kalayarkoil*

How can I help you today?

1️⃣ 📖 *Daily Bible*
2️⃣ ⛪ *Mass Timings*
3️⃣ 🕊️ *Services*
4️⃣ 📅 *Events*
5️⃣ 📢 *Announcements*
6️⃣ 📜 *Church Information*
7️⃣ 🌟 *Saint of the Day*
8️⃣ ❓ *Help*

👉 *You can reply with a number or ask your question naturally.*`;
      } else {
        const ragResult = await answerChurchQuestion(rawText, 'en');
        botReply = ragResult.reply;
      }
    }

    res.json({
      success: true,
      botReply,
      sessionState: {
        step: nextStep,
        isVerified: newIsVerified,
        providedPhone: newProvidedPhone,
        preferences: newPreferences,
        language: newLanguage,
        readingPreference: newReadingPreference,
        sendLinks: newSendLinks
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/clear-start-fresh (and /api/bot/subscribers/clear-all) — Complete fresh reset of all bot sessions & preferences
const clearAllBotSubscribers = async (req, res) => {
  try {
    const { _clearDedupCacheForTesting } = require('../bot/botHandler');
    if (typeof _clearDedupCacheForTesting === 'function') {
      _clearDedupCacheForTesting();
    }

    const botResult = await BotSession.deleteMany({});
    const userResult = await User.updateMany({}, { 
      $set: { 
        whatsappOptIn: false, 
        botPreferences: [],
        readingPreference: 'full',
        sendLinks: true
      } 
    });

    res.json({
      success: true,
      message: `Fresh bot reset complete: Cleared ${botResult.deletedCount} bot sessions and reset ${userResult.modifiedCount} user subscription preferences. All accounts, registrations, and website content are safe.`,
      deletedCount: botResult.deletedCount,
      usersUpdated: userResult.modifiedCount
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
  testBotMessage
};
