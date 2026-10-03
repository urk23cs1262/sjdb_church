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
 * Disabled: Per church requirements, email notifications keep only HOLY SCRIPTURE at the end of email.
 */
async function injectSaintCardIntoHtml(html, options = {}) {
  return html;
}

module.exports = {
  formatEmailSaintCard,
  injectSaintCardIntoHtml
};
