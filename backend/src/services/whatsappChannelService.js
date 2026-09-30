/**
 * WhatsApp Channel Service
 * 
 * Manages the official public WhatsApp Channel: "St. John de Britto Church Kkl."
 * - Dedicated one-way public church broadcast channel (Bible verse, Saint of the Day, readings, reflection, announcements).
 * - Complete architectural separation from the interactive SJDB Connect private bot.
 * - Duplicate prevention via content hashing and publication database audit trail.
 * - Safe limited retries (max 3) with zero channel spamming.
 */

const crypto = require('crypto');
const WhatsappChannelPublication = require('../models/WhatsappChannelPublication');
const SiteSettings = require('../models/SiteSettings');
const Announcement = require('../models/Announcement');
const { getTodayDailyContent } = require('./dailyContentService');
const { getDailySaint } = require('./saintService');
const { getDailySaintImagePayload } = require('./whatsappDailyFormatter');
const {
  DESTINATION,
  sendWhatsAppRouted,
  sendWhatsAppMessage,
  sendWhatsAppMedia,
  getConnectionStatus,
  getSocket
} = require('../bot/whatsapp');
const { getSiteUrl, SITE_ROUTES } = require('../config/siteRoutes');

// In-Memory Channel Cache
let cachedChannelJid = process.env.WHATSAPP_CHANNEL_JID || null;
let cachedChannelUrl = process.env.WHATSAPP_CHANNEL_URL || null;
let cachedChannelMetadata = null;
let lastMetadataFetch = 0;

/**
 * Extract invite code from a full WhatsApp Channel link or raw code
 * e.g. "https://whatsapp.com/channel/0029VaXXXXX" -> "0029VaXXXXX"
 */
