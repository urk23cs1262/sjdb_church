const EventEmitter = require('events');
const { sendMail } = require('../config/mailer');
const { sendSMS, sendWhatsApp: sendTwilioWhatsApp } = require('../config/twilio');
const { sendPushToAdmins, sendPushToUser } = require('./webPushService');
const Notification = require('../models/Notification');
const User = require('../models/User');
const SiteSettings = require('../models/SiteSettings');

class RequestEventEmitter extends EventEmitter {}
const requestEvents = new RequestEventEmitter();

/**
 * Centrally resolves the Church Admin's WhatsApp phone number.
 * Priority order:
 * 1. process.env.ADMIN_WHATSAPP_PHONE
 * 2. Database SiteSettings (key: 'admin_whatsapp_phone')
 * 3. process.env.ADMIN_PHONE
 * 4. Active Admin User record phone in DB
 * 5. Default church phone ('919655639144')
 */
const getAdminWhatsAppNumber = async () => {
  if (process.env.ADMIN_WHATSAPP_PHONE && process.env.ADMIN_WHATSAPP_PHONE.trim()) {
    return process.env.ADMIN_WHATSAPP_PHONE.trim().replace(/\D/g, '');
  }

  try {
    const setting = await SiteSettings.findOne({ key: 'admin_whatsapp_phone' });
    if (setting && setting.value && setting.value.trim()) {
      return setting.value.trim().replace(/\D/g, '');
    }
  } catch (err) {
    // Ignore db setting lookup error
  }

  if (process.env.ADMIN_PHONE && process.env.ADMIN_PHONE.trim()) {
    return process.env.ADMIN_PHONE.trim().replace(/\D/g, '');
  }

  try {
    const adminUser = await User.findOne({ role: 'admin', phone: { $exists: true, $ne: '' } });
    if (adminUser?.phone) {
      return adminUser.phone.trim().replace(/\D/g, '');
    }
  } catch (err) {
    // Ignore db user lookup error
  }

  return '919655639144';
};

/**
 * Normalizes request module metadata, labels, and deep link paths.
 */
const getModuleMeta = (moduleType, requestObj = {}) => {
  const norm = String(moduleType || '').toLowerCase().replace(/[-_ ]/g, '');

  if (norm.includes('mass') || norm.includes('booking') || norm.includes('intention')) {
    const reqId = requestObj.bookingNumber || (requestObj._id ? requestObj._id.toString() : 'MI-REQ');
    return {
      typeLabel: 'Mass Intention',
      icon: '📖',
      intentionLabel: 'Intention',
      deepLinkPath: `/admin/mass-intentions/${reqId}`,
      relatedModel: 'Booking',
      category: 'bookings',
      defaultDetail: requestObj.intentionDetails || requestObj.intentionType || 'Holy Mass Booking'
    };
  }

  if (norm.includes('prayer') || norm.includes('confession')) {
    const isConfession = requestObj.prayerLocation === 'confession' || requestObj.type === 'Confession Request';
    const reqId = requestObj._id ? requestObj._id.toString() : 'PR-REQ';
    return {
      typeLabel: isConfession ? 'Confession & Spiritual Counsel' : 'Prayer Request',
      icon: '🙏',
      intentionLabel: isConfession ? 'Request Details' : 'Prayer Intention',
      deepLinkPath: `/admin/prayer-requests/${reqId}`,
      relatedModel: 'PrayerRequest',
      category: 'prayers',
      defaultDetail: requestObj.intention || requestObj.type || 'Personal Intention'
    };
  }

  if (norm.includes('doc') || norm.includes('certificate')) {
    const reqId = requestObj._id ? requestObj._id.toString() : 'DOC-REQ';
    const typeClean = (requestObj.type || 'Certificate').replace(/_/g, ' ').toUpperCase();
    return {
      typeLabel: `Document (${typeClean})`,
      icon: '📄',
      intentionLabel: 'Document Requested',
      deepLinkPath: `/admin/document-requests/${reqId}`,
      relatedModel: 'Document',
      category: 'documents',
      defaultDetail: requestObj.requestDetails || `${typeClean} Certificate`
    };
  }

  if (norm.includes('ticket') || norm.includes('support') || norm.includes('enquiry') || norm.includes('complaint')) {
    const reqId = requestObj.ticketNumber || (requestObj._id ? requestObj._id.toString() : 'TKT-REQ');
    return {
      typeLabel: 'Support Ticket',
      icon: '🎫',
      intentionLabel: 'Subject & Inquiry',
      deepLinkPath: `/admin/tickets/${reqId}`,
      relatedModel: 'Ticket',
      category: 'tickets',
      defaultDetail: requestObj.subject || requestObj.message || 'Support Inquiry'
    };
  }

  // Generic fallback for any future request module
  const reqId = requestObj.referenceNumber || requestObj.code || (requestObj._id ? requestObj._id.toString() : 'REQ');
  const cleanModule = String(moduleType || 'Request').replace(/_/g, ' ').toUpperCase();
  return {
    typeLabel: cleanModule,
    icon: '🔔',
    intentionLabel: 'Details',
    deepLinkPath: `/admin/${String(moduleType || 'requests').toLowerCase()}/${reqId}`,
    relatedModel: 'Request',
    category: 'requests',
    defaultDetail: requestObj.details || requestObj.description || 'New Service Request'
  };
};

