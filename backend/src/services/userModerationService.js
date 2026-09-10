const mongoose = require('mongoose');
/**
 * Centralized User Moderation & Abuse Control Service
 * 
 * Enforces phone-number-based identity, progressive 3-strike abuse policy,
 * multilingual text normalization, and cross-system website account deactivation.
 */

const UserModeration = require('../models/UserModeration');
const BlockedWord = require('../models/BlockedWord');
const User = require('../models/User');
const { BAD_WORDS_LIST } = require('../bot/moderation');

const VIOLATION_WINDOW_HOURS = 24; // 3 strikes within 24 hours triggers automatic block

/**
 * Clean phone number to digits only (e.g. "+91 98765-43210" -> "919876543210")
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits;
}

/**
 * Normalize text to defeat obfuscation (leetspeak, spaced characters, punctuation, accents)
 * e.g. "b a d w 0 r d" -> "badword", "f@ck" -> "fack", "s-h-i-t" -> "shit"
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return { rawLower: '', normalized: '', collapsed: '' };
  let normalized = text.toLowerCase();

  // Strip diacritics / accents
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Leetspeak mapping
  const leetMap = {
    '@': 'a',
    '4': 'a',
    '$': 's',
    '5': 's',
    '0': 'o',
    '1': 'i',
    '!': 'i',
    '|': 'i',
    '3': 'e',
    '7': 't',
    '8': 'b',
    '+': 't'
  };

  for (const [char, replacement] of Object.entries(leetMap)) {
    normalized = normalized.split(char).join(replacement);
  }

  // Remove intervening punctuation and whitespace to catch spaced letters (e.g. "b a d")
  const collapsed = normalized.replace(/[\s\-_.,*#^~/\\|]+/g, '');

  return { rawLower: text.toLowerCase(), normalized, collapsed };
}

/**
 * Seed initial blocked words dataset into MongoDB if empty
 */
async function ensureBlockedWordsSeeded() {
  try {
    const count = await BlockedWord.countDocuments();
    if (count === 0) {
      console.log('[Moderation] Seeding initial BlockedWords dictionary...');
      const docs = BAD_WORDS_LIST.map(word => ({
        word: word.toLowerCase().trim(),
        language: /[\u0B80-\u0BFF]/.test(word) ? 'ta' : 'universal',
        category: 'profanity',
        severity: (word.includes('rape') || word.includes('kill') || word.includes('murder')) ? 3 : 2,
        isActive: true
      }));
      await BlockedWord.insertMany(docs, { ordered: false });
    }
  } catch (e) {
    // Ignore duplicate key collision on startup
  }
}

// In-memory cache of active blocked words for high-throughput scanning
let cachedBlockedWords = null;
let lastCacheUpdate = 0;

