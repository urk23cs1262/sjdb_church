/**
 * Centralized Contact & Security Configuration
 * 
 * Manages all church email addresses, administrator contacts, telephone numbers,
 * and WhatsApp credentials across the backend.
 * 
 * Strict rule: No emails or phone numbers should be hardcoded in application logic.
 */

const SiteSettings = require('../models/SiteSettings');

// Default fallback values if not configured in environment
const DEFAULT_CONFIG = {
  churchEmail: '',
  adminEmail: '',
  emailFrom: '',
  emailReplyTo: '',
  churchPhone: '',
  parishOfficePhone: '',
  whatsappBotNumber: '',
  whatsappAdminNumber: '',
  whatsappChannelUrl: '',
  whatsappChannelJid: ''
};

/**
 * Normalizes a phone number to standard 10 or 12 digits
 */
function cleanDigits(phone) {
  if (!phone) return '';
  let str = String(phone).replace(/\D/g, '');
  while (str.startsWith('0')) str = str.slice(1);
  return str;
}

/**
 * Normalizes email address
 */
function cleanEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Retrieves the live contact configuration from process.env with fallbacks
 */
function getContactConfig() {
  const churchEmail = cleanEmail(
    process.env.CHURCH_EMAIL ||
    process.env.PARISH_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.SMTP_FROM ||
    DEFAULT_CONFIG.churchEmail
  );

  const adminEmail = cleanEmail(
    process.env.ADMIN_EMAIL ||
    process.env.CHURCH_EMAIL ||
    process.env.SMTP_FROM ||
    DEFAULT_CONFIG.adminEmail
  );

  const emailFrom = cleanEmail(
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.CHURCH_EMAIL ||
    DEFAULT_CONFIG.emailFrom
  );

  const emailReplyTo = cleanEmail(
    process.env.EMAIL_REPLY_TO ||
    process.env.CHURCH_EMAIL ||
    process.env.ADMIN_EMAIL ||
    DEFAULT_CONFIG.emailReplyTo
  );

  const churchPhone = (
    process.env.CHURCH_PHONE ||
    process.env.ADMIN_PHONE ||
    DEFAULT_CONFIG.churchPhone
  ).trim();

  const parishOfficePhone = (
    process.env.PARISH_OFFICE_PHONE ||
    DEFAULT_CONFIG.parishOfficePhone
  ).trim();

  const whatsappBotNumber = cleanDigits(
    process.env.WHATSAPP_BOT_PHONE_NUMBER ||
    process.env.ADMIN_WHATSAPP_PHONE ||
    DEFAULT_CONFIG.whatsappBotNumber
  );

  const whatsappAdminNumber = cleanDigits(
    process.env.WHATSAPP_ADMIN_NUMBER ||
    process.env.ADMIN_PHONE ||
    process.env.WHATSAPP_BOT_PHONE_NUMBER ||
    DEFAULT_CONFIG.whatsappAdminNumber
  );

  const whatsappChannelUrl = (process.env.WHATSAPP_CHANNEL_URL || '').trim();
  const whatsappChannelJid = (process.env.WHATSAPP_CHANNEL_JID || '').trim();

  return {
    churchEmail,
    adminEmail,
    emailFrom,
    emailReplyTo,
    churchPhone,
    parishOfficePhone,
    whatsappBotNumber,
    whatsappAdminNumber,
    whatsappChannelUrl,
    whatsappChannelJid
  };
}

/**
 * Get authorized administrator phone numbers (e.g. for access control / moderation exemptions)
 */
function getAdminPhones() {
  const set = new Set();
  const envList = [
    process.env.ADMIN_PHONE,
    process.env.ADMIN_PHONES,
    process.env.WHATSAPP_ADMIN_NUMBER,
    process.env.ADMIN_WHATSAPP_PHONE,
    process.env.WHATSAPP_BOT_PHONE_NUMBER
  ];

  envList.forEach(item => {
    if (!item) return;
    String(item).split(',').forEach(p => {
      const d = cleanDigits(p);
      if (d) {
        set.add(d);
        if (d.length === 10) set.add('91' + d);
        if (d.startsWith('91') && d.length === 12) set.add(d.slice(2));
      }
    });
  });

  // Include primary church bot/admin phone if nothing specified
  if (set.size === 0) {
    const fallback = cleanDigits(DEFAULT_CONFIG.whatsappBotNumber);
    set.add(fallback);
    if (fallback.startsWith('91')) set.add(fallback.slice(2));
  }

  return Array.from(set);
}

/**
 * Check if a given phone number belongs to a configured church administrator
 */
function isAdminPhone(phone) {
  if (!phone) return false;
  const digits = cleanDigits(phone);
  if (!digits) return false;
  const adminPhones = getAdminPhones();
  return adminPhones.some(p => digits.endsWith(p) || p.endsWith(digits));
}

/**
 * Get authorized administrator email addresses
 */
function getAdminEmails() {
  const set = new Set();
  const envList = [
    process.env.ADMIN_EMAIL,
    process.env.ADMIN_EMAILS,
    process.env.CHURCH_EMAIL,
    process.env.PARISH_EMAIL,
    process.env.SMTP_FROM
  ];

  envList.forEach(item => {
    if (!item) return;
    String(item).split(',').forEach(e => {
      const cleaned = cleanEmail(e);
      if (cleaned) set.add(cleaned);
    });
  });

  return Array.from(set);
}

/**
 * Check if a given email belongs to a configured church administrator
 */
function isAdminEmail(email) {
  if (!email) return false;
  const cleaned = cleanEmail(email);
  if (!cleaned) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.includes(cleaned);
}

/**
 * Startup validation of environment configuration
 */
function validateContactConfig() {
  const config = getContactConfig();
  const issues = [];

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CHURCH_EMAIL && !process.env.ADMIN_EMAIL && !process.env.SMTP_FROM) {
      issues.push('Missing CHURCH_EMAIL or ADMIN_EMAIL in environment variables.');
    }
    if (!process.env.WHATSAPP_BOT_PHONE_NUMBER && !process.env.ADMIN_PHONE) {
      issues.push('Missing WHATSAPP_BOT_PHONE_NUMBER or ADMIN_PHONE in environment variables.');
    }
  }

  if (issues.length > 0) {
    console.warn('\n⚠️ [ContactConfig] Security & Environment Notice:');
    issues.forEach(issue => console.warn(`   • ${issue}`));
    console.warn('   Ensure these variables are configured in Render/production dashboard.\n');
  } else {
    console.log('✅ [ContactConfig] Contact security configuration verified.');
  }

  return { isValid: issues.length === 0, issues, config };
}

module.exports = {
  getContactConfig,
  getChurchEmail: () => getContactConfig().churchEmail,
  getAdminEmail: () => getContactConfig().adminEmail,
  getEmailFrom: () => getContactConfig().emailFrom,
  getEmailReplyTo: () => getContactConfig().emailReplyTo,
  getChurchPhone: () => getContactConfig().churchPhone,
  getParishOfficePhone: () => getContactConfig().parishOfficePhone,
  getWhatsAppBotNumber: () => getContactConfig().whatsappBotNumber,
  getWhatsAppAdminNumber: () => getContactConfig().whatsappAdminNumber,
  getWhatsAppChannelUrl: () => getContactConfig().whatsappChannelUrl,
  getWhatsAppChannelJid: () => getContactConfig().whatsappChannelJid,
  getAdminPhones,
  isAdminPhone,
  getAdminEmails,
  isAdminEmail,
  cleanDigits,
  cleanEmail,
  validateContactConfig
};