/**
 * Formats a clean reference/request ID for presentation.
 */
const formatRequestId = (requestObj = {}, moduleType = '') => {
  if (requestObj.bookingNumber) return requestObj.bookingNumber;
  if (requestObj.ticketNumber) return requestObj.ticketNumber;
  if (requestObj.referenceNumber) return requestObj.referenceNumber;

  const mongoId = requestObj._id ? requestObj._id.toString() : '';
  const shortId = mongoId ? mongoId.slice(-6).toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();

  const norm = String(moduleType || '').toLowerCase();
  if (norm.includes('mass') || norm.includes('booking')) return `MI-${shortId}`;
  if (norm.includes('prayer')) return `PR-${shortId}`;
  if (norm.includes('doc')) return `DOC-${shortId}`;
  if (norm.includes('ticket')) return `TKT-${shortId}`;

  return `REQ-${shortId}`;
};

/**
 * Builds the canonical client review URL for the admin.
 * Guaranteed to use production website URL, never localhost.
 */
const getAdminReviewUrl = (deepLinkPath) => {
  const { getSiteUrl } = require('../config/siteRoutes');
  return getSiteUrl(deepLinkPath);
};

/**
 * Resolves user deep link path for direct review.
 */
const getUserDeepLinkPath = (moduleType, requestId) => {
  const norm = String(moduleType || '').toLowerCase().replace(/[-_ ]/g, '');
  if (norm.includes('mass') || norm.includes('booking') || norm.includes('intention')) {
    return `/my-requests/mass-intentions/${requestId}`;
  }
  if (norm.includes('prayer') || norm.includes('confession')) {
    return `/my-requests/prayer-requests/${requestId}`;
  }
  if (norm.includes('doc') || norm.includes('certificate')) {
    return `/my-requests/document-requests/${requestId}`;
  }
  if (norm.includes('ticket') || norm.includes('support') || norm.includes('enquiry') || norm.includes('complaint')) {
    return `/my-requests/tickets/${requestId}`;
  }
  return `/my-requests/${String(moduleType || 'request').toLowerCase()}/${requestId}`;
};

/**
 * Builds the canonical client review URL for the user.
 * Guaranteed to use production website URL, never localhost.
 */
const getUserReviewUrl = (deepLinkPath) => {
  const { getSiteUrl } = require('../config/siteRoutes');
  return getSiteUrl(deepLinkPath);
};

/**
 * Resolves appropriate status emoji matching user specification.
 */