async function getActiveBlockedWords() {
  const now = Date.now();
  if (cachedBlockedWords && (now - lastCacheUpdate) < 5 * 60 * 1000) {
    return cachedBlockedWords;
  }

  await ensureBlockedWordsSeeded();
  const dbWords = await BlockedWord.find({ isActive: true }).lean();
  cachedBlockedWords = dbWords;
  lastCacheUpdate = now;
  return cachedBlockedWords;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect inappropriate or abusive words in message
 */
async function detectViolations(text) {
  if (!text || typeof text !== 'string') {
    return { isViolation: false, detectedWords: [], highestSeverity: 0 };
  }

  const { rawLower, normalized, collapsed } = normalizeText(text);
  const wordsList = await getActiveBlockedWords();

  const detectedSet = new Set();
  let highestSeverity = 0;

  for (const item of wordsList) {
    const word = item.word.toLowerCase();
    const severity = item.severity || 2;

    // 1. Check exact word boundary in raw/normalized text
    const escaped = escapeRegex(word);
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');

    if (regex.test(rawLower) || regex.test(normalized)) {
      detectedSet.add(word);
      if (severity > highestSeverity) highestSeverity = severity;
      continue;
    }

    // 2. Check collapsed text for obfuscated spaced variations (only for words with length >= 4)
    if (word.length >= 4 && collapsed.includes(word.replace(/\s+/g, ''))) {
      detectedSet.add(word);
      if (severity > highestSeverity) highestSeverity = severity;
    }
  }

  const detectedWords = Array.from(detectedSet);
  return {
    isViolation: detectedWords.length > 0,
    detectedWords,
    highestSeverity: highestSeverity || (detectedWords.length > 0 ? 2 : 0)
  };
}

/**
 * Look up associated website user account by phone number
 */
async function findLinkedUserByPhone(phone) {
  const clean = cleanPhoneNumber(phone);
  if (!clean) return null;
  const last10 = clean.slice(-10);

  return User.findOne({
    phone: new RegExp(last10 + '$')
  });
}

/**
 * Deactivate linked website account when user is blocked
 */
async function deactivateWebsiteAccount(user, reason) {
  if (!user) return;
  try {
    user.isActive = false;
    user.deactivatedReason = reason || 'WhatsApp abuse';
    user.deactivatedAt = new Date();
    // Invalidate active JWT sessions immediately
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    user.authVersion = (user.authVersion || 1) + 1;
    await user.save();
    console.log(`[Moderation] Linked website account (${user.name} / ${user.phone}) deactivated due to: ${reason}`);
  } catch (err) {
    console.error('[Moderation] Failed to deactivate website account:', err.message);
  }
}

/**
 * Reactivate linked website account when user is unblocked by admin
 */
async function reactivateWebsiteAccount(user) {
  if (!user) return;
  try {
    user.isActive = true;
    user.deactivatedReason = null;
    user.deactivatedAt = null;
    await user.save();
    console.log(`[Moderation] Linked website account (${user.name} / ${user.phone}) restored by admin.`);
  } catch (err) {
    console.error('[Moderation] Failed to reactivate website account:', err.message);
  }
}

/**
 * Process an incoming WhatsApp message through centralized moderation
 * 
 * Rules:
 * - 1st bad message -> Warning
 * - 2nd bad message -> Strong warning
 * - 3rd bad message within 24h -> Automatic Block
 * - Severity 3 (threat/extreme) -> Immediate Block
 * - Blocked users -> Disallowed from executing commands or registering on website
 */
async function processIncomingMessage({ phoneNumber, displayName = '', messageText = '', messageId = null }) {
  const cleanPhone = cleanPhoneNumber(phoneNumber);
  if (!cleanPhone) {
    return { isBlocked: false, isViolation: false };
  }

  // 1. Retrieve or initialize UserModeration record
  let modRecord = await UserModeration.findOne({ phoneNumber: cleanPhone });
  const linkedUser = await findLinkedUserByPhone(cleanPhone);

  if (!modRecord) {
    modRecord = new UserModeration({
      phoneNumber: cleanPhone,
      userId: linkedUser ? linkedUser._id : null,
      whatsappDisplayName: displayName || (linkedUser ? linkedUser.name : ''),
      status: 'active',
      violationCount: 0
    });
  } else if (!modRecord.userId && linkedUser) {
    modRecord.userId = linkedUser._id;
  }

  if (displayName && !modRecord.whatsappDisplayName) {
    modRecord.whatsappDisplayName = displayName;
  }

  // 2. If user is ALREADY BLOCKED, reject immediately
  if (modRecord.status === 'blocked') {
    return {
      isBlocked: true,
      isViolation: false,
      replyMessage: `🚫 *SJDB Connect — Account Restricted*

Your interactive access to SJDB Connect is currently restricted due to previous policy violations.

📖 *Note:* You will continue to receive all daily Catholic Mass readings, Saint of the Day, Bible verses, and parish announcements.
• To restore interactive bot messaging, please contact the church administrator.`
    };
  }

  // 3. Scan message for violations
  const { isViolation, detectedWords, highestSeverity } = await detectViolations(messageText);

  if (!isViolation) {
    return { isBlocked: false, isViolation: false };
  }

  // 4. Violation Detected — Calculate 24-hour window
  const now = new Date();
  const windowMs = VIOLATION_WINDOW_HOURS * 60 * 60 * 1000;

  if (modRecord.lastViolationAt && (now.getTime() - new Date(modRecord.lastViolationAt).getTime()) > windowMs) {
    console.log(`[Moderation] Violation window expired for ${cleanPhone} (> ${VIOLATION_WINDOW_HOURS}h). Resetting strike count to 0.`);
    modRecord.violationCount = 0;
  }

  modRecord.violationCount += 1;
  modRecord.lastViolationAt = now;

  let warningMessage = '';
  let shouldBlock = false;

  // Rule: Severity 3 (threat/extreme) OR 3rd violation within 24h triggers automatic block
  const wordsListStr = detectedWords.map(w => `\`${w}\``).join(', ');

  if (highestSeverity === 3 || modRecord.violationCount >= 3) {
    shouldBlock = true;
    modRecord.status = 'blocked';
    modRecord.blockedAt = now;
    modRecord.blockedReason = highestSeverity === 3
      ? 'Severe abusive or threatening content'
      : `Repeated abusive messages (${modRecord.violationCount} violations in ${VIOLATION_WINDOW_HOURS}h)`;

    warningMessage = `🚫 *Access Restricted: Terms of Use Violation*

Your message contained prohibited language:
🚨 *Detected words:* ${wordsListStr}

• *Violation Status:* Strike ${modRecord.violationCount} of 3 (BLOCKED)
• *Action Taken:* Interactive bot commands have been suspended.
• *Parish Notifications:* You will continue to receive all daily Catholic Mass readings, Saint of the Day, Bible verses, and church announcements.
• *Appeal:* If you believe this restriction was made in error, please contact the parish office to request reinstatement.`;

    // Cross-system enforcement: deactivate website account
    if (linkedUser) {
      await deactivateWebsiteAccount(linkedUser, modRecord.blockedReason);
    }
  } else if (modRecord.violationCount === 2) {
    modRecord.status = 'warning';
    warningMessage = `⚠️ *Final Warning: Inappropriate Language Detected*

Your message contained prohibited language:
🚨 *Detected words:* ${wordsListStr}

• *Violation Status:* Strike 2 of 3 (FINAL NOTICE)
• *Policy:* SJDB Connect is a parish platform. Continued abusive language within 24 hours will automatically restrict your account.`;
  } else {
    modRecord.status = 'warning';
    warningMessage = `⚠️ *Warning: Inappropriate Language Detected*

Your message contained prohibited language:
🚨 *Detected words:* ${wordsListStr}

• *Violation Status:* Strike 1 of 3
• *Policy:* Please use respectful language when communicating with SJDB Connect. Continued abusive messages within 24 hours will result in restricted access.`;
  }

  // Record incident in audit trail
  modRecord.violations.push({
    messageId,
    messageText,
    matchedWords: detectedWords,
    severity: highestSeverity,
    warningSent: warningMessage,
    timestamp: now
  });

await modRecord.save();
  console.warn(`[Moderation] Violation registered for ${cleanPhone} (Strike ${modRecord.violationCount}): Status=${modRecord.status}`);

  // Dispatch Email Notification to Administrator with full incident and user details
  try {
    const { notifyAdmin } = require('./adminNotificationService');
    notifyAdmin({
      type: 'WHATSAPP_ABUSE_ALERT',
      user: linkedUser,
      extra: {
        phoneNumber: cleanPhone,
        displayName: displayName || (linkedUser ? linkedUser.name : 'WhatsApp User'),
        messageText,
        detectedWords,
        highestSeverity,
        strikeCount: modRecord.violationCount,
        totalViolations: modRecord.violations.length,
        status: modRecord.status,
        isBlocked: shouldBlock,
        warningMessage,
        blockedReason: modRecord.blockedReason,
        previousViolations: modRecord.violations.slice(0, -1),
        linkedUser: linkedUser ? {
          _id: linkedUser._id,
          name: linkedUser.name,
          parishMemberId: linkedUser.parishMemberId,
          familyId: linkedUser.familyId,
          email: linkedUser.email,
          phone: linkedUser.phone,
          isActive: linkedUser.isActive,
          deactivatedReason: linkedUser.deactivatedReason,
          anbiyam: linkedUser.anbiyam || linkedUser.subStation,
          createdAt: linkedUser.createdAt
        } : null
      }
    }).catch(err => console.error('[Moderation] Failed to send abuse alert email to admin:', err.message));
  } catch (notifErr) {
    console.error('[Moderation] Error invoking admin abuse notification:', notifErr.message);
  }

  return {
    isBlocked: shouldBlock,
    isViolation: true,
    replyMessage: warningMessage,
    violationCount: modRecord.violationCount,
    status: modRecord.status
  };
}

/**
 * Check if a phone number is currently blocked
 */
async function isPhoneBlocked(phone) {
  if (!phone) return false;
  const clean = cleanPhoneNumber(phone);
  if (!clean) return false;

  const last10 = clean.slice(-10);

  const blockedRecord = await UserModeration.findOne({
    $or: [
      { phoneNumber: clean, status: 'blocked' },
      { phoneNumber: new RegExp(last10 + '$'), status: 'blocked' }
    ]
  }).lean();

  return Boolean(blockedRecord);
}

/**
 * Unblock user and restore access (WhatsApp + Website)
 */
async function unblockUser(phoneNumber, adminUserId = null) {
  const clean = cleanPhoneNumber(phoneNumber);
  if (!clean) return null;

  const record = await UserModeration.findOne({
    $or: [
      { phoneNumber: clean },
      { phoneNumber: new RegExp(clean.slice(-10) + '$') }
    ]
  });

  if (!record) return null;

  record.status = 'active';
  record.violationCount = 0;
  record.unblockedAt = new Date();
  record.unblockedBy = (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) ? adminUserId : null;
  await record.save();

  // Restore linked website account if exists
  const linkedUser = await findLinkedUserByPhone(clean);
  if (linkedUser) {
    await reactivateWebsiteAccount(linkedUser);
  }

  console.log(`[Moderation] User ${clean} successfully unblocked by admin (${adminUserId || 'system'}).`);
  return record;
}

/**
 * Manually block a user (Admin Action)
 */
async function blockUserManually(phoneNumber, reason = 'Manually blocked by administrator', adminUserId = null) {
  const clean = cleanPhoneNumber(phoneNumber);
  if (!clean) return null;

  let record = await UserModeration.findOne({
    $or: [
      { phoneNumber: clean },
      { phoneNumber: new RegExp(clean.slice(-10) + '$') }
    ]
  });

  const linkedUser = await findLinkedUserByPhone(clean);

  if (!record) {
    record = new UserModeration({
      phoneNumber: clean,
      userId: linkedUser ? linkedUser._id : null,
      whatsappDisplayName: linkedUser ? linkedUser.name : ''
    });
  }

  record.status = 'blocked';
  record.blockedAt = new Date();
  record.blockedReason = reason;
  record.unblockedAt = null;
  record.unblockedBy = null;
  record.violationCount = Math.max(3, record.violationCount + 1);
  await record.save();

  if (linkedUser) {
    await deactivateWebsiteAccount(linkedUser, reason);
  }

  // Send manual block notification to user on WhatsApp & Email so they are informed they still get notifications
  try {
    const wa = require('../bot/whatsapp');
    const manualBlockMsg = `🚫 *SJDB Connect — Administrative Notice*

Your interactive messaging access has been restricted by the administrator.
• *Reason:* ${reason}
• *Parish Notifications:* You will continue to receive all daily Catholic Mass readings, Saint of the Day, Bible verses, and church announcements.
• If you wish to appeal this decision, please contact the church office.`;
    await wa.sendWhatsAppMessage(clean, manualBlockMsg);
  } catch (waErr) {
    console.warn('[Moderation] Could not send manual block WhatsApp notice:', waErr.message);
  }

  if (linkedUser && linkedUser.email) {
    try {
      const { sendMail } = require('../config/mailer');
      await sendMail({
        to: linkedUser.email,
        subject: '🚫 Notice: SJDB Connect Interactive Access Restricted',
        html: `<div style="font-family:sans-serif; padding:20px; color:#1e293b;">
          <h2 style="color:#b91c1c;">SJDB Connect — Account Notice</h2>
          <p>Your interactive access to the SJDB Connect WhatsApp bot has been restricted by the administrator.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <div style="background:#f1f5f9; padding:12px; border-radius:8px; margin:16px 0;">
            <p style="margin:0; font-weight:bold; color:#1e3a8a;">Spiritual Content Delivery Continues:</p>
            <p style="margin:4px 0 0; font-size:13px; color:#475569;">You will continue to receive daily Mass readings, Saint of the Day, and church announcements.</p>
          </div>
          <p style="font-size:12px; color:#64748b;">If you believe this was in error, please contact the church office.</p>
        </div>`
      });
    } catch (mailErr) {
      console.warn('[Moderation] Could not send manual block email notice:', mailErr.message);
    }
  }

  console.log(`[Moderation] User ${clean} manually blocked by admin (${adminUserId || 'system'}).`);
  return record;
}

module.exports = {
  cleanPhoneNumber,
  normalizeText,
  detectViolations,
  processIncomingMessage,
  isPhoneBlocked,
  unblockUser,
  blockUserManually,
  getActiveBlockedWords
};
