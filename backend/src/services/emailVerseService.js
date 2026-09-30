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
 * Adheres strictly to the church's gold and royal-blue Catholic aesthetic with email-safe fonts.
 */
function formatEmailVerseCard(verse, options = {}) {
  if (!verse || (!verse.en && !verse.ta)) return '';

  const ref = escapeHtml(verse.ref || 'Holy Scripture');
  const en = escapeHtml(verse.en || '');
  const ta = escapeHtml(verse.ta || '');
  const category = escapeHtml(verse.category ? ` • ${verse.category}` : '');

  return `
<!-- DYNAMIC BILINGUAL BIBLE VERSE CARD -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 22px 0 10px 0; width: 100%; border-collapse: separate;">
  <tr>
    <td style="background: linear-gradient(135deg, #fffdf7 0%, #fef3c7 100%); border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.08); font-family: 'Segoe UI', Roboto, 'Noto Sans Tamil', 'Latha', 'Vijaya', Arial Unicode MS, Arial, sans-serif; text-align: left; box-sizing: border-box;">
      <div style="font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
        HOLY SCRIPTURE • Daily Scripture • Prayer${category}
      </div>
      ${en ? `<p style="margin: 0 0 8px 0; font-size: 13.5px; font-style: italic; color: #1e293b; line-height: 1.6; font-family: 'Segoe UI', Roboto, Georgia, serif;">"${en}"</p>` : ''}
      ${ta ? `<p style="margin: 0 0 10px 0; font-size: 13px; color: #78350f; line-height: 1.6; font-family: 'Noto Sans Tamil', 'Latha', 'Vijaya', 'Segoe UI', Roboto, Arial Unicode MS, sans-serif;">"${ta}"</p>` : ''}
      <div style="font-size: 12px; font-weight: 800; color: #b45309; text-align: right;">
        — ${ref}
      </div>
    </td>
  </tr>
</table>
`.trim();
}

/**
 * Injects a fresh bilingual Bible verse card into any outgoing HTML email.
 * Ensures the Holy Scripture section appears at the very end of the email body,
 * after all notification content and action buttons, immediately before the footer.
 */
async function injectFreshBibleVerseIntoHtml(html) {
  if (!html || typeof html !== 'string') return html;

  // 1. Avoid duplicate Holy Scripture sections
  if (
    html.includes('<!-- DYNAMIC BILINGUAL BIBLE VERSE CARD -->') ||
    html.includes('DYNAMIC BILINGUAL BIBLE VERSE CARD') ||
    html.includes('HOLY SCRIPTURE • Daily Scripture • Prayer') ||
    html.includes('HOLY SCRIPTURE • தினசரி இறைவார்த்தை') ||
    html.includes('DAILY BIBLE VERSES / தினசரி வேத வசனம்') ||
    html.includes('Scripture Blessing • இறைவார்த்தை ஆசி')
  ) {
    return html;
  }

  const verse = await getFreshBibleVerse();
  const verseCard = formatEmailVerseCard(verse);

  // 2. Explicit placeholder (highest priority)
  if (html.includes('<!-- DYNAMIC_BIBLE_VERSE -->')) {
    return html.replace('<!-- DYNAMIC_BIBLE_VERSE -->', verseCard);
  }
  if (html.includes('<!-- BIBLE_VERSE -->')) {
    return html.replace('<!-- BIBLE_VERSE -->', verseCard);
  }

  // 3. Old static verse block replacement
  if (html.includes('<!-- BIBLE VERSE -->')) {
    const bibleRegex = /<!-- BIBLE VERSE -->[\s\S]*?<\/div>\s*<\/div>/i;
    if (bibleRegex.test(html)) {
      return html.replace(bibleRegex, verseCard);
    }
  }

  // 4. Table-based emails where the footer is a <tr>:
  // e.g. <!-- Footer -->\s*<tr> or <tr ... footer ...>
  // In table structures, we wrap the card in <tr><td ...> so it is never foster-parented!
  const tableFooterPattern = /(<!--\s*(?:Footer|FOOTER|footer|EMAIL FOOTER|FOOTER STATEMENT)\s*-->\s*<tr>|<tr[^>]*>\s*<td[^>]*background(?:-color)?:\s*(?:#f8fafc|#fafafa|#0f172a|#111827)[^>]*>[\s\S]*?(?:St\. John de Britto|Parish Office|May God bless|Computer Generated Receipt))/i;
  const tableFooterMatch = html.match(tableFooterPattern);
  if (tableFooterMatch && tableFooterMatch.index !== undefined) {
    const tableRowCard = `<tr><td style="padding: 10px 24px 18px 24px;">\n${verseCard}\n</td></tr>\n`;
    return html.slice(0, tableFooterMatch.index) + tableRowCard + html.slice(tableFooterMatch.index);
  }

  // 5. Div-based emails:
  // Identify footer boundary (by comment or footer class/style)
  const footerStartPattern = /(?:<!--\s*(?:Footer|FOOTER|footer|EMAIL FOOTER|FOOTER SECTION)\s*-->|<div[^>]*class="[^"]*footer|<div[^>]*style="[^"]*background(?:-color)?:\s*#(?:0f172a|111827|1e293b|111)[^"]*text-align:\s*center)/i;
  const footerMatch = html.match(footerStartPattern);

  if (footerMatch && footerMatch.index !== undefined) {
    const beforeFooter = html.slice(0, footerMatch.index);
    const afterFooter = html.slice(footerMatch.index);

    // Look for the closing </div> of the content container right before the footer
    const lastClosingDiv = beforeFooter.lastIndexOf('</div>');
    if (lastClosingDiv !== -1) {
      // Insert inside the content container, right before its closing </div>
      return (
        beforeFooter.slice(0, lastClosingDiv) +
        `\n${verseCard}\n` +
        beforeFooter.slice(lastClosingDiv) +
        afterFooter
      );
    } else {
      // If no </div> before footer, insert directly before footer
      return beforeFooter + `\n${verseCard}\n` + afterFooter;
    }
  }

  // 6. Generic container closing:
  // If there's an inner container closing before the outer container, e.g. </div>\s*</div>
  const lastDivIndex = html.lastIndexOf('</div>');
  if (lastDivIndex !== -1) {
    const beforeLastDiv = html.slice(0, lastDivIndex);
    const prevDivIndex = beforeLastDiv.lastIndexOf('</div>');
    if (prevDivIndex !== -1) {
      return (
        beforeLastDiv.slice(0, prevDivIndex) +
        `\n${verseCard}\n` +
        beforeLastDiv.slice(prevDivIndex) +
        html.slice(lastDivIndex)
      );
    }
    return html.slice(0, lastDivIndex) + `\n${verseCard}\n` + html.slice(lastDivIndex);
  }

  // 7. Last fallback: before </body> or append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${verseCard}\n</body>`);
  }

  return html + '\n' + verseCard;
}

module.exports = {
  getFreshBibleVerse,
  formatEmailVerseCard,
  injectFreshBibleVerseIntoHtml
};
