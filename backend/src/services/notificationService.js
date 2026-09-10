const { sendMail } = require('../config/mailer');
const { sendSMS, sendWhatsApp } = require('../config/twilio');
const { sendPushToUser, sendPushBroadcast } = require('./webPushService');
const Notification = require('../models/Notification');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

const createNotification = async ({ userId, isBroadcast, title, message, type, category, priority, recipient, actionUrl, relatedId, relatedModel, fileUrl, channels = [] }) => {
  try {
    const { getSystemState } = require('./systemStateService');
    const systemState = await getSystemState();

    if (systemState && systemState.status !== 'live') {
      const allowedCategories = ['maintenance', 'emergency', 'security', 'system', 'admin', 'auth', 'permission', 'lockout'];
      const notifType = String(type || '').toLowerCase();
      const notifCat = String(category || '').toLowerCase();
      const isAllowed = allowedCategories.some(c => notifType.includes(c) || notifCat.includes(c)) || priority === 'urgent' || priority === 'critical' || recipient === 'admin';

      if (!isAllowed) {
        console.log(`[NotificationService] Restricting routine notification during ${systemState.status.toUpperCase()} mode: "${title}"`);
        return null;
      }
    }

    const notif = await Notification.create({
      userId,
      isBroadcast: isBroadcast || false,
      title,
      message,
      type: type || 'general',
      category: category || type || 'general',
      priority: priority || 'low',
      recipient: recipient || 'user',
      actionUrl,
      relatedId,
      relatedModel,
      fileUrl,
      sentVia: channels
    });

    // ── Unified Push Notification Channel ─────────────────────────────────────
    // Whatever notification is created for a user automatically triggers a Push Notification with notificationId
    const shouldSendPush = channels.includes('push') || (!channels.length && notif.recipient === 'user') || notif.isBroadcast;
    if (shouldSendPush) {
      const pushPayload = {
        title: title || "St. John de Britto's Church",
        body: (message || '').replace(/\n+/g, ' ').slice(0, 140),
        notificationId: notif._id.toString(),
        url: `/notifications?notification=${notif._id.toString()}`,
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: `sjdb-notif-${notif._id.toString()}`
      };

      if (isBroadcast || (recipient === 'user' && !userId)) {
        sendPushBroadcast(pushPayload).catch(err => console.warn('[NotificationService] Push broadcast error:', err.message));
      } else if (userId) {
        sendPushToUser(userId, pushPayload).catch(err => console.warn('[NotificationService] Push user error:', err.message));
      }
    }

    // ── Email channel ──────────────────────────────────────────────────────
    const shouldSendEmail = (channels && channels.length > 0)
      ? channels.includes('email')
      : (isBroadcast || (recipient === 'user' && userId));
    if (shouldSendEmail) {
      let recipientEmails = [];
      if (userId) {
        const u = await User.findById(userId);
        if (u?.email) recipientEmails.push(u.email);
      } else if (isBroadcast || recipient === 'user') {
        const users = await User.find({ email: { $exists: true, $ne: null } }).select('email settings');
        recipientEmails = users
          .filter(u => u.email && u.settings?.notifications?.email !== false)
          .map(u => u.email);
      }

      if (recipientEmails.length > 0) {
        const attachments = [];
        if (fileUrl) {
          const absolutePath = path.join(__dirname, '..', '..', fileUrl);
          if (fs.existsSync(absolutePath)) {
            attachments.push({ filename: path.basename(fileUrl), path: absolutePath });
          }
        }

        const clientUrl = (process.env.CLIENT_URL || 'https://stjb-church.vercel.app').replace('http://localhost:5173', 'https://stjb-church.vercel.app');
        const targetUrl = actionUrl ? (actionUrl.startsWith('http') ? actionUrl : `${clientUrl}${actionUrl}`) : `${clientUrl}/dashboard`;

        recipientEmails.forEach(toEmail => {
          sendMail({
            to: toEmail,
            subject: `${title} — St. John de Britto's Church`,
            attachments,
            html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fb;padding:40px 20px;">
  <div style="max-width:650px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 35px rgba(0,0,0,0.12);border:1px solid #e5e7eb;">
    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%);padding:35px 25px;text-align:center;">
      <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;margin:0 auto 15px;border:3px solid #fbbf24;box-shadow:0 6px 16px rgba(0,0,0,0.25);background:#ffffff;">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%;height:100%;object-fit:cover;display:block;" />
      </div>
      <h1 style="color:#fbbf24;margin:0;font-size:26px;font-weight:800;letter-spacing:0.5px;">St. John de Britto's Church</h1>
      <p style="color:#ffffff;margin:5px 0 0;font-size:14px;opacity:0.95;font-weight:500;">புனித அருளானந்தர் தேவாலயம்</p>
      <div style="width:80px;height:4px;background:#fbbf24;border-radius:999px;margin:15px auto 0;"></div>
    </div>
    <!-- BODY -->
    <div style="padding:40px 35px;color:#374151;line-height:1.8;">
      <h2 style="color:#1e3a8a;margin-top:0;font-size:24px;margin-bottom:20px;">${title}</h2>
      <div style="background:#f9fafb;border-left:5px solid #1e3a8a;padding:22px;border-radius:12px;margin-bottom:30px;">
        <p style="margin:0;font-size:16px;color:#374151;white-space:pre-line;">${message}</p>
      </div>
      ${fileUrl ? `
        <div style="background:#fff7ed;border:1px dashed #d97706;padding:15px;border-radius:10px;text-align:center;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#92400e;font-weight:bold;"> Your document is attached to this email.</p>
        </div>
      ` : ''}
      <div style="text-align:center;margin:25px 0;">
        <a href="${targetUrl}" style="background:#1e3a8a;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">View Details →</a>
      </div>
      <!-- DYNAMIC_BIBLE_VERSE -->
    </div>
    <!-- FOOTER -->
    <div style="background:#111827;padding:28px 20px;text-align:center;color:#d1d5db;font-size:13px;">
      <p style="margin:0 0 8px;">St. John de Britto's Church, Kalayarkoil</p>
      <p style="margin:0 0 15px;">Tamil Nadu - 630551</p>
      <div style="width:100%;height:1px;background:rgba(255,255,255,0.08);margin:18px 0;"></div>
      <p style="margin:0;font-size:12px;color:#9ca3af;">"May the peace of Christ be with you always."</p>
    </div>
  </div>
</div>`
          }).catch(err => console.error(` Email failed to ${toEmail}:`, err.message));
        });
      }
    }

    // ── SMS channel ────────────────────────────────────────────────────────
    if (channels.includes('sms') && userId) {
      const user = await User.findById(userId);
      if (user?.phone) {
        let formattedPhone = user.phone.trim();
        if (formattedPhone.length === 10 && !formattedPhone.startsWith('+')) {
          formattedPhone = `+91${formattedPhone}`;
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = `+${formattedPhone}`;
        }
        sendSMS(formattedPhone, `${title}\n\n${message}`)
          .then(res => console.log(res.success ? ` SMS sent to ${formattedPhone}` : ` SMS failed: ${res.error}`))
          .catch(err => console.error(` SMS error:`, err.message));
      }
    }

    // ── WhatsApp channel ───────────────────────────────────────────────────
    if (channels.includes('whatsapp') && userId) {
      const user = await User.findById(userId);
      if (user?.phone) {
        let formattedPhone = user.phone.trim();
        if (formattedPhone.length === 10 && !formattedPhone.startsWith('+')) {
          formattedPhone = `+91${formattedPhone}`;
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = `+${formattedPhone}`;
        }
        const fullFileUrl = fileUrl ? `${process.env.BACKEND_URL || 'http://localhost:5000'}${fileUrl}` : null;
        const waMsg = `*${title}*\n\n${message}${actionUrl ? `\n\n ${process.env.CLIENT_URL || 'http://localhost:5173'}${actionUrl}` : ''}`;
        sendWhatsApp(formattedPhone, waMsg, fullFileUrl)
          .then(res => console.log(res.success ? ` WhatsApp sent to ${formattedPhone}` : ` WhatsApp failed: ${res.error}`))
          .catch(err => console.error(` WhatsApp error:`, err.message));
      }
    }

    return notif;
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

const notifyAdmins = async ({ title, message, fileUrl }) => {
  try {
    const admins = await User.find({ role: 'admin' });
    const attachments = [];
    if (fileUrl) {
      const absolutePath = path.join(__dirname, '..', '..', fileUrl);
      if (fs.existsSync(absolutePath)) {
        attachments.push({ filename: path.basename(fileUrl), path: absolutePath });
      }
    }

    for (const admin of admins) {
      if (admin.email) {
        await sendMail({
          to: admin.email,
          subject: `Admin Alert: ${title}`,
          attachments,
          html: `
<div style="background:#f1f5f9; padding:20px 10px; font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%); padding:28px 20px; text-align:center; color:#ffffff;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0; font-size:20px; font-weight:800;">St. John de Britto's Church</h1>
      <p style="color:#e2e8f0; margin:4px 0 0; font-size:12.5px; font-weight:500;">Administrative Notification</p>
    </div>
    <div style="padding:24px 20px; color:#334155; line-height:1.6;">
      <h2 style="color:#1e3a8a; margin-top:0; font-size:18px;">${title}</h2>
      <div style="background:#f8fafc; border-left:4px solid #1e3a8a; padding:16px; border-radius:8px; margin:16px 0; font-size:13.5px;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      ${fileUrl ? `<p style="font-size:13.5px; color:#1e3a8a; font-weight:700;">The document / receipt is attached to this email.</p>` : ''}
      <!-- DYNAMIC_BIBLE_VERSE -->
    </div>
    <div style="background:#0f172a; padding:16px 18px; text-align:center; color:#94a3b8; font-size:11px;">
      <p style="margin:0;">St. John de Britto's Church, Kalayarkoil • Administrative System</p>
    </div>
  </div>
</div>`
        });
      }
      if (admin.phone) {
        const fullFileUrl = fileUrl ? `${process.env.BACKEND_URL || 'http://localhost:5000'}${fileUrl}` : '';
        await sendWhatsApp(admin.phone, ` *${title}*\n\n${message}${fullFileUrl ? `\n\n Receipt: ${fullFileUrl}` : ''}`);
      }
    }
  } catch (err) {
    console.error('Admin notification error:', err.message);
  }
};

module.exports = { createNotification, notifyAdmins };
