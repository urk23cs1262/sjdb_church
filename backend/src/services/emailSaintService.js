const { getDailySaint, fetchDailySaint } = require('./saintService');
const { getBaseClientUrl } = require('../config/siteRoutes');

const CLIENT_URL = getBaseClientUrl();

/**
 * Format a responsive, elegant Catholic Saint of the Day card for HTML emails.
 * Uses royal-blue and liturgical gold styling with Tamil & English typography.
 */
function formatEmailSaintCard(saint) {
  if (!saint) return '';

  const nameEn = saint.nameEn || saint.nameEnglish || saint.saintName || saint.name || 'Saint of the Day';
  const nameTa = saint.nameTa || saint.nameTamil || '';
  const feastDay = saint.feastDay || saint.feastDayEn || 'Today';
  const feastTitle = saint.feastTitle || saint.titleEn || null;
  const feastTitleTa = saint.feastTitleTa || saint.titleTa || null;

  // Prefer remote public HTTPS URL for email client compatibility
  const imageUrl = saint.remoteUrl || saint.imageUrl || saint.image || 'https://upload.wikimedia.org/wikipedia/commons/b/bf/St._John_De_Britto.jpg';
  const altText = `${nameEn} - Saint of the Day`;

  // Brief description snippet (max 160 chars)
  let shortDesc = (saint.descriptionEn || saint.description || '')
    .replace(/<[^>]+>/g, '')
    .split('.')[0];
  if (shortDesc.length > 160) {
    shortDesc = shortDesc.slice(0, 157) + '...';
  }
  if (!shortDesc) {
    shortDesc = 'May the holy intercession and virtues of this blessed saint bring spiritual grace and guidance today.';
  }

  const feastLine = feastTitle ? `<div style="font-size: 11.5px; font-weight: 700; color: #b45309; margin-top: 2px;">🎉 ${feastTitle}${feastTitleTa && feastTitleTa !== feastTitle ? ` • ${feastTitleTa}` : ''}</div>` : '';

  return `
<!-- SAINT OF THE DAY CARD -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0 14px 0; width: 100%; border-collapse: separate;">
  <tr>
    <td style="background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%); border: 1px solid #BFDBFE; border-left: 4px solid #1E3A8A; border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(30, 58, 138, 0.06); font-family: 'Segoe UI', Roboto, 'Noto Sans Tamil', 'Latha', 'Vijaya', Arial, sans-serif; text-align: left; box-sizing: border-box;">
      <div style="font-size: 11px; font-weight: 800; color: #1E3A8A; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px;">
        🕊️ SAINT OF THE DAY • இன்றைய புனிதர்
      </div>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          ${imageUrl ? `
          <td width="100" valign="top" style="padding-right: 14px; width: 100px;">
            <img src="${imageUrl}" alt="${altText}" width="100" style="width: 100px; max-width: 100px; height: 110px; max-height: 110px; object-fit: cover; border-radius: 8px; border: 1.5px solid #D4AF37; display: block; box-shadow: 0 2px 6px rgba(0,0,0,0.1);" />
          </td>
          ` : ''}
          <td valign="top" style="vertical-align: top;">
            <div style="font-size: 14px; font-weight: 700; color: #0F172A; line-height: 1.3;">
              ${nameEn}
            </div>
            ${nameTa && nameTa !== nameEn ? `
            <div style="font-size: 12.5px; font-weight: 600; color: #B45309; margin-top: 2px;">
              ${nameTa}
            </div>
            ` : ''}
            <div style="font-size: 11.5px; color: #64748B; margin-top: 3px;">
              📅 Feast Day: <strong>${feastDay}</strong>
            </div>
            ${feastLine}
            <p style="margin: 6px 0 10px 0; font-size: 12px; color: #334155; line-height: 1.5;">
              ${shortDesc}.
            </p>
            <div>
              <a href="${CLIENT_URL}/catholic-content" target="_blank" style="display: inline-block; background-color: #1E3A8A; color: #FFFFFF; font-size: 11.5px; font-weight: 700; text-decoration: none; padding: 6px 14px; border-radius: 6px; border: 1px solid #D4AF37;">
                View Saint of the Day &rarr;
              </a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();
}

/**
 * Injects Saint of the Day card into an outgoing HTML email.
 * Places the saint card after the main content / action buttons, and BEFORE the Holy Scripture section!
 */
async function injectSaintCardIntoHtml(html, options = {}) {
  if (!html || typeof html !== 'string') return html;

  // 1. Avoid duplicate Saint cards
  if (
    html.includes('<!-- SAINT OF THE DAY CARD -->') ||
    html.includes('SAINT OF THE DAY CARD') ||
    html.includes('SAINT OF THE DAY / இன்றைய புனிதர்') ||
    html.includes('SAINT OF THE DAY • இன்றைய புனிதர்') ||
    html.includes('SECTION 3: SAINT OF THE DAY') ||
    html.includes('View Saint of the Day')
  ) {
    return html;
  }

  // 2. Security / OTP exemption check
  const subject = (options.subject || '').toLowerCase();
  const lowerHtml = html.toLowerCase();
  const isSecurityOtp = 
    subject.includes('verification code') ||
    subject.includes('password reset') ||
    subject.includes('otp') ||
    lowerHtml.includes('one-time password') ||
    lowerHtml.includes('verification code is') ||
    lowerHtml.includes('security verification');

  if (isSecurityOtp) {
    // Keep security / OTP emails clean and uncluttered
    return html;
  }

  let saint = getDailySaint();
  if (!saint || !saint.name) {
    try {
      saint = await fetchDailySaint();
    } catch (e) {
      saint = getDailySaint();
    }
  }

  if (!saint || (!saint.name && !saint.nameEn)) {
    return html;
  }

  const saintCard = formatEmailSaintCard(saint);

  // 3. Inject right before the Holy Scripture section if present
  if (html.includes('<!-- DYNAMIC_BIBLE_VERSE -->')) {
    return html.replace('<!-- DYNAMIC_BIBLE_VERSE -->', `${saintCard}\n<!-- DYNAMIC_BIBLE_VERSE -->`);
  }
  if (html.includes('<!-- DYNAMIC BILINGUAL BIBLE VERSE CARD -->')) {
    return html.replace('<!-- DYNAMIC BILINGUAL BIBLE VERSE CARD -->', `${saintCard}\n<!-- DYNAMIC BILINGUAL BIBLE VERSE CARD -->`);
  }
  if (html.includes('<!-- BIBLE VERSE -->')) {
    return html.replace('<!-- BIBLE VERSE -->', `${saintCard}\n<!-- BIBLE VERSE -->`);
  }

  // 4. In table-based emails, inject as a row before the footer or before the Scripture card
  const tableFooterPattern = /(<!--\s*(?:Footer|FOOTER|footer|EMAIL FOOTER|FOOTER STATEMENT)\s*-->\s*<tr>|<tr[^>]*>\s*<td[^>]*background(?:-color)?:\s*(?:#f8fafc|#fafafa|#0f172a|#111827)[^>]*>[\s\S]*?(?:St\. John de Britto|Parish Office|May God bless|Computer Generated Receipt))/i;
  const match = html.match(tableFooterPattern);
  if (match) {
    const tableRowCard = `<tr><td style="padding: 0 24px 10px 24px;">${saintCard}</td></tr>\n`;
    return html.replace(match[0], `${tableRowCard}${match[0]}`);
  }

  // 5. Container-based injection before closing content container
  const contentClosePattern = /(<\/div>\s*<\/div>\s*<!--\s*Footer\s*-->|<\/div>\s*<!--\s*Footer\s*-->)/i;
  const divMatch = html.match(contentClosePattern);
  if (divMatch) {
    return html.replace(divMatch[0], `${saintCard}\n${divMatch[0]}`);
  }

  // Fallback: append before </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${saintCard}\n</body>`);
  }

  return `${html}\n${saintCard}`;
}

module.exports = {
  formatEmailSaintCard,
  injectSaintCardIntoHtml
};
