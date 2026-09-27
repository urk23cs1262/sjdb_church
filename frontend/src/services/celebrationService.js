/**
 * Catholic Celebrations & Floating Wishes Service — Frontend (SJDB Connect)
 * St. John de Britto Church, Kalayarkoil
 *
 * Supported Occasions:
 * 1. User Birthday — personalized (registered users only)
 * 2. St. John de Britto Feast — February 4 (PUBLIC — all visitors)
 * 3. Christmas — December 25 (PUBLIC — all visitors)
 * 4. Easter Sunday — Computus algorithm (PUBLIC — all visitors)
 * 5. New Year — January 1 (PUBLIC — all visitors)
 *
 * Timezone: Asia/Kolkata (IST) — 12:00:00 AM IST to 11:59:59 PM IST
 */

/**
 * Computus Easter Calculation (Meeus/Jones/Butcher algorithm)
 */
export function getEasterSunday(year) {
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
 * Extract date parts strictly in Asia/Kolkata (IST)
 */
export function getTodayISTParts(customDate = null) {
  const d = customDate ? new Date(customDate) : new Date();
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = istFormatter.formatToParts(d);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
  }

  const year = map.year || d.getFullYear();
  const month = map.month || (d.getMonth() + 1);
  const day = map.day || d.getDate();
  const hours = map.hour || 0;
  const minutes = map.minute || 0;
  const seconds = map.second || 0;

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  };
}

/**
 * Checks if a user's date of birth matches today's IST month & day
 */
export function isUserBirthdayToday(dob, istMonth, istDay) {
  if (!dob) return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;

  // Check with IST formatter
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = istFormatter.format(d).split('-');
  if (parts.length >= 2) {
    const bM = parseInt(parts[0], 10);
    const bD = parseInt(parts[1], 10);
    if (bM === istMonth && bD === istDay) return true;
  }

  // Fallback to UTC components
  const utcMonth = d.getUTCMonth() + 1;
  const utcDay = d.getUTCDate();
  return utcMonth === istMonth && utcDay === istDay;
}

/**
 * Detects the currently active celebration for a visitor / logged-in user.
 * Supports URL override ?celebration=... or ?testCelebration=... for testing.
 * Priority: Birthday > St. John Feast > Christmas > Easter > New Year
 */
export function getActiveCelebration(user = null, customDate = null) {
  const ist = getTodayISTParts(customDate);
  const { year, month, day } = ist;

  // 1. URL Query Override for Testing (e.g. ?celebration=st_john_britto_feast or ?testCelebration=christmas)
  if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('celebration') || params.get('testCelebration');
    if (override) {
      const validTypes = ['st_john_britto_feast', 'christmas', 'easter', 'new_year', 'birthday'];
      const normalized = override.toLowerCase().trim();
      if (validTypes.includes(normalized)) {
        return {
          type: normalized,
          year,
          istParts: ist,
          isPublic: normalized !== 'birthday',
          userName: (user?.name || (user?.role === 'admin' ? 'Parish Admin' : 'Parishioner')),
          isTestOverride: true
        };
      }
    }
  }

  // 2. Birthday check (only for authenticated users with DOB)
  if (user && user.dob && isUserBirthdayToday(user.dob, month, day)) {
    return {
      type: 'birthday',
      year,
      istParts: ist,
      isPublic: false,
      userName: user.name || (user.role === 'admin' ? 'Parish Admin' : 'Parishioner')
    };
  }

  // 3. St. John de Britto Feast (February 4) — PUBLIC
  if (month === 2 && day === 4) {
    return {
      type: 'st_john_britto_feast',
      year,
      istParts: ist,
      isPublic: true,
      userName: user?.name || ''
    };
  }

  // 4. Christmas (December 25) — PUBLIC
  if (month === 12 && day === 25) {
    return {
      type: 'christmas',
      year,
      istParts: ist,
      isPublic: true,
      userName: user?.name || ''
    };
  }

  // 5. Easter Sunday (Computus algorithm) — PUBLIC
  const easter = getEasterSunday(year);
  if (month === easter.month && day === easter.day) {
    return {
      type: 'easter',
      year,
      istParts: ist,
      isPublic: true,
      userName: user?.name || ''
    };
  }

  // 6. New Year (January 1) — PUBLIC
  if (month === 1 && day === 1) {
    return {
      type: 'new_year',
      year,
      istParts: ist,
      isPublic: true,
      userName: user?.name || ''
    };
  }

  // Normal day — zero celebration mode
  return null;
}

