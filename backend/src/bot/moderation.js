/**
 * SJDB Connect — Inappropriate & Abusive Content Filter
 * 
 * Detects profanity, abusive language, sexual/explicit terms, slurs,
 * and vulgar keywords in English and Tamil (including transliterations).
 */

const BAD_WORDS_LIST = [
  // English Profanity & Abusive Terms
  'fuck', 'fucking', 'fucked', 'fucker', 'fuk', 'fck', 'motherfucker',
  'bitch', 'bitches', 'bitching',
  'shit', 'shitty', 'bullshit',
  'ass', 'asshole', 'arsehole', 'dumbass', 'jackass',
  'bastard', 'bastards',
  'dick', 'dickhead', 'dicks',
  'pussy', 'pussies',
  'cunt', 'cunts',
  'cock', 'cocksucker',
  'slut', 'sluts', 'whore', 'whores',
  'porn', 'porno', 'pornography', 'xxx', 'hentai',
  'sex', 'sexy', 'sexxx', 'nude', 'nudes', 'naked', 'boobs', 'vagina', 'penis',
  'rape', 'rapist', 'molest',
  'kill yourself', 'die', 'murder',

  // Tamil Vulgar / Abusive / Sexual Terms & Transliterations
  'thevidiya', 'thevadiya', 'thevdiya', 'thevidia', 'thevidiyaal',
  'punda', 'punde', 'pundamavan', 'pundachi', 'koothi', 'kuthi',
  'ootha', 'othal', 'ommala', 'ommle', 'otha', 'okala',
  'sunni', 'soothu', 'poolu', 'pool', 'kunju', 'lavade', 'lavada',
  'kena', 'kenapunda', 'mayiru', 'mye', 'baadu', 'badu',
  'kamina', 'harami', 'saavuda', 'potta', 'othavane', 'oothavane',
  'தேவிடியா', 'புண்ட', 'புண்டை', 'சூத்து', 'சுன்னி', 'பூலு', 'மயிரு', 'ஓத்த', 'நாயே', 'கூதி'
];

// Compile regex list with word boundaries where applicable
const COMPILED_PATTERNS = BAD_WORDS_LIST.map(word => {
  // If word has spaces or special chars, escape regex
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use word boundaries for alphabetic English words to avoid false positives (e.g. 'asset' matching 'ass')
  if (/^[a-zA-Z0-9]+$/.test(word) && word.length > 2) {
    return {
      word,
      regex: new RegExp(`\\b${escaped}\\b`, 'i')
    };
  }
  return {
    word,
    regex: new RegExp(escaped, 'i')
  };
});

/**
 * Scan text for inappropriate words
 * @param {string} text
 * @returns {{ hasInappropriate: boolean, detectedWords: string[] }}
 */
function scanInappropriateContent(text) {
  if (!text || typeof text !== 'string') {
    return { hasInappropriate: false, detectedWords: [] };
  }

  const detectedSet = new Set();
  const lower = text.toLowerCase();

  for (const { word, regex } of COMPILED_PATTERNS) {
    if (regex.test(lower)) {
      detectedSet.add(word);
    }
  }

  const detectedWords = Array.from(detectedSet);
  return {
    hasInappropriate: detectedWords.length > 0,
    detectedWords
  };
}

module.exports = {
  scanInappropriateContent,
  BAD_WORDS_LIST
};
