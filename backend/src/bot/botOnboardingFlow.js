/**
 * SJDB Connect — Single Authoritative Bot Onboarding Flow
 * 
 * HI
 *  ↓
 * Bot Language
 *  ↓
 * Phone Number Verification
 *  ↓
 * OTP Verification
 *  ↓
 * Phone Number Verified
 *  ↓
 * SJDB Connect Preferences
 *  ↓
 * Daily Catholic Content Language
 *  ↓
 * You're All Set
 *  ↓
 * Main Menu
 */

const { SITE_ROUTES, getSiteUrl } = require('../config/siteRoutes');

function getStep1BotLanguageMessage() {
  return `👋 *Welcome to SJDB Connect!*
⛪ *St. John de Britto Church, Kalayarkoil*
_Connecting Faith & Community_

🌐 *1️⃣ Bot Language / பாட் மொழி*

Please select your preferred language for bot conversation:
தயவுசெய்து போட் உரையாடலுக்கான மொழியைத் தேர்ந்தெடுக்கவும்:

1️⃣ English
2️⃣ தமிழ் (Tamil)

👉 Reply with *1* or *2*`;
}

function getStep2PhoneVerificationMessage(botLang = 'en') {
  if (botLang === 'ta') {
    return `📱 *2️⃣ Phone Number Verification (தொலைபேசி எண் சரிபார்ப்பு)*

SJDB Connect சேவைகளைப் பெற, உங்கள் **10 இலக்க மொபைல் எண்ணை** உள்ளிடவும்.

👉 உங்கள் 10 இலக்க மொபைல் எண்ணை அனுப்பவும் (எ.கா: *9876543210*):`;
  }
  return `📱 *2️⃣ Phone Number Verification*

To access SJDB Connect and parish services, please enter your **10-digit mobile phone number**.

👉 Reply with your 10-digit mobile phone number (e.g., *9876543210*):`;
}

function getStep3OTPVerificationMessage(phone, otp, botLang = 'en') {
  if (botLang === 'ta') {
    return `🔐 *3️⃣ OTP Verification (OTP சரிபார்ப்பு)*

*${phone}* எண்ணிற்கான 6 இலக்க சரிபார்ப்புக் குறியீடு (OTP) அனுப்பப்பட்டுள்ளது:

🔑 உங்கள் OTP குறியீடு: *${otp}*
_(5 நிமிடங்கள் செல்லுபடியாகும்)_

👉 சரிபார்க்க இந்த 6 இலக்க OTP குறியீட்டை அனுப்பவும்:
_(அல்லது புதிய OTP பெற *RESEND* என அனுப்பவும்)_`;
  }
  return `🔐 *3️⃣ OTP Verification*

A 6-digit verification code has been issued for *${phone}*:

🔑 Your OTP Code: *${otp}*
_(Valid for 5 minutes)_

👉 Please reply with the 6-digit verification code to verify your phone number:
_(Or reply *RESEND* for a new code)_`;
}