/**
 * Returns complete celebration text: Modal heading/message/button + 4 floating cards
 */
export function getCelebrationDetails({ type, userName = 'Parishioner', language = 'en' }) {
  const lang = String(language || 'en').toLowerCase();
  const isTa = lang === 'ta';
  const isBoth = lang === 'both';
  const rawName = String(userName || 'Parishioner').trim();
  const upperName = rawName.toUpperCase();

  switch (type) {
    case 'birthday':
      return {
        type: 'birthday',
        heading: isBoth
          ? `HAPPY BIRTHDAY, ${upperName}!\nஇனிய பிறந்தநாள் நல்வாழ்த்துகள்!`
          : isTa
            ? `இனிய பிறந்தநாள் நல்வாழ்த்துகள்,\n${rawName}!`
            : `HAPPY BIRTHDAY,\n${upperName}!`,
        message: isBoth
          ? `St. John de Britto Church wishes you a blessed day and year filled with joy and peace.\n\nபுனித அருளானந்தர் திருத்தலம் உங்கள் வாழ்வில் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருள் நிறைய வாழ்த்துகிறது.`
          : isTa
            ? `புனித அருளானந்தர் திருத்தலம் உங்கள் வாழ்வில் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருள் நிறைய வாழ்த்துகிறது.`
            : `St. John de Britto Church wishes you a blessed day and year filled with joy and peace.`,
        buttonText: isBoth ? `Thank You! / நன்றி!` : isTa ? `நன்றி!` : `Thank You!`,
        floatingWishes: [
          {
            id: 'wish-1',
            icon: '🎂',
            title: isTa ? 'இனிய பிறந்தநாள்' : 'Happy Birthday',
            subtitle: rawName,
            detail: isTa ? 'இறைவனின் ஆசி நிறைக' : 'God Bless You!'
          },
          {
            id: 'wish-2',
            icon: '✨',
            title: isTa ? 'அமைதியும் மகிழ்ச்சியும்' : 'Many Happy Returns',
            subtitle: isTa ? 'இனிய நல்வாழ்த்துகள்' : 'Peace, Joy & Health',
            detail: isTa ? 'புனித அருளானந்தர் திருத்தலம்' : 'Blessed Day'
          },
          {
            id: 'wish-3',
            icon: '🙏',
            title: isTa ? 'இறை அருளில் திளைக்க' : 'A Blessed Year Ahead',
            subtitle: isTa ? 'பாதுகாப்பும் ஆசியும்' : 'Under God’s Protection',
            detail: isTa ? 'வாழ்வில் வளம் பெறுக' : 'Abundant Grace'
          },
          {
            id: 'wish-4',
            icon: '🌟',
            title: isTa ? 'திருத்தல நல்வாழ்த்துகள்' : 'Rejoice in the Lord',
            subtitle: isTa ? 'காளையார்கோவில்' : 'St. John de Britto Church',
            detail: isTa ? 'இறை சமாதானம்' : 'Grace & Love'
          }
        ]
      };

    case 'st_john_britto_feast':
      return {
        type: 'st_john_britto_feast',
        heading: isBoth
          ? `HAPPY FEAST OF ST. JOHN DE BRITTO!\nபுனித அருளானந்தர் திருவிழா நல்வாழ்த்துகள்!`
          : isTa
            ? `புனித அருளானந்தர்\nதிருவிழா நல்வாழ்த்துகள்!`
            : `HAPPY FEAST OF\nST. JOHN DE BRITTO!`,
        message: isBoth
          ? `May the intercession of St. John de Britto strengthen your faith and inspire you to live with courage, love, and devotion to Christ.\n\nபுனித ஜான் டி பிரிட்டோவின் பரிந்துரை உங்கள் விசுவாசத்தை உறுதிப்படுத்தி, கிறிஸ்துவின் மீது அன்பும் தைரியமும் கொண்டு வாழ உங்களை வழிநடத்தட்டும்.`
          : isTa
            ? `புனித ஜான் டி பிரிட்டோவின் பரிந்துரை உங்கள் விசுவாசத்தை உறுதிப்படுத்தி, கிறிஸ்துவின் மீது அன்பும் தைரியமும் கொண்டு வாழ உங்களை வழிநடத்தட்டும்.`
            : `May the intercession of St. John de Britto strengthen your faith and inspire you to live with courage, love, and devotion to Christ.`,
        buttonText: isBoth ? `Amen / ஆமென்` : isTa ? `ஆமென்` : `Amen`,
        floatingWishes: [
          {
            id: 'wish-1',
            icon: '✝',
            title: isTa ? 'புனித அருளானந்தர்' : 'Blessed Feast',
            subtitle: isTa ? 'திருவிழா நல்வாழ்த்துகள்' : 'St. John de Britto',
            detail: isTa ? 'பிப்ரவரி 4' : 'February 4'
          },
          {
            id: 'wish-2',
            icon: '✨',
            title: isTa ? 'அருளானந்தர் பெருவிழா' : 'Happy Feast Day',
            subtitle: isTa ? 'மகிழ்ச்சி நிறைக' : 'St. John de Britto',
            detail: isTa ? 'ஆசீர்வதிப்பாராக' : 'Pray for us'
          },
          {
            id: 'wish-3',
            icon: '🙏',
            title: isTa ? 'எங்களுக்காக வேண்டிக்கொள்ளும்' : 'Pray for Us',
            subtitle: isTa ? 'விசுவாசத்தின் சாட்சி' : 'Patron of Our Parish',
            detail: isTa ? 'காளையார்கோவில்' : 'Faith & Courage'
          },
          {
            id: 'wish-4',
            icon: '✨',
            title: isTa ? 'இறைவனின் பேரருள்' : 'God Bless You',
            subtitle: isTa ? 'அமைதியும் அருளும்' : 'Peace & Grace',
            detail: isTa ? 'புனித அருளானந்தர்' : 'SJDB Church'
          }
        ]
      };

    case 'christmas':
      return {
        type: 'christmas',
        heading: isBoth
          ? `MERRY CHRISTMAS!\nஇனிய கிறிஸ்துமஸ் நல்வாழ்த்துகள்!`
          : isTa
            ? `இனிய கிறிஸ்துமஸ்\nநல்வாழ்த்துகள்!`
            : `MERRY CHRISTMAS!`,
        message: isBoth
          ? `May the birth of our Lord Jesus Christ fill your heart and home with peace, joy, hope, and love.\n\nநம் ஆண்டவர் இயேசு கிறிஸ்துவின் பிறப்பு உங்கள் உள்ளத்திலும் இல்லத்திலும் அமைதி, மகிழ்ச்சி, நம்பிக்கை மற்றும் அன்பை நிறைக்கட்டும்.`
          : isTa
            ? `நம் ஆண்டவர் இயேசு கிறிஸ்துவின் பிறப்பு உங்கள் உள்ளத்திலும் இல்லத்திலும் அமைதி, மகிழ்ச்சி, நம்பிக்கை மற்றும் அன்பை நிறைக்கட்டும்.`
            : `May the birth of our Lord Jesus Christ fill your heart and home with peace, joy, hope, and love.`,
        buttonText: isBoth ? `Amen / ஆமென்` : isTa ? `ஆமென்` : `Amen`,
        floatingWishes: [
          {
            id: 'wish-1',
            icon: '✨',
            title: isTa ? 'இனிய கிறிஸ்துமஸ்' : 'Merry Christmas',
            subtitle: isTa ? 'நல்வாழ்த்துகள்' : 'Peace & Joy to All',
            detail: isTa ? 'பாலகன் இயேசு பிறந்துள்ளார்' : 'Glory to God'
          },
          {
            id: 'wish-2',
            icon: '✝',
            title: isTa ? 'கிறிஸ்துவின் ஆசி' : 'May Christ Bless You',
            subtitle: isTa ? 'குடும்பத்திற்கு அமைதி' : 'And Your Family',
            detail: isTa ? 'இறை அமைதி நிறைக' : 'Hope & Love'
          },
          {
            id: 'wish-3',
            icon: '⭐',
            title: isTa ? 'உன்னதத்தில் மாட்சி' : 'Prince of Peace',
            subtitle: isTa ? 'அமைதியின் தூதுவர்' : 'Christ is Born',
            detail: isTa ? 'பெத்லகேம் நட்சத்திரம்' : 'Blessed Nativity'
          },
          {
            id: 'wish-4',
            icon: '🎄',
            title: isTa ? 'மகிழ்ச்சியின் பெருவிழா' : 'Blessed Christmas',
            subtitle: isTa ? 'புனித அருளானந்தர் திருத்தலம்' : 'Grace & Truth',
            detail: isTa ? 'காளையார்கோவில்' : 'SJDB Church'
          }
        ]
      };

    case 'easter':
      return {
        type: 'easter',
        heading: isBoth
          ? `HAPPY EASTER!\nஇனிய பாஸ்கா திருநாள் வாழ்த்துகள்!`
          : isTa
            ? `இனிய பாஸ்கா\nதிருநாள் வாழ்த்துகள்!`
            : `HAPPY EASTER!`,
        message: isBoth
          ? `Christ is Risen! May the joy of the Resurrection fill your heart and home with hope, peace, love, and God's abundant blessings.\n\nகிறிஸ்து உயிர்த்தெழுந்தார்! உயிர்ப்பின் பெருவிழா உங்கள் உள்ளத்திலும் இல்லத்திலும் நம்பிக்கை, அமைதி, அன்பு மற்றும் ஆசீர்வாதங்களை நிறைக்கட்டும்.`
          : isTa
            ? `கிறிஸ்து உயிர்த்தெழுந்தார்! உயிர்ப்பின் பெருவிழா உங்கள் உள்ளத்திலும் இல்லத்திலும் நம்பிக்கை, அமைதி, அன்பு மற்றும் ஆசீர்வாதங்களை நிறைக்கட்டும்.`
            : `Christ is Risen! May the joy of the Resurrection fill your heart and home with hope, peace, love, and God's abundant blessings.`,
        buttonText: isBoth ? `Alleluia! / அல்லேலூயா!` : isTa ? `அல்லேலூயா!` : `Alleluia!`,
        floatingWishes: [
          {
            id: 'wish-1',
            icon: '✝',
            title: isTa ? 'கிறிஸ்து உயிர்த்தெழுந்தார்!' : 'Happy Easter',
            subtitle: isTa ? 'அல்லேலூயா!' : 'Christ is Risen!',
            detail: isTa ? 'உயிர்ப்பின் பெருவிழா' : 'Alleluia!'
          },
          {
            id: 'wish-2',
            icon: '✨',
            title: isTa ? 'பாஸ்கா திருநாள்' : 'He is Risen Indeed',
            subtitle: isTa ? 'நல்வாழ்த்துகள்' : 'Alleluia, Alleluia!',
            detail: isTa ? 'வாழ்வின் வெற்றி' : 'Victory Over Death'
          },
          {
            id: 'wish-3',
            icon: '🕊️',
            title: isTa ? 'அமைதி உரித்தாகுக' : 'Peace Be With You',
            subtitle: isTa ? 'உயிர்த்த ஆண்டவர்' : 'Hope & Victory',
            detail: isTa ? 'நம்பிக்கையின் ஒளி' : 'Risen Lord'
          },
          {
            id: 'wish-4',
            icon: '🌟',
            title: isTa ? 'புனித அருளானந்தர் திருத்தலம்' : 'Alleluia! Amen',
            subtitle: isTa ? 'காளையார்கோவில்' : 'Christ Our Light',
            detail: isTa ? 'அல்லேலூயா' : 'God Bless You'
          }
        ]
      };

    case 'new_year':
      return {
        type: 'new_year',
        heading: isBoth
          ? `HAPPY NEW YEAR!\nஇனிய புத்தாண்டு நல்வாழ்த்துகள்!`
          : isTa
            ? `இனிய புத்தாண்டு\nநல்வாழ்த்துகள்!`
            : `HAPPY NEW YEAR!`,
        message: isBoth
          ? `May the Lord bless you and your family with peace, joy, good health, and abundant grace throughout the new year.\n\nஆண்டவர் இந்த புதிய ஆண்டில் உங்களையும் உங்கள் குடும்பத்தையும் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளால் ஆசீர்வதிப்பாராக.`
          : isTa
            ? `ஆண்டவர் இந்த புதிய ஆண்டில் உங்களையும் உங்கள் குடும்பத்தையும் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளால் ஆசீர்வதிப்பாராக.`
            : `May the Lord bless you and your family with peace, joy, good health, and abundant grace throughout the new year.`,
        buttonText: isBoth ? `Thank You! / நன்றி!` : isTa ? `நன்றி!` : `Thank You!`,
        floatingWishes: [
          {
            id: 'wish-1',
            icon: '✨',
            title: isTa ? 'இனிய புத்தாண்டு' : 'Happy New Year',
            subtitle: isTa ? 'நல்வாழ்த்துகள்' : 'May God Bless Your Year',
            detail: isTa ? 'அமைதியும் வளமும்' : 'Grace & Hope'
          },
          {
            id: 'wish-2',
            icon: '🕊️',
            title: isTa ? 'இறை சமாதானம்' : 'Grace & Peace',
            subtitle: isTa ? 'ஆண்டவரின் துணை' : 'A Blessed Year Ahead',
            detail: isTa ? 'நல்வாழ்வு உண்டாகுக' : 'Under His Wings'
          },
          {
            id: 'wish-3',
            icon: '🌟',
            title: isTa ? 'நிறைவான ஆசிகள்' : 'Abundant Blessings',
            subtitle: isTa ? 'மகிழ்ச்சியும் நலமும்' : 'Joy & Good Health',
            detail: isTa ? 'காளையார்கோவில்' : 'SJDB Church'
          },
          {
            id: 'wish-4',
            icon: '🙏',
            title: isTa ? 'அருளானந்தர் திருத்தலம்' : 'Prayers & Blessings',
            subtitle: isTa ? 'புனித அருளானந்தர்' : 'In All You Do',
            detail: isTa ? 'எப்பொழுதும் ஆசி' : 'Happy New Year'
          }
        ]
      };

    default:
      return {
        type,
        heading: `PEACE & BLESSINGS!`,
        message: `St. John de Britto Church wishes you abundant grace and peace.`,
        buttonText: `Amen`,
        floatingWishes: []
      };
  }
}

