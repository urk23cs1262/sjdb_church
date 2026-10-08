/**
 * SJDB Connect — Baileys WhatsApp Connection
 * 
 * Manages the persistent WhatsApp Web session using Baileys.
 * Supports both QR Code scan and Phone Number Pairing Code.
 * Session keys are saved to MongoDB Atlas so credentials persist across restarts.
 *
 * Usage:
 * const { sendWhatsAppMessage, sendWhatsAppMedia, requestPairingCode } = require('./whatsapp');
 */

const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getChurchEmail } = require('../config/contactConfig');
const QRCode = require('qrcode');
const { handleIncomingMessage } = require('./botHandler');
const { useMongoDBAuthState, clearMongoDBAuthState } = require('./mongoAuthState');

// ─── Destination Types (Enforces Architectural Separation) ───────────────────
const DESTINATION = Object.freeze({
  BOT_PRIVATE: 'BOT_PRIVATE', // Interactive 1-on-1 private bot conversation
  CHANNEL: 'CHANNEL',         // Official 1-way public church WhatsApp Channel (@newsletter)
  GROUP: 'GROUP'              // Group broadcast
});

/**
 * Strict Channel / Newsletter JID Detection Helper
 * Returns true if the JID belongs to a WhatsApp Channel / Newsletter or Broadcast stream.
 */
function isChannelJid(jid) {
  if (!jid || typeof jid !== 'string') return false;
  const clean = jid.toLowerCase().trim();
  if (clean.includes('@newsletter') || clean.endsWith('@newsletter')) return true;
  if (clean.includes('@broadcast') || clean.endsWith('@broadcast')) return true;
  const configuredJid = (process.env.WHATSAPP_CHANNEL_JID || '').toLowerCase().trim();
  if (configuredJid && (clean === configuredJid || clean.includes(configuredJid))) return true;
  return false;
}

let sock = null; // Active socket instance
let isConnected = false;
let currentQr = null; // Stored QR Code data URL
let isConnecting = false;
let lastConnectedTime = null;

// Active pairing code cache & mutex
let activePairingInfo = null; // { phone, code, requestedAt }
let isPairingInProgress = false;

// ─── Reset / Clear Session ──────────────────────────────────────────────────

async function resetWhatsAppSession() {
  console.log('🔄 Resetting WhatsApp session & clearing MongoDB auth keys...');
  activePairingInfo = null;
  isPairingInProgress = false;

  if (sock) {
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.end(undefined);
    } catch (e) { }
    sock = null;
  }
  isConnected = false;
  currentQr = null;
  lastConnectedTime = null;
  await clearMongoDBAuthState();
  setTimeout(connectToWhatsApp, 1000);
}

// ─── Force Reconnect (Keep Session) ─────────────────────────────────────────

async function reconnectWhatsApp() {
  console.log('🔄 Reconnecting WhatsApp socket...');
  if (sock) {
    try {
      sock.end(undefined);
    } catch (e) { }
    sock = null;
  }
  isConnected = false;
  isConnecting = false;
  currentQr = null;
  return connectToWhatsApp();
}

// ─── Connect to WhatsApp ────────────────────────────────────────────────────