function getStep4And5PreferencesMessage(phone, parishUser, botLang = 'en') {
  const verifiedHeader = botLang === 'ta'
    ? `✅ *4️⃣ Phone Number Verified! (தொலைபேசி எண் சரிபார்க்கப்பட்டது!)*\n${parishUser ? `வரவேற்கிறோம், *${parishUser.name}*! 🙏\n\n` : `உங்கள் மொபைல் எண் *${phone}* வெற்றிகரமாக சரிபார்க்கப்பட்டது.\n\n`}`
    : `✅ *4️⃣ Phone Number Verified!*\n${parishUser ? `Welcome, *${parishUser.name}*! 🙏\n\n` : `Your mobile phone *${phone}* has been successfully verified.\n\n`}`;

  const prefBody = botLang === 'ta'
    ? `📋 *5️⃣ SJDB Connect Preferences (விருப்பங்கள்)*

நீங்கள் பெற விரும்பும் பங்கு சேவைகளைத் தேர்ந்தெடுக்கவும்:

1️⃣ 📖 தினசரி விவிலிய வசனம் (Daily Bible Verse)
2️⃣ 🕊️ அன்றைய புனிதர் (Saint of the Day)
3️⃣ ⛪ திருப்பலி வாசகங்கள் & சிந்தனை (Daily Mass Readings)
4️⃣ 📅 திருவிழாக்கள் & நிகழ்வுகள் (Church Events)
5️⃣ 📢 பங்கு அறிவிப்புகள் (Parish Announcements)
6️⃣ 🎂 பிறந்தநாள் வாழ்த்துகள் (Birthday Wishes)
7️⃣ ⭐ அனைத்து சேவைகளும் (All Services)

👉 எண்களை காற்புள்ளியுடன் அனுப்பவும் (எ.கா: *1,2,3*) அல்லது அனைத்திற்கும் *7* என அனுப்பவும்.`
    : `📋 *5️⃣ SJDB Connect Preferences*

Please select the parish services you would like to receive:

1️⃣ 📖 Daily Bible Verse
2️⃣ 🕊️ Saint of the Day
3️⃣ ⛪ Daily Mass Readings & Reflection
4️⃣ 📅 Church Events
5️⃣ 📢 Parish Announcements
6️⃣ 🎂 Birthday Wishes
7️⃣ ⭐ All of the above (Recommended)

👉 Reply with numbers separated by commas (e.g., *1,2,3*) or reply *7* for *ALL*.`;

  return `${verifiedHeader}${prefBody}`;
}

function getStep6ContentLanguageMessage(botLang = 'en') {
  if (botLang === 'ta') {
    return `🌐 *6️⃣ Daily Catholic Content Language (ஆன்மீக உள்ளடக்க மொழி)*

தினசரி விவிலிய வசனம், திருப்பலி வாசகங்கள் & அன்றைய புனிதர் செய்திகளுக்கான மொழியைத் தேர்ந்தெடுக்கவும்:

1️⃣ தமிழ் (Tamil)
2️⃣ English
3️⃣ Both (Tamil + English)

👉 *1*, *2*, அல்லது *3* என பதிலளிக்கவும்.`;
  }
  return `🌐 *6️⃣ Daily Catholic Content Language*

Select your preferred language for Daily Bible Verse, Mass Readings, Reflection & Saint of the Day:

1️⃣ Tamil (தமிழ்)
2️⃣ English
3️⃣ Both (Tamil + English)

👉 Reply with *1*, *2*, or *3*.`;
}

