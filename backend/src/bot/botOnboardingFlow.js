/**
 * SJDB Connect — Single Authoritative Bot Onboarding Flow
 * 
 * HI
 *  ↓
 * 1️⃣ Bot Language
 *  ↓
 * 2️⃣ Phone Number Verification
 *  ↓
 * 3️⃣ OTP Verification
 *  ↓
 * 4️⃣ Phone Number Verified
 *  ↓
 * 5️⃣ SJDB Connect Preferences
 *  ↓
 * 6️⃣ Daily Catholic Content Language
 *  ↓
 * 7️⃣ You're All Set
 *  ↓
 * 8️⃣ Main Menu
 */

function getStep1BotLanguageMessage() {
  return `👋 *Welcome to SJDB Connect!*
⛪ *St. John de Britto Church, Kalayarkoil*
_Connecting Faith & Community_

🌐 *1️⃣ Bot Language / போட் மொழி*

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

function getStep7AllSetMessage(preferences, contentLang, botLang = 'en') {
  const prefLabels = botLang === 'ta' ? {
    verse: '📖 தினசரி விவிலிய வசனம்',
    saint: '🕊️ அன்றைய புனிதர்',
    mass: '⛪ திருப்பலி வாசகங்கள் & சிந்தனை',
    events: '📅 திருவிழாக்கள் & நிகழ்வுகள்',
    announcements: '📢 பங்கு அறிவிப்புகள்',
    birthday: '🎂 பிறந்தநாள் வாழ்த்துகள்'
  } : {
    verse: '📖 Daily Bible Verse',
    saint: '🕊️ Saint of the Day',
    mass: '⛪ Daily Mass Readings & Reflection',
    events: '📅 Church Events',
    announcements: '📢 Parish Announcements',
    birthday: '🎂 Birthday Wishes'
  };

  const prefList = (preferences || []).map(p => `• ${prefLabels[p] || p}`).join('\n');
  const langLabel = contentLang === 'ta' ? 'Tamil (தமிழ்)' : contentLang === 'both' ? 'Both (Tamil + English)' : 'English';

  if (botLang === 'ta') {
    return `🎉 *7️⃣ You're All Set! (அனைத்தும் தயார்!)*

📋 *உங்கள் பதிவுசெய்யப்பட்ட சேவைகள்:*
${prefList || '• 📖 தினசரி விவிலிய வசனம்\n• ⛪ திருப்பலி வாசகங்கள்\n• 🕊️ அன்றைய புனிதர்'}

🌐 தினசரி ஆன்மீக மொழி: *${langLabel}*
⏰ தினசரி விடியற்காலை *4:00 AM IST* மணிக்கு உங்களுக்கு அனுப்பப்படும்.

இறைவன் உங்களையும் உங்கள் குடும்பத்தினரையும் ஆசீர்வதிப்பாராக! 🙏❤️
— *SJDB Connect*
_புனித அருளானந்தர் திருத்தலம், காளையார்கோவில்_`;
  }

  return `🎉 *7️⃣ You're All Set!*

📋 *Your Subscribed Services:*
${prefList || '• 📖 Daily Bible Verse\n• ⛪ Daily Mass Readings & Reflection\n• 🕊️ Saint of the Day'}

🌐 Daily Catholic Content Language: *${langLabel}*
⏰ Daily Catholic devotions broadcast is delivered sharply at *4:00 AM IST*.

May God bless you and your family! 🙏❤️
— *SJDB Connect*
_St. John de Britto Church, Kalayarkoil_`;
}

function getStep8MainMenuMessage(userName, botLang = 'en') {
  if (botLang === 'ta') {
    return `⛪ *8️⃣ Main Menu (முதன்மை மெனு)*
${userName ? `வணக்கம், *${userName}*! ` : ''}உங்களுக்கு எவ்வாறு உதவ முடியும்?

1️⃣ 📖 தினசரி விவிலிய வசனம் (Daily Bible)
2️⃣ ⛪ திருப்பலி நேரங்கள் (Mass Timings)
3️⃣ 🕊️ பங்கு சேவைகள் (Services & Help Desk)
4️⃣ 📅 திருவிழா & நிகழ்வுகள் (Events)
5️⃣ 📢 பங்கு அறிவிப்புகள் (Announcements)
6️⃣ 📜 திருத்தல வரலாறு & தகவல்கள் (Church Info)
7️⃣ 🌟 அன்றைய புனிதர் (Saint of the Day)
8️⃣ ❓ உதவி (Help)

👉 *எண்ணை அனுப்பலாம் அல்லது உங்கள் கேள்வியை நேரடியாகக் கேட்கலாம்.*
➡️ *14 பங்கு உதவி சேவைகளுக்கு "Services" என தட்டச்சு செய்யவும்.*`;
  }

  return `⛪ *8️⃣ Main Menu*
${userName ? `Welcome, *${userName}*! ` : ''}How can I help you today?

1️⃣ 📖 *Daily Bible*
2️⃣ ⛪ *Mass Timings*
3️⃣ 🕊️ *Services & Help Desk*
4️⃣ 📅 *Events*
5️⃣ 📢 *Announcements*
6️⃣ 📜 *Church Information*
7️⃣ 🌟 *Saint of the Day*
8️⃣ ❓ *Help*

👉 *You can reply with a number or ask your question naturally.*
➡️ *Type "Services" for the complete 14 Parish Help Desk services.*`;
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
  parseBotLanguage,
  parsePhoneNumber,
  parseOTP,
  parsePreferences,
  parseContentLanguage
};
