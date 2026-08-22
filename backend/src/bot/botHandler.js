/**
 * SJDB Connect WhatsApp Bot Handler
 * Uses Twilio WhatsApp (credentials already in .env)
 * 
 * Conversation flow:
 * 1. User sends "HI" → Welcome + preference menu
 * 2. User replies with numbers (1,2,3...) → Save preferences, ask language
 * 3. User replies with language choice → Save language, confirm + done
 */
const BotSession = require('../models/BotSession');
const User = require('../models/User');
const { sendMail } = require('../config/mailer');

// Lazy-load to avoid circular: whatsapp.js → botHandler.js → whatsapp.js
function getWA() {
  return require('./whatsapp');
}

// Helper to email admins when an unregistered visitor uses the WhatsApp bot
async function notifyAdminsUnregisteredBotUser(session, phone, rawJid) {
  try {
    const admins = await User.find({ role: 'admin', email: { $exists: true, $ne: '' } });
    if (!admins.length) return;

    const prefText = (session.preferences || []).map(p => {
      const labels = { verse: 'Bible Verse', saint: 'Saint of the Day', mass: 'Mass Readings', events: 'Events', announcements: 'Announcements', birthday: 'Birthday Wishes' };
      return labels[p] || p;
    }).join(', ');

    const langText = { en: 'English', ta: 'Tamil', both: 'English & Tamil' }[session.language] || session.language || 'Default';
    const phoneDisplay = phone || rawJid || session.phoneNumber;

    const emailHtml = `
<div style="background:#f1f5f9; padding:20px 12px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:550px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%); padding:28px 18px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="margin:0; color:#fbbf24; font-size:22px; font-weight:800;">St. John de Britto's Church</h1>
      <p style="margin:4px 0 0; color:#ffffff; opacity:0.9; font-size:13px;">WhatsApp Bot Activity Alert</p>
    </div>
    <div style="padding:24px 20px;">
      <div style="display:inline-block; background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:12px; font-weight:700; padding:4px 12px; border-radius:9999px; text-transform:uppercase; margin-bottom:12px;">
        Unregistered Visitor Activity
      </div>
      <h2 style="color:#1e3a8a; margin-top:0; font-size:18px;">New WhatsApp Bot Visitor Alert</h2>
      <p style="color:#334155; font-size:14px; line-height:1.5;">Hello Administrator,</p>
      <p style="color:#475569; font-size:14px; line-height:1.5;">An unregistered visitor has just interacted with or configured preferences on the <strong>SJDB Connect WhatsApp Bot</strong>.</p>
      
      <div style="background:#f8fafc; border-left:4px solid #d4a017; padding:16px; border-radius:8px; margin:18px 0;">
        <p style="margin:0 0 6px; color:#1e293b; font-size:13px;"><strong> Phone / WhatsApp ID:</strong> <span style="font-family:monospace; color:#1e3a8a; background:#e2e8f0; padding:2px 6px; border-radius:4px;">${phoneDisplay}</span></p>
        <p style="margin:6px 0; color:#1e293b; font-size:13px;"><strong> Subscribed Services:</strong> ${prefText || 'Configuring'}</p>
        <p style="margin:6px 0 0; color:#1e293b; font-size:13px;"><strong> Selected Language:</strong> ${langText}</p>
        <p style="margin:6px 0 0; color:#64748b; font-size:11px;">Time: ${new Date().toLocaleString('en-IN')}</p>
      </div>

      <div style="margin-top:25px; text-align:center;">
        <a href="${CLIENT_URL}/admin/users" style="background:#1e3a8a; color:#ffffff; font-weight:700; font-size:14px; text-decoration:none; padding:13px 22px; border-radius:12px; display:block; box-shadow:0 4px 12px rgba(30,58,138,0.3);">
          Open Admin Users Portal
        </a>
      </div>
    </div>
    <div style="background:#0f172a; padding:16px; text-align:center; color:#94a3b8; font-size:11px;">
      <p style="margin:0;">St. John de Britto's Church, Kalayarkoil</p>
    </div>
  </div>
</div>`;

    for (const admin of admins) {
      sendMail({
        to: admin.email,
        subject: `Unregistered Visitor Bot Activity — ${phoneDisplay}`,
        html: emailHtml
      }).catch(err => console.warn(`Admin email alert error for ${admin.email}:`, err.message));
    }
  } catch (err) {
    console.error(' Error notifying admins about unregistered bot user:', err.message);
  }
}

// ─── Message Templates ─────────────────────────────────────────────────────

const CLIENT_URL = process.env.CLIENT_URL?.replace('http://localhost:5173', 'https://st-jb-church.vercel.app') || 'https://st-jb-church.vercel.app';



const WELCOME_MSG = ` *Welcome to SJDB Connect*
_Connecting Faith & Community_

Dear friend, thank you for reaching out to *St. John de Britto's Church, Kalayarkoil*!

 *Visit Our Parish Portal:*
${CLIENT_URL}

Please select what you would like to receive daily:

1⃣ Daily Bible Verse
2⃣ Saint of the Day
3⃣ Daily Mass Readings
4⃣ Church Events
5⃣ Announcements
6⃣ Birthday Wishes

 Reply with numbers separated by commas.
_Example: 1,2,3_

 God bless you!`;

