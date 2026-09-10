const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: parseInt(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000
});

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((err) => {
    if (err) {
      console.error(' SMTP FAILED:', err.message);
    } else {
      console.log(' SMTP connected — email is ready');
    }
  });
} else {
  console.warn(' SMTP not configured — emails will be skipped');
}

const path = require('path');
const fs = require('fs');
const { injectFreshBibleVerseIntoHtml } = require('../services/emailVerseService');

const stripHtml = (html) => {
  return html
    .replace(/<style([\s\S]*?)<\/style>/gi, '')
    .replace(/<script([\s\S]*?)<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const sendMail = async ({ to, subject, html, attachments = [] }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(` Email skipped: ${subject} → ${to}`);
    return { success: false, error: 'SMTP not configured' };
  }
  try {
    const fromEmail = process.env.SMTP_FROM || 'arndas777@gmail.com';
    const emailAttachments = [...attachments];

    // Automatically inject a fresh, dynamic bilingual Bible verse into all outgoing emails
    let processedHtml = html;
    try {
      processedHtml = await injectFreshBibleVerseIntoHtml(html);
    } catch (vErr) {
      console.warn('[Mailer] Verse injection error (using original html):', vErr.message);
    }

    // Automatically attach sjdb_image.png as inline CID if referenced in html or if not present
    const defaultLogoPath = path.join(__dirname, '..', 'assets', 'sjdb_image.png');
    if (fs.existsSync(defaultLogoPath)) {
      const hasLogoCid = emailAttachments.some(a => a.cid === 'sjdb_church_logo' || a.cid === 'church_logo');
      if (!hasLogoCid && (processedHtml?.includes('cid:sjdb_church_logo') || processedHtml?.includes('cid:church_logo'))) {
        emailAttachments.push({
          filename: 'sjdb_image.png',
          path: defaultLogoPath,
          cid: 'sjdb_church_logo'
        });
      }
    }

    const info = await transporter.sendMail({
      from: `"St. John de Britto's Church" <${fromEmail}>`,
      to,
      subject,
      html: processedHtml,
      text: stripHtml(processedHtml), // Plain-text fallback for higher inbox delivery (bypasses Promotions filters)
      attachments: emailAttachments,
    });
    console.log(` Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(` Email error to ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
};

module.exports = { transporter, sendMail };