/**
 * LocalStorage Acknowledgement Helpers
 */
export function getCelebrationAckKey(type, year, user = null) {
  const userIdentifier = user?._id || user?.id || (user ? 'USER' : 'public');
  return `sjdb_celebration_ack_${type}_${year}_${userIdentifier}`;
}

export function isCelebrationPopupAcknowledged(type, year, user = null) {
  if (typeof window === 'undefined') return false;
  // If URL has ?resetAck=true, bypass acknowledgement for testing
  if (window.location?.search?.includes('resetAck=true')) return false;

  const key = getCelebrationAckKey(type, year, user);
  return localStorage.getItem(key) === 'true';
}

export function acknowledgeCelebrationPopup(type, year, user = null) {
  if (typeof window === 'undefined') return;
  const key = getCelebrationAckKey(type, year, user);
  localStorage.setItem(key, 'true');
}

/**
 * Custom Event Dispatcher for Re-opening Popup from Floating Wishes
 */
export function openCelebrationPopup(celebrationData) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sjdb-open-celebration', {
        detail: celebrationData
      })
    );
  }
}

/**
 * Custom Event Listener for Re-opening Popup
 */
export function onCelebrationPopupOpen(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('sjdb-open-celebration', handler);
  return () => {
    window.removeEventListener('sjdb-open-celebration', handler);
  };
}
