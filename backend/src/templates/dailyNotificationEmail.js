const { cleanCatholicContent, deduplicateReadings } = require('../utils/cleanCatholicContent');
const { getBaseClientUrl } = require('../config/siteRoutes');

const CLIENT_URL = getBaseClientUrl();

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatParagraphs(text) {
  if (!text) return '';
  const cleaned = cleanCatholicContent(text);
  if (!cleaned) return '';
  return cleaned
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => {
      if (!p || p.length === 0) return false;
      if (p.includes('cgAd') || p.includes('cgWrap') || p.includes('@media') || p.includes('!important')) return false;
      if (/^[.#][a-zA-Z0-9_-]+\s*\{/.test(p)) return false;
      if (/^(width|height|min-height|max-height|position|display|margin|padding|text-align)\s*:/i.test(p)) return false;
      return true;
    })
    .map(p => {
      let formatted = escapeHtml(p);
      // Replace **text** with <strong>text</strong>
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Style special prayer or title lines
      if (formatted.startsWith('Prayer:') || formatted.startsWith('மன்றாட்டு:')) {
        return `<div style="background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 10px 14px; border-radius: 0 6px 6px 0; margin-top: 12px; font-style: italic; color: #78350F; font-size: 14px; line-height: 1.6;">${formatted}</div>`;
      }
      return `<p style="margin: 0 0 10px 0; line-height: 1.6; color: #334155; font-size: 14.5px;">${formatted}</p>`;
    })
    .join('');
}

function renderMassReadingsSection(massReadings, lang) {
  const showTamil = lang === 'ta' || lang === 'both';
  const showEnglish = lang === 'en' || lang === 'both';

  let html = '';

  if (showTamil) {
    const rawTa = massReadings.tamil?.readings || [];
    const taReadings = deduplicateReadings(rawTa);
    html += `
      <div style="margin-bottom: ${showEnglish ? '24px' : '0'};">
        <div style="background-color: #F8FAFC; border-left: 4px solid #C5A059; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 14px;">
          <h3 style="margin: 0; color: #1E293B; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">DAILY MASS READINGS</h3>
          <div style="margin: 4px 0 0 0; color: #C5A059; font-size: 14px; font-weight: 700;">தமிழ்</div>
          ${massReadings.tamil?.title && massReadings.tamil.title !== 'New:' ? `<p style="margin: 4px 0 0 0; color: #64748B; font-size: 13px; font-weight: 600;">${escapeHtml(massReadings.tamil.title)}</p>` : ''}
        </div>
        ${taReadings.length > 0 ? taReadings.map(r => `
          <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed #E2E8F0;">
            <div style="color: #0F172A; font-weight: 700; font-size: 14px; margin-bottom: 4px;">${escapeHtml(r.type || 'வாசகம்')} ${r.reference ? `<span style="color: #64748B; font-weight: 500; font-size: 13px;">(${escapeHtml(r.reference)})</span>` : ''}</div>
            <div style="color: #334155; font-size: 14px; line-height: 1.6;">${formatParagraphs(r.text || '')}</div>
          </div>
        `).join('') : formatParagraphs(massReadings.tamil?.fullText || '')}
      </div>
    `;
  }

  if (showEnglish) {
    const rawEn = massReadings.english?.readings || [];
    const enReadings = deduplicateReadings(rawEn);
    html += `
      <div>
        <div style="background-color: #F8FAFC; border-left: 4px solid #1E293B; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 14px;">
          <h3 style="margin: 0; color: #1E293B; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">DAILY MASS READINGS</h3>
          <div style="margin: 4px 0 0 0; color: #64748B; font-size: 14px; font-weight: 700;">English</div>
          ${massReadings.english?.title && massReadings.english.title !== 'New:' ? `<p style="margin: 4px 0 0 0; color: #64748B; font-size: 13px; font-weight: 600;">${escapeHtml(massReadings.english.title)}</p>` : ''}
        </div>
        ${enReadings.length > 0 ? enReadings.map(r => `
          <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed #E2E8F0;">
            <div style="color: #0F172A; font-weight: 700; font-size: 14px; margin-bottom: 4px;">${escapeHtml(r.type || 'Reading')} ${r.reference ? `<span style="color: #64748B; font-weight: 500; font-size: 13px;">(${escapeHtml(r.reference)})</span>` : ''}</div>
            <div style="color: #334155; font-size: 14px; line-height: 1.6;">${formatParagraphs(r.text || '')}</div>
          </div>
        `).join('') : formatParagraphs(massReadings.english?.fullText || '')}
      </div>
    `;
  }

  // html += `
  //   <div style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed #CBD5E1; font-size: 12px; color: #64748B; text-align: right;">
  //     Source: <a href="https://www.catholicgallery.org/tamil-mass-readings-today/" target="_blank" style="color: #C5A059; text-decoration: none; font-weight: 600;">Catholic Lectionary / CCBI &amp; USCCB Liturgy</a>
  //   </div>
  // `;

  return html;
}

function renderReflectionSection(reflection, lang) {
  const showTamil = lang === 'ta' || lang === 'both';
  const showEnglish = lang === 'en' || lang === 'both';

  let html = '';

  if (showTamil) {
    html += `
      <div style="margin-bottom: ${showEnglish ? '18px' : '0'};">
        <div style="color: #C5A059; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          இன்றைய சிந்தனை
        </div>
        <div style="background-color: #FFFDF7; border: 1px solid #FEF3C7; border-radius: 8px; padding: 14px 16px; color: #78350F; font-size: 14px; line-height: 1.6;">
          ${formatParagraphs(reflection.tamil || '')}
        </div>
      </div>
    `;
  }

  if (showEnglish) {
    html += `
      <div>
        <div style="color: #1E293B; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          TODAY'S REFLECTION
        </div>
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 16px; color: #334155; font-size: 14px; line-height: 1.6;">
          ${formatParagraphs(reflection.english || '')}
        </div>
      </div>
    `;
  }

  // html += `
  //   <div style="margin-top: 12px; padding-top: 8px; font-size: 12px; color: #64748B; text-align: right;">
  //     Source: <a href="https://www.tamilcatholicdaily.com/dailyverse" target="_blank" style="color: #C5A059; text-decoration: none; font-weight: 600;">Catholic Liturgical Meditations / Daily Living Word</a>
  //   </div>
  // `;

  return html;
}

/**
 * Generate full HTML email
 */
function generateDailyNotificationHtml({
  userName = 'Parishioner',
  dailyContent,
  userLanguage = 'ta',
  hasBibleImageAttachment = false,
  hasSaintImageAttachment = false
}) {
  const { formattedDate, formattedDateTa, bible, massReadings, reflection, saint, readingsUrl } = dailyContent;
  const { getTamilBibleReference, getEnglishBibleReference } = require('../utils/bibleRefHelper');
  const refEn = getEnglishBibleReference(bible?.ref);
  const refTa = getTamilBibleReference(bible?.ref);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily Catholic Reading - ${escapeHtml(formattedDate)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F1F5F9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;">
          
          <!-- Top Golden Accent Bar -->
          <tr>
            <td style="background: linear-gradient(90deg, #9A7B38, #C5A059, #DFB96C); height: 6px;"></td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding: 32px 28px 24px 28px; text-align: center; background-color: #0F172A; color: #FFFFFF;">
              <div style="width: 75px; height: 75px; border-radius: 50%; overflow: hidden; margin: 0 auto 14px; border: 3px solid #C5A059; box-shadow: 0 4px 14px rgba(0,0,0,0.3); background: #ffffff;">
                <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; color: #FFFFFF;">ST. JOHN DE Britto CHURCH</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #C5A059; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">SJDB Connect — Daily Liturgy & Faith</p>
              
              <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.12);">
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #F8FAFC;">Good Morning, ${escapeHtml(userName)}</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #94A3B8;">${escapeHtml(formattedDate)} • ${escapeHtml(formattedDateTa)}</p>
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 24px;">

              <!-- SECTION 1: DAILY BIBLE VERSE (IMAGE + TEXT) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <!-- Section Title -->
                    <div style="background-color: #0F172A; border-left: 4px solid #C5A059; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 14px;">
                      <h2 style="margin: 0; color: #FFFFFF; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        DAILY BIBLE VERSE / இன்றைய இறைவார்த்தை
                      </h2>
                    </div>

                    <!-- Verse Image (if attached or available) -->
                    ${hasBibleImageAttachment ? `
                    <div style="margin-bottom: 16px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.12); border: 1.5px solid #D4AF37; text-align: center; background-color: #0F172A;">
                      <img src="cid:daily_bible_verse_img" alt="Daily Bible Verse" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
                    </div>
                    ` : ((bible?.imageUrl || bible?.image) ? `
                    <div style="margin-bottom: 16px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.12); border: 1.5px solid #D4AF37; text-align: center; background-color: #0F172A;">
                      <img src="${escapeHtml(bible.imageUrl || bible.image)}" alt="Daily Bible Verse" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
                    </div>
                    ` : '')}

                    <!-- Verse Text Card -->
                    <div style="background: linear-gradient(135deg, #FFFDF7 0%, #FEF3C7 100%); border: 1px solid #FDE68A; border-left: 4px solid #D97706; border-radius: 12px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.08); font-family: 'Segoe UI', Roboto, 'Noto Sans Tamil', 'Latha', 'Vijaya', Arial, sans-serif; box-sizing: border-box !important; width: 100% !important; max-width: 100% !important; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto;">
                      ${bible?.english ? `
                      <p style="margin: 0 0 8px 0; font-size: 14.5px; font-style: italic; color: #1E293B; line-height: 1.6; font-family: 'Segoe UI', Roboto, Georgia, serif; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto; max-width: 100%;">
                        "${escapeHtml(bible.english)}"
                      </p>
                      ` : ''}

                      ${bible?.tamil ? `
                      <p style="margin: 0 0 10px 0; font-size: 13.5px; color: #78350F; line-height: 1.6; font-family: 'Noto Sans Tamil', 'Latha', 'Vijaya', 'Segoe UI', Roboto, Arial, sans-serif; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto; max-width: 100%;">
                        "${escapeHtml(bible.tamil)}"
                      </p>
                      ` : ''}

                      <div style="font-size: 12.5px; font-weight: 800; color: #B45309; text-align: right; line-height: 1.4; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important;">
                        — ${escapeHtml(refEn)}${refTa && refTa !== refEn ? ` • ${escapeHtml(refTa)}` : ''}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />

              <!-- SECTION 2: DAILY MASS READINGS (PERSONALIZED) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    ${renderMassReadingsSection(massReadings, userLanguage)}
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />

              <!-- SECTION 3: TODAY'S REFLECTION (PERSONALIZED) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    ${renderReflectionSection(reflection, userLanguage)}
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />

              <!-- SECTION 4: SAINT OF THE DAY (IMAGE & ABOUT THE SAINT) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 14px 0; font-size: 17px; font-weight: 700; color: #0F172A;">SAINT OF THE DAY / இன்றைய புனிதர்</h2>

                    <div style="background-color: #F8FAFC; border-radius: 12px; padding: 18px; border: 1px solid #E2E8F0; margin-bottom: 14px;">
                      <!-- Saint Image Attached -->
                      ${hasSaintImageAttachment ? `
                      <div style="text-align: center; margin-bottom: 16px;">
                        <img src="cid:saintOfTheDayImage" alt="${escapeHtml(saint.nameEnglish || saint.name || 'Saint of the Day')}" style="max-width: 100%; max-height: 380px; width: auto; border-radius: 10px; border: 2px solid #D4AF37; box-shadow: 0 4px 14px rgba(0,0,0,0.1); display: block; margin: 0 auto; object-fit: contain;" />
                      </div>
                      ` : ((saint.remoteUrl || saint.imageUrl || saint.image) ? `
                      <div style="text-align: center; margin-bottom: 16px;">
                        <img src="${escapeHtml(saint.remoteUrl || saint.imageUrl || saint.image)}" alt="${escapeHtml(saint.nameEnglish || saint.name || 'Saint of the Day')}" style="max-width: 100%; max-height: 380px; width: auto; border-radius: 10px; border: 2px solid #D4AF37; box-shadow: 0 4px 14px rgba(0,0,0,0.1); display: block; margin: 0 auto; object-fit: contain;" />
                      </div>
                      ` : '')}

                      <!-- Tamil Saint Details -->
                      <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed #CBD5E1;">
                        <div style="font-size: 12px; font-weight: 700; color: #C5A059; text-transform: uppercase; margin-bottom: 4px;">தமிழ் (Tamil)</div>
                        <h4 style="margin: 0 0 6px 0; font-size: 16px; color: #0F172A; font-weight: 700;">${escapeHtml(saint.nameTamil)}</h4>
                        ${saint.hasFeastInfo && saint.feastTitleTa ? `
                        <div style="font-size: 13px; font-weight: 600; color: #B45309; margin-bottom: 6px;">🎉 ${escapeHtml(saint.feastTypeTa ? `${saint.feastTypeTa}: ` : '')}${escapeHtml(saint.feastTitleTa)}</div>
                        ` : ''}
                        <div style="color: #334155; font-size: 14px; line-height: 1.6;">${formatParagraphs(saint.descriptionTamil)}</div>
                      </div>

                      <!-- English Saint Details -->
                      <div>
                        <div style="font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">English</div>
                        <h4 style="margin: 0 0 6px 0; font-size: 16px; color: #0F172A; font-weight: 700;">${escapeHtml(saint.nameEnglish)}</h4>
                        ${saint.hasFeastInfo && saint.feastTitle ? `
                        <div style="font-size: 13px; font-weight: 600; color: #B45309; margin-bottom: 6px;">🎉 ${escapeHtml(saint.feastType ? `${saint.feastType}: ` : '')}${escapeHtml(saint.feastTitle)}</div>
                        ` : ''}
                        <div style="color: #334155; font-size: 14px; line-height: 1.6;">${formatParagraphs(saint.descriptionEnglish)}</div>
                      </div>

                      ${(saint.otherSaints && saint.otherSaints.length > 0) ? `
                      <!-- Other Saints Commemorated -->
                      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #CBD5E1;">
                        <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 6px;">OTHER SAINTS COMMEMORATED TODAY / இன்று நினைவுகூரப்படும் பிற புனிதர்கள்</div>
                        <ul style="margin: 0; padding-left: 18px; color: #334155; font-size: 13.5px; line-height: 1.6;">
                          ${saint.otherSaints.map(os => `<li style="margin-bottom: 4px;"><strong>${escapeHtml(os.name || os.nameEn || os.title)}</strong>${os.description ? ` — ${escapeHtml(os.description.slice(0, 130))}${os.description.length > 130 ? '...' : ''}` : ''}</li>`).join('')}
                        </ul>
                      </div>
                      ` : ''}

                    </div>
                  </td>
                </tr>
              </table>

              <!-- SECTION 5: CALL TO ACTION BUTTON (READ ON SJDB) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0 16px 0;">
                <tr>
                  <td align="center">
                    <a href="${CLIENT_URL}/bible-verse" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%); color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(30,58,138,0.3); text-align: center; border: 1.5px solid #D4AF37; letter-spacing: 0.5px;">
                      Read on SJDB &rarr;
                    </a>
                    <div style="margin-top: 6px; font-size: 12px; color: #64748B; font-weight: 600;">
                      SJDB-ல் வாசிக்க
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0 20px 0;" />

              <!-- SECTION 6: HOLY SCRIPTURE (AT THE VERY END OF EMAIL BODY) -->
              <!-- DYNAMIC_BIBLE_VERSE -->
              <!-- DYNAMIC BILINGUAL BIBLE VERSE CARD -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 18px auto 8px auto; width: 100% !important; max-width: 100% !important; min-width: 100% !important; table-layout: fixed !important; border-collapse: separate !important; box-sizing: border-box !important;">
                <tr>
                  <td style="background: linear-gradient(135deg, #fffdf7 0%, #fef3c7 100%); border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 12px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.08); font-family: 'Segoe UI', Roboto, 'Noto Sans Tamil', 'Latha', 'Vijaya', Arial Unicode MS, Arial, sans-serif; text-align: left; box-sizing: border-box !important; width: 100% !important; max-width: 100% !important; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto;">
                    <div style="font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 8px 0; line-height: 1.4; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important;">
                      HOLY SCRIPTURE • Daily Scripture • Prayer
                    </div>

                    <!-- English Verse -->
                    <p style="margin: 0 0 8px 0; font-size: 13.5px; font-style: italic; color: #1e293b; line-height: 1.6; font-family: 'Segoe UI', Roboto, Georgia, serif; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto; max-width: 100%;">
                      "${escapeHtml(bible.english)}"
                    </p>

                    <!-- Tamil Verse -->
                    <p style="margin: 0 0 10px 0; font-size: 13px; color: #78350f; line-height: 1.6; font-family: 'Noto Sans Tamil', 'Latha', 'Vijaya', 'Segoe UI', Roboto, Arial Unicode MS, sans-serif; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto; max-width: 100%;">
                      "${escapeHtml(bible.tamil)}"
                    </p>

                    <div style="font-size: 12px; font-weight: 800; color: #b45309; text-align: right; line-height: 1.4; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important;">
                      — ${escapeHtml(refEn)}${refTa && refTa !== refEn ? ` • ${escapeHtml(refTa)}` : ''}
                    </div>

                    <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #fcd34d; font-size: 11.5px; color: #92400e; text-align: right; word-wrap: break-word !important; overflow-wrap: anywhere !important; word-break: break-word !important;">
                      Source: <a href="https://www.vatican.va/archive/bible/index.htm" target="_blank" style="color: #b45309; text-decoration: none; font-weight: 600;">Biblia Sacra / Catholic Holy Bible (NRSV-CE / திருவிவிலியம்)</a>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 28px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; color: #64748B; font-size: 13px; line-height: 1.5;">
              <p style="margin: 0 0 8px 0; color: #0F172A; font-weight: 600; font-size: 14px;">May God bless you and have a blessed day.</p>
              <p style="margin: 0 0 6px 0;">St. John de Britto Church • "Come; Listen; and you will find life"</p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">You received this daily reflection because you are a registered member of SJDB Church. To update notification settings, visit your Profile Settings on the church portal.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

module.exports = {
  generateDailyNotificationHtml
};
