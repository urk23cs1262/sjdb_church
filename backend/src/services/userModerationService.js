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

const DEFAULT_BLOCKED_WORDS = (BAD_WORDS_LIST || []).map(word => ({
  word: word.toLowerCase().trim(),
  language: /[\u0B80-\u0BFF]/.test(word) ? 'ta' : 'universal',
  category: 'profanity',
  severity: (word.includes('rape') || word.includes('kill') || word.includes('murder')) ? 3 : 2,
  isActive: true
}));

// In-memory cache of active blocked words for high-throughput scanning
let cachedBlockedWords = null;
let lastCacheUpdate = 0;

async function getActiveBlockedWords() {
  const now = Date.now();
  if (cachedBlockedWords && (now - lastCacheUpdate) < 5 * 60 * 1000) {
    return cachedBlockedWords;
  }

  try {
    const dbWords = await BlockedWord.find({ isActive: true }).lean().maxTimeMS(2500);
    if (dbWords && dbWords.length > 0) {
      const map = new Map();
      for (const w of DEFAULT_BLOCKED_WORDS) map.set(w.word, w);
      for (const w of dbWords) map.set(w.word.toLowerCase().trim(), w);
      cachedBlockedWords = Array.from(map.values());
    } else {
      cachedBlockedWords = DEFAULT_BLOCKED_WORDS;
      ensureBlockedWordsSeeded().catch(() => {});
    }
  } catch (err) {
    console.warn('[Moderation] Fallback to in-memory BAD_WORDS_LIST:', err.message);
    cachedBlockedWords = DEFAULT_BLOCKED_WORDS;
  }

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
 * Deactivate linked website account when user is blocked and notify them
 */
async function deactivateWebsiteAccount(user, reason, detectedWords = []) {
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

    // 1. User In-App Notification
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: user._id,
        recipient: 'user',
        type: 'security',
        category: 'security',
        priority: 'critical',
        title: '🚫 Account Deactivated & Restricted',
        message: `Your SJDB Connect account has been deactivated due to prohibited language on WhatsApp. To appeal or restore your access, please contact the parish office at +91 9655639144 or arndas777@gmail.com.`,
        actionUrl: '/contact'
      });
    } catch (notifErr) {
      console.warn('[Moderation] Could not create user in-app notification:', notifErr.message);
    }

    // 2. User Deactivation Email with Parish Administrator Contact Details
    if (user.email) {
      try {
        const { sendMail } = require('../config/mailer');
        const wordsStr = Array.isArray(detectedWords) && detectedWords.length > 0
          ? detectedWords.map(w => `<code style="background:#fee2e2; padding:2px 6px; border-radius:4px; color:#b91c1c;">${w}</code>`).join(' ')
          : 'Prohibited / abusive content';

        await sendMail({
          to: user.email,
          subject: '🚫 Notice: Your SJDB Connect Account has been Deactivated and Blocked',
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #b91c1c, #dc2626); padding: 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: bold;">🚫 SJDB Connect — Account Deactivated & Blocked</h1>
              <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.95;">St. John de Britto Church, Kalayarkoil</p>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.6;">
              <p>Dear <strong>${user.name || 'Parishioner'}</strong>,</p>
              <p>Your SJDB Connect account and interactive WhatsApp bot access have been <strong>automatically deactivated and blocked</strong> due to repeated community policy violations (use of prohibited or abusive language).</p>
              
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px; margin: 18px 0;">
                <p style="margin: 0 0 6px; font-weight: bold; color: #991b1b; font-size: 14px;">Policy Violation Details:</p>
                <p style="margin: 0; font-size: 13px; color: #7f1d1d;"><strong>Reason:</strong> ${reason}</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #7f1d1d;"><strong>Detected words:</strong> ${wordsStr}</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #7f1d1d;"><strong>Status:</strong> Website account locked, interactive bot commands suspended, notifications suspended.</p>
              </div>

              <h3 style="color: #0f172a; margin: 20px 0 10px; font-size: 15px;">Parish Administrator Contact Details:</h3>
              <p style="margin: 0 0 8px; font-size: 13px;">If you believe this action was taken in error or wish to request reinstatement, please contact the church administration directly:</p>
              <ul style="padding-left: 20px; font-size: 13px; color: #1e293b; line-height: 1.8;">
                <li><strong>Parish Office:</strong> St. John de Britto Church, Kalayarkoil - 630551</li>
                <li><strong>Administrator Phone:</strong> <a href="tel:+919655639144" style="color: #2563eb; font-weight: bold;">+91 9655639144</a> / +91 9443123456</li>
                <li><strong>Admin Email:</strong> <a href="mailto:arndas777@gmail.com" style="color: #2563eb; font-weight: bold;">arndas777@gmail.com</a></li>
                <li><strong>Office Hours:</strong> Monday – Saturday, 9:00 AM – 5:00 PM IST</li>
                <li><strong>Parish Website:</strong> <a href="https://st-jb-church.vercel.app" style="color: #2563eb;">st-jb-church.vercel.app</a></li>
              </ul>

              <p style="margin: 20px 0 0; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                This is an automated safety notice issued by St. John de Britto Church parish administration.
              </p>
            </div>
          </div>`
        });
      } catch (mailErr) {
        console.warn('[Moderation] Could not send user deactivation email notice:', mailErr.message);
      }
    }
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
async function processIncomingMessage({ phoneNumber, displayName = '', messageText = '', messageId = null, userId = null }) {
  const cleanPhone = cleanPhoneNumber(phoneNumber);
  if (!cleanPhone) {
    return { isBlocked: false, isViolation: false };
  }

  // 1. Retrieve or initialize UserModeration record
  let modRecord = await UserModeration.findOne({ phoneNumber: cleanPhone });
  let linkedUser = null;
  if (userId) {
    linkedUser = await User.findById(userId);
  }
  if (!linkedUser) {
    linkedUser = await findLinkedUserByPhone(cleanPhone);
  }

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

  // 2. If user is ALREADY BLOCKED, reject immediately with Parish Admin contact info
  if (modRecord.status === 'blocked') {
    return {
      isBlocked: true,
      isViolation: false,
      replyMessage: `🚫 *SJDB Connect — Account Deactivated & Blocked*

Your account is currently restricted and deactivated due to previous policy violations. All interactive bot services and messages have been suspended.

📞 *Parish Administrator Contact Details:*
• ⛪ *Parish:* St. John de Britto Church, Kalayarkoil
• 📱 *Admin / Parish Phone:* +91 9655639144 / +91 9443123456
• 📧 *Admin Email:* arndas777@gmail.com
• 🏛️ *Office Hours:* Monday – Saturday, 9:00 AM – 5:00 PM IST
• 🌐 *Website:* https://st-jb-church.vercel.app

To appeal this restriction, please contact the church office directly.`
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

  const wordsListStr = detectedWords.map(w => `\`${w}\``).join(', ');

  // Automatic Block rule:
  // 1st bad message -> Warning
  // 2nd bad message (or extreme severity 3) -> Automatically block and deactivate!
  if (highestSeverity === 3 || modRecord.violationCount >= 2) {
    shouldBlock = true;
    modRecord.status = 'blocked';
    modRecord.blockedAt = now;
    modRecord.blockedReason = highestSeverity === 3
      ? 'Severe abusive or threatening content'
      : `Repeated abusive messages (${modRecord.violationCount} violations in ${VIOLATION_WINDOW_HOURS}h)`;

    warningMessage = `🚫 *SJDB Connect — Account Deactivated & Blocked*

Your message contained prohibited language:
🚨 *Detected words:* ${wordsListStr}

• *Status:* Account Automatically Blocked & Deactivated
• *Action Taken:* Your interactive access to the SJDB Connect WhatsApp bot and parish website account have been suspended due to repeated policy violations.

📞 *Parish Administrator Contact Details:*
If you wish to appeal or request account reactivation, please contact the church administration directly:
• ⛪ *Parish:* St. John de Britto Church, Kalayarkoil
• 📱 *Admin / Parish Phone:* +91 9655639144 / +91 9443123456
• 📧 *Admin Email:* arndas777@gmail.com
• 🏛️ *Office Hours:* Monday – Saturday, 9:00 AM – 5:00 PM IST
• 🌐 *Parish Website:* https://st-jb-church.vercel.app

— *Parish Administration*
_SJDB Connect_`;

    // Cross-system enforcement: deactivate website account and notify user
    if (linkedUser) {
      await deactivateWebsiteAccount(linkedUser, modRecord.blockedReason, detectedWords);
    }
  } else {
    // 1st bad message -> Warning
    modRecord.status = 'warning';
    warningMessage = `⚠️ *Warning: Inappropriate Language Detected*

Your message contained prohibited language:
🚨 *Detected words:* ${wordsListStr}

• *Status:* Strike 1 Warning
• *Notice:* SJDB Connect is a sacred parish platform. If you send inappropriate language again, your account will be *automatically deactivated and blocked*.
• *Policy:* Please maintain respect and Christian charity in all communications.`;
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
    await notifyAdmin({
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
    });
  } catch (notifErr) {
    console.error('[Moderation] Error invoking admin abuse notification:', notifErr.message);
  }

  // Direct email to Admin to guarantee delivery with all details
  try {
    const { sendMail } = require('../config/mailer');
    await sendMail({
      to: 'arndas777@gmail.com',
      subject: shouldBlock
        ? `🚨 URGENT: User Blocked & Deactivated for Abusive Language — ${displayName || cleanPhone}`
        : `⚠️ WhatsApp Abuse Warning Issued — ${displayName || cleanPhone}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background: ${shouldBlock ? 'linear-gradient(135deg, #991b1b, #dc2626)' : 'linear-gradient(135deg, #d97706, #f59e0b)'}; padding: 22px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">${shouldBlock ? '🚨 User Automatically Blocked & Deactivated' : '⚠️ WhatsApp Abuse Warning Issued'}</h2>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.95;">SJDB Connect Central Moderation Service</p>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.6; font-size: 13.5px;">
          <p>A message containing prohibited language was intercepted on the WhatsApp bot.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; width: 35%;">Sender Phone:</td>
              <td style="padding: 10px;">${cleanPhone}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold;">WhatsApp Name:</td>
              <td style="padding: 10px;">${displayName || 'Unknown'}</td>
            </tr>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold;">Website Account:</td>
              <td style="padding: 10px;">${linkedUser ? `Registered Member (${linkedUser.name})` : 'Unregistered WhatsApp User'}</td>
            </tr>
            ${linkedUser ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold;">Member ID / Anbiyam:</td>
              <td style="padding: 10px;">${linkedUser.parishMemberId || 'N/A'} / ${linkedUser.anbiyam || linkedUser.subStation || 'N/A'}</td>
            </tr>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold;">User Email:</td>
              <td style="padding: 10px;">${linkedUser.email || 'N/A'}</td>
            </tr>
            ` : ''}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #b91c1c;">Detected Words:</td>
              <td style="padding: 10px; color: #b91c1c; font-weight: bold;">${detectedWords.map(w => `<span style="background:#fee2e2; padding:2px 6px; border-radius:4px; margin-right:4px;">${w}</span>`).join(' ')}</td>
            </tr>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold;">Full Message Text:</td>
              <td style="padding: 10px; font-style: italic; color: #475569;">"${messageText}"</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold;">Action Taken:</td>
              <td style="padding: 10px; font-weight: bold; color: ${shouldBlock ? '#b91c1c' : '#d97706'};">
                ${shouldBlock ? `Strike ${modRecord.violationCount}: User Automatically Blocked & Website Account Deactivated` : `Strike ${modRecord.violationCount}: Formal Warning Sent`}
              </td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; font-weight: bold;">Timestamp:</td>
              <td style="padding: 10px;">${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 24px;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/whatsapp" style="background: #1e3a8a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Open Moderation Center & Audit Logs →
            </a>
          </div>
        </div>
      </div>`
    }).catch(err => console.warn('[Moderation] Direct admin email error:', err.message));
  } catch (err) {
    console.warn('[Moderation] Direct admin email notice error:', err.message);
  }

  // Admin In-App Notification in Notification collection
  try {
    const Notification = require('../models/Notification');
    Notification.create({
      recipient: 'admin',
      isBroadcast: false,
      title: shouldBlock
        ? `🚨 User Blocked & Deactivated: ${displayName || cleanPhone}`
        : `⚠️ WhatsApp Abuse Warning: ${displayName || cleanPhone}`,
      message: `User ${displayName || cleanPhone} sent prohibited words (${detectedWords.join(', ')}). Action: ${shouldBlock ? 'Automatically Blocked & Deactivated' : 'Strike 1 Warning Issued'}.`,
      type: 'security',
      category: 'security',
      priority: shouldBlock ? 'critical' : 'high',
      actionUrl: '/admin/whatsapp',
      metadata: {
        phoneNumber: cleanPhone,
        detectedWords,
        messageText,
        strikeCount: modRecord.violationCount,
        isBlocked: shouldBlock
      }
    }).catch(e => console.warn('[Moderation] Admin notification error:', e.message));
  } catch (notifErr) {
    console.warn('[Moderation] Admin in-app notification error:', notifErr.message);
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

  // Send manual block notification to user on WhatsApp & Email so they are informed access is suspended
  try {
    const wa = require('../bot/whatsapp');
    const manualBlockMsg = `🚫 *SJDB Connect — Administrative Notice*

Your account has been restricted by the administrator.
• *Reason:* ${reason}
• *Status:* All bot services and parish notifications have been suspended.
• No notifications or messages will be sent until an administrator restores your account.
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
        subject: '🚫 Notice: SJDB Connect Account Restricted',
        html: `<div style="font-family:sans-serif; padding:20px; color:#1e293b;">
          <h2 style="color:#b91c1c;">SJDB Connect — Account Restricted</h2>
          <p>Your access to the SJDB Connect WhatsApp bot and website account has been restricted by the administrator.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:12px; border-radius:4px; margin:16px 0;">
            <p style="margin:0; font-weight:bold; color:#991b1b;">All Services & Notifications Suspended:</p>
            <p style="margin:4px 0 0; font-size:13px; color:#7f1d1d;">All bot messaging, daily Catholic readings, broadcasts, and church notifications are suspended until your account is reviewed and restored by an administrator.</p>
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

/**
 * Restore all restricted/moderated users and reactivate linked accounts
 */
async function restoreAllActiveUsers(adminUserId = null) {
  const modResult = await UserModeration.updateMany({}, {
    $set: {
      status: 'active',
      violationCount: 0,
      blockedReason: null,
      blockedAt: null,
      unblockedAt: new Date(),
      unblockedBy: adminUserId || null,
      violations: []
    }
  });

  const userResult = await User.updateMany(
    { isActive: false },
    { $set: { isActive: true, deactivatedReason: null } }
  );

  console.log(`[Moderation] All active users restored: ${modResult.modifiedCount} moderation records reset, ${userResult.modifiedCount} accounts reactivated.`);
  return {
    moderationRestored: modResult.modifiedCount,
    usersReactivated: userResult.modifiedCount
  };
}

module.exports = {
  cleanPhoneNumber,
  normalizeText,
  detectViolations,
  processIncomingMessage,
  isPhoneBlocked,
  unblockUser,
  blockUserManually,
  getActiveBlockedWords,
  restoreAllActiveUsers
};