const getStatusEmoji = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('approv') || s.includes('confirm')) return '✅';
  if (s.includes('reject') || s.includes('declin')) return '❌';
  if (s.includes('cancel')) return '🚫';
  if (s.includes('complet')) return '🎉';
  if (s.includes('process') || s.includes('progress')) return '⚙️';
  if (s.includes('resolv')) return '🌟';
  if (s.includes('close')) return '🔒';
  if (s.includes('pend') || s.includes('submit')) return '⏳';
  return '🔔';
};

/**
 * Formats a clean capitalized status string (e.g. "Approved", "In Progress").
 */
const formatDisplayStatus = (status) => {
  const s = String(status || 'Pending').toLowerCase().replace(/_/g, ' ');
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Provides a respectful, pastoral default status message for the user if no custom admin note is supplied.
 */
const getDefaultUserStatusMessage = (meta, status, action) => {
  const s = String(status || '').toLowerCase();
  const typeName = meta.typeLabel;
  if (action === 'created') {
    return `Your ${typeName} request has been received and is pending Church review.`;
  }
  if (s.includes('approv') || s.includes('confirm')) {
    return `Your ${typeName} has been approved by the Church.`;
  }
  if (s.includes('reject') || s.includes('declin')) {
    return `Your ${typeName} request could not be approved at this time. Please contact the parish office for further details.`;
  }
  if (s.includes('cancel')) {
    return `Your ${typeName} request has been cancelled.`;
  }
  if (s.includes('complet')) {
    return `Your ${typeName} request has been completed by the Church.`;
  }
  if (s.includes('process') || s.includes('progress')) {
    return `Your ${typeName} request is currently being processed by the parish administration.`;
  }
  if (s.includes('resolv')) {
    return `Your support inquiry has been resolved by Church administration.`;
  }
  if (s.includes('close')) {
    return `Your ticket has been closed.`;
  }
  return `Your ${typeName} request status has been updated to ${formatDisplayStatus(status)}.`;
};

/**
 * Helper to dispatch WhatsApp message via Baileys bot socket, falling back to Twilio.
 */
const dispatchWhatsApp = async (phoneNumber, text) => {
  try {
    const whatsappBot = require('../bot/whatsapp');
    if (whatsappBot && typeof whatsappBot.sendWhatsAppMessage === 'function') {
      const sent = await whatsappBot.sendWhatsAppMessage(phoneNumber, text);
      if (sent) return true;
    }
  } catch (err) {
    console.warn('[RequestNotification] Baileys bot dispatch error:', err.message);
  }

  // Fallback to Twilio if Baileys did not deliver
  try {
    let formatted = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    await sendTwilioWhatsApp(formatted, text);
    return true;
  } catch (tErr) {
    console.warn('[RequestNotification] Twilio WhatsApp fallback error:', tErr.message);
    return false;
  }
};

/**
 * Main Central Dispatcher for Admin Request Notifications.
 */
const notifyAdminRequest = async ({
  action = 'created',
  module: moduleType,
  request = {},
  user: userParam,
  previousStatus,
  newStatus,
  updatedBy,
  note,
  req
}) => {
  try {
    // 1. Resolve User / Parishioner
    let user = userParam;
    if (!user && request.userId) {
      if (typeof request.userId === 'object' && request.userId.name) {
        user = request.userId;
      } else {
        try {
          user = await User.findById(request.userId).select('name parishMemberId familyId email phone anbiyam');
        } catch (uErr) {
          // ignore
        }
      }
    }

    const userName = user?.name || request.personName || request.familyName || request.name || 'Parishioner';
    const memberId = user?.parishMemberId || 'SJDB_M01';
    const familyId = user?.familyId || 'SJDB_FAM';
    const userPhone = user?.phone || request.contactPhone || request.phone || 'N/A';
    const userEmail = user?.email || request.email || 'stjdbchurch@gmail.com';

    // 2. Resolve Module Metadata & IDs
    const meta = getModuleMeta(moduleType, request);
    const requestId = formatRequestId(request, moduleType);
    const reviewUrl = getAdminReviewUrl(meta.deepLinkPath);

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const formattedDateTime = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const currentStatus = (newStatus || request.status || 'Pending').toUpperCase();
    const prevStatusFormatted = previousStatus ? previousStatus.toUpperCase() : null;

    // Resolve details text
    let detailsText = meta.defaultDetail;
    if (request.massDate) {
      const massDateStr = new Date(request.massDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
      detailsText = `${request.intentionType ? request.intentionType.replace(/_/g, ' ') : 'Mass Intention'} (${massDateStr}${request.massTime ? ` at ${request.massTime}` : ''})`;
      if (request.intentionDetails) detailsText += ` — "${request.intentionDetails}"`;
    } else if (request.intention) {
      detailsText = request.intention;
    } else if (request.subject) {
      detailsText = `${request.subject}${request.message ? ` — ${request.message.slice(0, 100)}` : ''}`;
    }

    // 3. Format WhatsApp Bot Message matching exact user specification
    let waMessage = '';
    if (action === 'created') {
      waMessage =
`🔔 *New ${meta.typeLabel} Request*
👤 Name: ${userName}
🆔 Member ID: ${memberId}${familyId && familyId !== 'N/A' ? ` (Family: ${familyId})` : ''}
${meta.icon} ${meta.intentionLabel}: ${detailsText}
📅 Date: ${formattedDate}
🔖 Request ID: ${requestId}
⏳ Status: ${currentStatus}

👉 Review Request:
${reviewUrl}

Please review and take the required action.`;
    } else {
      waMessage =
`🔔 *${meta.typeLabel} Request Status Updated*
👤 Name: ${userName}
🆔 Member ID: ${memberId}
${meta.icon} ${meta.intentionLabel}: ${detailsText}
📅 Date: ${formattedDate}
🔖 Request ID: ${requestId}
${prevStatusFormatted ? `🔄 Previous Status: ${prevStatusFormatted}\n` : ''}⏳ Status: ${currentStatus}${note ? `\n📝 Note: ${note}` : ''}

👉 Review Request:
${reviewUrl}

Please review in the Church Admin Dashboard.`;
    }

    // 4. Send Immediate WhatsApp to Central Admin Phone
    const adminWhatsAppPhone = await getAdminWhatsAppNumber();
    dispatchWhatsApp(adminWhatsAppPhone, waMessage)
      .then(ok => console.log(`[RequestNotification] WhatsApp sent to Admin (${adminWhatsAppPhone}): ${ok ? 'SUCCESS' : 'QUEUED/FAILED'}`))
      .catch(err => console.error('[RequestNotification] WhatsApp error:', err.message));

    // 5. In-App Notification for Admin Panel
    const notifTitle = action === 'created'
      ? `New ${meta.typeLabel} Request (${requestId})`
      : `${meta.typeLabel} ${currentStatus} (${requestId})`;

    const notifMessage = action === 'created'
      ? `${userName} submitted a ${meta.typeLabel}. ID: ${requestId}. Details: ${detailsText.slice(0, 140)}.`
      : `${meta.typeLabel} (${requestId}) status updated to ${currentStatus} for ${userName}.${note ? ` Note: ${note}` : ''}`;

    await Notification.create({
      recipient: 'admin',
      userId: user?._id,
      title: notifTitle,
      message: notifMessage,
      type: meta.category,
      category: 'requests',
      priority: action === 'created' ? 'high' : 'medium',
      actionUrl: meta.deepLinkPath,
      relatedId: request._id,
      relatedModel: meta.relatedModel,
      metadata: {
        action,
        module: moduleType,
        requestId,
        memberId,
        familyId,
        userName,
        userEmail,
        userPhone,
        status: currentStatus,
        previousStatus: prevStatusFormatted,
        details: detailsText,
        reviewUrl,
        timestamp: now
      },
      sentVia: ['whatsapp', 'email', 'push']
    }).catch(err => console.error('[RequestNotification] In-app notification error:', err.message));

    // 6. Web Push Alert to Admin Devices
    sendPushToAdmins({
      title: notifTitle,
      body: notifMessage.slice(0, 120),
      url: meta.deepLinkPath,
      tag: `admin-req-${requestId}`,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: {
        url: meta.deepLinkPath,
        requestId
      }
    }).catch(err => console.warn('[RequestNotification] Push to admins error:', err.message));

    // 7. Rich HTML Email Alert to System Admins
    const primaryAdminEmail = process.env.ADMIN_EMAIL || 'stjdbchurch@gmail.com';
    const adminUsers = await User.find({ role: 'admin' }).select('email name');
    const adminRecipients = [];

    if (!adminUsers.some(a => (a.email || '').toLowerCase() === primaryAdminEmail.toLowerCase())) {
      adminRecipients.push({ email: primaryAdminEmail, name: 'Parish Administrator' });
    }
    for (const adm of adminUsers) {
      if (adm.email && !adminRecipients.some(r => r.email.toLowerCase() === adm.email.toLowerCase())) {
        adminRecipients.push(adm);
      }
    }

    const emailSubject = action === 'created'
      ? `🔔 New ${meta.typeLabel} Request — ${userName} (${requestId})`
      : `🔄 ${meta.typeLabel} Request Updated — ${currentStatus} (${requestId})`;

    const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notifTitle}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo-box { width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; background: #ffffff; overflow: hidden; border: 3px solid #fbbf24; }
    .content { padding: 28px 24px; color: #1e293b; }
    .badge { display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 12px; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(37,99,235,0.3); }
    .footer { background: #0f172a; padding: 18px; text-align: center; color: #94a3b8; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-box">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0 0 4px; font-size:20px; font-weight:800;">St. John de Britto Church</h1>
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600; letter-spacing:0.5px;">ADMINISTRATIVE REQUEST ALERT</p>
    </div>
    <div class="content">
      <div style="margin-bottom:14px;">
        <span class="badge" style="background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe;">
          ${action === 'created' ? '✨ NEW SUBMISSION' : '🔄 STATUS UPDATE'} • ${meta.typeLabel.toUpperCase()}
        </span>
      </div>

      <h2 style="color:#1e3a8a; margin:0 0 14px; font-size:18px; font-weight:800;">
        ${notifTitle}
      </h2>

      <div class="card">
        <div class="row">
          <span class="label">Parishioner Name:</span>
          <span class="val">${userName}</span>
        </div>
        <div class="row">
          <span class="label">Member / Family ID:</span>
          <span class="val font-mono">${memberId} / ${familyId}</span>
        </div>
        <div class="row">
          <span class="label">Contact Mobile:</span>
          <span class="val font-mono">${userPhone}</span>
        </div>
        <div class="row">
          <span class="label">Registered Email:</span>
          <span class="val">${userEmail}</span>
        </div>
        <div class="row">
          <span class="label">Request / Reference ID:</span>
          <span class="val" style="color:#2563eb; font-family:monospace; font-weight:800;">${requestId}</span>
        </div>
        <div class="row">
          <span class="label">Submitted Time:</span>
          <span class="val">${formattedDateTime}</span>
        </div>
        <div class="row">
          <span class="label">Current Status:</span>
          <span class="val" style="color:${currentStatus === 'APPROVED' ? '#16a34a' : currentStatus === 'REJECTED' ? '#dc2626' : '#d97706'}; font-weight:800;">
            ${currentStatus}
          </span>
        </div>
      </div>

      <!-- Details Block -->
      <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:12px; padding:14px 16px; margin-bottom:22px;">
        <div style="font-size:11px; font-weight:800; color:#92400e; text-transform:uppercase; margin-bottom:4px;">
          ${meta.icon} ${meta.intentionLabel}
        </div>
        <div style="font-size:13.5px; color:#78350f; font-weight:600; line-height:1.5;">
          ${detailsText}
        </div>
      </div>

      <!-- Action Button (Direct Secure Deep Link) -->
      <div style="text-align:center; margin:24px 0 10px;">
        <a href="${reviewUrl}" class="btn">
          👉 Review & Process in Admin Dashboard →
        </a>
        <p style="margin:8px 0 0; font-size:11px; color:#94a3b8;">
          (Requires administrator sign-in credentials. Forwarded links remain protected.)
        </p>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Automated Request Management System • Dispatched via WhatsApp, Email & Web Push</p>
    </div>
  </div>
</body>
</html>`;

    for (const recipient of adminRecipients) {
      if (recipient.email) {
        sendMail({
          to: recipient.email,
          subject: emailSubject,
          html: emailHtml
        }).catch(err => console.error(`[RequestNotification] Email alert error to ${recipient.email}:`, err.message));
      }
    }

    return true;
  } catch (err) {
    console.error('[RequestNotification] notifyAdminRequest error:', err.message);
    return false;
  }
};

/**
 * Main Central Dispatcher for User Request-Status Notifications.
 * Delivers across all configured channels:
 * 1. WhatsApp Bot (User WhatsApp)
 * 2. Email (User registered email)
 * 3. In-App / Website Notification (recipient: 'user', userId: user._id)
 * 4. Web Push Notification (sendPushToUser)
 */
const notifyUserRequestStatus = async ({
  action = 'created',
  module: moduleType,
  request = {},
  user: userParam,
  previousStatus,
  newStatus,
  updatedBy,
  note,
  req
}) => {
  try {
    // 1. Resolve User / Parishioner
    let user = userParam;
    if (!user && request.userId) {
      if (typeof request.userId === 'object' && (request.userId.email || request.userId.phone || request.userId.name)) {
        user = request.userId;
      } else {
        try {
          user = await User.findById(request.userId).select('name parishMemberId familyId email phone anbiyam settings');
        } catch (uErr) {
          // ignore
        }
      }
    }

    const userName = user?.name || request.personName || request.familyName || request.name || 'Parishioner';
    const memberId = user?.parishMemberId || request.parishMemberId || null;
    const familyId = user?.familyId || request.familyId || null;
    let userPhone = user?.phone || request.contactPhone || request.phone || null;
    const userEmail = user?.email || request.email || null;

    if (userPhone) {
      userPhone = userPhone.trim().replace(/\D/g, '');
    }

    // 2. Resolve Module Metadata, IDs & Deep Links
    const meta = getModuleMeta(moduleType, request);
    const requestId = formatRequestId(request, moduleType);
    const userDeepLinkPath = getUserDeepLinkPath(moduleType, requestId);
    const userReviewUrl = getUserReviewUrl(userDeepLinkPath);

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const formattedDateTime = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const rawStatus = newStatus || request.status || 'Pending';
    const displayStatus = formatDisplayStatus(rawStatus);
    const statusEmoji = getStatusEmoji(rawStatus);

    // Resolve details text
    let detailsText = meta.defaultDetail;
    if (request.massDate) {
      const massDateStr = new Date(request.massDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
      detailsText = `${request.intentionType ? request.intentionType.replace(/_/g, ' ') : 'Mass Intention'} (${massDateStr}${request.massTime ? ` at ${request.massTime}` : ''})`;
      if (request.intentionDetails) detailsText += ` — "${request.intentionDetails}"`;
    } else if (request.intention) {
      detailsText = request.intention;
    } else if (request.subject) {
      detailsText = `${request.subject}${request.message ? ` — ${request.message.slice(0, 100)}` : ''}`;
    }

    // Resolve user message/reason:
    const messageContent = (note && note.trim()) ? note.trim() : getDefaultUserStatusMessage(meta, rawStatus, action);

    // 3. Format WhatsApp Message matching exact user specification
    const waMessage = action === 'created'
      ? `🔔 *Your ${meta.typeLabel} Request has been Received*
${meta.icon} Request: ${detailsText}
🔖 Request ID: ${requestId}
📅 Date: ${formattedDate}
${statusEmoji} Status: ${displayStatus}
📝 Message: ${messageContent}

👉 View Request:
${userReviewUrl}`
      : `🔔 *Your ${meta.typeLabel} Request has been Updated*
${meta.icon} Request: ${detailsText}
🔖 Request ID: ${requestId}
📅 Date: ${formattedDate}
${statusEmoji} Status: ${displayStatus}
📝 Message: ${messageContent}

👉 View Request:
${userReviewUrl}`;

    // 4. Send Immediate WhatsApp Notification to User's phone
    if (userPhone && userPhone.length >= 10) {
      dispatchWhatsApp(userPhone, waMessage)
        .then(ok => console.log(`[RequestNotification] WhatsApp sent to User (${userPhone}): ${ok ? 'SUCCESS' : 'QUEUED/FAILED'}`))
        .catch(err => console.error(`[RequestNotification] WhatsApp error for user ${userPhone}:`, err.message));
    }

    // 5. In-App Notification for User
    if (user?._id) {
      const notifTitle = action === 'created'
        ? `Your ${meta.typeLabel} Request has been Received`
        : `Your ${meta.typeLabel} Request has been Updated`;

      const notifMessage = `${meta.typeLabel} (${requestId}) is now ${displayStatus}. ${messageContent}`;

      await Notification.create({
        recipient: 'user',
        userId: user._id,
        title: notifTitle,
        message: notifMessage,
        type: meta.category,
        category: 'requests',
        priority: (displayStatus === 'Approved' || displayStatus === 'Rejected') ? 'high' : 'normal',
        actionUrl: userDeepLinkPath,
        relatedId: request._id,
        relatedModel: meta.relatedModel,
        metadata: {
          action,
          module: moduleType,
          requestId,
          status: displayStatus,
          details: detailsText,
          adminMessage: messageContent,
          reviewUrl: userReviewUrl,
          timestamp: now
        },
        sentVia: ['whatsapp', 'email', 'push', 'inApp', 'website']
      }).catch(err => console.error('[RequestNotification] User in-app notification error:', err.message));
    }

    // 6. Web Push Notification to User Devices
    if (user?._id) {
      sendPushToUser(user._id, {
        title: `Request ${action === 'created' ? 'Received' : 'Updated'}: ${meta.typeLabel}`,
        body: `${requestId}: Status is ${displayStatus}. ${messageContent.slice(0, 100)}`,
        url: userDeepLinkPath,
        tag: `user-req-${requestId}`,
        icon: '/favicon.png',
        badge: '/favicon.png',
        data: {
          url: userDeepLinkPath,
          requestId
        }
      }).catch(err => console.warn('[RequestNotification] Push to user error:', err.message));
    }

    // 7. Rich Branded HTML Status Email to User
    if (userEmail && userEmail.includes('@')) {
      const statusColor = rawStatus.toLowerCase().includes('approv') || rawStatus.toLowerCase().includes('confirm')
        ? '#16a34a'
        : rawStatus.toLowerCase().includes('reject') || rawStatus.toLowerCase().includes('declin')
        ? '#dc2626'
        : rawStatus.toLowerCase().includes('complet')
        ? '#7c3aed'
        : '#d97706';

      const emailSubject = action === 'created'
        ? `🔔 Your ${meta.typeLabel} Request has been Received (${requestId})`
        : `🔔 Your ${meta.typeLabel} Request has been Updated: ${displayStatus} (${requestId})`;

      const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo-box { width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; background: #ffffff; overflow: hidden; border: 3px solid #fbbf24; }
    .content { padding: 28px 24px; color: #1e293b; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
    .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 12px; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(37,99,235,0.3); }
    .footer { background: #0f172a; padding: 18px; text-align: center; color: #94a3b8; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-box">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0 0 4px; font-size:20px; font-weight:800;">St. John de Britto Church</h1>
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600; letter-spacing:0.5px;">REQUEST STATUS NOTIFICATION</p>
    </div>
    <div class="content">
      <div style="margin-bottom:16px;">
        <span class="badge" style="background:${statusColor}15; color:${statusColor}; border:1px solid ${statusColor}40;">
          ${statusEmoji} ${displayStatus}
        </span>
      </div>

      <h2 style="color:#1e3a8a; margin:0 0 10px; font-size:18px; font-weight:800;">
        Dear ${userName},
      </h2>
      <p style="margin:0 0 16px; color:#475569; font-size:14px; line-height:1.5;">
        Your <strong>${meta.typeLabel}</strong> request with the church has an update.
      </p>

      <div class="card">
        <div class="row">
          <span class="label">Request Type:</span>
          <span class="val">${meta.typeLabel}</span>
        </div>
        <div class="row">
          <span class="label">Request ID:</span>
          <span class="val" style="color:#2563eb; font-family:monospace; font-weight:800;">${requestId}</span>
        </div>
        <div class="row">
          <span class="label">Current Status:</span>
          <span class="val" style="color:${statusColor}; font-weight:800;">
            ${statusEmoji} ${displayStatus}
          </span>
        </div>
        <div class="row">
          <span class="label">Date / Time:</span>
          <span class="val">${formattedDateTime}</span>
        </div>
        ${memberId ? `
        <div class="row">
          <span class="label">Parish Member ID:</span>
          <span class="val font-mono">${memberId}</span>
        </div>` : ''}
      </div>

      <!-- Request Details -->
      <div style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom:14px;">
        <div style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:4px;">
          ${meta.icon} ${meta.intentionLabel}
        </div>
        <div style="font-size:13.5px; color:#1e293b; font-weight:600; line-height:1.5;">
          ${detailsText}
        </div>
      </div>

      <!-- Church / Admin Message -->
      <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:12px; padding:14px 16px; margin-bottom:22px;">
        <div style="font-size:11px; font-weight:800; color:#92400e; text-transform:uppercase; margin-bottom:4px;">
          📝 Church Message
        </div>
        <div style="font-size:13.5px; color:#78350f; font-weight:600; line-height:1.5;">
          ${messageContent}
        </div>
      </div>

      <!-- Secure Deep Link Button -->
      <div style="text-align:center; margin:26px 0 12px;">
        <a href="${userReviewUrl}" class="btn">
          👉 View & Review Your Request →
        </a>
        <p style="margin:8px 0 0; font-size:11.5px; color:#94a3b8;">
          Click the button above to view complete details on the Church website.
        </p>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Automated Notification • Dispatched via WhatsApp, Email & Web Push</p>
    </div>
  </div>
</body>
</html>`;

      sendMail({
        to: userEmail,
        subject: emailSubject,
        html: emailHtml
      }).catch(err => console.error(`[RequestNotification] User email error to ${userEmail}:`, err.message));
    }

    return true;
  } catch (err) {
    console.error('[RequestNotification] notifyUserRequestStatus error:', err.message);
    return false;
  }
};

// ── Event Bus Listeners ───────────────────────────────────────────────────────
requestEvents.on('request:created', (payload) => {
  Promise.allSettled([
    notifyAdminRequest({ ...payload, action: 'created' }),
    notifyUserRequestStatus({ ...payload, action: 'created' })
  ]).catch(err => {
    console.error('[RequestNotification] Error on request:created event:', err.message);
  });
});

requestEvents.on('request:status_changed', (payload) => {
  Promise.allSettled([
    notifyAdminRequest({ ...payload, action: 'status_changed' }),
    notifyUserRequestStatus({ ...payload, action: 'status_changed' })
  ]).catch(err => {
    console.error('[RequestNotification] Error on request:status_changed event:', err.message);
  });
});

/**
 * Convenience helper to emit a new request creation event.
 */
const emitRequestCreated = (payload) => {
  requestEvents.emit('request:created', payload);
};

/**
 * Convenience helper to emit a request status change event.
 */
const emitRequestStatusChanged = (payload) => {
  requestEvents.emit('request:status_changed', payload);
};

module.exports = {
  requestEvents,
  notifyAdminRequest,
  notifyUserRequestStatus,
  emitRequestCreated,
  emitRequestStatusChanged,
  getAdminWhatsAppNumber,
  getModuleMeta,
  formatRequestId,
  getAdminReviewUrl,
  getUserDeepLinkPath,
  getUserReviewUrl,
  getStatusEmoji,
  formatDisplayStatus,
  getDefaultUserStatusMessage
};
