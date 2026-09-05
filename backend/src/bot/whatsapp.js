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
const QRCode = require('qrcode');
const { handleIncomingMessage } = require('./botHandler');
const { useMongoDBAuthState, clearMongoDBAuthState } = require('./mongoAuthState');

let sock = null; // Active socket instance
let isConnected = false;
let currentQr = null; // Stored QR Code data URL
let isConnecting = false;
let lastConnectedTime = null;
let reconnectTimer = null;
let connectionGeneration = 0;
let shuttingDown = false;
const RECONNECT_BASE_MS = 5000;
const RECONNECT_MAX_MS = 60000;
let reconnectAttempt = 0;

// Active pairing code cache & mutex
let activePairingInfo = null; // { phone, code, requestedAt }
let isPairingInProgress = false;

// ─── Reset / Clear Session ──────────────────────────────────────────────────

async function resetWhatsAppSession() {
  console.log('🔄 Resetting WhatsApp session & clearing MongoDB auth keys...');
  clearReconnectTimer();
  connectionGeneration += 1;
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
  scheduleReconnect(1000);
}

// ─── Force Reconnect (Keep Session) ─────────────────────────────────────────

async function reconnectWhatsApp() {
  console.log('🔄 Reconnecting WhatsApp socket...');
  clearReconnectTimer();
  connectionGeneration += 1;
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

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(delayMs = null) {
  if (shuttingDown || reconnectTimer || isConnecting || isConnected) return;
  const delay = delayMs ?? Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_BASE_MS * Math.pow(2, Math.min(reconnectAttempt, 4))
  );
  reconnectAttempt += 1;
  console.log(`🔄 WhatsApp reconnect scheduled in ${Math.ceil(delay / 1000)}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToWhatsApp().catch(err =>
      console.error('[WhatsApp] Scheduled reconnect failed:', err.message)
    );
  }, delay);
}

async function connectToWhatsApp() {
  if (shuttingDown) return null;
  if (isConnected && sock) return sock;
  if (isConnecting) return sock;

  clearReconnectTimer();
  isConnecting = true;
  const generation = ++connectionGeneration;

  let newSock = null;
  try {
    const { state, saveCreds } = await useMongoDBAuthState();

    let version = [2, 3000, 1043857760];
    try {
      const vRes = await fetchLatestBaileysVersion();
      if (vRes?.version) version = vRes.version;
    } catch (vErr) {
      console.warn('⚠️ Could not fetch remote Baileys version; using fallback version.');
    }

    console.log(`\n📡 SJDB Connect — Connecting to WhatsApp Web (Baileys v${version.join('.')})`);

    newSock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.windows('Desktop'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    sock = newSock;

    newSock.ev.on('connection.update', async (update) => {
      if (generation !== connectionGeneration || newSock !== sock) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQr = await QRCode.toDataURL(qr);
          console.log('📱 WhatsApp QR Code is ready in the Admin Dashboard.');
        } catch (e) {
          currentQr = null;
          console.error('[WhatsApp] QR generation failed:', e.message);
        }
      }

      if (connection === 'open') {
        isConnected = true;
        isConnecting = false;
        currentQr = null;
        activePairingInfo = null;
        isPairingInProgress = false;
        lastConnectedTime = Date.now();
        reconnectAttempt = 0;
        console.log('\n🟢 WhatsApp connected! SJDB Connect bot is live 24/7.\n');
        return;
      }

      if (connection === 'close') {
        isConnected = false;
        isConnecting = false;
        if (sock === newSock) sock = null;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut &&
          statusCode !== 401;

        console.log(`\n⚠️ WhatsApp disconnected. Code: ${statusCode}. Reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          scheduleReconnect();
        } else if (!shuttingDown) {
          console.log('🚪 WhatsApp session logged out/invalid. Clearing auth for a new QR/pairing link.');
          try {
            await clearMongoDBAuthState();
          } catch (e) {
            console.error('[WhatsApp] Failed to clear invalid auth state:', e.message);
          }
          currentQr = null;
          activePairingInfo = null;
          scheduleReconnect(1500);
        }
      }
    });

    newSock.ev.on('creds.update', saveCreds);

    newSock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (generation !== connectionGeneration || newSock !== sock || type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.remoteJid === 'status@broadcast') continue;

        if (msg.key.fromMe) {
          const myJid = newSock?.user?.id
            ? newSock.user.id.split(':')[0].replace(/\D/g, '')
            : '';
          const remoteJidNum = msg.key.remoteJid
            ? msg.key.remoteJid.replace(/\D/g, '')
            : '';

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
          ) continue;
        }

        const from = msg.key.remoteJid;
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          '';

        if (!body) continue;

        const phone = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
        const messageId = msg.key?.id || null;
        const messageTimestamp = msg.messageTimestamp || null;

        try {
          await handleIncomingMessage(
            phone,
            body,
            from,
            msg.pushName,
            messageId,
            messageTimestamp
          );
        } catch (err) {
          console.error('❌ Bot handler error:', err.message);
        }
      }
    });

    return newSock;
  } catch (err) {
    if (generation === connectionGeneration) {
      isConnecting = false;
      isConnected = false;
      if (sock && sock === newSock) sock = null;
      console.error('❌ Error during connectToWhatsApp:', err.message);
      scheduleReconnect();
    }
    return null;
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

  const jid = formatJid(phone);
  if (!jid) return false;

  if (isDuplicateOutgoing(jid, text)) {
    console.log(`⚡ [WhatsApp] Suppressed duplicate outgoing message to ${jid}`);
    return true;
  }

  try {
    const hasUrl = text.includes('http://') || text.includes('https://');
    const options = { text };

    if (hasUrl && linkPreviewModule?.getUrlInfo) {
      try {
        const match = text.match(/https?:\/\/[^\s]+/);
        if (match && !match[0].includes('localhost')) {
          const urlInfo = await Promise.race([
            linkPreviewModule.getUrlInfo(match[0], { timeout: 2000 }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Preview timeout')), 2000))
          ]).catch(() => null);

          if (urlInfo && urlInfo.title && !urlInfo.title.includes('404') && !urlInfo.title.includes('Not Found')) {
            options.linkPreview = urlInfo;
          }
        }
      } catch (e) {
        // Fallback to pure text
      }
    }

    // 15-second timeout safety wrapper
    await Promise.race([
      sock.sendMessage(jid, options),
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

  const jid = formatJid(phone);
  if (!jid) return false;

  let url, caption, mimetype, fileName;
  if (typeof mediaArg === 'object' && mediaArg !== null) {
    url = mediaArg.url;
    caption = mediaArg.caption || '';
    mimetype = mediaArg.mimetype || (url?.match(/\.(jpe?g|png|webp)/i) ? 'image/jpeg' : 'image/jpeg');
    fileName = mediaArg.fileName;
  } else {
    url = mediaArg;
    caption = optionalCaption || '';
    mimetype = url?.match(/\.pdf$/i) ? 'application/pdf' : 'image/jpeg';
  }

  if (!url) return false;

  if (isDuplicateOutgoing(jid, `${url}:${caption || ''}`)) {
    console.log(`⚡ [WhatsApp] Suppressed duplicate outgoing media to ${jid}`);
    return true;
  }

  try {
    if (mimetype?.startsWith('image') || url.match(/\.(jpe?g|png|webp|gif)/i)) {
      await sock.sendMessage(jid, { image: { url }, caption });
    } else if (mimetype === 'application/pdf' || url.match(/\.pdf$/i)) {
      await sock.sendMessage(jid, { document: { url }, mimetype: 'application/pdf', fileName: fileName || 'document.pdf', caption });
    } else if (mimetype?.startsWith('audio') || url.match(/\.(mp3|m4a|wav|ogg)/i)) {
      await sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/mp4', ptt: false });
    } else {
      await sock.sendMessage(jid, { image: { url }, caption });
    }
    console.log(`📎 WhatsApp media sent to ${jid}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send media to ${jid}:`, err.message);
    return false;
  }
}

async function sendWhatsAppToUser(userObjOrId, text) {
  try {
    const BotSession = require('../models/BotSession');
    const User = require('../models/User');

    let user = userObjOrId;
    if (typeof userObjOrId === 'string') {
      user = await User.findById(userObjOrId);
    }

    if (!user) return false;

    const phoneDigits = user.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';
    const queryList = [{ linkedUserId: user._id }];
    if (phoneDigits) {
      queryList.push({ phoneNumber: { $regex: phoneDigits } });
    }

    let session = await BotSession.findOne({ $or: queryList });
    let targetJid = session?.phoneNumber || user.phone;

    if (!targetJid && (user.role === 'admin' || user.isAdmin)) {
      const adminUsers = await User.find({ role: 'admin', phone: { $exists: true, $ne: '' } });
      for (const adm of adminUsers) {
        if (adm.phone) {
          targetJid = adm.phone;
          break;
        }
      }
    }

    if (!targetJid) {
      console.warn(`⚠️ No WhatsApp number or session found for user ${user.name}`);
      return false;
    }

    return await sendWhatsAppMessage(targetJid, text);
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

  // Format clean digits only: e.g. 919655639144
  let cleanNumber = String(phoneNumber || '').replace(/\D/g, '');
  while (cleanNumber.startsWith('0')) cleanNumber = cleanNumber.substring(1);
  if (!cleanNumber.startsWith('91') && cleanNumber.length === 10) {
    cleanNumber = '91' + cleanNumber;
  }

  if (!cleanNumber || cleanNumber.length < 10) {
    throw new Error('Please enter a valid WhatsApp phone number with country code (e.g. 919655639144)');
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

function shutdownWhatsApp() {
  shuttingDown = true;
  clearReconnectTimer();
  connectionGeneration += 1;
  isConnected = false;
  isConnecting = false;
  if (sock) {
    try { sock.end(undefined); } catch (e) {}
  }
  sock = null;
}

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

/**
 * Wait for WhatsApp socket to be connected and ready.
 * If connecting or offline, polls up to timeoutMs (default 25s).
 */
async function waitForWhatsAppReady(timeoutMs = 25000) {
  if (isConnected && sock) return true;
  if (!sock && !isConnecting && !shuttingDown) {
    try {
      connectToWhatsApp().catch(() => {});
    } catch (e) {}
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isConnected && sock) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return isConnected && Boolean(sock);
}

module.exports = {
  connectToWhatsApp,
  reconnectWhatsApp,
  resetWhatsAppSession,
  requestPairingCode,
  sendWhatsAppMessage,
  sendWhatsAppMedia,
  sendWhatsAppToUser,
  getConnectionStatus,
  getQR,
  waitForWhatsAppReady,
  shutdownWhatsApp
};