function getStep7AllSetMessage(preferences, contentLang, botLang = 'en', hasWebsiteAccount = false) {
  const defaultServices = `• 📖 Daily Bible Verse
• 🕊️ Saint of the Day
• ⛪ Daily Mass Readings & Reflection
• 📅 Church Events
• 📢 Parish Announcements
• 🎂 Birthday Wishes`;

  const prefLabels = {
    verse: '• 📖 Daily Bible Verse',
    saint: '• 🕊️ Saint of the Day',
    mass: '• ⛪ Daily Mass Readings & Reflection',
    events: '• 📅 Church Events',
    announcements: '• 📢 Parish Announcements',
    birthday: '• 🎂 Birthday Wishes'
  };

  let prefList = '';
  if (Array.isArray(preferences) && preferences.length > 0) {
    const items = preferences.map(p => prefLabels[p]).filter(Boolean);
    if (items.length > 0) {
      prefList = items.join('\n');
    }
  }
  if (!prefList) {
    prefList = defaultServices;
  }

  let langLabel = 'Both (Tamil + English)';
  if (contentLang === 'ta') langLabel = 'Tamil (தமிழ்)';
  else if (contentLang === 'en') langLabel = 'English';
  else if (contentLang === 'both') langLabel = 'Both (Tamil + English)';

  const regUrl = getSiteUrl(SITE_ROUTES.REGISTER);

  if (botLang === 'ta') {
    const accountNotice = !hasWebsiteAccount
      ? `\n\n💡 *முக்கிய குறிப்பு:*\nஅனைத்து தகவல்களையும் உடனுக்குடனும் சரியாகவும் பெற்று எங்களோடு *இணைந்திருக்க (BE CONNECTED)*, தயவுசெய்து எமது ஆலய இணையதளத்தில் ஒரு கணக்கை உருவாக்கவும்: ⛪🤝\n🔗 *பதிவு செய்ய:* ${regUrl}`
      : `\n\n🌟 *பங்கு உறுப்பினர் கணக்கு:* உங்கள் தொலைபேசி எண் எமது ஆலய இணையதளத்துடன் வெற்றிகரமாக இணைக்கப்பட்டுள்ளது!`;

    return `✅ *You're all set! (அனைத்தும் தயார்!)*

📋 *Your Subscribed Services:*
${prefList}

🌐 Daily Catholic Content Language: *${langLabel}*
⏰ Daily Catholic broadcast is delivered sharply at *4:00 AM IST*.${accountNotice}

May God bless you and your family! 🙏❤️
— *SJDB Connect*
_St. John de Britto Church, Kalayarkoil_

➡️ Type *Menu* for Quick Commands
➡️ Type *Services* for Help Desk`;
  }

  const accountNotice = !hasWebsiteAccount
    ? `\n\n💡 *Important Note:*\nPlease create a parish account to receive all information correctly and immediately and *BE CONNECTED* with our church community! ⛪🤝\n🔗 *Register here:* ${regUrl}`
    : `\n\n🌟 *Parish Account:* Your mobile number is registered with our parish website!`;

  return `✅ *You're all set!*

📋 *Your Subscribed Services:*
${prefList}

🌐 Daily Catholic Content Language: *${langLabel}*
⏰ Daily Catholic broadcast is delivered sharply at *4:00 AM IST*.${accountNotice}

May God bless you and your family! 🙏❤️
— *SJDB Connect*
_St. John de Britto Church, Kalayarkoil_

➡️ Type *Menu* for Quick Commands
➡️ Type *Services* for Help Desk`;
}

function getHowToUseSJDBConnectMessage(botLang = 'en') {
  return `⛪ *How to use SJDB Connect*

You can ask me about any church or faith-related topic:

• ⛪ *Mass & Confession:* "When is Sunday Mass?", "What time is confession?"
• 📖 *Scripture & Devotions:* "Say today's Bible verse", "Give me today's reflection"
• 🕊️ *Saints & Readings:* "Who is today's saint?", "What are today's Mass readings?"
• 🙏 *Prayers & Rosary:* "How do I pray the Rosary?", "Prayer before Mass"
• ✝️ *Sacraments:* "How do I register for Baptism / Marriage?"
• 📅 *Parish News:* "Any parish announcements?", "What events are coming?"
• 🏛️ *Ministries:* "What ministries are available?", "Anbiyam groups"
• 📍 *Location & Contact:* "Where is the church?", "Parish office hours"
• 📱 *My Account:* "My profile", "My language", "My notifications", "My registrations"
• 🌐 *Bot Commands:* Reply *READINGS* for full readings, *LANGUAGE* to change language

🌐 *Read more:*
https://st-jb-church.vercel.app

— *St. John de britto Church, Kalayarkoil*
_SJDB Connect_`;
}

