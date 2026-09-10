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

const { normalizeToE164, getPhoneLookupKeys, isSamePhoneIdentity, formatPhoneDisplay } = require('../utils/phoneUtils');

const VIOLATION_WINDOW_HOURS = 24; // 24-hour rolling strike window calculated dynamically

/**
 * Clean phone number to canonical E.164 format (e.g. "+919876543210")
 */
function cleanPhoneNumber(phone) {
  return normalizeToE164(phone);
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
 * Distinguish educational/inquiry questions from abusive harassment
 * e.g. "What does the word bitch mean?", "why is this word bad?", "பொருள் என்ன"
 */
function isEducationalOrInquiryContext(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();
  const patterns = [
    /what\s+(is|does)\s+(the\s+)?(meaning|definition|mean)\s+of/i,
    /why\s+is\s+.+\s+(a\s+)?(bad\s*word|curse|slur|inappropriate)/i,
    /meaning\s+of\s+/i,
    /definition\s+of\s+/i,
    /what\s+does\s+.+\s+mean/i,
    /பொருள்\s+என்ன/i,
    /அர்த்தம்\s+என்ன/i,
    /விளக்கம்\s+என்ன/i
  ];
  return patterns.some(p => p.test(lower));
}

/**
 * Detect inappropriate or abusive words in message
 */
async function detectViolations(text) {
  if (!text || typeof text !== 'string') {
    return { isViolation: false, detectedWords: [], highestSeverity: 0, isEducational: false, isDirectThreat: false };
  }

  const { rawLower, normalized, collapsed } = normalizeText(text);
  const wordsList = await getActiveBlockedWords();

  const isEducational = isEducationalOrInquiryContext(text);
  const isDirectThreat = /(i\s*will\s*(kill|murder|rape)|die\s+(bitch|bastard|you)|fuck\s+you|fuck\s+off|go\s+to\s+hell)/i.test(text);

  const detectedSet = new Set();
  let highestSeverity = 0;

  for (const item of wordsList) {
    const word = item.word.toLowerCase();
    let severity = item.severity || 2;

    // False-positive guard: If asking an educational / dictionary inquiry, downgrade severity
    if (isEducational && severity === 3) {
      severity = 1;
    }

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

  // Explicit direct personal threats escalate to maximum severity
  if (isDirectThreat) {
    highestSeverity = 3;
  }

  const detectedWords = Array.from(detectedSet);
  return {
    isViolation: detectedWords.length > 0,
    detectedWords,
    highestSeverity: highestSeverity || (detectedWords.length > 0 ? 2 : 0),
    isEducational,
    isDirectThreat
  };
}

/**
 * Look up associated website user account by canonical phone identity
 */
async function findLinkedUserByPhone(phone) {
  if (!phone) return null;
  const keys = getPhoneLookupKeys(phone);
  if (!keys.last10) return null;

  return User.findOne({
    $or: [
      { phone: keys.e164 },
      { phone: keys.rawDigits },
      { phone: new RegExp(keys.last10 + '$') }
    ]
  });
}

/**
 * Deactivate linked website account when user is blocked and notify them
 */
async function deactivateWebsiteAccount(user, reason, detectedWords = []) {
  if (!user) return;
  const adminPhones = ['07639520006', '917639520006', '7639520006', '9655639144', '919655639144', '9443123456', '919443123456'];
  const userPhoneDigits = (user.phone || '').replace(/\D/g, '');
  const isProtectedAdmin = user.role === 'admin' || 
                           user.role === 'priest' || 
                           user.isTechnicalTeam || 
                           (user.email || '').toLowerCase() === 'arndas777@gmail.com' ||
                           adminPhones.some(p => userPhoneDigits.endsWith(p.slice(-10)));

  if (isProtectedAdmin) {
    console.warn(`[Moderation] Protected administrator account (${user.name} / ${user.email || user.phone}) will NOT be deactivated.`);
    return;
  }
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
        const wordsBadges = Array.isArray(detectedWords) && detectedWords.length > 0
          ? detectedWords.map(w => `<span style="display:inline-block; background-color:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-family:Consolas, Monaco, monospace; font-weight:800; font-size:13px; padding:3px 8px; border-radius:5px; margin:2px 4px 2px 0;">${w}</span>`).join(' ')
          : '<span style="color:#b91c1c; font-weight:bold;">Prohibited / abusive content</span>';

        await sendMail({
          to: user.email,
          subject: '🚫 Notice: Your SJDB Connect Account has been Deactivated and Blocked',
          html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Account Deactivated & Blocked</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
  <div style="max-width:600px; margin:0 auto; padding:16px 8px;">
    
    <div style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
      
      <!-- HEADER -->
      <div style="background:linear-gradient(135deg, #991b1b 0%, #dc2626 100%); padding:26px 20px; text-align:center; color:#ffffff;">
        <div style="display:inline-block; background:rgba(255,255,255,0.22); padding:4px 14px; border-radius:20px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
          🚫 Account Notice
        </div>
        <h1 style="margin:0; font-size:22px; font-weight:900; line-height:1.3; color:#ffffff;">
          Account Deactivated & Blocked
        </h1>
        <p style="margin:6px 0 0; font-size:13px; opacity:0.95; color:#ffffff;">
          St. John de Britto Church, Kalayarkoil • SJDB Connect
        </p>
      </div>

      <!-- BODY -->
      <div style="padding:22px 18px; color:#1e293b;">
        <p style="font-size:15px; margin:0 0 12px; line-height:1.5;">Dear <strong>${user.name || 'Parishioner'}</strong>,</p>
        <p style="font-size:13.5px; color:#475569; margin:0 0 16px; line-height:1.6;">
          Your SJDB Connect parish account and interactive WhatsApp bot access have been <strong>automatically deactivated and restricted</strong> due to policy violations (use of prohibited or inappropriate language).
        </p>

        <!-- VIOLATION DETAILS CARD -->
        <div style="background-color:#fef2f2; border:1px solid #fecaca; border-left:5px solid #dc2626; border-radius:10px; padding:14px 16px; margin-bottom:18px;">
          <div style="font-size:11px; font-weight:800; color:#991b1b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
            Policy Violation Details
          </div>
          <div style="font-size:13px; color:#7f1d1d; margin-bottom:5px;">
            • <strong>Reason:</strong> ${reason || 'Inappropriate or abusive language'}
          </div>
          <div style="font-size:13px; color:#7f1d1d; margin-bottom:6px;">
            • <strong>Detected Words:</strong> ${wordsBadges}
          </div>
          <div style="font-size:13px; color:#7f1d1d;">
            • <strong>Current Status:</strong> Website login locked, interactive bot messaging suspended, all automated notifications suspended.
          </div>
        </div>

        <!-- CONTACT DETAILS CARD -->
        <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px 18px; margin-bottom:18px;">
          <div style="font-size:12px; font-weight:800; color:#1e3a8a; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
            📞 Parish Administration Contact Details
          </div>
          <p style="font-size:13px; color:#334155; margin:0 0 12px; line-height:1.5;">
            SJDB Connect is a sacred platform dedicated to prayer, spiritual reflection, and community fellowship. If you believe this action was taken in error or wish to appeal for account restoration, please contact the church administration directly:
          </p>
          
          <div style="font-size:13px; color:#1e293b; line-height:1.9;">
            <div>• <strong>Parish Office:</strong> St. John de Britto Church, Kalayarkoil - 630551</div>
            <div>• <strong>Parish Priest / Admin Phone:</strong> <a href="tel:+919655639144" style="color:#2563eb; font-weight:bold; text-decoration:none;">+91 9655639144</a> / <a href="tel:+919443123456" style="color:#2563eb; text-decoration:none;">+91 9443123456</a></div>
            <div>• <strong>Administrator Email:</strong> <a href="mailto:arndas777@gmail.com" style="color:#2563eb; font-weight:bold; text-decoration:none;">arndas777@gmail.com</a></div>
            <div>• <strong>Office Hours:</strong> Monday – Saturday, 9:00 AM – 5:00 PM IST</div>
            <div>• <strong>Parish Website:</strong> <a href="https://st-jb-church.vercel.app" style="color:#2563eb; text-decoration:none;">st-jb-church.vercel.app</a></div>
          </div>
        </div>

        <p style="margin:16px 0 0; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px; text-align:center;">
          Automated safety notice issued by St. John de Britto Church Parish Administration.
        </p>
      </div>

    </div>
  </div>
</body>
</html>`
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
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    user.authVersion = (user.authVersion || 1) + 1;
    await user.save();
    console.log(`[Moderation] Linked website account (${user.name} / ${user.phone}) restored by admin with updated tokenVersion.`);
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
  const canonicalPhone = normalizeToE164(phoneNumber);
  if (!canonicalPhone) {
    return { isBlocked: false, isViolation: false };
  }

  const keys = getPhoneLookupKeys(canonicalPhone);

  // 1. Check if user is ALREADY BLOCKED
  const alreadyBlocked = await isPhoneBlocked(canonicalPhone);
  if (alreadyBlocked) {
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

  // 2. Scan message for violations
  const { isViolation, detectedWords, highestSeverity, isEducational, isDirectThreat } = await detectViolations(messageText);

  if (!isViolation) {
    return { isBlocked: false, isViolation: false };
  }

  // 3. Violation Detected — Atomic concurrency & dynamic 24-hour rolling strike window
  let linkedUser = null;
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    linkedUser = await User.findById(userId);
  }
  if (!linkedUser) {
    linkedUser = await findLinkedUserByPhone(canonicalPhone);
  }

  const now = new Date();
  const newViolation = {
    messageId,
    messageText,
    matchedWords: detectedWords,
    severity: highestSeverity,
    warningSent: '',
    timestamp: now
  };

  // Atomic push ensures NO lost strikes during concurrent rapid messages
  const updatedRecord = await UserModeration.findOneAndUpdate(
    { $or: keys.dbOrQuery },
    {
      $setOnInsert: {
        phoneNumber: canonicalPhone,
        userId: linkedUser ? linkedUser._id : null,
        createdAt: now
      },
      $push: { violations: newViolation },
      $set: {
        lastViolationAt: now,
        whatsappDisplayName: displayName || (linkedUser ? linkedUser.name : '')
      }
    },
    { new: true, upsert: true }
  );

  // Calculate active strikes inside the rolling 24h window from actual timestamps
  // If an administrator restored this user, violations prior to restoration are preserved but do not count toward active strikes.
  const cutoff24h = new Date(now.getTime() - VIOLATION_WINDOW_HOURS * 60 * 60 * 1000);
  const lastUnblockedAt = updatedRecord.unblockedAt ? new Date(updatedRecord.unblockedAt) : null;
  const effectiveCutoff = (lastUnblockedAt && lastUnblockedAt > cutoff24h) ? lastUnblockedAt : cutoff24h;

  const activeViolations = (updatedRecord.violations || []).filter(v => v.timestamp && new Date(v.timestamp) >= effectiveCutoff);
  const activeStrikes = activeViolations.length;

  const isSevereThreat = highestSeverity === 3 && !isEducational;
  const shouldBlock = isSevereThreat || activeStrikes >= 3;
  const wordsListStr = detectedWords.map(w => `\`${w}\``).join(', ');

  let warningMessage = '';

  if (shouldBlock) {
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

    if (linkedUser) {
      const blockedReason = isSevereThreat
        ? 'Severe abusive or threatening content'
        : `Repeated abusive messages (${activeStrikes} violations in ${VIOLATION_WINDOW_HOURS}h)`;
      await deactivateWebsiteAccount(linkedUser, blockedReason, detectedWords);
    }
  } else {
    warningMessage = `⚠️ *Warning: Inappropriate Language Detected*

Your message contained prohibited language:
🚨 *Detected words:* ${wordsListStr}

• *Status:* Strike ${activeStrikes} Warning
• *Notice:* SJDB Connect is a sacred parish platform. If you send inappropriate language again, your account will be *automatically deactivated and blocked*.
• *Policy:* Please maintain respect and Christian charity in all communications.`;
  }

  // Finalize state atomically
  const blockedReason = shouldBlock
    ? (isSevereThreat ? 'Severe abusive or threatening content' : `Repeated abusive messages (${activeStrikes} violations in ${VIOLATION_WINDOW_HOURS}h)`)
    : null;

  const finalRecord = await UserModeration.findByIdAndUpdate(
    updatedRecord._id,
    {
      $set: {
        violationCount: activeStrikes,
        status: shouldBlock ? 'blocked' : 'warning',
        ...(shouldBlock && !updatedRecord.blockedAt ? {
          blockedAt: now,
          blockedReason
        } : {})
      }
    },
    { new: true }
  );

  console.warn(`[Moderation] Violation registered for ${canonicalPhone} (Strike ${activeStrikes}): Status=${finalRecord.status}`);

  // Dispatch Email Notification to Administrator with full incident and user details
  try {
    const { notifyAdmin } = require('./adminNotificationService');
    await notifyAdmin({
      type: 'WHATSAPP_ABUSE_ALERT',
      user: linkedUser,
      extra: {
        phoneNumber: canonicalPhone,
        displayName: displayName || (linkedUser ? linkedUser.name : 'WhatsApp User'),
        messageText,
        detectedWords,
        highestSeverity,
        strikeCount: activeStrikes,
        totalViolations: updatedRecord.violations.length,
        status: finalRecord.status,
        isBlocked: shouldBlock,
        warningMessage,
        blockedReason,
        previousViolations: updatedRecord.violations.slice(0, -1),
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
    const formattedPhone = formatPhoneDisplay(canonicalPhone);
    const wordsBadges = (detectedWords || []).map(w => 
      `<span style="display:inline-block; background-color:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-family:Consolas, Monaco, monospace; font-weight:800; font-size:14px; padding:4px 10px; border-radius:6px; margin:2px 6px 2px 0;">${w}</span>`
    ).join('');
    const formattedTimestamp = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });

    await sendMail({
      to: 'arndas777@gmail.com',
      subject: shouldBlock
        ? `🚨 URGENT: User Blocked & Deactivated for Abusive Language — ${displayName || formattedPhone}`
        : `⚠️ WhatsApp Abuse Warning Issued — ${displayName || formattedPhone}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${shouldBlock ? '🚨 User Blocked & Deactivated' : '⚠️ WhatsApp Abuse Warning'}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
  <div style="max-width:600px; margin:0 auto; padding:16px 8px;">
    
    <!-- MAIN CARD CONTAINER -->
    <div style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
      
      <!-- HEADER BANNER -->
      <div style="background:${shouldBlock ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #b45309 0%, #ea580c 100%)'}; padding:26px 20px; text-align:center; color:#ffffff;">
        <div style="display:inline-block; background:rgba(255,255,255,0.22); padding:4px 14px; border-radius:20px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
          ${shouldBlock ? '🚨 Critical Security Enforcement' : '⚠️ Central Moderation Alert'}
        </div>
        <h1 style="margin:0; font-size:22px; font-weight:900; line-height:1.3; color:#ffffff;">
          ${shouldBlock ? 'User Automatically Blocked & Deactivated' : 'WhatsApp Abuse Warning Issued'}
        </h1>
        <p style="margin:6px 0 0; font-size:13px; opacity:0.95; color:#ffffff;">
          SJDB Connect Central Moderation Service • St. John de Britto Church, Kalayarkoil
        </p>
      </div>

      <!-- BODY WRAPPER -->
      <div style="padding:22px 18px; color:#1e293b;">
        
        <!-- ENFORCEMENT SUMMARY CALLOUT -->
        <div style="background-color:${shouldBlock ? '#fef2f2' : '#fffbeb'}; border-left:5px solid ${shouldBlock ? '#dc2626' : '#f59e0b'}; border-radius:8px; padding:14px 16px; margin-bottom:20px;">
          <div style="font-size:14px; font-weight:800; color:${shouldBlock ? '#991b1b' : '#92400e'}; margin-bottom:4px;">
            ${shouldBlock ? '🚫 Action Taken: Account Restricted & Deactivated' : `⚠️ Action Taken: Formal Warning Issued (Strike ${activeStrikes} of 3)`}
          </div>
          <div style="font-size:13px; color:${shouldBlock ? '#7f1d1d' : '#78350f'}; line-height:1.5;">
            ${shouldBlock 
              ? `User <strong>${displayName || formattedPhone}</strong> exceeded policy thresholds. Their interactive WhatsApp bot messaging and linked parish website account have been <strong>automatically deactivated and blocked</strong>.` 
              : `User <strong>${displayName || formattedPhone}</strong> sent prohibited language. A formal warning was delivered. <strong>${3 - activeStrikes} strike(s)</strong> remaining before automatic account deactivation.`}
          </div>
        </div>

        <!-- SECTION 1: INCIDENT & ABUSE DETAILS -->
        <div style="margin-bottom:22px;">
          <div style="font-size:12px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:10px; border-bottom:2px solid #f1f5f9; padding-bottom:6px;">
            🚨 Incident & Violation Breakdown
          </div>

          <!-- DETECTED WORDS CARD -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; margin-bottom:10px;">
            <div style="font-size:11px; font-weight:700; color:#b91c1c; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
              Detected Prohibited Words (${detectedWords.length})
            </div>
            <div style="margin-bottom:6px;">
              ${wordsBadges}
            </div>
            <div style="font-size:11.5px; color:#64748b;">
              Severity Rating: <strong style="color:#0f172a;">Level ${highestSeverity} of 3</strong> ${highestSeverity === 3 ? '(Critical Threat / Instant Ban)' : '(Profanity / Vulgar Language)'}
            </div>
          </div>

          <!-- VERBATIM MESSAGE TEXT -->
          <div style="background-color:#0f172a; border-radius:10px; padding:14px 16px; margin-bottom:10px; border:1px solid #334155;">
            <div style="font-size:11px; font-weight:700; color:#f87171; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
              💬 Flagged Incoming Message Text
            </div>
            <div style="font-family:Consolas, Monaco, monospace; font-size:14px; color:#fecaca; line-height:1.5; word-break:break-word; overflow-wrap:anywhere;">
              "${(messageText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
            </div>
          </div>

          <!-- STRIKES & VIOLATION METRICS -->
          <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
            <tr>
              <td style="width:50%; padding-right:5px; vertical-align:top;">
                <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center;">
                  <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase;">Active Strikes (24h)</div>
                  <div style="font-size:22px; font-weight:900; color:#dc2626; margin:4px 0 2px;">${activeStrikes} / 3</div>
                  <div style="font-size:11px; color:#64748b; font-weight:600;">${shouldBlock ? 'Threshold Exceeded (Blocked)' : `${3 - activeStrikes} strike(s) remaining`}</div>
                </div>
              </td>
              <td style="width:50%; padding-left:5px; vertical-align:top;">
                <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center;">
                  <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase;">Lifetime Violations</div>
                  <div style="font-size:22px; font-weight:900; color:#7c3aed; margin:4px 0 2px;">${updatedRecord.violations?.length || activeStrikes}</div>
                  <div style="font-size:11px; color:#64748b; font-weight:600;">Permanent Audit Trail</div>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- SECTION 2: USER & PARISHIONER PROFILE -->
        <div style="margin-bottom:22px;">
          <div style="font-size:12px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:10px; border-bottom:2px solid #f1f5f9; padding-bottom:6px;">
            👤 Offending User Profile & Details
          </div>

          <!-- SENDER PHONE -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 15px; margin-bottom:8px;">
            <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">
              Sender Mobile Number
            </div>
            <div style="font-size:16px; font-weight:800; color:#0f172a; font-family:Consolas, Monaco, monospace; letter-spacing:0.5px;">
              ${formattedPhone}
            </div>
          </div>

          <!-- WHATSAPP DISPLAY NAME -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 15px; margin-bottom:8px;">
            <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">
              WhatsApp Display Name
            </div>
            <div style="font-size:15px; font-weight:700; color:#0f172a; word-break:break-word;">
              ${displayName || 'Unknown'}
            </div>
          </div>

          <!-- WEBSITE ACCOUNT STATUS -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 15px; margin-bottom:8px;">
            <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
              Website Account Link
            </div>
            <div>
              ${linkedUser 
                ? `<span style="display:inline-block; background-color:${shouldBlock ? '#fee2e2' : '#dcfce7'}; color:${shouldBlock ? '#b91c1c' : '#15803d'}; border:1px solid ${shouldBlock ? '#fca5a5' : '#86efac'}; font-size:12px; font-weight:800; padding:3px 10px; border-radius:5px;">
                    ${shouldBlock ? '🔒 Registered Member (Account Deactivated & Blocked)' : '✅ Registered Parishioner (Active)'}
                   </span>`
                : '<span style="color:#64748b; font-style:italic; font-size:13.5px;">Unregistered WhatsApp User (No Website Account)</span>'}
            </div>
          </div>

          ${linkedUser ? `
          <!-- PARISHIONER NAME -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 15px; margin-bottom:8px;">
            <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">
              Parishioner Full Name
            </div>
            <div style="font-size:15.5px; font-weight:800; color:#1e3a8a; word-break:break-word;">
              ${linkedUser.name}
            </div>
          </div>

          <!-- MEMBER ID & FAMILY ID -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 15px; margin-bottom:8px;">
            <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">
              Parish Member ID / Family ID
            </div>
            <div style="font-size:15px; font-weight:800; color:#0f172a; font-family:Consolas, Monaco, monospace;">
              ${linkedUser.parishMemberId || 'N/A'}${linkedUser.familyId ? ` <span style="color:#64748b; font-weight:normal;">(Family: ${linkedUser.familyId})</span>` : ''}
            </div>
          </div>

          <!-- ANBIYAM / SUB-STATION -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 15px; margin-bottom:8px;">
            <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">
              Anbiyam / Sub-Station
            </div>
            <div style="font-size:14.5px; font-weight:700; color:#0f172a; word-break:break-word;">
              ${linkedUser.anbiyam || linkedUser.subStation || 'Main Parish'}
            </div>
          </div>

          <!-- REGISTERED USER EMAIL -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 15px; margin-bottom:8px;">
            <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">
              Registered User Email
            </div>
            <div style="font-size:15px; font-weight:700; color:#2563eb; word-break:break-word; overflow-wrap:anywhere;">
              <a href="mailto:${linkedUser.email}" style="color:#2563eb; text-decoration:none;">${linkedUser.email || 'None'}</a>
            </div>
          </div>
          ` : ''}

          <!-- INCIDENT TIMESTAMP -->
          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 15px; margin-bottom:8px;">
            <div style="font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">
              Incident Date & Time
            </div>
            <div style="font-size:13.5px; font-weight:700; color:#334155;">
              ${formattedTimestamp} (IST)
            </div>
          </div>
        </div>

        <!-- ACTION BUTTON -->
        <div style="text-align:center; margin:26px 0 10px;">
          <a href="${process.env.CLIENT_URL || 'https://st-jb-church.vercel.app'}/admin/whatsapp" style="background:#1e3a8a; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:14px; font-weight:800; display:inline-block; box-shadow:0 4px 14px rgba(30,58,138,0.25);">
            Open Moderation Center & Audit Logs →
          </a>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:14px; text-align:center; font-size:11.5px; color:#64748b;">
        Automated security notification issued by SJDB Connect Central Moderation • St. John de Britto Church, Kalayarkoil
      </div>

    </div>
  </div>
</body>
</html>`
    });
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
        ? `🚨 User Blocked & Deactivated: ${displayName || canonicalPhone}`
        : `⚠️ WhatsApp Abuse Warning: ${displayName || canonicalPhone}`,
      message: `User ${displayName || canonicalPhone} sent prohibited words (${detectedWords.join(', ')}). Action: ${shouldBlock ? 'Automatically Blocked & Deactivated' : 'Strike 1 Warning Issued'}.`,
      type: 'security',
      category: 'security',
      priority: shouldBlock ? 'critical' : 'high',
      actionUrl: '/admin/whatsapp',
      metadata: {
        phoneNumber: canonicalPhone,
        detectedWords,
        messageText,
        strikeCount: activeStrikes,
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
    violationCount: activeStrikes,
    status: finalRecord.status
  };
}

/**
 * Check if a phone number is currently blocked
 */
async function isPhoneBlocked(phone) {
  if (!phone) return false;
  // Parish administrators and official church numbers are NEVER blocked
  const adminPhones = ['07639520006', '917639520006', '7639520006', '9655639144', '919655639144', '9443123456', '919443123456'];
  const cleanDigits = phone.replace(/\D/g, '');
  if (adminPhones.some(p => cleanDigits.endsWith(p.slice(-10)))) {
    return false;
  }

  const keys = getPhoneLookupKeys(phone);
  if (!keys.e164 && !keys.last10) return false;

  const blockedRecord = await UserModeration.findOne({
    status: 'blocked',
    $or: keys.dbOrQuery
  }).lean();

  return Boolean(blockedRecord);
}

/**
 * Unblock user and restore access (WhatsApp + Website)
 * Fully preserves all historical violation records for audit integrity.
 */
async function unblockUser(phoneNumber, adminUserId = null, restoreReason = 'Restored by parish administrator upon review') {
  if (!phoneNumber) return null;
  const keys = getPhoneLookupKeys(phoneNumber);
  if (!keys.e164 && !keys.last10) return null;

  const record = await UserModeration.findOne({
    $or: keys.dbOrQuery
  });

  if (!record) return null;

  let adminName = 'Parish Administrator';
  if (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) {
    const adminUser = await User.findById(adminUserId).select('name');
    if (adminUser) adminName = adminUser.name;
  }

  const previousStatus = record.status;
  const strikesAtRestore = record.violationCount || 0;

  record.status = 'active';
  record.violationCount = 0;
  record.unblockedAt = new Date();
  record.unblockedBy = (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) ? adminUserId : null;
  record.blockedAt = null;
  record.blockedReason = null;

  if (!record.restorationHistory) record.restorationHistory = [];
  record.restorationHistory.push({
    restoredBy: (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) ? adminUserId : null,
    restoredByName: adminName,
    restoredAt: new Date(),
    restoreReason: restoreReason || 'Restored by parish administrator upon review',
    previousStatus,
    strikesAtRestore
  });

  await record.save();

  // Restore linked website account if exists
  const linkedUser = await findLinkedUserByPhone(phoneNumber);
  if (linkedUser) {
    await reactivateWebsiteAccount(linkedUser);
  }

  console.log(`[Moderation] User ${record.phoneNumber} unblocked by admin (${adminName}). Historical violations (${record.violations?.length || 0}) preserved.`);
  return record;
}

/**
 * Manually block a user (Admin Action)
 */
async function blockUserManually(phoneNumber, reason = 'Manually blocked by administrator', adminUserId = null) {
  if (!phoneNumber) return null;
  const keys = getPhoneLookupKeys(phoneNumber);
  if (!keys.e164 && !keys.last10) return null;

  let record = await UserModeration.findOne({
    $or: keys.dbOrQuery
  });

  const linkedUser = await findLinkedUserByPhone(phoneNumber);

  if (!record) {
    record = new UserModeration({
      phoneNumber: keys.e164 || keys.rawDigits,
      userId: linkedUser ? linkedUser._id : null,
      whatsappDisplayName: linkedUser ? linkedUser.name : ''
    });
  }

  record.status = 'blocked';
  record.blockedAt = new Date();
  record.blockedReason = reason;
  record.unblockedAt = null;
  record.unblockedBy = null;
  record.violationCount = Math.max(3, (record.violationCount || 0) + 1);
  await record.save();

  if (linkedUser) {
    await deactivateWebsiteAccount(linkedUser, reason);
  }

  const targetPhone = keys.e164 || keys.rawDigits;

  // Send manual block notification to user on WhatsApp & Email so they are informed access is suspended
  try {
    const wa = require('../bot/whatsapp');
    const manualBlockMsg = `🚫 *SJDB Connect — Administrative Notice*

Your account has been restricted by the administrator.
• *Reason:* ${reason}
• *Status:* All bot services and parish notifications have been suspended.
• No notifications or messages will be sent until an administrator restores your account.
• If you wish to appeal this decision, please contact the church office.`;
    await wa.sendWhatsAppMessage(targetPhone, manualBlockMsg);
  } catch (waErr) {
    console.warn('[Moderation] Could not send manual block WhatsApp notice:', waErr.message);
  }

  if (linkedUser && linkedUser.email) {
    try {
      const { sendMail } = require('../config/mailer');
      await sendMail({
        to: linkedUser.email,
        subject: '🚫 Notice: Your SJDB Connect Account has been Restricted',
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Restricted</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:16px 8px;">
    <div style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg, #991b1b 0%, #dc2626 100%); padding:26px 20px; text-align:center; color:#ffffff;">
        <h1 style="margin:0; font-size:22px; font-weight:900; line-height:1.3; color:#ffffff;">
          Account Restricted by Administrator
        </h1>
        <p style="margin:6px 0 0; font-size:13px; opacity:0.95; color:#ffffff;">
          St. John de Britto Church, Kalayarkoil • SJDB Connect
        </p>
      </div>
      <div style="padding:22px 18px; color:#1e293b;">
        <p style="font-size:15px; margin:0 0 12px; line-height:1.5;">Dear <strong>${linkedUser.name || 'Parishioner'}</strong>,</p>
        <p style="font-size:13.5px; color:#475569; margin:0 0 16px; line-height:1.6;">
          Your access to the SJDB Connect WhatsApp bot and website account has been restricted by the parish administrator.
        </p>

        <div style="background-color:#fef2f2; border:1px solid #fecaca; border-left:5px solid #dc2626; border-radius:10px; padding:14px 16px; margin-bottom:18px;">
          <div style="font-size:11px; font-weight:800; color:#991b1b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Restriction Reason</div>
          <div style="font-size:13.5px; color:#7f1d1d; font-weight:600; margin-bottom:6px;">${reason}</div>
          <div style="font-size:12.5px; color:#7f1d1d;">All bot messaging, Catholic daily readings, and church notifications are suspended until your account is reviewed and restored by an administrator.</div>
        </div>

        <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px 18px; font-size:13px; line-height:1.8;">
          <div style="font-size:12px; font-weight:800; color:#1e3a8a; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
            📞 Parish Administration Contact Details
          </div>
          <div>• <strong>Parish Office:</strong> St. John de Britto Church, Kalayarkoil - 630551</div>
          <div>• <strong>Admin Phone:</strong> <a href="tel:+919655639144" style="color:#2563eb; font-weight:bold; text-decoration:none;">+91 9655639144</a> / <a href="tel:+919443123456" style="color:#2563eb; text-decoration:none;">+91 9443123456</a></div>
          <div>• <strong>Admin Email:</strong> <a href="mailto:arndas777@gmail.com" style="color:#2563eb; font-weight:bold; text-decoration:none;">arndas777@gmail.com</a></div>
          <div>• <strong>Office Hours:</strong> Monday – Saturday, 9:00 AM – 5:00 PM IST</div>
          <div>• <strong>Parish Website:</strong> <a href="https://st-jb-church.vercel.app" style="color:#2563eb; text-decoration:none;">st-jb-church.vercel.app</a></div>
        </div>

        <p style="margin:16px 0 0; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px; text-align:center;">
          Automated administrative notice issued by St. John de Britto Church.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
      });
    } catch (mailErr) {
      console.warn('[Moderation] Could not send manual block email notice:', mailErr.message);
    }
  }

  console.log(`[Moderation] User ${targetPhone} manually blocked by admin (${adminUserId || 'system'}).`);
  return record;
}

/**
 * Restore all restricted/moderated users and reactivate linked accounts.
 * Retains complete historical violation records for audit integrity.
 */
async function restoreAllActiveUsers(adminUserId = null) {
  const modResult = await UserModeration.updateMany({}, {
    $set: {
      status: 'active',
      violationCount: 0,
      blockedReason: null,
      blockedAt: null,
      unblockedAt: new Date(),
      unblockedBy: adminUserId || null
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
