/**
 * Frontend Bible Reference Helper
 * Translates Bible book references between English and Tamil (Catholic CCBI / திருவிவிலியம் standards)
 */

export const BIBLE_BOOKS = [
  // New Testament
  { en: '1 Peter', ta: '1 பேதுரு', aliases: ['1 pet', '1pet', '1 pt', '1pt', '1 பேதுரு', '1பேதுரு'] },
  { en: '2 Peter', ta: '2 பேதுரு', aliases: ['2 pet', '2pet', '2 pt', '2pt', '2 பேதுரு', '2பேதுரு'] },
  { en: '1 John', ta: '1 யோவான்', aliases: ['1 jn', '1jn', '1 jhn', '1 யோவான்', '1யோவான்'] },
  { en: '2 John', ta: '2 யோவான்', aliases: ['2 jn', '2jn', '2 jhn', '2 யோவான்', '2யோவான்'] },
  { en: '3 John', ta: '3 யோவான்', aliases: ['3 jn', '3jn', '3 jhn', '3 யோவான்', '3யோவான்'] },
  { en: 'John', ta: 'யோவான்', aliases: ['jn', 'jhn', 'joh', 'யோவான்'] },
  { en: 'Matthew', ta: 'மத்தேயு', aliases: ['matt', 'mat', 'mt', 'மத்தேயு'] },
  { en: 'Mark', ta: 'மாற்கு', aliases: ['mrk', 'mar', 'mk', 'மாற்கு'] },
  { en: 'Luke', ta: 'லூக்கா', aliases: ['luk', 'lk', 'லூக்கா'] },
  { en: 'Acts', ta: 'திருத்தூதர் பணிகள்', aliases: ['act', 'ac', 'அப்போஸ்தலர்', 'திருத்தூதர் பணிகள்'] },
  { en: 'Romans', ta: 'உரோமையர்', aliases: ['rom', 'ro', 'rm', 'ரோமர்', 'உரோமையர்'] },
  { en: '1 Corinthians', ta: '1 கொரிந்தியர்', aliases: ['1 cor', '1cor', '1 co', '1 கொரிந்தியர்', '1கொரிந்தியர்'] },
  { en: '2 Corinthians', ta: '2 கொரிந்தியர்', aliases: ['2 cor', '2cor', '2 co', '2 கொரிந்தியர்', '2கொரிந்தியர்'] },
  { en: 'Galatians', ta: 'கலாத்தியர்', aliases: ['gal', 'ga', 'கலாத்தியர்'] },
  { en: 'Ephesians', ta: 'எபேசியர்', aliases: ['eph', 'ep', 'எபேசியர்'] },
  { en: 'Philippians', ta: 'பிலிப்பியர்', aliases: ['phil', 'php', 'phi', 'பிலிப்பியர்'] },
  { en: 'Colossians', ta: 'கொலோசேயர்', aliases: ['col', 'கொலோசேயர்'] },
  { en: '1 Thessalonians', ta: '1 தெசலோனிக்கர்', aliases: ['1 thess', '1thess', '1 th', '1 தெசலோனிக்கர்'] },
  { en: '2 Thessalonians', ta: '2 தெசலோனிக்கர்', aliases: ['2 thess', '2thess', '2 th', '2 தெசலோனிக்கர்'] },
  { en: '1 Timothy', ta: '1 திமொத்தேயு', aliases: ['1 tim', '1tim', '1 ti', '1 திமொத்தேயு'] },
  { en: '2 Timothy', ta: '2 திமொத்தேயு', aliases: ['2 tim', '2tim', '2 ti', '2 திமொத்தேயு'] },
  { en: 'Titus', ta: 'தீத்து', aliases: ['tit', 'ti', 'தீத்து'] },
  { en: 'Philemon', ta: 'பிலமோன்', aliases: ['phlm', 'phm', 'பிலமோன்'] },
  { en: 'Hebrews', ta: 'எபிரேயர்', aliases: ['heb', 'he', 'எபிரேயர்'] },
  { en: 'James', ta: 'யாக்கோபு', aliases: ['jas', 'jm', 'யாக்கோபு'] },
  { en: 'Jude', ta: 'யூதா', aliases: ['jud', 'jd', 'யூதா'] },
  { en: 'Revelation', ta: 'திருவெளிப்பாடு', aliases: ['rev', 're', 'வெளிப்படுத்தின விசேஷம்', 'திருவெளிப்பாடு'] },

  // Old Testament & Deuterocanonical
  { en: 'Genesis', ta: 'தொடக்க நூல்', aliases: ['gen', 'ge', 'gn', 'ஆதியாகமம்', 'தொடக்க நூல்'] },
  { en: 'Exodus', ta: 'விடுதலைப் பயணம்', aliases: ['exod', 'exo', 'ex', 'யாத்திராகமம்', 'விடுதலைப் பயணம்'] },
  { en: 'Leviticus', ta: 'லேவியர்', aliases: ['lev', 'le', 'lv', 'லேவியர்'] },
  { en: 'Numbers', ta: 'எண்ணிக்கை', aliases: ['num', 'nu', 'nm', 'எண்ணாகமம்', 'எண்ணிக்கை'] },
  { en: 'Deuteronomy', ta: 'இணைச் சட்டம்', aliases: ['deut', 'dt', 'de', 'உபாகமம்', 'இணைச் சட்டம்'] },
  { en: 'Joshua', ta: 'யோசுவா', aliases: ['josh', 'jos', 'jsh', 'யோசுவா'] },
  { en: 'Judges', ta: 'நீதித் தலைவர்கள்', aliases: ['judg', 'jdg', 'jg', 'நியாயாதிபதிகள்', 'நீதித் தலைவர்கள்'] },
  { en: 'Ruth', ta: 'ரூத்து', aliases: ['rth', 'ru', 'ரூத்து'] },
  { en: '1 Samuel', ta: '1 சாமுவேல்', aliases: ['1 sam', '1sam', '1 sm', '1 சாமுவேல்'] },
  { en: '2 Samuel', ta: '2 சாமுவேல்', aliases: ['2 sam', '2sam', '2 sm', '2 சாமுவேல்'] },
  { en: '1 Kings', ta: '1 அரசர்கள்', aliases: ['1 kgs', '1kgs', '1 ki', '1 ராஜாக்கள்', '1 அரசர்கள்'] },
  { en: '2 Kings', ta: '2 அரசர்கள்', aliases: ['2 kgs', '2kgs', '2 ki', '2 ராஜாக்கள்', '2 அரசர்கள்'] },
  { en: '1 Chronicles', ta: '1 குறிப்பேடு', aliases: ['1 chron', '1chr', '1 ch', '1 நாளாகமம்', '1 குறிப்பேடு'] },
  { en: '2 Chronicles', ta: '2 குறிப்பேடு', aliases: ['2 chron', '2chr', '2 ch', '2 நாளாகமம்', '2 குறிப்பேடு'] },
  { en: 'Ezra', ta: 'எஸ்ரா', aliases: ['ezr', 'எஸ்ரா'] },
  { en: 'Nehemiah', ta: 'நெகேமியா', aliases: ['neh', 'ne', 'நெகேமியா'] },
  { en: 'Tobit', ta: 'தோபித்து', aliases: ['tob', 'tb', 'தோபித்து'] },
  { en: 'Judith', ta: 'யூதித்து', aliases: ['jdt', 'jth', 'யூதித்து'] },
  { en: 'Esther', ta: 'எஸ்தர்', aliases: ['esth', 'est', 'es', 'எஸ்தர்'] },
  { en: '1 Maccabees', ta: '1 மக்கபேயர்', aliases: ['1 macc', '1macc', '1 மக்கபேயர்'] },
  { en: '2 Maccabees', ta: '2 மக்கபேயர்', aliases: ['2 macc', '2macc', '2 மக்கபேயர்'] },
  { en: 'Job', ta: 'யோபு', aliases: ['jb', 'யோபு'] },
  { en: 'Psalm', ta: 'திருப்பாடல்கள்', aliases: ['psalm', 'psalms', 'ps', 'pss', 'psm', 'சங்கீதம்', 'திருப்பாடல்கள்'] },
  { en: 'Proverbs', ta: 'நீதிமொழிகள்', aliases: ['prov', 'pro', 'prv', 'pr', 'நீதிமொழிகள்'] },
  { en: 'Ecclesiastes', ta: 'சபை உரையாளர்', aliases: ['eccles', 'eccl', 'ecc', 'ec', 'பிரசங்கி', 'சபை உரையாளர்'] },
  { en: 'Song of Songs', ta: 'இனிமைமிகு பாடல்', aliases: ['song of solomon', 'song', 'sos', 'canticles', 'உன்னதப்பாட்டு', 'இனிமைமிகு பாடல்'] },
  { en: 'Wisdom', ta: 'சாலமோனின் ஞானம்', aliases: ['wis', 'ws', 'ஞானம்', 'சாலமோனின் ஞானம்'] },
  { en: 'Sirach', ta: 'சீராக்', aliases: ['ecclesiasticus', 'sir', 'சீராக்'] },
  { en: 'Isaiah', ta: 'எசாயா', aliases: ['isa', 'is', 'ஏசாயா', 'எசாயா'] },
  { en: 'Jeremiah', ta: 'எரேமியா', aliases: ['jer', 'jr', 'எரேமியா'] },
  { en: 'Lamentations', ta: 'புலம்பல்', aliases: ['lam', 'la', 'புலம்பல்'] },
  { en: 'Baruch', ta: 'பாரூக்', aliases: ['bar', 'பாரூக்'] },
  { en: 'Ezekiel', ta: 'எசேக்கியேல்', aliases: ['ezek', 'eze', 'ezk', 'எசேக்கியேல்'] },
  { en: 'Daniel', ta: 'தானியேல்', aliases: ['dan', 'da', 'dn', 'தானியேல்'] },
  { en: 'Hosea', ta: 'ஓசேயா', aliases: ['hos', 'ho', 'ஓசேயா'] },
  { en: 'Joel', ta: 'யோவேல்', aliases: ['jl', 'joe', 'யோவேல்'] },
  { en: 'Amos', ta: 'ஆமோஸ்', aliases: ['am', 'amo', 'ஆமோஸ்'] },
  { en: 'Obadiah', ta: 'ஒபதியா', aliases: ['obad', 'ob', 'ஒபதியா'] },
  { en: 'Jonah', ta: 'யோனா', aliases: ['jon', 'jnh', 'யோனா'] },
  { en: 'Micah', ta: 'மீக்கா', aliases: ['mic', 'mc', 'மீக்கா'] },
  { en: 'Nahum', ta: 'நாகூம்', aliases: ['nah', 'na', 'நாகூம்'] },
  { en: 'Habakkuk', ta: 'அபக்கூக்கு', aliases: ['hab', 'அபக்கூக்கு'] },
  { en: 'Zephaniah', ta: 'செப்பனியா', aliases: ['zeph', 'zep', 'செப்பனியா'] },
  { en: 'Haggai', ta: 'ஆகாய்', aliases: ['hag', 'hg', 'ஆகாய்'] },
  { en: 'Zechariah', ta: 'செக்கரியா', aliases: ['zech', 'zec', 'zc', 'செக்கரியா'] },
  { en: 'Malachi', ta: 'மலாக்கி', aliases: ['mal', 'ml', 'மலாக்கி'] }
];

