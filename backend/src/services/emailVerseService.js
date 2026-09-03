const fs = require('fs');
const path = require('path');
const DailyVerse = require('../models/DailyVerse');

let fileVerses = [];

function loadVerses() {
  try {
    const jsonPath = path.join(__dirname, '..', 'data', 'daily-verses-400.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      fileVerses = Array.isArray(data) ? data : (data.verses || []);
      console.log(`[EmailVerseService] Loaded ${fileVerses.length} daily Bible verses from daily-verses-400.json.`);
    }
  } catch (e) {
    console.warn('[EmailVerseService] Could not load daily-verses-400.json:', e.message);
  }
}

// Initial load
loadVerses();

let lastIndex = -1;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Retrieves a fresh, distinct Bible Verse from daily-verses-400.json or MongoDB
 * in both English and Tamil.
 */
async function getFreshBibleVerse() {
  if (fileVerses.length === 0) {
    loadVerses();
  }

  if (fileVerses.length > 0) {
    let nextIndex = Math.floor(Math.random() * fileVerses.length);
    if (nextIndex === lastIndex && fileVerses.length > 1) {
      nextIndex = (nextIndex + 1) % fileVerses.length;
    }
    lastIndex = nextIndex;
    const v = fileVerses[nextIndex];
    return {
      ref: v.ref || v.reference || 'Holy Scripture',
      en: (v.en || v.verseTextEn || v.english || '').trim(),
      ta: (v.ta || v.verseTextTa || v.tamil || '').trim(),
      category: v.category || 'Daily Blessing'
    };
  }

  // Fallback: Query MongoDB DailyVerse model
  try {
    const count = await DailyVerse.countDocuments();
    if (count > 0) {
      const randomSkip = Math.floor(Math.random() * count);
      const doc = await DailyVerse.findOne().skip(randomSkip);
      if (doc) {
        return {
          ref: doc.ref || doc.reference || 'Holy Scripture',
          en: (doc.english || doc.verseTextEn || '').trim(),
          ta: (doc.tamil || doc.verseTextTa || '').trim(),
          category: doc.category || 'Daily Blessing'
        };
      }
    }
  } catch (err) {
    console.warn('[EmailVerseService] MongoDB fallback error:', err.message);
  }

  // Ultimate fallback
  return {
    ref: 'Luke 1:37',
    en: 'For with God nothing shall be impossible.',
    ta: 'தேவனால் கூடாத காரியம் ஒன்றுமில்லை.',
    category: 'Faith'
  };
}

/**
 * Returns a styled HTML component containing the fresh Bible verse in both English and Tamil.
 */
function formatEmailVerseCard(verse) {
  if (!verse || (!verse.en && !verse.ta)) return '';

  const ref = escapeHtml(verse.ref || 'Holy Scripture');
  const en = escapeHtml(verse.en || '');
  const ta = escapeHtml(verse.ta || '');
  const category = escapeHtml(verse.category ? ` • ${verse.category}` : '');

  return `
<!-- DYNAMIC BILINGUAL BIBLE VERSE CARD -->
<div style="background: linear-gradient(135deg, #fffdf7 0%, #fef3c7 100%); border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 14px; padding: 16px 18px; margin: 20px 0; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.06); width: 100%; box-sizing: border-box; word-break: break-word;">
  <div style="font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
    Holy Scripture • தினசரி இறைவார்த்தை${category}
  </div>
  ${en ? `<p style="margin: 0 0 8px 0; font-size: 13.5px; font-style: italic; color: #1e293b; line-height: 1.6;">"${en}"</p>` : ''}
  ${ta ? `<p style="margin: 0 0 10px 0; font-size: 13px; color: #78350f; line-height: 1.6;">"${ta}"</p>` : ''}
  <div style="font-size: 12px; font-weight: 800; color: #b45309; text-align: right;">
    — ${ref}
  </div>
</div>
`;
}

/**
 * Injects a fresh bilingual Bible verse card into any outgoing HTML email.
 */
async function injectFreshBibleVerseIntoHtml(html) {
  if (!html || typeof html !== 'string') return html;

  const verse = await getFreshBibleVerse();
  const verseCard = formatEmailVerseCard(verse);

  // If explicit placeholder exists, replace it
  if (html.includes('<!-- DYNAMIC_BIBLE_VERSE -->')) {
    return html.replace('<!-- DYNAMIC_BIBLE_VERSE -->', verseCard);
  }

  // If old static verse block exists, replace it
  if (html.includes('<!-- BIBLE VERSE -->')) {
    const bibleRegex = /<!-- BIBLE VERSE -->[\s\S]*?<\/div>\s*<\/div>/i;
    if (bibleRegex.test(html)) {
      return html.replace(bibleRegex, verseCard);
    }
  }

  // If the email already has a dynamic verse card, do nothing
  if (html.includes('DYNAMIC BILINGUAL BIBLE VERSE CARD') || html.includes('DAILY BIBLE VERSES / தினசரி வேத வசனம்')) {
    return html;
  }

  // Insert before footer comment if present
  if (html.includes('<!-- Footer -->') || html.includes('<!-- FOOTER -->') || html.includes('<!-- footer -->')) {
    return html.replace(/<!-- (?:Footer|FOOTER|footer) -->/, `${verseCard}\n<!-- Footer -->`);
  }

  // Insert before the last closing </div> or </body>
  const lastDivIndex = html.lastIndexOf('</div>');
  if (lastDivIndex !== -1) {
    return html.slice(0, lastDivIndex) + verseCard + html.slice(lastDivIndex);
  }

  if (html.includes('</body>')) {
    return html.replace('</body>', `${verseCard}</body>`);
  }

  return html + verseCard;
}

module.exports = {
  getFreshBibleVerse,
  formatEmailVerseCard,
  injectFreshBibleVerseIntoHtml
};