async function connectToWhatsApp() {
  if (isConnecting) return sock;
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMongoDBAuthState();

    let version = [2, 3000, 1043857760];
    try {
      const vRes = await fetchLatestBaileysVersion();
      if (vRes?.version) version = vRes.version;
    } catch (vErr) {
      console.warn('⚠️ Could not fetch remote Baileys version, using latest default version.');
    }

    console.log(`\n📡 SJDB Connect — Connecting to WhatsApp Web (Baileys v${version.join('.')})`);

    // Use canonical Browsers.windows('Desktop') to prevent WhatsApp pairing rejections
    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.windows('Desktop'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    // ── QR Code & Connection Lifecycle ─────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('📱 New WhatsApp QR Code generated for Admin Dashboard.');
        try {
          currentQr = await QRCode.toDataURL(qr);
          console.log('✅ QR Code Data URL ready for Web Dashboard!');
        } catch (e) {
          currentQr = null;
        }
      }

      if (connection === 'close') {
        isConnected = false;
        isConnecting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

        console.log(`\n⚠️ WhatsApp disconnected. Code: ${statusCode}. Reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          console.log('🔄 Reconnecting in 5 seconds...');
          setTimeout(connectToWhatsApp, 5000);
        } else {
          console.log('🚪 Logged out or session invalid. Resetting auth state for fresh QR/pairing...');
          resetWhatsAppSession();
        }
      }

      if (connection === 'open') {
        isConnected = true;
        isConnecting = false;
        currentQr = null;
        activePairingInfo = null;
        isPairingInProgress = false;
        lastConnectedTime = Date.now();
        console.log('\n🟢 WhatsApp connected! SJDB Connect bot is live.\n');
      }
    });

    // ── Save credentials on update ────────────────────────────────────────────
    sock.ev.on('creds.update', saveCreds);

    // ── Incoming Messages ──────────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.key || !msg.key.remoteJid) continue;

        const remoteJid = String(msg.key.remoteJid || '').trim();
        const participant = String(msg.key.participant || msg.participant || '').trim();

        // ── ROUTE 1: WHATSAPP CHANNEL / NEWSLETTER & BROADCAST ──────────────
        // Absolute Separation Rule: WhatsApp Channels use the '@newsletter' server.
        // Channels are read-only public broadcasts. They MUST NEVER trigger the interactive SJDB Connect bot!
        if (
          isChannelJid(remoteJid) ||
          isChannelJid(participant) ||
          msg.broadcast === true ||
          remoteJid === 'status@broadcast' ||
          msg.message?.newsletterAdminInviteMessage
        ) {
          if (isChannelJid(remoteJid)) {
            console.log(`📢 [WhatsApp Channel] Channel activity detected on JID: ${remoteJid} (Dropped from bot processing)`);
            try {
              const { recordDiscoveredChannelJid } = require('../services/whatsappChannelService');
              recordDiscoveredChannelJid(remoteJid);
            } catch (e) {
              console.warn('[WhatsApp Channel] Error auto-recording channel JID:', e.message);
            }
          }
          // Absolute separation rule: DO NOT process channel posts as user bot messages!
          continue;
        }

        // ── ROUTE 2: WHATSAPP GROUP ─────────────────────────────────────────
        if (remoteJid.endsWith('@g.us')) {
          // Ignore group messages for private bot onboarding
          continue;
        }

        if (msg.key.fromMe) {
          const myJid = sock?.user?.id ? sock.user.id.split(':')[0].replace(/\D/g, '') : '';
          const remoteJidNum = msg.key.remoteJid ? msg.key.remoteJid.replace(/\D/g, '') : '';

          if (!myJid || myJid.slice(-10) !== remoteJidNum.slice(-10)) continue;

          const textContent =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            '';

          if (
            textContent.includes('Welcome to SJDB Connect') ||
            textContent.includes('Choose your preferred language') ||
            textContent.includes("You're all set!") ||
            textContent.includes('Please reply with valid numbers') ||
            textContent.includes('Please reply with *1*') ||
            textContent.includes('unsubscribed from SJDB Connect') ||
            textContent.includes('New Church Event') ||
            textContent.includes('New Church Announcement') ||
            textContent.includes('Updated Church Event') ||
            textContent.includes('Updated Parish Announcement')
          ) {
            continue;
          }
        }

        const from = msg.key.remoteJid;
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        if (!body) continue;

        const phone = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
        const messageId = msg.key?.id || null;
        const messageTimestamp = msg.messageTimestamp || null;

        try {
          if (sock && from) {
            sock.sendPresenceUpdate('composing', from).catch(() => {});
          }
          await handleIncomingMessage(phone, body, from, msg.pushName, messageId, messageTimestamp);
        } catch (err) {
          console.error('❌ Bot handler error:', err.message);
        } finally {
          if (sock && from) {
            sock.sendPresenceUpdate('paused', from).catch(() => {});
          }
        }
      }
    });

    return sock;
  } catch (err) {
    isConnecting = false;
    console.error('❌ Error during connectToWhatsApp:', err.message);
  }
}

// ─── Send Text Message ────────────────────────────────────────────────────────

function formatJid(phone) {
  if (!phone) return null;
  if (phone.includes('@')) return phone;
  let number = String(phone).replace(/\D/g, '');
  while (number.startsWith('0')) {
    number = number.substring(1);
  }
  if (!number.startsWith('91') && number.length === 10) {
    number = '91' + number;
  }
  return `${number}@s.whatsapp.net`;
}

let linkPreviewModule = null;
try {
  linkPreviewModule = require('link-preview-js');
} catch (e) {
  // Graceful fallback if link-preview-js is missing
}

// Short-window outgoing duplicate suppression (prevents double-tap/retry outgoing echoes)
const recentOutgoingSends = new Map();
function isDuplicateOutgoing(jid, key) {
  const now = Date.now();
  const dedupKey = `${jid}:${key}`;
  const lastSent = recentOutgoingSends.get(dedupKey);
  if (lastSent && (now - lastSent) < 1500) {
    return true;
  }
  recentOutgoingSends.set(dedupKey, now);
  if (recentOutgoingSends.size > 1000) {
    for (const [k, ts] of recentOutgoingSends.entries()) {
      if (now - ts > 20000) recentOutgoingSends.delete(k);
    }
  }
  return false;
}

async function sendWhatsAppMessage(phone, text) {
  if (!sock || !isConnected) {
    console.warn(`⚠️ WhatsApp not connected. Message to ${phone} skipped.`);
    return false;
  }

  // Strict Destination Guard: Private helper must NEVER send to WhatsApp Channel
  if (isChannelJid(phone)) {
    console.error(`🚨 [CRITICAL ROUTING BLOCKED] Blocked attempt to call private sendWhatsAppMessage with Channel JID (${phone})!`);
    return false;
  }

  const jid = formatJid(phone);
  if (!jid || isChannelJid(jid)) {
    console.error(`🚨 [CRITICAL ROUTING BLOCKED] Blocked attempt to call private sendWhatsAppMessage with Channel JID (${jid})!`);
    return false;
  }

  if (isDuplicateOutgoing(jid, text)) {
    console.log(`⚡ [WhatsApp] Suppressed duplicate outgoing message to ${jid}`);
    return true;
  }

  try {
    // Send message directly without blocking on external link preview scrapers for lightning-fast replies
    await Promise.race([
      sock.sendMessage(jid, { text }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp send timeout (15s)')), 15000))
    ]);
    console.log(`✉️ WhatsApp sent to ${jid}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp to ${jid}:`, err.message);
    return false;
  }
}

async function sendWhatsAppMedia(phone, mediaArg, optionalCaption) {
  if (!sock || !isConnected) {
    console.warn(`⚠️ WhatsApp not connected. Media to ${phone} skipped.`);
    return false;
  }

  // Strict Destination Guard: Private helper must NEVER send to WhatsApp Channel
  if (isChannelJid(phone)) {
    console.error(`🚨 [CRITICAL ROUTING BLOCKED] Blocked attempt to call private sendWhatsAppMedia with Channel JID (${phone})!`);
    return false;
  }

  const jid = formatJid(phone);
  if (!jid || isChannelJid(jid)) {
    console.error(`🚨 [CRITICAL ROUTING BLOCKED] Blocked attempt to call private sendWhatsAppMedia with Channel JID (${jid})!`);
    return false;
  }

  let url, caption, mimetype, fileName, buffer;
  if (typeof mediaArg === 'object' && mediaArg !== null) {
    url = mediaArg.url;
    buffer = mediaArg.buffer;
    caption = mediaArg.caption || '';
    mimetype = mediaArg.mimetype || (buffer || url?.match(/\.pdf$/i) ? 'application/pdf' : 'image/jpeg');
    fileName = mediaArg.fileName;
  } else {
    url = mediaArg;
    caption = optionalCaption || '';
    mimetype = url?.match(/\.pdf$/i) ? 'application/pdf' : 'image/jpeg';
  }

  if (!url && !buffer) return false;

  // If url is a local file path and no buffer is passed, read into Buffer for 100% reliable Baileys transfer
  if (!buffer && url && typeof url === 'string') {
    try {
      let resolvedPath = url;
      if (url.startsWith('/uploads/')) {
        const p1 = path.join(__dirname, '../../', url);
        if (fs.existsSync(p1)) {
          resolvedPath = p1;
        } else {
          const p2 = path.join(process.cwd(), url);
          if (fs.existsSync(p2)) resolvedPath = p2;
        }
      }
      if (fs.existsSync(resolvedPath)) {
        buffer = fs.readFileSync(resolvedPath);
        if (!fileName) fileName = path.basename(resolvedPath);
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        const resp = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        });
        if (resp.status === 200 && resp.data && resp.data.length > 200) {
          buffer = Buffer.from(resp.data);
          if (!fileName) {
            try { fileName = path.basename(new URL(url).pathname); } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.warn('[WhatsApp] Could not read local/remote media buffer:', e.message);
    }

    // Local fallback for saint images if download failed
    if (!buffer && (url?.includes('saint') || caption?.includes('Saint') || caption?.includes('புனிதர்'))) {
      try {
        const dir1 = path.join(__dirname, '../../uploads/saints');
        const dir2 = path.join(process.cwd(), 'uploads/saints');
        const sDir = fs.existsSync(dir1) ? dir1 : fs.existsSync(dir2) ? dir2 : null;
        if (sDir) {
          const files = fs.readdirSync(sDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
          if (files.length > 0) {
            buffer = fs.readFileSync(path.join(sDir, files[0]));
            if (!fileName) fileName = files[0];
          }
        }
      } catch (e) {}
    }
  }

  const dupKey = buffer ? `buf:${fileName || 'doc'}:${caption || ''}` : `${url}:${caption || ''}`;
  if (isDuplicateOutgoing(jid, dupKey)) {
    console.log(`⚡ [WhatsApp] Suppressed duplicate outgoing media to ${jid}`);
    return true;
  }

  try {
    const isPdf = mimetype === 'application/pdf' || (url && url.match(/\.pdf$/i)) || (fileName && fileName.endsWith('.pdf'));
    if (isPdf) {
      const docPayload = buffer ? buffer : { url };
      await sock.sendMessage(jid, { document: docPayload, mimetype: 'application/pdf', fileName: fileName || 'document.pdf', caption });
    } else if (mimetype?.startsWith('image') || (url && url.match(/\.(jpe?g|png|webp|gif)/i))) {
      const imgPayload = buffer ? buffer : { url };
      await sock.sendMessage(jid, { image: imgPayload, caption });
    } else if (mimetype?.startsWith('audio') || (url && url.match(/\.(mp3|m4a|wav|ogg)/i))) {
      const audioPayload = buffer ? buffer : { url };
      await sock.sendMessage(jid, { audio: audioPayload, mimetype: 'audio/mp4', ptt: false });
    } else {
      const docPayload = buffer ? buffer : { url };
      await sock.sendMessage(jid, { document: docPayload, mimetype: mimetype || 'application/octet-stream', fileName: fileName || 'file', caption });
    }
    console.log(`📎 WhatsApp media sent to ${jid}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send media to ${jid}:`, err.message);
    return false;
  }
}

async function sendWhatsAppDocument(phone, docOptions) {
  if (isChannelJid(phone)) {
    console.error(`🚨 [CRITICAL ROUTING BLOCKED] Blocked attempt to send document to Channel JID (${phone})!`);
    return false;
  }
  if (typeof docOptions === 'string') {
    return sendWhatsAppMedia(phone, { url: docOptions, mimetype: 'application/pdf' });
  }
  return sendWhatsAppMedia(phone, { ...docOptions, mimetype: 'application/pdf' });
}

async function sendWhatsAppNotification(userOrPhone, notification, options = {}) {
  const { sendWhatsAppNotification: dispatchNotif } = require('../services/whatsAppNotificationService');
  return dispatchNotif(userOrPhone, notification, options);
}

async function sendWhatsAppToUser(userObjOrId, text, options = {}) {
  try {
    const res = await sendWhatsAppNotification(userObjOrId, text, options);
    return res && res.success !== false;
  } catch (err) {
    console.error('❌ Error sending WhatsApp to user:', err.message);
    return false;
  }
}

// ─── Pairing Code (Single Socket & Canonical Browser) ─────────────────────────

async function requestPairingCode(phoneNumber) {
  if (isConnected) {
    throw new Error('WhatsApp is already connected!');
  }

  // Format clean digits only: e.g. 919876543210
  let cleanNumber = String(phoneNumber || '').replace(/\D/g, '');
  while (cleanNumber.startsWith('0')) cleanNumber = cleanNumber.substring(1);
  if (!cleanNumber.startsWith('91') && cleanNumber.length === 10) {
    cleanNumber = '91' + cleanNumber;
  }

  if (!cleanNumber || cleanNumber.length < 10) {
    throw new Error('Please enter a valid WhatsApp phone number with country code (e.g. 919876543210)');
  }

  // Return existing valid pairing code if requested within 45 seconds for the same phone
  const now = Date.now();
  if (
    activePairingInfo &&
    activePairingInfo.phone === cleanNumber &&
    now - activePairingInfo.requestedAt < 45000
  ) {
    console.log(`ℹ️ Returning active pairing code for ${cleanNumber}: ${activePairingInfo.code}`);
    return activePairingInfo.code;
  }

  if (isPairingInProgress) {
    throw new Error('A pairing request is already being processed. Please wait a moment.');
  }

  isPairingInProgress = true;

  try {
    if (!sock) {
      await connectToWhatsApp();
    }

    // Wait up to 6 seconds for websocket connection to become open & ready
    let waited = 0;
    while ((!sock || !sock.ws || !sock.ws.isOpen) && waited < 6000) {
      await new Promise(r => setTimeout(r, 400));
      waited += 400;
    }

    if (!sock || !sock.ws?.isOpen) {
      throw new Error('WhatsApp socket initializing. Please wait a few seconds and try again.');
    }

    if (sock.authState?.creds?.registered) {
      throw new Error('WhatsApp session is already registered. If you need to re-link, click Reset Session first.');
    }

    const rawCode = await sock.requestPairingCode(cleanNumber);
    const formattedCode = rawCode ? (rawCode.match(/.{1,4}/g)?.join('-') || rawCode) : rawCode;

    activePairingInfo = {
      phone: cleanNumber,
      code: formattedCode,
      requestedAt: Date.now()
    };

    console.log(`🔑 Generated WhatsApp Pairing Code for ${cleanNumber}: ${formattedCode}`);
    isPairingInProgress = false;
    return formattedCode;
  } catch (err) {
    isPairingInProgress = false;
    console.error(`❌ Failed to generate pairing code for ${cleanNumber}:`, err.message);
    throw new Error(err.message || 'Failed to request pairing code from WhatsApp servers');
  }
}

// ─── Connection Status ────────────────────────────────────────────────────────

function getConnectionStatus() {
  const userJid = sock?.user?.id || '';
  const rawNumber = userJid ? userJid.split(':')[0].split('@')[0].replace(/\D/g, '') : null;
  const userName = sock?.user?.name || null;

  let status = 'disconnected';
  if (isConnected) {
    status = 'connected';
  } else if (isConnecting) {
    status = 'connecting';
  } else if (currentQr) {
    status = 'qr_ready';
  }

  return {
    connected: isConnected,
    status,
    phoneNumber: rawNumber,
    userName,
    lastConnectedAt: lastConnectedTime,
    uptimeSeconds: isConnected && lastConnectedTime ? Math.floor((Date.now() - lastConnectedTime) / 1000) : 0,
    hasQr: !!currentQr,
    sock: !!sock
  };
}

function getQR() {
  return currentQr;
}

function getSocket() {
  return sock;
}

/**
 * Strict Outgoing Message Router
 * Enforces destination separation:
 * - DESTINATION.BOT_PRIVATE: Only '@s.whatsapp.net' or valid phone numbers. Never channels!
 * - DESTINATION.CHANNEL: Only '@newsletter'. Never private users!
 * - DESTINATION.GROUP: Only '@g.us'.
 */
async function sendWhatsAppRouted({ destination, recipient, message, media }) {
  if (!destination) {
    throw new Error('Destination is required. Use DESTINATION.BOT_PRIVATE, DESTINATION.CHANNEL, or DESTINATION.GROUP.');
  }

  // Strict Destination Type Checking
  if (destination === DESTINATION.BOT_PRIVATE) {
    if (recipient && recipient.endsWith('@newsletter')) {
      throw new Error(`CRITICAL ROUTING VIOLATION: Cannot send BOT_PRIVATE message to WhatsApp Channel (${recipient})!`);
    }
    const jid = formatJid(recipient);
    if (!jid || jid.endsWith('@newsletter')) {
      throw new Error(`Invalid private recipient JID: ${recipient}`);
    }

    if (!sock || !isConnected) {
      throw new Error('WhatsApp is not currently connected.');
    }
    if (media) {
      return sendWhatsAppMedia(jid, media, message);
    }
    return sendWhatsAppMessage(jid, message);
  }

  if (destination === DESTINATION.CHANNEL) {
    if (!recipient || !recipient.endsWith('@newsletter')) {
      throw new Error(`CRITICAL ROUTING VIOLATION: Cannot send CHANNEL message to non-channel recipient (${recipient})! Channel JID must end with @newsletter.`);
    }

    if (!sock || !isConnected) {
      throw new Error('WhatsApp is not currently connected.');
    }

    const dedupText = message || (media?.caption || 'media');
    if (isDuplicateOutgoing(recipient, dedupText)) {
      console.log(`⚡ [WhatsApp Channel] Suppressed duplicate outgoing message to ${recipient}`);
      return true;
    }

    try {
      if (media) {
        let mediaPayload = null;
        if (media.buffer) {
          mediaPayload = media.buffer;
        } else if (media.url) {
          mediaPayload = { url: media.url };
        }

        const caption = message || media.caption || '';
        const isPdf = media.mimetype === 'application/pdf' || media.fileName?.endsWith('.pdf');
        const isVideo = media.mimetype?.startsWith('video');

        if (isVideo) {
          await sock.sendMessage(recipient, { video: mediaPayload, caption });
        } else if (isPdf) {
          await sock.sendMessage(recipient, { document: mediaPayload, mimetype: 'application/pdf', fileName: media.fileName || 'document.pdf', caption });
        } else {
          // Default to image
          await sock.sendMessage(recipient, { image: mediaPayload, caption });
        }
      } else {
        await sock.sendMessage(recipient, { text: message });
      }
      console.log(`📢 [WhatsApp Channel] Successfully sent update to channel ${recipient}`);
      return true;
    } catch (err) {
      console.error(`❌ [WhatsApp Channel] Error sending to channel ${recipient}:`, err.message);
      throw err;
    }
  }

  if (destination === DESTINATION.GROUP) {
    if (!recipient || !recipient.endsWith('@g.us')) {
      throw new Error(`Invalid group recipient JID: ${recipient}`);
    }
    if (media) {
      return sendWhatsAppMedia(recipient, media, message);
    }
    return sendWhatsAppMessage(recipient, message);
  }

  throw new Error(`Unknown destination type: ${destination}`);
}

module.exports = {
  DESTINATION,
  isChannelJid,
  connectToWhatsApp,
  reconnectWhatsApp,
  resetWhatsAppSession,
  requestPairingCode,
  sendWhatsAppMessage,
  sendWhatsAppMedia,
  sendWhatsAppDocument,
  sendWhatsAppNotification,
  sendWhatsAppToUser,
  sendWhatsAppRouted,
  getConnectionStatus,
  getQR,
  getSocket
};
