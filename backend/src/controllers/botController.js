const { triggerBroadcastNow } = require('../services/dailyBroadcastService');
const BotSession = require('../models/BotSession');
const User = require('../models/User');

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
    res.json({ success: true, connected: false, sock: false });
  }
};

// GET /api/bot/qr — Get current QR code data URL
const getQR = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const { getQR, getConnectionStatus } = require('../bot/whatsapp');
    const { connected } = getConnectionStatus();
    const qr = getQR();
    res.json({ success: true, connected, qr });
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

// GET /api/bot/subscribers — Admin: view all subscribers (website registered users + bot sessions)
const getSubscribers = async (req, res) => {
  try {
    // 1. Get interactive bot sessions
    const sessions = await BotSession.find({ step: 'done' }).lean();

    // 2. Get registered website users who have a phone number
    const users = await User.find({ phone: { $exists: true, $ne: '' }, isActive: { $ne: false } })
      .select('name phone preferredLanguage botPreferences whatsappOptIn createdAt updatedAt')
      .lean();

    // Map by phone to avoid duplicates
    const subscriberMap = new Map();

    // Add website registered users
    users.forEach(u => {
      const cleanPhone = u.phone.replace(/\D/g, '');
      if (cleanPhone) {
        subscriberMap.set(cleanPhone, {
          _id: u._id,
          phoneNumber: cleanPhone,
          name: u.name,
          source: 'Website User',
          preferences: u.botPreferences?.length ? u.botPreferences : ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'],
          language: u.preferredLanguage || 'en',
          updatedAt: u.updatedAt || u.createdAt
        });
      }
    });

    // Merge/override with interactive bot sessions
    sessions.forEach(s => {
      const cleanPhone = s.phoneNumber.replace(/\D/g, '');
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
          language: s.language || existing.language,
          updatedAt: s.updatedAt || existing.updatedAt
        });
      } else {
        const key = cleanPhone || s.phoneNumber;
        subscriberMap.set(key, {
          _id: s._id,
          phoneNumber: s.phoneNumber,
          name: 'WhatsApp Member',
          source: 'WhatsApp Bot',
          preferences: s.preferences?.length ? s.preferences : ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'],
          language: s.language || 'en',
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

// GET /api/bot/stats — Admin: broadcast stats
const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ phone: { $exists: true, $ne: '' } });
    const botSessions = await BotSession.countDocuments({ step: 'done' });
    const optedIn = await User.countDocuments({ whatsappOptIn: { $ne: false } });

    // Deduplicated count
    const sessions = await BotSession.find({ step: 'done' }).select('phoneNumber').lean();
    const users = await User.find({ phone: { $exists: true, $ne: '' } }).select('phone').lean();
    const phones = new Set([
      ...sessions.map(s => s.phoneNumber.replace(/\D/g, '')),
      ...users.map(u => u.phone.replace(/\D/g, ''))
    ]);

    const prefCounts = [
      { _id: 'verse', count: phones.size },
      { _id: 'saint', count: phones.size },
      { _id: 'mass', count: phones.size },
      { _id: 'events', count: phones.size },
      { _id: 'announcements', count: phones.size },
      { _id: 'birthday', count: phones.size },
    ];
    

    res.json({ success: true, stats: { total: totalUsers + botSessions, active: phones.size, optedIn, prefCounts } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/broadcast/now — Admin: trigger immediate broadcast
const triggerBroadcast = async (req, res) => {
  try {
    triggerBroadcastNow().catch(console.error);
    res.json({ success: true, message: 'Broadcast triggered in background' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bot/send — Admin: send custom message to all subscribers
const sendCustomMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    const { getConnectionStatus } = require('../bot/whatsapp');
    const { connected } = getConnectionStatus();
    if (!connected) {
      return res.status(400).json({ success: false, message: 'WhatsApp is disconnected. Please link device in Admin Panel first.' });
    }

    // Collect all unique phone numbers from both Users & BotSessions
    const users = await User.find({ phone: { $exists: true, $ne: '' }, isActive: { $ne: false } }).select('phone').lean();
    const sessions = await BotSession.find({ step: 'done' }).select('phoneNumber').lean();

    const phones = new Set([
      ...users.map(u => u.phone.replace(/\D/g, '')),
      ...sessions.map(s => s.phoneNumber.replace(/\D/g, ''))
    ]);

    const targetList = Array.from(phones).filter(Boolean);

    // Respond immediately to UI so button doesn't hang
    res.json({ success: true, message: 'Broadcast sent successfully!' });

    // Process sending loop in background
    setImmediate(async () => {
      let sent = 0;
      let failed = 0;
      for (const phone of targetList) {
        try {
          const ok = await sendWA(
            phone,
            ` *SJDB Connect*\n\n${message}\n\n _St. John de Britto's Church_`
          );
          if (ok) sent++;
          else failed++;
          await new Promise(r => setTimeout(r, 400)); // Rate limit protection
        } catch (e) {
          failed++;
          console.error(`Error sending custom message to ${phone}:`, e.message);
        }
      }
      console.log(` Custom broadcast finished: ${sent} sent, ${failed} failed out of ${targetList.length} total`);
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



// POST /api/bot/test-message — Admin Playground to test bot interaction flow
const testBotMessage = async (req, res) => {
  try {
    const { getConnectionStatus } = require('../bot/whatsapp');
    const { connected } = getConnectionStatus();
    if (!connected) {
      return res.status(400).json({ success: false, message: 'WhatsApp Bot is disconnected. Please link your device via QR code under the Overview tab first.' });
    }

    const { message, sessionState = {} } = req.body;
    let { step = 'welcome', preferences = [], language = 'en' } = sessionState;
    const rawText = (message || '').trim();
    const text = rawText.toUpperCase();

    let botReply = '';
    let nextStep = step;
    let newPreferences = [...preferences];
    let newLanguage = language;

    const isHiTrigger = /\b(HI|HELLO|START|RESET|MENU)\b/i.test(text) || text.includes('SJDB CONNECT');

    if (isHiTrigger) {
      nextStep = 'preferences';
      botReply = ` *Welcome to SJDB Connect*\n_Connecting Faith & Community_\n\nDear friend, thank you for reaching out to *St. John de Britto's Church, Kalayarkoil*!\n\n *Visit Our Parish Portal:*\nhttps://st-jb-church.vercel.app\n\nPlease select what you would like to receive daily:\n\n1⃣ Daily Bible Verse\n2⃣ Saint of the Day\n3⃣ Daily Mass Readings\n4⃣ Church Events\n5⃣ Announcements\n6⃣ Birthday Wishes\n\n Reply with numbers separated by commas.\n_Example: 1,2,3_\n\n God bless you!`;
    } else if (step === 'welcome') {
      botReply = ` Welcome to *St. John de Britto's Church, Kalayarkoil*!\n\nPlease reply *HI* to view our parish bot options and subscribe to daily spiritual messages.`;
    } else if (step === 'preferences') {
      const prefMap = { '1': 'verse', '2': 'saint', '3': 'mass', '4': 'events', '5': 'announcements', '6': 'birthday' };
      const parts = rawText.split(',').map(s => s.trim());
      const selected = parts.map(p => prefMap[p]).filter(Boolean);

      if (selected.length > 0) {
        newPreferences = selected;
        nextStep = 'language';
        botReply = ` *Choose your preferred language:*\n\n1⃣ English\n2⃣ Tamil (தமிழ்)\n3⃣ Both (இரண்டும்)\n\nReply with 1, 2, or 3.`;
      } else {
        botReply = ` Invalid choice. Please reply with numbers separated by commas (e.g. *1,2,3*) or reply *HI* to restart.`;
      }
    } else if (step === 'language') {
      const langMap = { '1': 'en', '2': 'ta', '3': 'both' };
      const selectedLang = langMap[rawText];

      if (selectedLang) {
        newLanguage = selectedLang;
        nextStep = 'done';

        const labelsMap = { verse: 'Bible Verse', saint: 'Saint of the Day', mass: 'Mass Readings', events: 'Events', announcements: 'Announcements', birthday: 'Birthday Wishes' };
        const prefText = newPreferences.map(p => ` ${labelsMap[p] || p}`).join('\n');
        const langText = { en: 'English', ta: 'Tamil', both: 'English & Tamil' }[selectedLang];

        botReply = ` *You're all set!*\n\nYou will receive:\n${prefText}\n\n Language: *${langText}*\n\nDaily messages are sent at *6:00 AM IST* every morning.\n\n *Visit Our Parish Portal:*\nhttps://st-jb-church.vercel.app\n\n May God bless you!\n— *SJDB Connect*\n_St. John de Britto's Church_\n\n Reply *STOP* to unsubscribe or *HI* to change preferences.`;
      } else {
        botReply = ` Invalid choice. Please reply with *1* for English, *2* for Tamil, or *3* for Both.`;
      }
    } else if (step === 'done') {
      if (text === 'STOP' || text === 'UNSUBSCRIBE') {
        nextStep = 'welcome';
        newPreferences = [];
        botReply = ` You have been unsubscribed from SJDB Connect.\n\nReply *HI* anytime to re-subscribe. God bless! `;
      } else {
        botReply = ` You are currently subscribed to SJDB Connect daily updates! Reply *HI* to change your preferences or *STOP* to unsubscribe.`;
      }
    }

    res.json({
      success: true,
      botReply,
      sessionState: {
        step: nextStep,
        preferences: newPreferences,
        language: newLanguage
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStatus, getQR, resetSession, getSubscribers, getStats, triggerBroadcast, sendCustomMessage, testBotMessage };
