/**
 * Universal Catholic Content Cleaner
 * Removes advertisement styles, classes, script tags, tracking widgets,
 * and CSS fragments (.cgAd2, .cgAd-2, .cgWrap-2, @media...) from Catholic liturgical texts.
 */

function cleanCatholicContent(text) {
  if (!text) return '';
  let cleaned = String(text);

  // 1. Remove HTML style, script, noscript, and iframe blocks
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  cleaned = cleaned.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

  // 2. Remove ad containers and wrapper divs
  cleaned = cleaned.replace(/<div[^>]*class=["'][^"']*(?:cgAd2|cgAd-2|cgWrap-2|cgAd|cgWrap|adsbygoogle|adslot)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  cleaned = cleaned.replace(/<ins[^>]*class=["'][^"']*adsbygoogle[^"']*["'][^>]*>[\s\S]*?<\/ins>/gi, '');

  // 3. Remove raw CSS code accidentally inserted as plain text
  cleaned = cleaned.replace(/\.cgAd2\s*\{[\s\S]*?\}/gi, '');
  cleaned = cleaned.replace(/\.cgAd-2\s*,\s*\.cgWrap-2\s*\{[\s\S]*?\}/gi, '');
  cleaned = cleaned.replace(/@media\s*\(min-width:\s*\d+px\)\s*\{[\s\S]*?\}\s*\}?/gi, '');
  cleaned = cleaned.replace(/\.cgAd[a-zA-Z0-9_-]*\s*\{[\s\S]*?\}/gi, '');
  cleaned = cleaned.replace(/\.cgWrap[a-zA-Z0-9_-]*\s*\{[\s\S]*?\}/gi, '');
  cleaned = cleaned.replace(/\{[^}]*(?:width|height|display|position|margin|text-align)[^}]*\}/gi, '');

  // 4. Remove residual CSS selectors or leftover fragments
  cleaned = cleaned.replace(/\.cgAd2/gi, '');
  cleaned = cleaned.replace(/\.cgAd-2/gi, '');
  cleaned = cleaned.replace(/\.cgWrap-2/gi, '');
  cleaned = cleaned.replace(/min-height:\s*\d+px!important;/gi, '');
  cleaned = cleaned.replace(/text-align:\s*center;?/gi, '');
  cleaned = cleaned.replace(/display:\s*inline-block;?/gi, '');
  cleaned = cleaned.replace(/margin:\s*[^;]+;?/gi, '');
  cleaned = cleaned.replace(/position:\s*relative;?/gi, '');

  // 5. Remove ad / app download lines
  cleaned = cleaned.replace(/Download our Official Catholic Gallery App[^\n]*/gi, '');
  cleaned = cleaned.replace(/Official Catholic Gallery App for[^\n]*/gi, '');
  cleaned = cleaned.replace(/Download for Android[^\n]*/gi, '');
  cleaned = cleaned.replace(/\bAndroid\s*(&|and)?\s*(iOS)?\b/gi, '');
  cleaned = cleaned.replace(/\biOS\b/gi, '');
  cleaned = cleaned.replace(/^New:\s*$/gim, '');
  cleaned = cleaned.replace(/Install Now[^\n]*/gi, '');

  // 6. Clean line by line: discard any line with CSS syntax or garbage
  return cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (line === 'New:' || line === 'Android &' || line === 'iOS' || line === 'Android') return false;
      // Filter any line that is CSS selector or rule
      if (/^[.#][a-zA-Z0-9_-]+\s*\{/.test(line)) return false;
      if (/^[{}\s;]+$/.test(line)) return false;
      if (line.includes('cgAd') || line.includes('cgWrap') || line.includes('@media') || line.includes('!important')) return false;
      if (/^(width|height|min-height|max-height|position|display|margin|padding|text-align)\s*:/i.test(line)) return false;
      if (/calc\([^)]+\)/i.test(line)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalizes liturgical section titles into canonical keys
 * to prevent duplicates (e.g. First Reading appearing twice).
 */
function getCanonicalReadingKey(typeStr = '') {
  const s = String(typeStr).toLowerCase().replace(/[\s\-_:]+/g, ' ').trim();
  if (s.includes('முதல்') || s.includes('first')) return 'first_reading';
  if (s.includes('இரண்டாம்') || s.includes('second')) return 'second_reading';
  if (s.includes('மூன்றாம்') || s.includes('third')) return 'third_reading';
  if (s.includes('பதிலுரை') || s.includes('psalm') || s.includes('response')) return 'psalm';
  if (s.includes('வாழ்த்தொலி') || s.includes('அல்லேலூயா') || s.includes('alleluia') || s.includes('acclamation')) return 'alleluia';
  if (s.includes('நற்செய்தி') || s.includes('gospel')) return 'gospel';
  return s;
}

/**
 * Deduplicate reading sections to ensure each liturgical section
 * (First Reading, Responsorial Psalm, Second Reading, Gospel Acclamation, Gospel)
 * appears exactly once per language.
 */
function deduplicateReadings(readingsList) {
  if (!Array.isArray(readingsList)) return [];

  const seenTypes = new Set();
  const result = [];

  for (const item of readingsList) {
    if (!item) continue;
    const rawType = (item.type || item.heading || '').trim();
    const canonKey = getCanonicalReadingKey(rawType);

    if (!canonKey) continue;

    if (!seenTypes.has(canonKey)) {
      seenTypes.add(canonKey);
      result.push({
        ...item,
        type: rawType,
        text: cleanCatholicContent(item.text || ''),
        reference: (item.reference || '').trim()
      });
    }
  }

  return result;
}

module.exports = {
  cleanCatholicContent,
  deduplicateReadings,
  getCanonicalReadingKey
};