const LANGUAGE_MSG = ` *Choose your preferred language:*

1⃣ English
2⃣ Tamil (தமிழ்)
3⃣ Both (இரண்டும்)

Reply with 1, 2, or 3.`;

const prefMap = {
  '1': 'verse',
  '2': 'saint',
  '3': 'mass',
  '4': 'events',
  '5': 'announcements',
  '6': 'birthday',
};

const langMap = {
  '1': 'en',
  '2': 'ta',
  '3': 'both',
};

// ─── Handle Incoming Message ─────────────────────────────────────────────────

async function handleIncomingMessage(fromNumber, body, rawJid, pushName) {
  const text = (body || '').trim().toUpperCase();

  // Destination JID for sending replies back (e.g. "13430564061424@lid" or "919876543210@s.whatsapp.net")
  const replyTarget = rawJid || fromNumber;

  // Clean phone number / session key
  const phone = (fromNumber || '').replace('whatsapp:', '').replace(/\D/g, '');
  const sessionKey = (fromNumber && fromNumber.includes('@lid')) ? fromNumber : (phone || fromNumber);

  // Get or create session
  let session = await BotSession.findOne({
    $or: [
      { phoneNumber: sessionKey },
      { phoneNumber: phone },
      ...(rawJid ? [{ phoneNumber: rawJid }] : [])
    ]
  });

  if (!session) {
    session = new BotSession({ phoneNumber: sessionKey, step: 'welcome' });
    await session.save();
  }

  // Update last message time
  session.lastMessage = new Date();

  // Try auto-linking by phone or pushName if not linked yet
  if (!session.linkedUserId) {
    let linkedCandidate = null;
    if (phone && phone.length >= 10 && !rawJid?.includes('@lid')) {
      linkedCandidate = await User.findOne({ phone: { $regex: phone.slice(-10) } });
    }
    if (!linkedCandidate && pushName && pushName.trim().length >= 2) {
      const cleanName = pushName.trim();
      const firstWord = cleanName.split(' ')[0];
      linkedCandidate = await User.findOne({
        $or: [
          { name: { $regex: cleanName, $options: 'i' } },
          { name: { $regex: firstWord, $options: 'i' } }
        ]
      });
    }
    if (linkedCandidate) {
      session.linkedUserId = linkedCandidate._id;
      await session.save();
    }
  }

  // Helper to check if incoming text is a HI / greeting / reset trigger
  const isHiTrigger =
    /\b(HI|HELLO|START|RESET|MENU)\b/i.test(text) ||
    text.includes('SJDB CONNECT');

  // ── Step: Welcome / trigger ──────────────────────────────────────────────
  // ONLY respond to HI/HELLO/START/RESET/MENU — ignore everything else
  if (session.step === 'welcome') {
    if (!isHiTrigger) return; // silent
    session.step = 'preferences';
    await session.save();
    await getWA().sendWhatsAppMessage(replyTarget, WELCOME_MSG);
    return;
  }

  // If HI trigger is sent at any step — restart the flow
  if (isHiTrigger) {
    session.step = 'preferences';
    await session.save();
    await getWA().sendWhatsAppMessage(replyTarget, WELCOME_MSG);
    return;
  }

  // ── Step: Preferences selection ──────────────────────────────────────────
  if (session.step === 'preferences') {
    const parts = body.split(',').map(s => s.trim());
    const prefs = parts.map(p => prefMap[p]).filter(Boolean);

    if (prefs.length === 0) {
      return; // silent — ignore random messages
    }

    session.preferences = prefs;
    session.step = 'language';
    await session.save();
    await getWA().sendWhatsAppMessage(replyTarget, LANGUAGE_MSG);
    return;
  }

  // ── Step: Language selection ─────────────────────────────────────────────
  if (session.step === 'language') {
    const lang = langMap[body.trim()];
    if (!lang) {
      return; // silent — ignore random messages
    }

    session.language = lang;

    // Try to link to existing User by phone (non-@lid users only)
    let linkedUser = null;
    if (session.linkedUserId) {
      linkedUser = await User.findById(session.linkedUserId);
    }
    if (!linkedUser && phone && phone.length >= 10 && !rawJid?.includes('@lid')) {
      linkedUser = await User.findOne({ phone: { $regex: phone.slice(-10) } });
    }

    if (linkedUser) {
      session.linkedUserId = linkedUser._id;
      linkedUser.whatsappOptIn = true;
      linkedUser.botPreferences = session.preferences;
      linkedUser.preferredLanguage = lang;
      await linkedUser.save();
      session.step = 'done';
      await session.save();
    } else if (rawJid?.includes('@lid')) {
      // @lid user — can't auto-detect phone, ask them
      session.step = 'link_phone';
      await session.save();
      await getWA().sendWhatsAppMessage(replyTarget,
        ` *Link Your Parish Account*\n\nTo connect your WhatsApp to your existing parish account, please reply with your *registered mobile number* (10 digits).\n\nExample: *9876543210*\n\n_(Reply *SKIP* if you don't have a parish account)_`
      );
      return;
    } else {
      session.step = 'done';
      await session.save();
    }

    const prefLabels = session.preferences.map(p => {
      const labels = { verse: 'Bible Verse', saint: 'Saint of the Day', mass: 'Mass Readings', events: 'Events', announcements: 'Announcements', birthday: 'Birthday Wishes' };
      return ` ${labels[p]}`;
    }).join('\n');

    const langLabel = { en: 'English', ta: 'Tamil', both: 'English & Tamil' }[lang];

    let confirmMsg = ` *You're all set!*

You will receive:
${prefLabels}

 Language: *${langLabel}*

Daily messages are sent at *6:00 AM IST* every morning.

 *Visit Our Parish Portal:*
${CLIENT_URL}`;

    if (!linkedUser) {
      confirmMsg += `\n\n *Create Your Parish Account:*
To access personalized parish services (family registration, event bookings, mass requests & donations), create your free account:
 ${CLIENT_URL}/register`;

      // Email all admins about this unregistered visitor activity
      notifyAdminsUnregisteredBotUser(session, phone, replyTarget).catch(e => console.warn('Admin bot activity email error:', e.message));
    }

    confirmMsg += `\n\n May God bless you!
— *SJDB Connect*
_St. John de Britto's Church_

 Reply *STOP* to unsubscribe or *HI* to change preferences.`;

    await getWA().sendWhatsAppMessage(replyTarget, confirmMsg);
    return;

  }

  // ── Step: Link phone number (@lid users) ────────────────────────────────
  if (session.step === 'link_phone') {
    const isSkip = text === 'SKIP';
    const enteredPhone = body.trim().replace(/\D/g, '');

    let linkedUser = null;

    if (!isSkip && enteredPhone.length >= 10) {
      linkedUser = await User.findOne({ phone: { $regex: enteredPhone.slice(-10) } });

      if (!linkedUser) {
        // Not found — give clear feedback so user knows what to do
        await getWA().sendWhatsAppMessage(replyTarget,
          ` *No parish account found* with mobile number *${enteredPhone.slice(-10)}*.\n\nPlease check the number and try again, or reply *SKIP* to continue without linking.`
        );
        return;
      }

      session.linkedUserId = linkedUser._id;
      linkedUser.whatsappOptIn = true;
      linkedUser.botPreferences = session.preferences;
      linkedUser.preferredLanguage = session.language;
      await linkedUser.save();
    }

    session.step = 'done';
    await session.save();

    const prefLabels = session.preferences.map(p => {
      const labels = { verse: 'Bible Verse', saint: 'Saint of the Day', mass: 'Mass Readings', events: 'Events', announcements: 'Announcements', birthday: 'Birthday Wishes' };
      return ` ${labels[p]}`;
    }).join('\n');

    const langLabel = { en: 'English', ta: 'Tamil', both: 'English & Tamil' }[session.language || 'en'];

    let confirmMsg = linkedUser
      ? ` *Account Linked Successfully!*\n\nWelcome, *${linkedUser.name}*! Your WhatsApp is now linked to your parish account.\n\n`
      : ` *You're all set!*\n\n`;

    confirmMsg += `You will receive:\n${prefLabels}\n\n Language: *${langLabel}*\n\nDaily messages are sent at *6:00 AM IST* every morning.\n\n *Visit Our Parish Portal:*\n${CLIENT_URL}`;

    if (!linkedUser) {
      confirmMsg += `\n\n *Create Your Parish Account:*\nTo access personalized parish services, create your free account:\n ${CLIENT_URL}/register`;
      notifyAdminsUnregisteredBotUser(session, phone, replyTarget).catch(e => console.warn('Admin bot activity email error:', e.message));
    }

    confirmMsg += `\n\n May God bless you!\n— *SJDB Connect*\n_St. John de Britto's Church_\n\n Reply *STOP* to unsubscribe or *HI* to change preferences.`;
    await getWA().sendWhatsAppMessage(replyTarget, confirmMsg);
    return;

  }

  // ── Step: Done — handle STOP / HI only, ignore everything else ──────────
  if (session.step === 'done') {
    if (text === 'STOP' || text === 'UNSUBSCRIBE') {
      session.step = 'welcome';
      session.preferences = [];
      await session.save();
      if (session.linkedUserId) {
        await User.findByIdAndUpdate(session.linkedUserId, { whatsappOptIn: false, botPreferences: [] });
      }
      await getWA().sendWhatsAppMessage(replyTarget, ` You have been unsubscribed from SJDB Connect.\n\n Website: ${CLIENT_URL}\n\nReply *HI* anytime to re-subscribe. God bless! `);
      return;
    }
    // All other messages → completely silent (no reply)
    return;
  }
}


module.exports = { handleIncomingMessage };