function normalizeKey(str) {
  return String(str || '').toLowerCase().replace(/[\s\.\-_]/g, '');
}

function parseRef(rawRef) {
  if (!rawRef) return { bookPart: '', numPart: '' };
  let clean = String(rawRef).trim();

  if (clean.includes('/')) {
    const parts = clean.split('/');
    const taPart = parts.find(p => /[\u0B80-\u0BFF]/.test(p));
    const enPart = parts.find(p => !/[\u0B80-\u0BFF]/.test(p));
    return {
      rawTa: taPart ? taPart.trim() : null,
      rawEn: enPart ? enPart.trim() : null,
      clean
    };
  }

  const match = clean.match(/^(.*?)(\s+\d+(?::\d+(?:-\d+)?)?|\s+\d+(?:-\d+)?)$/);
  if (match) {
    return {
      bookPart: match[1].trim(),
      numPart: match[2].trim()
    };
  }

  return { bookPart: clean, numPart: '' };
}

function findBookEntry(bookPart) {
  if (!bookPart) return null;
  const norm = normalizeKey(bookPart);

  for (const entry of BIBLE_BOOKS) {
    if (normalizeKey(entry.en) === norm || normalizeKey(entry.ta) === norm) {
      return entry;
    }
    if (entry.aliases && entry.aliases.some(a => normalizeKey(a) === norm)) {
      return entry;
    }
  }

  for (const entry of BIBLE_BOOKS) {
    if (norm.startsWith(normalizeKey(entry.en)) || norm.startsWith(normalizeKey(entry.ta))) {
      return entry;
    }
  }

  return null;
}

export function getTamilBibleReference(rawRef) {
  if (!rawRef) return '';
  const parsed = parseRef(rawRef);
  if (parsed.rawTa) return parsed.rawTa;

  const entry = findBookEntry(parsed.bookPart);
  if (entry) {
    return `${entry.ta} ${parsed.numPart}`.trim();
  }

  if (/[\u0B80-\u0BFF]/.test(rawRef)) {
    return rawRef.trim();
  }

  return rawRef.trim();
}

export function getEnglishBibleReference(rawRef) {
  if (!rawRef) return '';
  const parsed = parseRef(rawRef);
  if (parsed.rawEn) return parsed.rawEn;

  const entry = findBookEntry(parsed.bookPart);
  if (entry) {
    return `${entry.en} ${parsed.numPart}`.trim();
  }

  return rawRef.trim();
}

export function getBilingualBibleReference(rawRef) {
  return {
    english: getEnglishBibleReference(rawRef),
    tamil: getTamilBibleReference(rawRef)
  };
}
