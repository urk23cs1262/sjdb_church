const { getSiteUrl } = require('../config/siteRoutes');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateBirthdayEmailHtml({ user, language = 'ta' }) {
  const userName = escapeHtml(user?.name || 'Beloved Parishioner');
  const clientUrl = getSiteUrl('/dashboard');
  const isTamil = language === 'ta';
  const isBoth = language === 'both';

  const subject = isTamil
    ? `🎂 இனிய பிறந்தநாள் நல்வாழ்த்துகள், ${userName}! — St. John de Britto Church`
    : `🎂 Happy Birthday, ${userName}! — St. John de Britto Church`;

  const html = `
<!DOCTYPE html>
<html lang="${isTamil ? 'ta' : 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- CELEBRATION HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 40px 25px 35px; text-align: center;">
              <div style="width: 82px; height: 82px; margin: 0 auto 16px; border-radius: 50%; overflow: hidden; border: 3px solid #fbbf24; background: #ffffff; box-shadow: 0 6px 18px rgba(0,0,0,0.25);">
                <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
              </div>
              <div style="display: inline-block; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.4); padding: 5px 16px; border-radius: 999px; margin-bottom: 12px;">
                <span style="color: #fbbf24; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                  🎉 ${isTamil ? 'பிறந்தநாள் நல்வாழ்த்துகள்' : 'Birthday Blessings'}
                </span>
              </div>
              <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 26px; font-weight: 800; letter-spacing: 0.3px;">
                ${isTamil ? 'இனிய பிறந்தநாள் வாழ்த்துகள்!' : 'Happy Birthday!'}
              </h1>
              <p style="color: #93c5fd; margin: 0; font-size: 15px; font-weight: 500;">
                St. John de Britto Church, Kalayarkoil • SJDB Connect
              </p>
            </td>
          </tr>

          <!-- BLESSING CARD -->
          <tr>
            <td style="padding: 35px 30px 25px;">
              <h2 style="color: #1e3a8a; margin: 0 0 16px; font-size: 22px; font-weight: 700;">
                ${isTamil ? `அன்பார்ந்த ${userName},` : `Dear ${userName},`}
              </h2>

              <div style="background: linear-gradient(to right, #eff6ff, #f8fafc); border-left: 5px solid #fbbf24; border-radius: 12px; padding: 22px 20px; margin-bottom: 24px;">
                ${isTamil || isBoth ? `
                  <p style="margin: 0 0 12px; color: #1e293b; font-size: 15.5px; line-height: 1.75;">
                    இந்த இனிய பிறந்தநாளில் இறைவன் உங்களை நிறைவாக ஆசீர்வதித்து, உங்கள் வாழ்வில் <strong>அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளை</strong> நிறைக்க வேண்டுகிறோம்.
                  </p>
                  <p style="margin: 0; color: #1e293b; font-size: 15.5px; line-height: 1.75;">
                    புனித ஜான் டி பிரிட்டோ உங்களுக்காக பரிந்து பேசவும், ஆண்டவர் இந்த புதிய ஆண்டில் உங்களை வழிநடத்தவும் வாழ்த்துகிறோம்.
                  </p>
                ` : ''}

                ${!isTamil || isBoth ? `
                  <div style="${isBoth ? 'margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;' : ''}">
                    <p style="margin: 0 0 10px; color: #1e293b; font-size: 15.5px; line-height: 1.75;">
                      May God bless you abundantly on your special day and fill your life with <strong>peace, joy, good health, and grace</strong>.
                    </p>
                    <p style="margin: 0; color: #1e293b; font-size: 15.5px; line-height: 1.75;">
                      May St. John de Britto pray for you and may the Lord guide you throughout the coming year.
                    </p>
                  </div>
                ` : ''}
              </div>

              <!-- SCRIPTURE PROMISE -->
              <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 14px; padding: 20px; margin-bottom: 28px; text-align: center;">
                <div style="color: #ca8a04; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                  📖 Scripture Blessing • இறைவார்த்தை ஆசி
                </div>
                <p style="color: #713f12; font-size: 15px; font-style: italic; line-height: 1.6; margin: 0 0 8px;">
                  "May the Lord bless you and keep you; May the Lord make His face shine upon you and be gracious to you."
                </p>
                ${isTamil || isBoth ? `
                  <p style="color: #854d0e; font-size: 14.5px; font-style: italic; line-height: 1.6; margin: 0 0 6px;">
                    "ஆண்டவர் உனக்கு ஆசி வழங்கி, உன்னைக் காப்பாராக! ஆண்டவர் தம் திருமுகத்தை உன்மீது ஒளிரச்செய்து, உன்மீது கருணைகாட்டுவாராக!"
                  </p>
                ` : ''}
                <div style="color: #a16207; font-size: 13px; font-weight: 700;">
                  — Numbers / எண்ணாகமம் 6:24-25
                </div>
              </div>

              <!-- CALL TO ACTION -->
              <div style="text-align: center; margin: 25px 0 10px;">
                <a href="${clientUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                  ${isTamil ? 'இறை அருளைப் பெறுக (Visit Parish Portal) →' : 'Visit Parish Portal →'}
                </a>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 25px; text-align: center; color: #94a3b8; font-size: 13px;">
              <p style="margin: 0 0 6px; color: #f1f5f9; font-weight: 600;">
                St. John de Britto Church, Kalayarkoil
              </p>
              <p style="margin: 0 0 14px; font-size: 12.5px;">
                புனித அருளானந்தர் திருத்தலம், காளையார்கோவில் • Sivagangai Diocese, Tamil Nadu - 630551
              </p>
              <div style="width: 60px; height: 1px; background: rgba(255,255,255,0.15); margin: 14px auto;"></div>
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                SJDB Connect Automated Birthday Service • Sent with prayerful love
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
}

module.exports = {
  generateBirthdayEmailHtml
};
