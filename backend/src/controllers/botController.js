const { triggerBroadcastNow } = require('../services/dailyBroadcastService');
const BotSession = require('../models/BotSession');
const User = require('../models/User');
const DailyNotificationLog = require('../models/DailyNotificationLog');
const { getTodayDailyContent } = require('../services/dailyContentService');
const {
  generateDailyVerseCaption,
  generateDailyVerseMessage,
  generateDailyMassReadingsMessage,
  generateDailyReflectionMessage,
  generateSaintContentMessage,
  generateReadMoreMessage,
  generateDailyCatholicMessage,
  generateDailyLinksMessage,
  generateSaintInfoMessage
} = require('../services/whatsappDailyFormatter');
const { answerChurchQuestion } = require('../bot/churchRAGService');
const {
  getStep1BotLanguageMessage,
  getStep2PhoneVerificationMessage,
  getStep3OTPVerificationMessage,
  getStep4And5PreferencesMessage,
  getStep6ContentLanguageMessage,
  getStep7AllSetMessage,
  getStep8MainMenuMessage,
  getHowToUseSJDBConnectMessage,
  parseBotLanguage,
  parsePhoneNumber,
  parseOTP,
  parsePreferences,
  parseContentLanguage
} = require('../bot/botOnboardingFlow');

function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text);
}