function getStep8MainMenuMessage(userName, botLang = 'en') {
  if (botLang === 'ta') {
    return `⛪ *Main Menu (முதன்மை மெனு)*
${userName ? `வணக்கம், *${userName}*! ` : ''}உங்களுக்கு எவ்வாறு உதவ முடியும்?

1️⃣ ⛪ *திருப்பலி நேரங்கள்* (Mass Timings)
2️⃣ 🕊️ *ஒப்புரவு அருட்சாதனம்* (Confession Timings)
3️⃣ 📖 *தினசரி விவிலிய வசனம்* (Daily Bible Verse)
4️⃣ 📜 *திருப்பலி வாசகங்கள்* (Daily Mass Readings)
5️⃣ 🌟 *இன்றைய புனிதர்* (Saint of the Day)
6️⃣ 🙏 *கத்தோலிக்க செபங்கள்* (Catholic Prayers)
7️⃣ 📅 *பங்கு நிகழ்வுகள்* (Church Events)
8️⃣ 📢 *பங்கு அறிவிப்புகள்* (Parish Announcements)
9️⃣ 📍 *ஆலய அமைவிடம் & வரைபடம்* (Church Location & Map)
1️⃣0️⃣ 👥 *பங்கு அமைப்புகள் & அன்பியங்கள்* (Parish Ministries & Anbiyams)
1️⃣1️⃣ 👑 *பங்குத்தந்தையர்கள்* (Parish Priest & Clergy)
1️⃣2️⃣ 🏛️ *ஆலய வரலாறு* (Church History)
1️⃣3️⃣ 📞 *தொடர்பு விபரம்* (Contact Church)

👉 *1 முதல் 13 வரை உள்ள எண்ணை அழுத்தவும் அல்லது உங்கள் கேள்வியை நேரடியாகக் கேட்கவும்!*`;
  }

  return `⛪ *Main Menu*
${userName ? `Welcome, *${userName}*! ` : ''}How can I help you today?

1️⃣ ⛪ *Mass Timings*
2️⃣ 🕊️ *Confession Timings*
3️⃣ 📖 *Daily Bible Verse*
4️⃣ 📜 *Daily Mass Readings*
5️⃣ 🌟 *Saint of the Day*
6️⃣ 🙏 *Catholic Prayers*
7️⃣ 📅 *Church Events*
8️⃣ 📢 *Parish Announcements*
9️⃣ 📍 *Church Location & Map*
1️⃣0️⃣ 👥 *Parish Ministries & Anbiyams*
1️⃣1️⃣ 👑 *Parish Priest & Clergy*
1️⃣2️⃣ 🏛️ *Church History*
1️⃣3️⃣ 📞 *Contact Church*

👉 *Reply with a number (1-13) or ask your question naturally.*`;
}

function parseBotLanguage(rawText) {
  const t = (rawText || '').trim().toLowerCase();
  if (/^(1|english|eng|en)$/i.test(t)) return 'en';
  if (/^(2|tamil|தமிழ்|ta)$/i.test(t)) return 'ta';
  return null;
}

function parsePhoneNumber(rawText) {
  const digits = (rawText || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return null;
}

function parseOTP(rawText) {
  const digits = (rawText || '').replace(/\D/g, '');
  if (digits.length === 6) return digits;
  return null;
}

function parsePreferences(rawText) {
  const t = (rawText || '').trim().toLowerCase();
  if (t === '7' || /^(all|\*|all of the above|அனைத்தும்)$/i.test(t)) {
    return ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday'];
  }
  const prefMap = {
    '1': 'verse',
    '2': 'saint',
    '3': 'mass',
    '4': 'events',
    '5': 'announcements',
    '6': 'birthday'
  };
  const parts = rawText.split(/[,\s]+/).map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean);
  const selected = Array.from(new Set(parts.map(p => prefMap[p]).filter(Boolean)));
  return selected.length > 0 ? selected : null;
}

function parseContentLanguage(rawText) {
  const t = (rawText || '').trim().toLowerCase();
  if (/^(1|tamil|தமிழ்|ta)$/i.test(t)) return 'ta';
  if (/^(2|english|eng|en)$/i.test(t)) return 'en';
  if (/^(3|both|tamil \+ english|all)$/i.test(t)) return 'both';
  return null;
}

module.exports = {
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
};