function extractInviteCode(urlOrCode) {
  if (!urlOrCode) return null;
  const trimmed = urlOrCode.trim();
  const match = trimmed.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{10,40}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Compute deterministic SHA-256 hash of content to prevent duplicate channel posts
 */
function computeContentHash(content) {
  const normalized = (typeof content === 'string' ? content : JSON.stringify(content))
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Initialize and resolve Channel JID from environment variables or database
 */
async function initializeChannelConfig() {
  try {
    if (process.env.WHATSAPP_CHANNEL_JID) {
      cachedChannelJid = process.env.WHATSAPP_CHANNEL_JID.trim();
    }
    if (process.env.WHATSAPP_CHANNEL_URL) {
      cachedChannelUrl = process.env.WHATSAPP_CHANNEL_URL.trim();
    }

    // Check SiteSettings in database if not set in environment
    if (!cachedChannelJid) {
      const dbJid = await SiteSettings.findOne({ key: 'whatsapp_channel_jid' }).lean();
      if (dbJid && dbJid.value) {
        cachedChannelJid = dbJid.value.trim();
      }
    }
    if (!cachedChannelUrl) {
      const dbUrl = await SiteSettings.findOne({ key: 'whatsapp_channel_url' }).lean();
      if (dbUrl && dbUrl.value) {
        cachedChannelUrl = dbUrl.value.trim();
      }
    }

    // If we have an invite URL but no JID, attempt resolution via Baileys MEX query
    if (!cachedChannelJid && cachedChannelUrl) {
      await resolveChannelFromInvite(cachedChannelUrl);
    }

    if (cachedChannelJid) {
      console.log(`📢 [WhatsApp Channel] Channel JID configured: ${cachedChannelJid}`);
    } else {
      console.log('ℹ️ [WhatsApp Channel] No Channel JID configured yet. Ready for configuration via Admin Dashboard or .env.');
    }
  } catch (err) {
    console.warn('[WhatsApp Channel] Config initialization notice:', err.message);
  }
}

/**
 * Auto-capture discovered channel JID from Baileys events (e.g. when admin posts in channel)
 */
async function recordDiscoveredChannelJid(channelJid) {
  if (!channelJid || !channelJid.endsWith('@newsletter')) return;

  if (cachedChannelJid !== channelJid) {
    cachedChannelJid = channelJid;
    console.log(`📢 [WhatsApp Channel] Auto-detected active Channel JID: ${channelJid}`);
    try {
      await SiteSettings.findOneAndUpdate(
        { key: 'whatsapp_channel_jid' },
        { key: 'whatsapp_channel_jid', value: channelJid, label: 'Official WhatsApp Channel JID', type: 'text' },
        { upsert: true, new: true }
      );
    } catch (_) {}
  }
}

/**
 * Resolve Channel metadata and JID from an invite link using Baileys newsletterMetadata API
 */
async function resolveChannelFromInvite(urlOrCode) {
  const code = extractInviteCode(urlOrCode);
  if (!code) {
    return { success: false, error: 'Invalid WhatsApp Channel invite link or code format.' };
  }

  const sock = getSocket();
  const conn = getConnectionStatus();
  if (!sock || !conn.connected) {
    return { success: false, error: 'WhatsApp is not currently connected. Please ensure Baileys is online.' };
  }

  try {
    console.log(`📢 [WhatsApp Channel] Resolving channel metadata for invite code: ${code}...`);
    const metadata = await sock.newsletterMetadata('invite', code);
    if (!metadata || !metadata.id) {
      return { success: false, error: 'Channel not found or metadata could not be fetched by WhatsApp.' };
    }

    cachedChannelJid = metadata.id;
    cachedChannelMetadata = metadata;
    lastMetadataFetch = Date.now();

    // Persist to database
    await SiteSettings.findOneAndUpdate(
      { key: 'whatsapp_channel_jid' },
      { key: 'whatsapp_channel_jid', value: metadata.id, label: 'Official WhatsApp Channel JID', type: 'text' },
      { upsert: true, new: true }
    );

    if (urlOrCode.includes('whatsapp.com')) {
      cachedChannelUrl = urlOrCode.trim();
      await SiteSettings.findOneAndUpdate(
        { key: 'whatsapp_channel_url' },
        { key: 'whatsapp_channel_url', value: cachedChannelUrl, label: 'Official WhatsApp Channel Link', type: 'text' },
        { upsert: true, new: true }
      );
    }

    console.log(`✅ [WhatsApp Channel] Successfully resolved channel: "${metadata.name}" (${metadata.id})`);
    return {
      success: true,
      channelJid: metadata.id,
      name: metadata.name,
      subscribers: metadata.subscribers || 0,
      description: metadata.description || ''
    };
  } catch (err) {
    console.error('[WhatsApp Channel] Error resolving channel from invite:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get comprehensive channel status and diagnostics for Admin Dashboard
 */
async function getChannelStatus() {
  const conn = getConnectionStatus();
  const configured = Boolean(cachedChannelJid);

  let subscriberCount = 0;
  let channelName = 'St. John de Britto Church Kkl.';
  let description = '';

  const sock = getSocket();
  if (sock && conn.connected && cachedChannelJid) {
    try {
      if (!cachedChannelMetadata || (Date.now() - lastMetadataFetch > 5 * 60 * 1000)) {
        const meta = await sock.newsletterMetadata('jid', cachedChannelJid);
        if (meta) {
          cachedChannelMetadata = meta;
          lastMetadataFetch = Date.now();
        }
      }
      if (cachedChannelMetadata) {
        channelName = cachedChannelMetadata.name || channelName;
        subscriberCount = cachedChannelMetadata.subscribers || 0;
        description = cachedChannelMetadata.description || '';
      }
    } catch (e) {
      console.warn('[WhatsApp Channel] Status metadata check notice:', e.message);
    }
  }

  // Get latest publication
  const latestPublication = await WhatsappChannelPublication.findOne()
    .sort({ createdAt: -1 })
    .lean();

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPublished = await WhatsappChannelPublication.findOne({
    date: todayKey,
    contentType: 'daily_content',
    status: 'published'
  }).lean();

  return {
    configured,
    connected: conn.connected,
    supported: true, // Native Baileys v7 newsletter protocol support verified
    channelJid: cachedChannelJid || null,
    channelUrl: cachedChannelUrl || null,
    name: channelName,
    subscribers: subscriberCount,
    description,
    todayDailyPublished: Boolean(todayPublished),
    latestPublication: latestPublication ? {
      publicationId: latestPublication.publicationId,
      contentType: latestPublication.contentType,
      title: latestPublication.title,
      status: latestPublication.status,
      publishedAt: latestPublication.publishedAt,
      createdAt: latestPublication.createdAt
    } : null
  };
}

/**
 * Core primitive: Send update to Channel with strict destination verification
 */
async function sendToChannelDirect(payload, maxRetries = 3) {
  if (!cachedChannelJid) {
    throw new Error('WhatsApp Channel JID is not configured. Please set WHATSAPP_CHANNEL_JID or configure via Admin Dashboard.');
  }

  const conn = getConnectionStatus();
  if (!conn.connected) {
    throw new Error('WhatsApp connection is currently offline. Cannot publish to Channel.');
  }

  let attempt = 0;
  let lastErr = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      if (payload.media) {
        const ok = await sendWhatsAppRouted({
          destination: DESTINATION.CHANNEL,
          recipient: cachedChannelJid,
          message: payload.caption || '',
          media: payload.media
        });
        if (ok) return { success: true, attempts: attempt };
      } else {
        const ok = await sendWhatsAppRouted({
          destination: DESTINATION.CHANNEL,
          recipient: cachedChannelJid,
          message: payload.text
        });
        if (ok) return { success: true, attempts: attempt };
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[WhatsApp Channel] Publishing attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  throw new Error(`Channel publishing failed after ${maxRetries} attempts: ${lastErr?.message}`);
}

/**
 * Publish a text update to the Channel
 */
async function publishChannelText(text, options = {}) {
  const title = options.title || 'Church Update';
  const publicationId = options.publicationId || `text_${Date.now()}`;
  const dateKey = options.date || new Date().toISOString().slice(0, 10);
  const contentHash = computeContentHash(text);

  // Duplicate Check
  const existing = await WhatsappChannelPublication.findOne({ contentHash, status: 'published' });
  if (existing && !options.force) {
    console.log(`⚡ [WhatsApp Channel] Suppressed duplicate channel publication (${contentHash.slice(0, 10)})`);
    return { success: true, duplicate: true, publicationId: existing.publicationId };
  }

  const record = await WhatsappChannelPublication.create({
    publicationId,
    date: dateKey,
    contentType: options.contentType || 'custom_message',
    contentHash,
    channelJid: cachedChannelJid,
    status: 'pending',
    source: options.source || 'admin_manual',
    triggerType: options.triggerType || 'manual',
    title,
    summary: text.slice(0, 140),
    adminUserId: options.adminUserId || null
  });

  try {
    await sendToChannelDirect({ text });
    record.status = 'published';
    record.publishedAt = new Date();
    await record.save();
    console.log(`✅ [WhatsApp Channel] Published update: "${title}" (${publicationId})`);
    return { success: true, publicationId };
  } catch (err) {
    record.status = 'failed';
    record.errorMessage = err.message;
    await record.save();
    throw err;
  }
}

/**
 * Publish an image update with caption to the Channel
 */
async function publishChannelImage(media, caption, options = {}) {
  const title = options.title || 'Church Media';
  const publicationId = options.publicationId || `media_${Date.now()}`;
  const dateKey = options.date || new Date().toISOString().slice(0, 10);
  const contentHash = computeContentHash(caption + (options.mediaUrl || ''));

  const existing = await WhatsappChannelPublication.findOne({ contentHash, status: 'published' });
  if (existing && !options.force) {
    console.log(`⚡ [WhatsApp Channel] Suppressed duplicate media publication (${contentHash.slice(0, 10)})`);
    return { success: true, duplicate: true, publicationId: existing.publicationId };
  }

  const record = await WhatsappChannelPublication.create({
    publicationId,
    date: dateKey,
    contentType: options.contentType || 'custom_message',
    contentHash,
    channelJid: cachedChannelJid,
    status: 'pending',
    source: options.source || 'admin_manual',
    triggerType: options.triggerType || 'manual',
    title,
    summary: (caption || '').slice(0, 140),
    mediaAttached: true,
    mediaType: 'image',
    adminUserId: options.adminUserId || null
  });

  try {
    await sendToChannelDirect({ media, caption });
    record.status = 'published';
    record.publishedAt = new Date();
    await record.save();
    console.log(`✅ [WhatsApp Channel] Published media update: "${title}" (${publicationId})`);
    return { success: true, publicationId };
  } catch (err) {
    record.status = 'failed';
    record.errorMessage = err.message;
    await record.save();
    throw err;
  }
}

/**
 * Format the official Public 4:00 AM Daily Catholic Content for the WhatsApp Channel
 * Present both English + Tamil gracefully.
 * STRICTLY NO CHATBOT PROMPTS (no "choose language", no "reply 1 or 2", no bot menus).
 */
function formatChannelDailyContent(dailyContent) {
  const dateStrEn = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const dateStrTa = new Date().toLocaleDateString('ta-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // 1. Bible Verse
  const verseEn = dailyContent?.bible?.english || '';
  const verseTa = dailyContent?.bible?.tamil || '';
  const verseRef = dailyContent?.bible?.ref || 'Holy Scripture';

  // 2. Saint of the Day
  const saintEn = dailyContent?.saint?.nameEn || dailyContent?.saintName || 'Saint of the Day';
  const saintTa = dailyContent?.saint?.nameTa || dailyContent?.saintNameTa || saintEn;
  const saintFeastEn = dailyContent?.saint?.feastDayEn || dailyContent?.saint?.feastDay || dateStrEn;
  const saintDescEn = (dailyContent?.saint?.descriptionEn || dailyContent?.saint?.description || '').trim();
  const saintDescTa = (dailyContent?.saint?.descriptionTa || '').trim();

  // 3. Mass Readings References
  const readingsRefEn = dailyContent?.massReadings?.english?.liturgicalDate || dailyContent?.massReadings?.english?.firstReading || 'Daily Mass Readings';
  const gospelEn = dailyContent?.massReadings?.english?.gospel || '';
  const gospelSnippetEn = gospelEn.slice(0, 300);

  // 4. Daily Reflection
  const reflEn = (dailyContent?.massReadings?.english?.reflection?.text || dailyContent?.massReadings?.english?.reflection || '').toString().trim();
  const reflTa = (dailyContent?.massReadings?.tamil?.reflection?.text || dailyContent?.massReadings?.tamil?.reflection || '').toString().trim();
  const reflSnippetEn = reflEn.slice(0, 350);
  const reflSnippetTa = reflTa.slice(0, 350);

  const websiteUrl = getSiteUrl(SITE_ROUTES.DAILY_READINGS);

  let msg = `✝️ *ST. JOHN DE BRITTO CHURCH, KALAYARKOIL*
_Official Parish WhatsApp Channel_
📅 ${dateStrEn} | ${dateStrTa}

━━━━━━━━━━━━━━━━━━━━━
📖 *DAILY BIBLE VERSE • இன்றைய இறைவார்த்தை*

"${verseEn}"
_${verseRef}_

${verseTa ? `"${verseTa}"\n_${verseRef}_\n` : ''}
━━━━━━━━━━━━━━━━━━━━━
👑 *SAINT OF THE DAY • இன்றைய புனிதர்*
✨ *${saintEn}*
${saintTa !== saintEn ? `✨ *${saintTa}*\n` : ''}📅 *Feast Day / திருவிழா:* ${saintFeastEn}

${saintDescEn ? `${saintDescEn}\n` : ''}
${saintDescTa ? `🇮🇳 *தமிழ் குறிப்பு:*\n${saintDescTa}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━
📜 *DAILY LITURGY & GOSPEL • திருவழிபாடு*
📖 *Gospel:* ${gospelSnippetEn}${gospelSnippetEn.length >= 300 ? '...' : ''}

━━━━━━━━━━━━━━━━━━━━━
🕊️ *DAILY REFLECTION • ஆன்மீக சிந்தனை*
${reflSnippetEn ? `🇬🇧 *English Reflection:*\n${reflSnippetEn}...\n` : ''}
${reflSnippetTa ? `🇮🇳 *தமிழ் சிந்தனை:*\n${reflSnippetTa}...\n` : ''}
🌐 *Read Complete Liturgy Online:*
${websiteUrl}

— *St. John de Britto Church, Kalayarkoil*
_SJDB Public Church Broadcast_`;

  return msg;
}

/**
 * Publish Daily Catholic Content to WhatsApp Channel (Called at 4:00 AM IST)
 */
async function publishChannelDailyContent(targetDate = new Date(), options = {}) {
  const dateKey = targetDate.toISOString().slice(0, 10);
  const publicationId = `channel_daily_${dateKey}`;

  // 1. Verify Channel configuration
  if (!cachedChannelJid) {
    await initializeChannelConfig();
    if (!cachedChannelJid) {
      console.warn('⚠️ [WhatsApp Channel] Daily 4 AM post skipped: Channel JID is not configured.');
      return { success: false, skipped: true, reason: 'Channel JID not configured' };
    }
  }

  // 2. Check if already published for today
  const existingPub = await WhatsappChannelPublication.findOne({
    date: dateKey,
    contentType: 'daily_content',
    status: 'published'
  });

  if (existingPub && !options.force) {
    console.log(`⚡ [WhatsApp Channel] Today's Daily Catholic Content already published to Channel (${dateKey}). Skipping duplicate.`);
    return { success: true, duplicate: true, publicationId: existingPub.publicationId };
  }

  console.log(`📢 [WhatsApp Channel] Generating 4:00 AM Daily Catholic Content for ${dateKey}...`);

  // 3. Fetch aggregated daily content
  const dailyContent = await getTodayDailyContent(targetDate);
  const textMessage = formatChannelDailyContent(dailyContent);
  const contentHash = computeContentHash(dateKey + textMessage);

  // 4. Create pending publication record
  let record = await WhatsappChannelPublication.findOne({ publicationId });
  if (!record) {
    record = new WhatsappChannelPublication({
      publicationId,
      date: dateKey,
      contentType: 'daily_content',
      contentHash,
      channelJid: cachedChannelJid,
      status: 'pending',
      source: options.source || 'scheduled_cron',
      triggerType: options.triggerType || '4_am_daily',
      title: `Daily Catholic Content — ${dateKey}`,
      summary: `Bible verse, Saint ${dailyContent.saintName || ''}, readings and reflection.`,
      adminUserId: options.adminUserId || null
    });
    await record.save();
  }

  try {
    // 5. Check if Saint portrait image is available
    const saintPayload = getDailySaintImagePayload({ dailyContent, language: 'both' });

    if (saintPayload && saintPayload.buffer) {
      // Send verified Saint portrait with caption
      record.mediaAttached = true;
      record.mediaType = 'image';
      await sendToChannelDirect({
        media: {
          buffer: saintPayload.buffer,
          mimetype: 'image/jpeg',
          fileName: `saint_${dateKey}.jpg`
        },
        caption: `👑 *Saint of the Day: ${dailyContent.saintName || 'Saint'}*\n📅 ${dateKey}`
      });
      await new Promise(r => setTimeout(r, 600));
    }

    // 6. Send the comprehensive Bilingual Liturgy Text
    await sendToChannelDirect({ text: textMessage });

    record.status = 'published';
    record.publishedAt = new Date();
    await record.save();

    console.log(`✅ [WhatsApp Channel] Successfully published 4:00 AM Daily Catholic Content to Channel (${cachedChannelJid})!`);
    return { success: true, publicationId };
  } catch (pubErr) {
    record.status = 'failed';
    record.errorMessage = pubErr.message;
    await record.save();
    console.error('❌ [WhatsApp Channel] Failed publishing 4 AM daily content:', pubErr.message);
    throw pubErr;
  }
}

/**
 * Publish an official Parish Announcement to the WhatsApp Channel
 */
async function publishChannelAnnouncement(announcementId, options = {}) {
  const announcement = await Announcement.findById(announcementId);
  if (!announcement) {
    throw new Error('Announcement not found');
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const publicationId = `announcement_${announcement._id}_${Date.now()}`;
  const title = announcement.title || 'Parish Announcement';
  const bodyText = announcement.content || announcement.description || '';
  const websiteUrl = getSiteUrl(SITE_ROUTES.ANNOUNCEMENTS);

  const formattedMsg = `📢 *PARISH ANNOUNCEMENT • பங்கு அறிவிப்பு*
⛪ *St. John de Britto Church, Kalayarkoil*

📌 *${title}*

${bodyText}

🌐 *Read More on Parish Website:*
${websiteUrl}

— *Parish Office, St. John de Britto Church*
_SJDB Public Church Broadcast_`;

  const contentHash = computeContentHash(formattedMsg);

  const record = await WhatsappChannelPublication.create({
    publicationId,
    date: dateKey,
    contentType: 'announcement',
    contentHash,
    channelJid: cachedChannelJid,
    status: 'pending',
    source: options.source || 'admin_manual',
    triggerType: 'announcement_publish',
    title: `Announcement: ${title}`,
    summary: bodyText.slice(0, 140),
    adminUserId: options.adminUserId || null,
    metadata: { announcementId: announcement._id }
  });

  try {
    if (announcement.image) {
      record.mediaAttached = true;
      record.mediaType = 'image';
      await sendToChannelDirect({
        media: { url: announcement.image },
        caption: formattedMsg
      });
    } else {
      await sendToChannelDirect({ text: formattedMsg });
    }

    record.status = 'published';
    record.publishedAt = new Date();
    await record.save();

    console.log(`✅ [WhatsApp Channel] Published announcement "${title}" to Channel!`);
    return { success: true, publicationId };
  } catch (err) {
    record.status = 'failed';
    record.errorMessage = err.message;
    await record.save();
    throw err;
  }
}

/**
 * Send Test Channel Update (Admin Manual Test)
 * Strictly sends ONLY to the Channel, NEVER to private users!
 */
async function sendTestChannelUpdate(adminUser = null) {
  if (!cachedChannelJid) {
    await initializeChannelConfig();
    if (!cachedChannelJid) {
      throw new Error('WhatsApp Channel JID is not configured. Please enter the Channel JID or Invite Link in the Admin Dashboard.');
    }
  }

  const testMsg = `📢 *TEST CHANNEL UPDATE*
⛪ *St. John de Britto Church, Kalayarkoil*

This is a test message from the official church WhatsApp Channel.
Verifying public broadcast integration with SJDB Connect.

📅 Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST

_SJDB Public Church Broadcast_`;

  return publishChannelText(testMsg, {
    title: 'Test Channel Update',
    contentType: 'test_update',
    source: 'admin_manual',
    triggerType: 'admin_test_button',
    adminUserId: adminUser?._id || null,
    force: true
  });
}

/**
 * Update Channel Settings (JID or Invite Link)
 */
async function updateChannelSettings({ channelJid, channelUrl }) {
  if (channelUrl) {
    cachedChannelUrl = channelUrl.trim();
    await SiteSettings.findOneAndUpdate(
      { key: 'whatsapp_channel_url' },
      { key: 'whatsapp_channel_url', value: cachedChannelUrl, label: 'Official WhatsApp Channel Link', type: 'text' },
      { upsert: true, new: true }
    );
    // If JID not provided, attempt to resolve from URL
    if (!channelJid) {
      await resolveChannelFromInvite(cachedChannelUrl);
    }
  }

  if (channelJid) {
    const cleanJid = channelJid.trim();
    if (!cleanJid.endsWith('@newsletter')) {
      throw new Error('Invalid Channel JID format. A WhatsApp Channel JID must end with @newsletter (e.g. 120363xxxxxxxxxx@newsletter).');
    }
    cachedChannelJid = cleanJid;
    await SiteSettings.findOneAndUpdate(
      { key: 'whatsapp_channel_jid' },
      { key: 'whatsapp_channel_jid', value: cleanJid, label: 'Official WhatsApp Channel JID', type: 'text' },
      { upsert: true, new: true }
    );
  }

  return getChannelStatus();
}

// Auto-initialize on module load
initializeChannelConfig().catch(e => console.warn('[WhatsApp Channel] Init notice:', e.message));

module.exports = {
  initializeChannelConfig,
  getChannelStatus,
  recordDiscoveredChannelJid,
  resolveChannelFromInvite,
  publishChannelText,
  publishChannelImage,
  publishChannelDailyContent,
  publishChannelAnnouncement,
  sendTestChannelUpdate,
  updateChannelSettings,
  formatChannelDailyContent
};