// GET /api/bot/status — Connection status & WhatsApp Channel status
const getStatus = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const { getConnectionStatus } = require('../bot/whatsapp');
    const { getChannelStatus } = require('../services/whatsappChannelService');
    const conn = getConnectionStatus();
    const channel = await getChannelStatus().catch(() => null);
    res.json({ success: true, ...conn, channel });
  } catch (err) {
    res.json({ success: true, connected: false, sock: false, status: 'disconnected', error: err.message });
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
      ...sessions.map(s => s.phoneNumber ? s.phoneNumber.replace(/\D/g, '').slice(-10) : '').filter(Boolean),
      ...users.map(u => u.phone ? u.phone.replace(/\D/g, '').slice(-10) : '').filter(Boolean)
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

    // 6 Separated message previews
    const verseTa = generateDailyVerseMessage({ dailyContent, language: 'ta' });
    const verseEn = generateDailyVerseMessage({ dailyContent, language: 'en' });
    const readingsTa = generateDailyMassReadingsMessage({ dailyContent, language: 'ta' });
    const readingsEn = generateDailyMassReadingsMessage({ dailyContent, language: 'en' });
    const reflectionTa = generateDailyReflectionMessage({ dailyContent, language: 'ta' });
    const reflectionEn = generateDailyReflectionMessage({ dailyContent, language: 'en' });
    const saintTa = generateSaintContentMessage({ dailyContent, language: 'ta' });
    const saintEn = generateSaintContentMessage({ dailyContent, language: 'en' });
    const readMoreTa = generateReadMoreMessage({ dailyContent, language: 'ta' });
    const readMoreEn = generateReadMoreMessage({ dailyContent, language: 'en' });

    res.json({
      success: true,
      date: new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' }).format(new Date()),
      saintName: dailyContent?.saintName || dailyContent?.saint?.nameEnglish || dailyContent?.saintOfTheDay?.english?.name || 'Saint of the Day',
      saintNameTa: dailyContent?.saintNameTa || dailyContent?.saint?.nameTamil || dailyContent?.saintOfTheDay?.tamil?.name || '',
      saintImage: dailyContent?.saintImage || dailyContent?.saint?.image || dailyContent?.saintOfTheDay?.english?.imageUrl || dailyContent?.saintOfTheDay?.imageUrl || null,
      saintFeastDay: dailyContent?.saintFeastDay || dailyContent?.saint?.feastDay || dailyContent?.saintOfTheDay?.english?.feastDay || 'Today',
      saintDescription: dailyContent?.saintDescription || dailyContent?.saint?.description || dailyContent?.saint?.descriptionEnglish || dailyContent?.saintOfTheDay?.english?.description || '',
      bibleRef: dailyContent?.bible?.ref || dailyContent?.dailyVerse?.reference || dailyContent?.readings?.gospel?.reference || 'Holy Bible',
      previewTa,
      previewEn,
      separatedMessages: {
        verse: {
          ta: verseTa,
          en: verseEn,
          caption: generateDailyVerseCaption({ dailyContent }),
          image: '/api/settings/daily-verses/today/image'
        },
        readings: { ta: readingsTa, en: readingsEn },
        reflection: { ta: reflectionTa, en: reflectionEn },
        saintImage: dailyContent?.saintImage || dailyContent?.saint?.image || null,
        saintContent: { ta: saintTa, en: saintEn },
        readMore: { ta: readMoreTa, en: readMoreEn }
      }
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
      const formatted = `*SJDB Connect*\n\n${message.trim()}\n\n_St. John de Britto Church_`;
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
      const formatted = `*SJDB Connect*\n\n${message.trim()}\n\n_St. John de Britto Church_`;
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
    const textToSend = message || `🧪 *SJDB Connect — Test Message*\n\nThis is a verified test message sent from the St. John de Britto Church WhatsApp Bot.\n\n⏰ Timestamp: ${new Date().toLocaleTimeString('en-IN')}`;

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
      pendingPhone = '',
      pendingOtp = '',
      preferences = [],
      language = 'en',
      botLanguage = 'en',
      readingPreference = 'full',
      sendLinks = false
    } = sessionState;

    const rawText = (message || '').trim();
    const text = rawText.toUpperCase();
    const isTamil = /[\u0B80-\u0BFF]/.test(rawText) || botLanguage === 'ta';
    const { SITE_ROUTES, EXTERNAL_LINKS, getSiteUrl } = require('../config/siteRoutes');
    const { getChurchPhone, getChurchEmail } = require('../config/contactConfig');
    const {
      getServicesMenuMessage,
      formatCatholicPrayersMessage,
      extractMenuNumber
    } = require('../bot/botHandler');

    let botReply = '';
    let nextStep = step;
    let newIsVerified = isVerified;
    let newProvidedPhone = providedPhone;
    let newPendingPhone = pendingPhone;
    let newPendingOtp = pendingOtp;
    let newPreferences = [...preferences];
    let newLanguage = language;
    let newBotLanguage = botLanguage;
    let newReadingPreference = readingPreference;
    let newSendLinks = sendLinks;

    const normalizedForTrigger = rawText.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isStartTrigger = /^(hi|hello|hey|start|reset|restart|வணக்கம்)$/i.test(normalizedForTrigger) ||
      normalizedForTrigger.includes('sjdb connect') ||
      normalizedForTrigger.includes('"come; listen; and you will find life"') ||
      normalizedForTrigger.includes('connecting faith and community') ||
      (normalizedForTrigger.includes('hi') && normalizedForTrigger.includes('sjdb'));

    const menuNum = extractMenuNumber(rawText);

    if (isStartTrigger) {
      if (newIsVerified && newProvidedPhone) {
        nextStep = 'done';
        botReply = getStep8MainMenuMessage('Parishioner', newBotLanguage || 'en');
      } else {
        nextStep = 'bot_language';
        botReply = getStep1BotLanguageMessage();
      }
    } else if (step === 'welcome' || step === 'bot_language') {
      const chosenBotLang = parseBotLanguage(rawText);
      if (chosenBotLang) {
        newBotLanguage = chosenBotLang;
        nextStep = 'phone_verification';
        botReply = getStep2PhoneVerificationMessage(chosenBotLang);
      } else {
        nextStep = 'bot_language';
        botReply = getStep1BotLanguageMessage();
      }
    } else if (step === 'phone_verification' || step === 'ask_phone') {
      const clean10Digits = parsePhoneNumber(rawText);
      if (!clean10Digits) {
        botReply = getStep2PhoneVerificationMessage(newBotLanguage || 'en');
      } else {
        newPendingPhone = clean10Digits;
        newPendingOtp = '123456';
        nextStep = 'otp_verification';
        botReply = getStep3OTPVerificationMessage(clean10Digits, newPendingOtp, newBotLanguage || 'en');
      }
    } else if (step === 'otp_verification') {
      const inputOtp = parseOTP(rawText);
      if (inputOtp && (inputOtp === newPendingOtp || inputOtp === '123456')) {
        newProvidedPhone = newPendingPhone || '9876543210';
        newIsVerified = true;
        nextStep = 'preferences';
        const parishUser = await User.findOne({ phone: { $regex: newProvidedPhone } }).catch(() => null);
        botReply = getStep4And5PreferencesMessage(newProvidedPhone, parishUser, newBotLanguage || 'en');
      } else {
        botReply = `❌ Invalid OTP. Please enter the 6-digit verification code:\n\n` + getStep3OTPVerificationMessage(newPendingPhone || '9876543210', newPendingOtp || '123456', newBotLanguage || 'en');
      }
    } else if (step === 'preferences') {
      const selectedPrefs = parsePreferences(rawText);
      if (selectedPrefs) {
        newPreferences = selectedPrefs;
        nextStep = 'language';
        botReply = getStep6ContentLanguageMessage(newBotLanguage || 'en');
      } else {
        botReply = `⚠️ Invalid selection. Please reply with numbers (e.g., *1,2,3*) or *7* for ALL.\n\n` + getStep4And5PreferencesMessage(newProvidedPhone || '9876543210', null, newBotLanguage || 'en');
      }
    } else if (step === 'language') {
      const chosenLang = parseContentLanguage(rawText);
      if (chosenLang) {
        newLanguage = chosenLang;
        nextStep = 'done';
        const confirmMsg = getStep7AllSetMessage(newPreferences, newLanguage, newBotLanguage || 'en');
        const howToUseMsg = getHowToUseSJDBConnectMessage(newBotLanguage || 'en');
        botReply = `${confirmMsg}\n\n${howToUseMsg}`;
      } else {
        botReply = getStep6ContentLanguageMessage(newBotLanguage || 'en');
      }
    } else {
      // General Navigation & Commands (step === 'done' or 'services' or verified)
      const isServicesMenuCommand = /^(services|service|help\s*desk|பங்கு\s*சேவைகள்|சேவைகள்)$/i.test(normalizedForTrigger) ||
        normalizedForTrigger === '15' ||
        normalizedForTrigger === '15 services' ||
        (step === 'done' && menuNum === 3);

      const isMainMenuCommand = /^(menu|home|0|முதன்மை\s*மெனு|மெனு)$/i.test(normalizedForTrigger);

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
        botReply = getStep4And5PreferencesMessage(newProvidedPhone || '9876543210', null, newBotLanguage || 'en');
      } else if (text === 'LANGUAGE' || text === 'LANG') {
        nextStep = 'language';
        botReply = getStep6ContentLanguageMessage(newBotLanguage || 'en');
      } else if (isMainMenuCommand) {
        nextStep = 'done';
        botReply = getStep8MainMenuMessage('Parishioner', newBotLanguage || 'en');
      } else if (isServicesMenuCommand) {
        nextStep = 'services';
        botReply = getServicesMenuMessage(newBotLanguage === 'ta');
      } else {
        // Evaluate Service Selections (1-15) or Main Menu options (1-8)
        const inServices = step === 'services';
        const isTamilQuery = isTamil || newBotLanguage === 'ta';

        // 1️⃣ Mass Timings (Option 1 in Services, Option 2 in Main Menu)
        const isMassTimings = (inServices && menuNum === 1) || (!inServices && menuNum === 2) ||
          /\b(mass timings?|mass times?|sunday mass|திருப்பலி நேரம்|திருப்பலி நேரங்கள்)\b/i.test(normalizedForTrigger);

        // 2️⃣ Confession (Option 2 in Services)
        const isConfession = (inServices && menuNum === 2) ||
          /\b(confessions?|reconciliation|ஒப்புரவு|பாவசங்கீர்த்தனம்)\b/i.test(normalizedForTrigger);

        // 3️⃣ Daily Bible Verse (Option 3 in Services, Option 1 in Main Menu)
        const isVerse = (inServices && menuNum === 3) || (!inServices && menuNum === 1) ||
          /\b(bible verse|daily bible|verse|இறைவார்த்தை|வேத வசனம்)\b/i.test(normalizedForTrigger);

        // 4️⃣ Daily Mass Readings (Option 4 in Services, or READINGS)
        const isReadings = (inServices && menuNum === 4) ||
          /\b(readings?|mass readings?|today readings?|வாசகங்கள்|திருப்பலி வாசகங்கள்)\b/i.test(normalizedForTrigger);

        // 5️⃣ Daily Reflection (Option 5 in Services, or REFLECTION) — NEW!
        const isReflection = (inServices && menuNum === 5) ||
          /\b(reflections?|daily reflection|today reflection|சிந்தனை|தியானம்|இன்றைய சிந்தனை)\b/i.test(normalizedForTrigger);

        // 6️⃣ Saint of the Day (Option 6 in Services, Option 7 in Main Menu)
        const isSaint = (inServices && menuNum === 6) || (!inServices && menuNum === 7) ||
          /\b(saints?|today saint|saint of the day|புனிதர்|இன்றைய புனிதர்)\b/i.test(normalizedForTrigger);

        // 7️⃣ Catholic Prayers (Option 7 in Services)
        const isPrayers = (inServices && menuNum === 7) ||
          /\b(prayers?|catholic prayers?|rosary|செபம்|ஜெபம்|கத்தோலிக்க செபங்கள்)\b/i.test(normalizedForTrigger);

        // 8️⃣ Church Events (Option 8 in Services, Option 4 in Main Menu)
        const isEvents = (inServices && menuNum === 8) || (!inServices && menuNum === 4) ||
          /\b(events?|upcoming events?|நிகழ்வுகள்|நிகழ்ச்சிகள்)\b/i.test(normalizedForTrigger);

        // 9️⃣ Announcements (Option 9 in Services, Option 5 in Main Menu)
        const isAnnouncements = (inServices && menuNum === 9) || (!inServices && menuNum === 5) ||
          /\b(announcements?|parish announcements?|அறிவிப்புகள்|பங்கு அறிவிப்புகள்)\b/i.test(normalizedForTrigger);

        // 🔟 Location (Option 10 in Services)
        const isLocation = (inServices && menuNum === 10) ||
          /\b(location|map|directions?|where is church|ஆலய அமைவிடம்|வரைபடம்)\b/i.test(normalizedForTrigger);

        // 1️⃣1️⃣ Ministries (Option 11 in Services)
        const isMinistries = (inServices && menuNum === 11) ||
          /\b(ministries?|anbiyams?|committees?|பங்கு அமைப்புகள்|அன்பியங்கள்)\b/i.test(normalizedForTrigger);

        // 1️⃣2️⃣ Parish Priest (Option 12 in Services)
        const isPriest = (inServices && menuNum === 12) ||
          /\b(priests?|clergy|parish priest|father|பங்குத்தந்தை|குருக்கள்)\b/i.test(normalizedForTrigger);

        // 1️⃣3️⃣ History (Option 13 in Services, Option 6 in Main Menu for Church Info)
        const isHistory = (inServices && menuNum === 13) || (!inServices && menuNum === 6) ||
          /\b(history|heritage|about church|church info|வரலாறு|ஆலய விபரங்கள்)\b/i.test(normalizedForTrigger);

        // 1️⃣4️⃣ Contact (Option 14 in Services)
        const isContact = (inServices && menuNum === 14) ||
          /\b(contacts?|office hours|phone|email|தொடர்பு கொள்ள|அலுவலகம்)\b/i.test(normalizedForTrigger);

        // 1️⃣5️⃣ Mass Intentions & Certificates (Option 15 in Services)
        const isIntentionsOrCerts = (inServices && menuNum === 15) ||
          /\b(intentions?|mass intentions?|certificates?|baptism certificate|சான்றிதழ்கள்|திருப்பலி கருத்து)\b/i.test(normalizedForTrigger);

        // 8️⃣ Help (Option 8 in Main Menu)
        const isHelp = (!inServices && menuNum === 8) ||
          /\b(help|guide|usage|உதவி|வழிகாட்டி)\b/i.test(normalizedForTrigger);

        if (isMassTimings) {
          botReply = isTamilQuery
            ? `⛪ *புனித அருளானந்தர் ஆலயம் — திருப்பலி நேரங்கள்*
_காளையார்கோவில், சிவகங்கை மறைமாவட்டம்_

📅 *வார நாட்கள் (புதன் – சனி):*
• மாலை 5:30 மணி — மாலைத் திருப்பலி

🌟 *ஞாயிறு திருப்பலிகள்:*
• காலை 6:30 மணி — அதிகாலைத் திருப்பலி
• காலை 8:30 மணி — பங்குப் திருப்பலி

🕯️ *புதன்கிழமை:* புனித அருளானந்தர் நவநாள் & திருப்பலி (மாலை 5:30)
🕯️ *சனிக்கிழமை:* நித்திய சகாய மாதா நவநாள் & திருப்பலி (மாலை 5:30)

🌐 *விபரம்:* ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`
            : `⛪ *St. John de Britto Church — Holy Mass Timings*
_Kalayarkoil, Sivagangai Diocese_

📅 *Weekdays (Wed – Sat):* 5:30 PM
🌟 *Sunday Holy Masses:* 6:30 AM & 8:30 AM
🕯️ *Wednesdays:* St. John de Britto Novena & Mass (5:30 PM)
🕯️ *Saturdays:* Our Lady of Perpetual Succour Novena & Mass (5:30 PM)

🌐 *Full Schedule:* ${getSiteUrl(SITE_ROUTES.MASS_TIMINGS)}`;
        } else if (isConfession) {
          botReply = isTamilQuery
            ? `🕊️ *ஒப்புரவு அருட்சாதனம் (பாவசங்கீர்த்தன நேரங்கள்)*
_புனித அருளானந்தர் ஆலயம், காளையார்கோவில்_

⏰ *ஒப்புரவு நேரங்கள்:*
• புதன் முதல் சனி வரை: மாலை 5:00 – 5:30 மணி
• ஞாயிறு: காலை 6:00 – 6:30 & 8:00 – 8:30 மணி
• திருப்பலிக்கு பின் பங்குத்தந்தையிடம் அணுகலாம்.

📞 *பங்கு அலுவலகம்:* ${getChurchPhone() || 'பங்கு அலுவலகம்'}`
            : `🕊️ *Sacrament of Reconciliation (Confession Timings)*
_St. John de Britto Church, Kalayarkoil_

⏰ *Regular Confession Schedule:*
• Wed – Sat: 5:00 PM – 5:30 PM (before Evening Mass)
• Sundays: 6:00 AM – 6:30 AM & 8:00 AM – 8:30 AM
• Anytime by appointment with the Parish Priest.

📞 *Parish Office:* ${getChurchPhone() || 'Parish Office'}`;
        } else if (isVerse) {
          const dailyContent = await getTodayDailyContent(new Date());
          botReply = generateDailyVerseMessage({ dailyContent, language: newLanguage });
        } else if (isReadings) {
          const dailyContent = await getTodayDailyContent(new Date());
          botReply = generateDailyMassReadingsMessage({ dailyContent, language: newLanguage });
        } else if (isReflection) {
          // 5️⃣ Daily Reflection (இன்றைய சிந்தனை)
          const dailyContent = await getTodayDailyContent(new Date());
          botReply = generateDailyReflectionMessage({ dailyContent, language: newLanguage });
        } else if (isSaint) {
          const dailyContent = await getTodayDailyContent(new Date());
          botReply = generateSaintInfoMessage({ dailyContent, language: newLanguage });
        } else if (isPrayers) {
          botReply = formatCatholicPrayersMessage(isTamilQuery);
        } else if (isEvents) {
          const eventsUrl = getSiteUrl(SITE_ROUTES.EVENTS);
          botReply = isTamilQuery
            ? `📅 *வரவிருக்கும் பங்கு நிகழ்வுகள் (Church Events)*\n\n1. பங்கு குடும்ப விழா & வழிபாடுகள்\n2. மறைக்கல்வி சிறார் ஆண்டு விழா\n\n🌐 *நிகழ்வுகள் நாள்காட்டி:* ${eventsUrl}`
            : `📅 *Upcoming Church Events*\n\n1. Parish Feast Day Celebrations\n2. Sunday Catechism Annual Gathering\n\n🌐 *View Calendar:* ${eventsUrl}`;
        } else if (isAnnouncements) {
          const annUrl = getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS);
          botReply = isTamilQuery
            ? `📢 *பங்கு அறிவிப்புகள் (Parish Announcements)*\n\n• ஞாயிறு மறைக்கல்வி காலை 9:30 மணிக்கு நடைபெறும்.\n• அன்பியக் கூட்டங்கள் அந்தந்த வட்டாரங்களில் நடைபெறும்.\n\n🌐 *அனைத்து அறிவிப்புகள்:* ${annUrl}`
            : `📢 *Parish Announcements*\n\n• Sunday Catechism at 9:30 AM after Mass.\n• Basic Christian Community (Anbiyam) weekly prayer meetings.\n\n🌐 *Read All:* ${annUrl}`;
        } else if (isLocation) {
          botReply = isTamilQuery
            ? `📍 *ஆலய அமைவிடம் & வரைபடம் (Location & Map)*\n\nபுனித அருளானந்தர் ஆலயம், காளையார்கோவில், சிவகங்கை மாவட்டம் – 630551.\n\n🗺️ *Google Maps:* https://maps.app.goo.gl/StJohnDeBrittoChurch`
            : `📍 *Church Location & Google Maps*\n\nSt. John de Britto Church, Kalayarkoil, Sivagangai District, Tamil Nadu – 630551.\n\n🗺️ *Google Maps:* https://maps.app.goo.gl/StJohnDeBrittoChurch`;
        } else if (isMinistries) {
          const minUrl = getSiteUrl(SITE_ROUTES.MINISTRIES);
          botReply = isTamilQuery
            ? `👥 *பங்கு அமைப்புகள் & அன்பியங்கள் (Ministries & Anbiyams)*\n\n• மரியாயின் சேனை (Legion of Mary)\n• புனித வின்சென்ட் தே பவுல் சபை (SVP)\n• இளைஞர் இயக்கம் & பீடச்சிறார்கள்\n\n🌐 *விபரம்:* ${minUrl}`
            : `👥 *Parish Ministries & Anbiyams*\n\n• Legion of Mary\n• Society of St. Vincent de Paul (SVP)\n• Youth Ministry & Altar Servers\n\n🌐 *Explore Ministries:* ${minUrl}`;
        } else if (isPriest) {
          botReply = isTamilQuery
            ? `👑 *பங்குப் பணியாளர்கள் (Parish Clergy)*\n\n• பங்குத்தந்தை: அருட்தந்தை லூயிஸ்\n• உதவி பங்குத்தந்தை: அருட்தந்தை அந்தோணி\n\n📞 தொடர்பு: ${getChurchPhone() || 'பங்கு அலுவலகம்'}`
            : `👑 *Parish Clergy*\n\n• Parish Priest: Rev. Fr. Louis\n• Assistant Parish Priest: Rev. Fr. Antony\n\n📞 Office: ${getChurchPhone() || 'Parish Office'}`;
        } else if (isHistory) {
          const abUrl = getSiteUrl(SITE_ROUTES.ABOUT);
          botReply = isTamilQuery
            ? `🏛️ *ஆலய வரலாறு & விபரங்கள் (Church History)*\n\n300+ ஆண்டுகள் பழமையான வரலாற்றுச் சிறப்புமிக்க புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்.\n\n🌐 *முழு வரலாறு:* ${abUrl}`
            : `🏛️ *Church History & Heritage*\n\nA sacred pilgrimage shrine honoring St. John de Britto (Arulanandar) with 300+ years of faith in Kalayarkoil.\n\n🌐 *Full Heritage:* ${abUrl}`;
        } else if (isContact) {
          botReply = isTamilQuery
            ? `📞 *தொடர்பு விபரம் (Contact Church)*\n\n🕒 அலுவலக நேரம்: காலை 9:00 – 12:30 & மாலை 4:00 – 8:00\n📞 தொலைபேசி: ${getChurchPhone() || 'பங்கு அலுவலகம்'}\n📧 மின்னஞ்சல்: ${getChurchEmail() || 'church@sjdb.org'}`
            : `📞 *Contact Church*\n\n🕒 Office Hours: 9:00 AM – 12:30 PM & 4:00 PM – 8:00 PM\n📞 Phone: ${getChurchPhone() || 'Parish Office'}\n📧 Email: ${getChurchEmail() || 'church@sjdb.org'}`;
        } else if (isIntentionsOrCerts) {
          const certUrl = getSiteUrl(SITE_ROUTES.CERTIFICATES);
          botReply = isTamilQuery
            ? `📜 *திருப்பலி கருத்துக்கள் & சான்றிதழ்கள் (Intentions & Certificates)*\n\nஞானஸ்நானம், திருமண சான்றிதழ்கள் மற்றும் திருப்பலி பூசை வைக்க:\n\n🌐 *இணையதளத்தில் விண்ணப்பிக்க:* ${certUrl}\n📞 *பங்கு அலுவலகம்:* ${getChurchPhone() || 'பங்கு அலுவலகம்'}`
            : `📜 *Mass Intentions & Certificates*\n\nBook Mass Intentions or apply for Baptism / Marriage certificates:\n\n🌐 *Apply Online:* ${certUrl}\n📞 *Parish Office:* ${getChurchPhone() || 'Parish Office'}`;
        } else if (isHelp) {
          botReply = isTamilQuery
            ? `❓ *SJDB Connect — உதவி & வழிகாட்டி*\n\n• *MENU* — முதன்மை மெனு (1-8)\n• *SERVICES* — 15 பங்கு சேவைகள்\n• *5* அல்லது *REFLECTION* — இன்றைய சிந்தனை\n• *4* அல்லது *READINGS* — திருப்பலி வாசகங்கள்\n• *STOP* — விலக`
            : `❓ *SJDB Connect — Help & Guidance*\n\n• *MENU* — Main Menu (1-8)\n• *SERVICES* — 15 Parish Help Desk services\n• *5* or *REFLECTION* — Daily Reflection\n• *4* or *READINGS* — Daily Mass Readings\n• *STOP* — Unsubscribe`;
        } else {
          // Natural language question via RAG
          try {
            const ragResult = await answerChurchQuestion(rawText, newBotLanguage || 'en');
            botReply = ragResult?.reply || (isTamilQuery
              ? `தயவுசெய்து முதன்மை மெனுவிற்கு *Menu* அல்லது 15 சேவைகளுக்கு *Services* என தட்டச்சு செய்யவும்.`
              : `Please type *Menu* for Main Menu or *Services* for the 15 Parish Help Desk services.`);
          } catch {
            botReply = isTamilQuery
              ? `மன்னிக்கவும், தகவலைப் பெற முடியவில்லை. முதன்மை மெனுவிற்கு *Menu* அல்லது சேவைகளுக்கு *Services* என அனுப்பவும்.`
              : `Could not process your question. Type *Menu* for Main Menu or *Services* for the 15 Parish Help Desk services.`;
          }
        }
      }
    }

    res.json({
      success: true,
      botReply,
      sessionState: {
        step: nextStep,
        isVerified: newIsVerified,
        providedPhone: newProvidedPhone,
        pendingPhone: newPendingPhone,
        pendingOtp: newPendingOtp,
        preferences: newPreferences,
        language: newLanguage,
        botLanguage: newBotLanguage,
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

// ─── WhatsApp Channel Controllers ──────────────────────────────────────────

// GET /api/bot/channel/status
const getChannelStatus = async (req, res) => {
  try {
    const { getChannelStatus } = require('../services/whatsappChannelService');
    const status = await getChannelStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/channel/test
const sendTestChannelUpdate = async (req, res) => {
  try {
    const { sendTestChannelUpdate } = require('../services/whatsappChannelService');
    const result = await sendTestChannelUpdate(req.user);
    res.json({ success: true, message: 'Test message successfully published to WhatsApp Channel!', result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/channel/publish-daily
const publishChannelDailyContent = async (req, res) => {
  try {
    const { publishChannelDailyContent } = require('../services/whatsappChannelService');
    const result = await publishChannelDailyContent(new Date(), {
      force: true,
      source: 'admin_manual',
      triggerType: 'admin_button',
      adminUserId: req.user?._id
    });
    res.json({ success: true, message: 'Daily Catholic Content published to WhatsApp Channel!', result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/channel/settings
const updateChannelSettings = async (req, res) => {
  try {
    const { channelJid, channelUrl } = req.body;
    const { updateChannelSettings } = require('../services/whatsappChannelService');
    const updated = await updateChannelSettings({ channelJid, channelUrl });
    res.json({ success: true, message: 'WhatsApp Channel settings updated successfully!', channel: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/bot/channel/logs
const getChannelLogs = async (req, res) => {
  try {
    const WhatsappChannelPublication = require('../models/WhatsappChannelPublication');
    const { limit = 25, page = 1 } = req.query;
    const total = await WhatsappChannelPublication.countDocuments();
    const logs = await WhatsappChannelPublication.find()
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    res.json({ success: true, total, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/channel/announcement
const publishAnnouncementToChannel = async (req, res) => {
  try {
    const { announcementId, action = 'created' } = req.body;
    if (!announcementId) {
      return res.status(400).json({ success: false, message: 'Announcement ID is required' });
    }
    const { publishChannelAnnouncement } = require('../services/whatsappChannelService');
    const result = await publishChannelAnnouncement(announcementId, {
      adminUserId: req.user?._id,
      source: 'admin_manual',
      action
    });
    res.json({ success: true, message: 'Announcement published to WhatsApp Channel!', result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/channel/event
const publishEventToChannel = async (req, res) => {
  try {
    const { eventId, action = 'created' } = req.body;
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }
    const { publishChannelEvent } = require('../services/whatsappChannelService');
    const result = await publishChannelEvent(eventId, {
      adminUserId: req.user?._id,
      source: 'admin_manual',
      action
    });
    res.json({ success: true, message: 'Event published to WhatsApp Channel!', result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/channel/reminder
const publishReminderToChannel = async (req, res) => {
  try {
    const { title, details, dateText, timeText, venueText, typeLabel, targetUrl, itemId } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Reminder title is required' });
    }
    const { publishChannelReminder } = require('../services/whatsappChannelService');
    const result = await publishChannelReminder({
      title,
      details,
      dateText,
      timeText,
      venueText,
      typeLabel: typeLabel || 'Parish Reminder',
      targetUrl: targetUrl || '/events',
      itemId: itemId || null
    }, {
      adminUserId: req.user?._id,
      source: 'admin_manual',
      force: true
    });
    res.json({ success: true, message: 'Reminder published to WhatsApp Channel!', result });
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
  getChannelStatus,
  sendTestChannelUpdate,
  publishChannelDailyContent,
  updateChannelSettings,
  getChannelLogs,
  publishAnnouncementToChannel,
  publishEventToChannel,
  publishReminderToChannel
};
