const EventEmitter = require('events');
const mongoose = require('mongoose');
const { sendMail } = require('../config/mailer');
const { sendSMS, sendWhatsApp: sendTwilioWhatsApp } = require('../config/twilio');
const { sendPushToAdmins, sendPushToUser } = require('./webPushService');
const Notification = require('../models/Notification');
const User = require('../models/User');
const SiteSettings = require('../models/SiteSettings');
const { getSiteUrl } = require('../config/siteRoutes');
const { getAdminPhones, getAdminEmails, getAdminEmail, getWhatsAppAdminNumber, getChurchEmail } = require('../config/contactConfig');

class RequestEventEmitter extends EventEmitter {}
const requestEvents = new RequestEventEmitter();

/**
 * Normalizes any raw phone number string into clean digits with country code.
 * e.g. "09876543210" -> "919876543210", "9876543210" -> "919876543210"
 */
const normalizePhoneNumber = (raw) => {
  if (!raw) return null;
  let clean = String(raw).replace(/\D/g, '');
  if (!clean) return null;
  if (clean.startsWith('0') && clean.length === 11) {
    clean = clean.slice(1);
  }
  if (clean.length === 10) {
    clean = `91${clean}`;
  }
  if (clean.length >= 10 && clean.length <= 15) {
    return clean;
  }
  return null;
};

/**
 * Resolves all distinct administrator phone numbers for WhatsApp broadcasts.
 * Supports 1, 2, 3, or more admins, priests, technical team, and fallback configs.
 */
const getAllAdminPhoneNumbers = async () => {
  const phones = new Set();

  // 1. Environment variables
  if (process.env.ADMIN_WHATSAPP_PHONE) {
    const p = normalizePhoneNumber(process.env.ADMIN_WHATSAPP_PHONE);
    if (p) phones.add(p);
  }
  if (process.env.ADMIN_PHONE) {
    const p = normalizePhoneNumber(process.env.ADMIN_PHONE);
    if (p) phones.add(p);
  }

  // 2. Site settings
  try {
    const setting = await SiteSettings.findOne({ key: 'admin_whatsapp_phone' });
    if (setting?.value) {
      const p = normalizePhoneNumber(setting.value);
      if (p) phones.add(p);
    }
  } catch (err) { }

  // 3. All Admin, Priest, and Staff users registered in database
  try {
    const adminUsers = await User.find({
      $or: [
        { role: { $in: ['admin', 'priest', 'staff'] } },
        { isTechnicalTeam: true }
      ],
      isActive: { $ne: false },
      phone: { $exists: true, $ne: '' }
    }).select('name phone email role');

    for (const adm of adminUsers) {
      const p = normalizePhoneNumber(adm.phone);
      if (p) phones.add(p);
    }
  } catch (err) {
    console.warn('[RequestNotification] Error fetching admin phone numbers from DB:', err.message);
  }

  // Fallback to configured admin phones if none found in DB
  if (phones.size === 0) {
    const defaultAdminPhones = getAdminPhones();
    for (const p of defaultAdminPhones) {
      const np = normalizePhoneNumber(p);
      if (np) phones.add(np);
    }
  }

  return Array.from(phones);
};

/**
 * Resolves all distinct administrator email recipients for notification broadcasts.
 * Supports 1, 2, 3, or more admins, priests, technical team, and fallback configs.
 */
const getAllAdminEmailRecipients = async () => {
  const emailMap = new Map(); // email.toLowerCase() -> { email, name }

  const addEmail = (email, name = 'Parish Administrator') => {
    if (!email) return;
    const clean = String(email).trim().toLowerCase();
    if (clean.includes('@') && clean.includes('.')) {
      if (!emailMap.has(clean)) {
        emailMap.set(clean, { email: clean, name: name || 'Parish Administrator' });
      }
    }
  };

  // 1. Primary admin emails from environment / contactConfig
  const configuredAdminEmails = getAdminEmails();
  for (const admEmail of configuredAdminEmails) {
    addEmail(admEmail, 'St. John de Britto Church Admin');
  }
  if (configuredAdminEmails.length === 0) {
    const fallbackChurch = getChurchEmail();
    if (fallbackChurch) addEmail(fallbackChurch, 'St. John de Britto Church');
  }

  // 2. Site settings
  try {
    const setting = await SiteSettings.findOne({ key: 'admin_email' });
    if (setting?.value) {
      addEmail(setting.value, 'Parish Office');
    }
  } catch (err) { }

  // 3. All Admin, Priest, and Staff users in database
  try {
    const adminUsers = await User.find({
      $or: [
        { role: { $in: ['admin', 'priest', 'staff'] } },
        { isTechnicalTeam: true }
      ],
      isActive: { $ne: false },
      email: { $exists: true, $ne: '' }
    }).select('name email role');

    for (const adm of adminUsers) {
      addEmail(adm.email, adm.name);
    }
  } catch (err) {
    console.warn('[RequestNotification] Error fetching admin emails from DB:', err.message);
  }

  return Array.from(emailMap.values());
};

/**
 * Centrally resolves the primary Church Admin's WhatsApp phone number (backward-compatible).
 */
const getAdminWhatsAppNumber = async () => {
  const configured = getWhatsAppAdminNumber();
  if (configured) {
    const norm = normalizePhoneNumber(configured);
    if (norm) return norm;
  }
  const allPhones = await getAllAdminPhoneNumbers();
  return allPhones[0] || '';
};

/**
 * Helper to dispatch WhatsApp message via Baileys bot socket, falling back to Twilio.
 * Supports sending documents/PDF attachments (e.g. donation receipts).
 */
const dispatchWhatsApp = async (phoneNumber, text, mediaOptions = null) => {
  if (!phoneNumber) return false;
  const cleanPhone = String(phoneNumber).replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) return false;

  try {
    const whatsappBot = require('../bot/whatsapp');
    if (whatsappBot) {
      // If a document/PDF attachment is provided, deliver as media message
      if (mediaOptions && (mediaOptions.url || mediaOptions.buffer || mediaOptions.path)) {
        if (typeof whatsappBot.sendWhatsAppMedia === 'function') {
          const sentMedia = await whatsappBot.sendWhatsAppMedia(cleanPhone, {
            url: mediaOptions.url || mediaOptions.path,
            buffer: mediaOptions.buffer,
            mimetype: mediaOptions.mimetype || 'application/pdf',
            fileName: mediaOptions.fileName || mediaOptions.filename || 'Donation_Receipt.pdf',
            caption: mediaOptions.caption || text
          });
          if (sentMedia) return true;
        }
      }

      if (typeof whatsappBot.sendWhatsAppMessage === 'function') {
        const sent = await whatsappBot.sendWhatsAppMessage(cleanPhone, text);
        if (sent) return true;
      }
    }
  } catch (err) {
    console.warn('[RequestNotification] Baileys bot dispatch error:', err.message);
  }

  // Fallback to Twilio
  try {
    let formatted = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
    if (!formatted.startsWith('+91') && formatted.length === 11) {
      formatted = `+91${cleanPhone}`;
    }
    await sendTwilioWhatsApp(formatted, text);
    return true;
  } catch (tErr) {
    console.warn('[RequestNotification] Twilio WhatsApp fallback error:', tErr.message);
    return false;
  }
};

/**
 * Safely resolves relative and absolute server file paths (e.g. /uploads/receipts/...)
 * ensuring reliable disk lookup on both Windows and Linux environments.
 */
const resolveLocalFilePath = (targetPath) => {
  if (!targetPath) return null;
  const fs = require('fs');
  const path = require('path');
  if (path.isAbsolute(targetPath) && fs.existsSync(targetPath)) {
    return targetPath;
  }
  const rel = String(targetPath).replace(/^[/\\]+/, '');
  const candidate1 = path.join(__dirname, '..', '..', rel);
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.join(__dirname, '..', rel);
  if (fs.existsSync(candidate2)) return candidate2;
  const candidate3 = path.resolve(process.cwd(), rel);
  if (fs.existsSync(candidate3)) return candidate3;
  return candidate1;
};

/**
 * Normalizes request module metadata, labels, icons and categories.
 */
const getModuleMeta = (moduleType = '', requestObj = {}) => {
  const norm = String(moduleType || '').toLowerCase().replace(/[-_ ]/g, '');

  if (norm.includes('mass') || norm.includes('booking') || norm.includes('intention')) {
    const reqId = requestObj.bookingNumber || (requestObj._id ? requestObj._id.toString() : 'MB-REQ');
    return {
      typeKey: 'MASS_BOOKING',
      typeLabel: 'Mass Booking',
      icon: '📖',
      intentionLabel: 'Intention',
      adminDeepLink: `/admin/bookings/${reqId}`,
      userDeepLink: `/dashboard/bookings/${reqId}`,
      relatedModel: 'Booking',
      category: 'bookings',
      defaultDetail: requestObj.intentionDetails || requestObj.intentionType || 'Holy Mass Booking'
    };
  }

  if (norm.includes('prayer') || norm.includes('confession')) {
    const isConfession = requestObj.prayerLocation === 'confession' || requestObj.type === 'Confession Request';
    const reqId = requestObj._id ? requestObj._id.toString() : 'PR-REQ';
    return {
      typeKey: isConfession ? 'CONFESSION_REQUEST' : 'PRAYER_REQUEST',
      typeLabel: isConfession ? 'Confession & Spiritual Counsel' : 'Prayer Request',
      icon: isConfession ? '✝️' : '🙏',
      intentionLabel: isConfession ? 'Confidential Request' : 'Prayer Intention',
      adminDeepLink: `/admin/prayers/${reqId}`,
      userDeepLink: `/dashboard/prayer-requests/${reqId}`,
      relatedModel: 'PrayerRequest',
      category: 'prayer',
      isConfidential: isConfession,
      defaultDetail: isConfession ? 'Confession & Spiritual Counsel Appointment' : (requestObj.intention || requestObj.type || 'Personal Intention')
    };
  }

  if (norm.includes('doc') || norm.includes('certificate')) {
    const reqId = requestObj._id ? requestObj._id.toString() : 'DOC-REQ';
    const typeClean = (requestObj.type || 'Certificate').replace(/_/g, ' ').toUpperCase();
    return {
      typeKey: 'DOCUMENT_REQUEST',
      typeLabel: `Document (${typeClean})`,
      icon: '📄',
      intentionLabel: 'Document Requested',
      adminDeepLink: `/admin/documents/${reqId}`,
      userDeepLink: `/dashboard/documents/${reqId}`,
      relatedModel: 'Document',
      category: 'documents',
      defaultDetail: requestObj.requestDetails || `${typeClean} Certificate`
    };
  }

  if (norm.includes('ticket') || norm.includes('support') || norm.includes('enquiry') || norm.includes('complaint') || norm.includes('contact')) {
    const reqId = requestObj.ticketNumber || (requestObj._id ? requestObj._id.toString() : 'TKT-REQ');
    const isEnquiry = norm.includes('enquiry') || norm.includes('contact');
    return {
      typeKey: isEnquiry ? 'CONTACT_ENQUIRY' : 'TICKET',
      typeLabel: isEnquiry ? 'Website Enquiry' : 'Support Ticket',
      icon: '🎫',
      intentionLabel: 'Subject & Inquiry',
      adminDeepLink: `/admin/tickets/${reqId}`,
      userDeepLink: `/dashboard/tickets/${reqId}`,
      relatedModel: 'Ticket',
      category: 'tickets',
      defaultDetail: requestObj.subject || requestObj.message || 'Support Inquiry'
    };
  }

  if (norm.includes('donat')) {
    const reqId = requestObj.transactionId || (requestObj._id ? requestObj._id.toString() : 'DON-REQ');
    return {
      typeKey: 'DONATION',
      typeLabel: 'Donation Submission',
      icon: '💰',
      intentionLabel: 'Donation Details',
      adminDeepLink: `/admin/donations`,
      userDeepLink: `/dashboard/donations`,
      relatedModel: 'Donation',
      category: 'donations',
      defaultDetail: requestObj.amount ? `Donation of ₹${requestObj.amount} (${requestObj.type || 'General Offering'})` : 'Donation'
    };
  }

  // Generic fallback for any future request module
  const reqId = requestObj.referenceNumber || requestObj.code || (requestObj._id ? requestObj._id.toString() : 'REQ');
  const cleanModule = String(moduleType || 'Request').replace(/_/g, ' ').toUpperCase();
  const slug = String(moduleType || 'requests').toLowerCase().replace(/_/g, '-');
  return {
    typeKey: String(moduleType || 'REQUEST').toUpperCase().replace(/[- ]/g, '_'),
    typeLabel: cleanModule,
    icon: '🔔',
    intentionLabel: 'Details',
    adminDeepLink: `/admin/${slug}/${reqId}`,
    userDeepLink: `/dashboard/requests/${slug}/${reqId}`,
    relatedModel: 'Request',
    category: 'general',
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
  if (requestObj.transactionId) return requestObj.transactionId;

  const mongoId = requestObj._id ? requestObj._id.toString() : (typeof requestObj === 'string' && requestObj.length === 24 ? requestObj : '');
  const shortId = mongoId ? mongoId.slice(-6).toUpperCase() : (typeof requestObj === 'string' ? requestObj : Math.random().toString(36).substring(2, 8).toUpperCase());

  const norm = String(moduleType || '').toLowerCase();
  if (norm.includes('mass') || norm.includes('booking')) return `MB-${new Date().getFullYear()}-${shortId}`;
  if (norm.includes('prayer')) return `PR-${shortId}`;
  if (norm.includes('doc')) return `DOC-${shortId}`;
  if (norm.includes('ticket') || norm.includes('contact') || norm.includes('enquiry')) return `TKT-${shortId}`;
  if (norm.includes('donat')) return `DON-${shortId}`;

  return `REQ-${shortId}`;
};

/**
 * Builds the canonical client review URL for the admin.
 */
const getAdminReviewUrl = (deepLinkPath) => {
  return getSiteUrl(deepLinkPath);
};

/**
 * Resolves user deep link path for direct review.
 */
const getUserDeepLinkPath = (moduleType, requestId) => {
  const norm = String(moduleType || '').toLowerCase().replace(/[-_ ]/g, '');
  if (norm.includes('mass') || norm.includes('booking') || norm.includes('intention')) {
    return `/dashboard/bookings/${requestId}`;
  }
  if (norm.includes('prayer') || norm.includes('confession')) {
    return `/dashboard/prayer-requests/${requestId}`;
  }
  if (norm.includes('doc') || norm.includes('certificate')) {
    return `/dashboard/documents/${requestId}`;
  }
  if (norm.includes('ticket') || norm.includes('support') || norm.includes('enquiry') || norm.includes('complaint') || norm.includes('contact')) {
    return `/dashboard/tickets/${requestId}`;
  }
  if (norm.includes('donat')) {
    return `/dashboard/donations`;
  }
  return `/dashboard/requests/${String(moduleType || 'request').toLowerCase().replace(/_/g, '-')}/${requestId}`;
};

/**
 * Builds the canonical client review URL for the user.
 */
const getUserReviewUrl = (deepLinkPath) => {
  return getSiteUrl(deepLinkPath);
};

/**
 * Resolves appropriate status emoji.
 */
const getStatusEmoji = (status) => {
  const s = String(status || '').toUpperCase();
  if (s.includes('APPROV') || s.includes('CONFIRM') || s.includes('VERIF')) return '✅';
  if (s.includes('REJECT') || s.includes('DECLIN')) return '❌';
  if (s.includes('CANCEL')) return '🚫';
  if (s.includes('COMPLET') || s.includes('RESOLV')) return '🎉';
  if (s.includes('REVIEW') || s.includes('PROGRESS') || s.includes('PROCESS')) return '⚙️';
  if (s.includes('CLOSE')) return '🔒';
  if (s.includes('PEND') || s.includes('SUBMIT') || s.includes('NEW')) return '⏳';
  return '🔔';
};

/**
 * Formats a clean capitalized status string (e.g. "Approved", "Under Review").
 */
const formatDisplayStatus = (status) => {
  const s = String(status || 'Pending').toLowerCase().replace(/_/g, ' ');
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Generates status-specific user notification title.
 */
const generateStatusTitle = (requestType, status) => {
  const norm = String(status || '').toUpperCase();
  const typeClean = String(requestType || 'Request').replace(/[-_]/g, ' ').trim();
  const typeLabel = typeClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  if (norm.includes('APPROV') || norm.includes('CONFIRM') || norm.includes('VERIF')) return `${typeLabel} Approved`;
  if (norm.includes('REJECT') || norm.includes('DECLIN')) return `${typeLabel} Not Approved`;
  if (norm.includes('COMPLET')) return `${typeLabel} Completed`;
  if (norm.includes('RESOLV')) return `${typeLabel} Resolved`;
  if (norm.includes('REVIEW') || norm.includes('PROGRESS') || norm.includes('PROCESS')) return `${typeLabel} Under Review`;
  if (norm.includes('CANCEL')) return `${typeLabel} Cancelled`;
  return `${typeLabel} Status Updated: ${formatDisplayStatus(status)}`;
};

/**
 * Generates status-specific user-facing message.
 */
const generateStatusMessage = (request = {}, status, adminComment) => {
  const norm = String(status || '').toUpperCase();
  const meta = getModuleMeta(request.type || request.requestType || request.moduleType || '', request);
  const typeName = meta.typeLabel || 'request';

  let baseMsg = '';
  if (meta.isConfidential) {
    baseMsg = `Your confidential spiritual appointment request status has been updated. Please sign in to view private details.`;
  } else if (norm.includes('APPROV') || norm.includes('CONFIRM') || norm.includes('VERIF')) {
    baseMsg = `Your ${typeName} request has been approved.`;
  } else if (norm.includes('REJECT') || norm.includes('DECLIN')) {
    baseMsg = `Your ${typeName} request has been reviewed and could not be approved at this time.`;
  } else if (norm.includes('COMPLET')) {
    baseMsg = `Your ${typeName} request has been completed and is ready to view.`;
  } else if (norm.includes('RESOLV')) {
    baseMsg = `Your ${typeName} has been marked as resolved and closed.`;
  } else if (norm.includes('REVIEW') || norm.includes('PROGRESS') || norm.includes('PROCESS')) {
    baseMsg = `Your ${typeName} request is currently being reviewed.`;
  } else if (norm.includes('CANCEL')) {
    baseMsg = `Your ${typeName} request has been cancelled.`;
  } else {
    baseMsg = `Your ${typeName} request status has been updated to ${formatDisplayStatus(status)}.`;
  }

  if (adminComment && String(adminComment).trim()) {
    baseMsg += `\n\nAdmin note: ${String(adminComment).trim()}`;
  }

  return baseMsg;
};

/**
 * Resolves redirect URL for user notification deep link.
 */
const generateRequestRedirectUrl = (request = {}, requestType = '') => {
  const type = requestType || request.type || request.requestType || '';
  const reqId = formatRequestId(request, type);
  return getUserDeepLinkPath(type, reqId);
};

/**
 * Resolves admin review URL for admin notification deep link.
 */
const generateAdminReviewUrl = (request = {}, requestType = '') => {
  const type = requestType || request.type || request.requestType || '';
  const meta = getModuleMeta(type, request);
  return meta.adminDeepLink;
};

// ─── 1. CENTRAL ADMIN NOTIFICATION SERVICE ──────────────────────────────────
/**
 * Centralized service to create and deliver an admin request notification through:
 * 1. Admin In-App Database Notification & Bell counter
 * 2. Admin WhatsApp via SJDB Connect / Baileys
 * 3. Admin Browser / Web Push Notification
 * 4. Admin Rich HTML Email Notification
 */
const createAdminNotification = async ({
  type,
  requestType,
  title,
  message,
  userId,
  user: userParam,
  memberId: memberIdParam,
  requestId: requestIdParam,
  status = 'PENDING',
  priority = 'normal',
  details,
  actionUrl: actionUrlParam,
  redirectUrl: redirectUrlParam,
  fileUrl,
  pdfPath,
  mediaOptions,
  skipEmail = false,
  metadata = {},
  req,
  request: requestParam
}) => {
  try {
    const rawType = requestType || type || 'REQUEST';
    let requestObj = requestParam || {};
    if (!requestObj._id && requestIdParam) {
      requestObj._id = requestIdParam;
    }

    // 1. Resolve User
    let user = userParam;
    const lookupId = userId || requestObj.userId || (user && user._id);
    if ((!user || !user.email || !user.phone || !user.parishMemberId) && lookupId) {
      const uId = (typeof lookupId === 'object' && lookupId._id) ? lookupId._id : lookupId;
      if (uId && (typeof uId === 'string' || uId instanceof mongoose.Types.ObjectId)) {
        try {
          const dbUser = await User.findById(uId).select('name parishMemberId familyId email phone');
          if (dbUser) {
            user = { ...(user && typeof user.toObject === 'function' ? user.toObject() : (user || {})), ...dbUser.toObject() };
          }
        } catch { }
      }
    }

    const userName = user?.name || requestObj.personName || requestObj.name || metadata.userName || (req?.user?.name) || 'Parishioner';
    const memberId = memberIdParam || user?.parishMemberId || metadata.memberId || (req?.user?.parishMemberId) || 'SJDB_M01';
    const familyId = user?.familyId || metadata.familyId || (req?.user?.familyId) || 'N/A';
    const userPhone = user?.phone || requestObj.contactPhone || requestObj.phone || metadata.userPhone || (req?.user?.phone) || 'N/A';
    const userEmail = user?.email || requestObj.email || requestObj.contactEmail || metadata.userEmail || (req?.user?.email) || 'None';

    // 2. Resolve Module Metadata & IDs
    const meta = getModuleMeta(rawType, requestObj);
    const reqId = formatRequestId(requestObj, rawType);
    const deepLink = actionUrlParam || redirectUrlParam || meta.adminDeepLink;
    const reviewUrl = getAdminReviewUrl(deepLink);

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedDateTime = now.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const currentStatus = String(status || 'PENDING').toUpperCase();

    // Resolve details text
    let shortDetail = details || meta.defaultDetail;
    if (requestObj.massDate) {
      const massDateStr = new Date(requestObj.massDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
      shortDetail = `${requestObj.intentionType ? requestObj.intentionType.replace(/_/g, ' ') : 'Mass Intention'} (${massDateStr}${requestObj.massTime ? ` at ${requestObj.massTime}` : ''})`;
      if (requestObj.intentionDetails) shortDetail += ` — "${requestObj.intentionDetails}"`;
    } else if (requestObj.intention) {
      shortDetail = requestObj.intention;
    } else if (requestObj.subject) {
      shortDetail = `${requestObj.subject}${requestObj.message ? ` — ${requestObj.message.slice(0, 100)}` : ''}`;
    }

    // 3. Idempotency Check
    const idempotencyKey = `ADMIN_${String(rawType).toUpperCase()}_${String(reqId)}_${currentStatus}`;
    const existingNotif = await Notification.findOne({ idempotencyKey });
    if (existingNotif) {
      console.log(`[AdminNotification] Idempotency match found for ${idempotencyKey}. Skipping duplicate.`);
      return existingNotif;
    }

    const notifTitle = title || `New ${meta.typeLabel} Request`;
    const notifMessage = message || `${userName} (${memberId}) submitted a new ${meta.typeLabel} request.${shortDetail ? ` "${shortDetail}"` : ''}`;
    const contactSummary = [
      userPhone && userPhone !== 'N/A' ? `📞 ${userPhone}` : null,
      userEmail && userEmail !== 'None' ? `📧 ${userEmail}` : null
    ].filter(Boolean).join(' | ');

    const safeObjectId = (id) => {
      if (!id) return null;
      if (id instanceof mongoose.Types.ObjectId) return id;
      if (typeof id === 'object' && id._id) return safeObjectId(id._id);
      if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
        try { return new mongoose.Types.ObjectId(id); } catch { return null; }
      }
      return null;
    };
    const validRelatedId = safeObjectId(requestObj._id) || safeObjectId(userId) || safeObjectId(user?._id) || null;

    // 4. Save to Database for Admin Notification Panel / Bell
    const notif = await Notification.create({
      recipient: 'admin',
      userId: user?._id,
      title: notifTitle,
      message: notifMessage,
      type: meta.category,
      category: meta.category,
      requestType: rawType,
      requestId: reqId,
      status: currentStatus,
      priority: priority === 'urgent' || priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'medium',
      actionUrl: deepLink,
      redirectUrl: deepLink,
      fileUrl: fileUrl || requestObj.receiptUrl || requestObj.fileUrl || null,
      relatedId: validRelatedId,
      relatedModel: meta.relatedModel,
      idempotencyKey,
      metadata: {
        requestType: rawType,
        requestId: reqId,
        memberId,
        familyId,
        userName,
        userEmail,
        userPhone,
        status: currentStatus,
        details: shortDetail,
        reviewUrl,
        fileUrl: fileUrl || requestObj.receiptUrl || requestObj.fileUrl || null,
        ...metadata
      },
      sentVia: ['website', 'email', 'push', 'whatsapp'],
      channels: {
        website: { sent: true, sentAt: now, read: false },
        push: { sent: false },
        email: { sent: false },
        whatsapp: { sent: false }
      }
    });

    // 5. Deliver through other channels asynchronously (Non-blocking & Resilient)
    Promise.allSettled([
      // Channel A: Admin WhatsApp (Multi-Admin Delivery with PDF Document support)
      (async () => {
        try {
          const adminPhoneNumbers = await getAllAdminPhoneNumbers();
          const targetPdf = pdfPath || fileUrl || requestObj.receiptUrl || requestObj.fileUrl;
          let resolvedMedia = mediaOptions || null;

          if (!resolvedMedia && targetPdf) {
            const fs = require('fs');
            const path = require('path');
            const candidatePath = resolveLocalFilePath(targetPdf);
            if (candidatePath && fs.existsSync(candidatePath)) {
              resolvedMedia = {
                url: candidatePath,
                buffer: fs.readFileSync(candidatePath),
                mimetype: 'application/pdf',
                fileName: path.basename(candidatePath)
              };
            }
          }

          const isDonation = (rawType === 'DONATION' || meta.typeKey === 'DONATION');
          const donationAmount = requestObj.amount || metadata.amount || '';
          const donationCategory = requestObj.category || metadata.category || requestObj.type || 'Donation';
          const donationReceiptNo = requestObj.receiptNumber || metadata.receiptNumber || reqId;
          const donationPaymentId = requestObj.paymentId || metadata.paymentRef || requestObj.transactionId || 'N/A';
          const donationIntention = requestObj.intention || metadata.intention || requestObj.note || requestObj.message || 'None';

          const waMessage = isDonation ?
`🔔 *Admin Alert: New Donation Received (Paid)*

A new donation has been received!

👤 *Donor:* ${userName}
🆔 *Member ID:* ${memberId}${familyId && familyId !== 'N/A' ? ` (Family: ${familyId})` : ''}
📧 *Donor Email:* ${userEmail && userEmail !== 'None' ? userEmail : '—'}
📞 *Phone Number:* ${userPhone && userPhone !== 'N/A' ? userPhone : '—'}
💰 *Amount:* ₹${donationAmount || '0'}
🏷️ *Category:* ${donationCategory}
🧾 *Receipt No:* ${donationReceiptNo}
💳 *Payment ID:* ${donationPaymentId}
🙏 *Intention:* ${donationIntention}
📅 *Date:* ${formattedDateTime}

📎 Official donation receipt PDF is attached for church records.

👉 Review in Admin Panel:
${reviewUrl}`
:
`🔔 *New ${meta.typeLabel} Request*
👤 User Name: ${userName}
🆔 Member ID: ${memberId}${familyId && familyId !== 'N/A' ? ` (Family: ${familyId})` : ''}
📧 User Email: ${userEmail && userEmail !== 'None' ? userEmail : '—'}
📞 Phone Number: ${userPhone && userPhone !== 'N/A' ? userPhone : '—'}
🔖 Request ID: ${reqId}
📅 Submitted: ${formattedDateTime}
⏳ Status: ${currentStatus}
${meta.icon} ${meta.intentionLabel}: ${shortDetail}

👉 Review Request:
${reviewUrl}

Please review in Admin Panel.`;

          if (resolvedMedia) {
            resolvedMedia.caption = resolvedMedia.caption || waMessage;
          }

          const waResults = await Promise.allSettled(
            adminPhoneNumbers.map(phone => dispatchWhatsApp(phone, waMessage, resolvedMedia))
          );
          const successfulPhones = [];
          const failedPhones = [];
          waResults.forEach((res, idx) => {
            const phone = adminPhoneNumbers[idx];
            if (res.status === 'fulfilled' && res.value === true) {
              successfulPhones.push(phone);
            } else {
              failedPhones.push(phone);
            }
          });

          const anySent = successfulPhones.length > 0;
          await Notification.findByIdAndUpdate(notif._id, {
            'channels.whatsapp.sent': anySent,
            'channels.whatsapp.sentAt': new Date(),
            'channels.whatsapp.recipients': adminPhoneNumbers,
            'channels.whatsapp.hasAttachment': Boolean(resolvedMedia),
            ...(!anySent ? { 'channels.whatsapp.error': 'Dispatch failed for all admin numbers' } : {})
          });
          console.log(`[AdminNotification] WhatsApp dispatched to ${adminPhoneNumbers.length} admin(s) ${resolvedMedia ? '(WITH PDF ATTACHMENT)' : ''} [Success: ${successfulPhones.length}, Failed: ${failedPhones.length}]`);
        } catch (waErr) {
          console.error('[AdminNotification] WhatsApp error:', waErr.message);
          await Notification.findByIdAndUpdate(notif._id, {
            'channels.whatsapp.sent': false,
            'channels.whatsapp.error': waErr.message
          }).catch(() => {});
        }
      })(),

      // Channel B: Admin Web Push
      (async () => {
        try {
          const pushRes = await sendPushToAdmins({
            title: notifTitle,
            body: `${userName} (${memberId}) | ${userPhone !== 'N/A' ? userPhone : userEmail !== 'None' ? userEmail : ''}: ${shortDetail.slice(0, 80)}`,
            url: deepLink,
            tag: `admin-req-${reqId}`,
            icon: '/favicon.png',
            badge: '/favicon.png',
            data: { url: deepLink, requestId: reqId }
          });
          await Notification.findByIdAndUpdate(notif._id, {
            'channels.push.sent': !!pushRes?.success,
            'channels.push.sentAt': new Date(),
            ...(!pushRes?.success ? { 'channels.push.error': pushRes?.reason || pushRes?.error } : {})
          });
        } catch (pushErr) {
          console.warn('[AdminNotification] Push error:', pushErr.message);
          await Notification.findByIdAndUpdate(notif._id, {
            'channels.push.sent': false,
            'channels.push.error': pushErr.message
          }).catch(() => {});
        }
      })(),

      // Channel C: Admin Email (Multi-Admin Delivery)
      (async () => {
        if (skipEmail || metadata.skipEmail || metadata.skipAdminEmail) {
          return;
        }
        try {
          const adminRecipients = await getAllAdminEmailRecipients();
          const emailSubject = `New ${meta.typeLabel} Request — ${userName} (${reqId})`;
          const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${notifTitle}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', -apple-system, Roboto, sans-serif; }
    .container { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo-box { width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; background: #ffffff; overflow: hidden; border: 3px solid #fbbf24; }
    .content { padding: 28px 24px; color: #1e293b; }
    .badge { display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 12px; font-weight: 800; font-size: 14px; }
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
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600;">NEW REQUEST ALERT</p>
    </div>
    <div class="content">
      <div style="margin-bottom:14px;">
        <span class="badge" style="background:#dbeafe; color:#1e40af;">
          ✨ NEW REQUEST • ${meta.typeLabel.toUpperCase()}
        </span>
      </div>
      <h2 style="color:#1e3a8a; margin:0 0 14px; font-size:18px; font-weight:800;">
        ${notifTitle}
      </h2>
      <div class="card">
        <div class="row"><span class="label">User Name:</span><span class="val">${userName}</span></div>
        <div class="row"><span class="label">Member ID:</span><span class="val font-mono">${memberId}</span></div>
        <div class="row"><span class="label">User Email:</span><span class="val">${userEmail && userEmail !== 'None' ? `<a href="mailto:${userEmail}" style="color:#2563eb; text-decoration:none; font-weight:700;">${userEmail}</a>` : '<span style="color:#94a3b8;">—</span>'}</span></div>
        <div class="row"><span class="label">Phone Number:</span><span class="val font-mono">${userPhone && userPhone !== 'N/A' ? `<a href="tel:${userPhone}" style="color:#0f172a; text-decoration:none; font-weight:700;">${userPhone}</a>` : '<span style="color:#94a3b8;">—</span>'}</span></div>
        <div class="row"><span class="label">Request ID:</span><span class="val" style="color:#2563eb; font-family:monospace;">${reqId}</span></div>
        <div class="row"><span class="label">Submitted:</span><span class="val">${formattedDateTime}</span></div>
        <div class="row"><span class="label">Status:</span><span class="val" style="color:#d97706; font-weight:800;">${currentStatus}</span></div>
      </div>
      <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:12px; padding:14px 16px; margin-bottom:22px;">
        <div style="font-size:11px; font-weight:800; color:#92400e; text-transform:uppercase; margin-bottom:4px;">
          ${meta.icon} ${meta.intentionLabel}
        </div>
        <div style="font-size:13.5px; color:#78350f; font-weight:600; line-height:1.5;">
          ${shortDetail}
        </div>
      </div>
      <div style="text-align:center; margin:24px 0 10px;">
        <a href="${reviewUrl}" class="btn">👉 View Request in Admin Panel →</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Central Admin Request System • Dispatched via WhatsApp, Email & Web Push</p>
    </div>
  </div>
</body>
</html>`;

          const emailAttachments = [];
          const fs = require('fs');
          const path = require('path');
          const targetPdf = pdfPath || fileUrl || requestObj.receiptUrl || requestObj.fileUrl;
          if (targetPdf) {
            const pdfAbsPath = resolveLocalFilePath(targetPdf);
            if (pdfAbsPath && fs.existsSync(pdfAbsPath)) {
              emailAttachments.push({
                filename: path.basename(pdfAbsPath),
                path: pdfAbsPath,
                contentType: 'application/pdf'
              });
            }
          }

          const mailResults = await Promise.allSettled(
            adminRecipients.map(recipient =>
              sendMail({ to: recipient.email, subject: emailSubject, html: emailHtml, attachments: emailAttachments })
            )
          );

          const successfulEmails = [];
          const failedEmails = [];
          mailResults.forEach((res, idx) => {
            const email = adminRecipients[idx].email;
            if (res.status === 'fulfilled') {
              successfulEmails.push(email);
            } else {
              failedEmails.push(email);
            }
          });

          const anySent = successfulEmails.length > 0;
          await Notification.findByIdAndUpdate(notif._id, {
            'channels.email.sent': anySent,
            'channels.email.sentAt': new Date(),
            'channels.email.recipients': adminRecipients.map(r => r.email),
            ...(!anySent ? { 'channels.email.error': 'Email delivery failed for all admin addresses' } : {})
          });
          console.log(`[AdminNotification] Email dispatched to ${adminRecipients.length} admin(s) [Success: ${successfulEmails.length}, Failed: ${failedEmails.length}]`);
        } catch (mailErr) {
          console.error('[AdminNotification] Email error:', mailErr.message);
          await Notification.findByIdAndUpdate(notif._id, {
            'channels.email.sent': false,
            'channels.email.error': mailErr.message
          }).catch(() => {});
        }
      })()
    ]);

    return notif;
  } catch (err) {
    console.error('[AdminNotification] createAdminNotification error:', err.message);
    return null;
  }
};

// ─── 2. CENTRAL USER STATUS NOTIFICATION SERVICE ────────────────────────────
/**
 * Centralized service to deliver a status-update notification to the requesting user through:
 * 1. User In-App Database Notification & Bell counter
 * 2. User WhatsApp via SJDB Connect / Baileys
 * 3. User Browser / Web Push Notification
 * 4. User Rich HTML Email Notification with direct "View Request" link
 */
const createUserNotification = async ({
  userId,
  type = 'REQUEST_STATUS_UPDATE',
  requestType,
  requestId,
  status,
  title,
  message,
  redirectUrl,
  actionUrl,
  adminComment,
  metadata = {},
  req,
  request: requestParam
}) => {
  try {
    const rawType = requestType || type || 'REQUEST';
    let requestObj = requestParam || {};
    if (!requestObj._id && requestId) {
      requestObj._id = requestId;
    }

    // 1. Resolve User
    let user = null;
    const targetUserId = userId || requestObj.userId;
    if (targetUserId) {
      if (typeof targetUserId === 'object' && targetUserId.name && targetUserId.email && targetUserId.phone) {
        user = targetUserId;
      } else {
        const uId = (typeof targetUserId === 'object' && targetUserId._id) ? targetUserId._id : targetUserId;
        try {
          user = await User.findById(uId).select('name parishMemberId familyId email phone settings');
        } catch { }
      }
    }

    const userName = user?.name || requestObj.personName || requestObj.name || metadata.userName || (req?.user?.name) || 'Parishioner';
    const memberId = user?.parishMemberId || metadata.memberId || (req?.user?.parishMemberId) || 'SJDB_M01';
    const userPhone = user?.phone || requestObj.contactPhone || requestObj.phone || metadata.userPhone || (req?.user?.phone) || null;
    const userEmail = user?.email || requestObj.email || metadata.userEmail || (req?.user?.email) || null;

    // 2. Resolve Meta & IDs
    const meta = getModuleMeta(rawType, requestObj);
    const reqId = formatRequestId(requestObj, rawType);
    const cleanStatus = String(status || requestObj.status || 'PENDING').toUpperCase();
    const displayStatus = formatDisplayStatus(cleanStatus);
    const statusEmoji = getStatusEmoji(cleanStatus);

    const deepLink = redirectUrl || actionUrl || generateRequestRedirectUrl(requestObj, rawType);
    const reviewUrl = getUserReviewUrl(deepLink);

    const now = new Date();
    const formattedDateTime = now.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // 3. Resolve Content
    const notifTitle = title || generateStatusTitle(meta.typeLabel, cleanStatus);
    const notifMessage = message || generateStatusMessage(requestObj, cleanStatus, adminComment || metadata.adminComment);

    // 4. Idempotency Check
    const idempotencyKey = `USER_${user?._id || 'ANON'}_${String(rawType).toUpperCase()}_${String(reqId)}_${cleanStatus}`;
    const existingNotif = await Notification.findOne({ idempotencyKey });
    if (existingNotif) {
      console.log(`[UserNotification] Idempotency match found for ${idempotencyKey}. Skipping duplicate.`);
      return existingNotif;
    }

    // 5. Save to Database for User Notification Bell / Panel
    let notif = null;
    if (user?._id) {
      notif = await Notification.create({
        recipient: 'user',
        userId: user._id,
        title: notifTitle,
        message: notifMessage,
        type: meta.category,
        category: meta.category,
        requestType: rawType,
        requestId: reqId,
        status: cleanStatus,
        priority: cleanStatus === 'APPROVED' || cleanStatus === 'REJECTED' ? 'high' : 'normal',
        actionUrl: deepLink,
        redirectUrl: deepLink,
        relatedId: requestObj._id,
        relatedModel: meta.relatedModel,
        idempotencyKey,
        metadata: {
          requestType: rawType,
          requestId: reqId,
          userName,
          memberId,
          userEmail,
          userPhone,
          status: cleanStatus,
          adminComment: adminComment || metadata.adminComment,
          reviewUrl,
          ...metadata
        },
        sentVia: ['website', 'email', 'push', 'whatsapp'],
        channels: {
          website: { sent: true, sentAt: now, read: false },
          push: { sent: false },
          email: { sent: false },
          whatsapp: { sent: false }
        }
      });
    }

    // 6. Deliver through other channels asynchronously
    Promise.allSettled([
      // Channel A: User WhatsApp
      (async () => {
        if (!userPhone) return;
        try {
          const contactLines = [
            userEmail && userEmail !== 'None' ? `📧 Email: ${userEmail}` : null,
            userPhone && userPhone !== 'N/A' ? `📞 Phone: ${userPhone}` : null
          ].filter(Boolean).join('\n');

          const waMessage = meta.isConfidential
            ? `🔔 *${meta.typeLabel} Status Update*
👤 User: ${userName} (${memberId})
${contactLines ? `${contactLines}\n` : ''}${statusEmoji} Status: *${displayStatus}*
Your confidential spiritual appointment request has been updated.

👉 View your request:
${reviewUrl}

_St. John de Britto Church, Kalayarkoil_`
            : `🔔 *${meta.typeLabel} Status Update*
👤 User: ${userName} (${memberId})
${contactLines ? `${contactLines}\n` : ''}${statusEmoji} Status: *${displayStatus}*

Your ${meta.typeLabel} request has been *${displayStatus}*.
${adminComment ? `\n📝 *Admin message:* ${adminComment}\n` : ''}
👉 View your request:
${reviewUrl}

_St. John de Britto Church, Kalayarkoil_`;

          const sent = await dispatchWhatsApp(userPhone, waMessage);
          if (notif?._id) {
            await Notification.findByIdAndUpdate(notif._id, {
              'channels.whatsapp.sent': !!sent,
              'channels.whatsapp.sentAt': new Date(),
              ...(!sent ? { 'channels.whatsapp.error': 'Dispatch returned false' } : {})
            });
          }
          console.log(`[UserNotification] WhatsApp dispatched to user (${userPhone}): ${sent ? 'SUCCESS' : 'FAILED'}`);
        } catch (waErr) {
          console.error('[UserNotification] WhatsApp error:', waErr.message);
          if (notif?._id) {
            await Notification.findByIdAndUpdate(notif._id, {
              'channels.whatsapp.sent': false,
              'channels.whatsapp.error': waErr.message
            }).catch(() => {});
          }
        }
      })(),

      // Channel B: User Web Push
      (async () => {
        if (!user?._id) return;
        try {
          const pushBody = meta.isConfidential
            ? 'Your confidential spiritual request has been updated.'
            : `${reqId}: ${displayStatus}. ${adminComment ? `Note: ${adminComment.slice(0, 80)}` : ''}`;

          const pushRes = await sendPushToUser(user._id, {
            title: notifTitle,
            body: pushBody,
            url: deepLink,
            tag: `user-req-${reqId}-${cleanStatus}`,
            icon: '/favicon.png',
            badge: '/favicon.png',
            data: { url: deepLink, requestId: reqId }
          });
          if (notif?._id) {
            await Notification.findByIdAndUpdate(notif._id, {
              'channels.push.sent': !!pushRes?.success,
              'channels.push.sentAt': new Date(),
              ...(!pushRes?.success ? { 'channels.push.error': pushRes?.reason || pushRes?.error } : {})
            });
          }
        } catch (pushErr) {
          console.warn('[UserNotification] Push error:', pushErr.message);
          if (notif?._id) {
            await Notification.findByIdAndUpdate(notif._id, {
              'channels.push.sent': false,
              'channels.push.error': pushErr.message
            }).catch(() => {});
          }
        }
      })(),

      // Channel C: User Email
      (async () => {
        if (!userEmail || !userEmail.includes('@')) return;
        try {
          const statusColor = cleanStatus.includes('APPROV') || cleanStatus.includes('CONFIRM') || cleanStatus.includes('VERIF')
            ? '#16a34a'
            : cleanStatus.includes('REJECT') || cleanStatus.includes('DECLIN')
            ? '#dc2626'
            : cleanStatus.includes('COMPLET') || cleanStatus.includes('RESOLV')
            ? '#7c3aed'
            : '#d97706';

          const emailSubject = `${meta.typeLabel} Status Updated: ${displayStatus} (${reqId})`;
          const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${emailSubject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, Roboto, sans-serif; }
    .container { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo-box { width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; background: #ffffff; overflow: hidden; border: 3px solid #fbbf24; }
    .content { padding: 28px 24px; color: #1e293b; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
    .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 12px; font-weight: 800; font-size: 14px; }
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
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600;">REQUEST STATUS NOTIFICATION</p>
    </div>
    <div class="content">
      <div style="margin-bottom:16px;">
        <span class="badge" style="background:${statusColor}15; color:${statusColor}; border:1px solid ${statusColor}40;">
          ${statusEmoji} ${displayStatus}
        </span>
      </div>
      <h2 style="color:#1e3a8a; margin:0 0 10px; font-size:18px; font-weight:800;">Dear ${userName},</h2>
      <p style="margin:0 0 16px; color:#475569; font-size:14px; line-height:1.5;">
        Your <strong>${meta.typeLabel}</strong> request with the church has an update.
      </p>
      <div class="card">
        <div class="row"><span class="label">User Name:</span><span class="val">${userName}</span></div>
        <div class="row"><span class="label">Member ID:</span><span class="val font-mono">${memberId}</span></div>
        ${userEmail && userEmail !== 'None' ? `<div class="row"><span class="label">User Email:</span><span class="val" style="color:#2563eb;"><a href="mailto:${userEmail}" style="color:#2563eb; text-decoration:none;">${userEmail}</a></span></div>` : ''}
        ${userPhone && userPhone !== 'N/A' ? `<div class="row"><span class="label">Phone Number:</span><span class="val font-mono"><a href="tel:${userPhone}" style="color:#0f172a; text-decoration:none;">${userPhone}</a></span></div>` : ''}
        <div class="row"><span class="label">Request Type:</span><span class="val">${meta.typeLabel}</span></div>
        <div class="row"><span class="label">Request ID:</span><span class="val" style="color:#2563eb; font-family:monospace; font-weight:800;">${reqId}</span></div>
        <div class="row"><span class="label">Current Status:</span><span class="val" style="color:${statusColor}; font-weight:800;">${statusEmoji} ${displayStatus}</span></div>
        <div class="row"><span class="label">Date / Time:</span><span class="val">${formattedDateTime}</span></div>
      </div>
      ${adminComment ? `
      <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:12px; padding:14px 16px; margin-bottom:22px;">
        <div style="font-size:11px; font-weight:800; color:#92400e; text-transform:uppercase; margin-bottom:4px;">📝 Church Administration Note</div>
        <div style="font-size:13.5px; color:#78350f; font-weight:600; line-height:1.5;">${adminComment}</div>
      </div>` : ''}
      <div style="text-align:center; margin:26px 0 12px;">
        <a href="${reviewUrl}" class="btn">👉 View & Review Your Request →</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Automated Notification • Dispatched via WhatsApp, Email & Web Push</p>
    </div>
  </div>
</body>
</html>`;

          await sendMail({ to: userEmail, subject: emailSubject, html: emailHtml });
          if (notif?._id) {
            await Notification.findByIdAndUpdate(notif._id, {
              'channels.email.sent': true,
              'channels.email.sentAt': new Date()
            });
          }
        } catch (mailErr) {
          console.error('[UserNotification] Email error:', mailErr.message);
          if (notif?._id) {
            await Notification.findByIdAndUpdate(notif._id, {
              'channels.email.sent': false,
              'channels.email.error': mailErr.message
            }).catch(() => {});
          }
        }
      })()
    ]);

    return notif;
  } catch (err) {
    console.error('[UserNotification] createUserNotification error:', err.message);
    return null;
  }
};

// ─── Backward-compatible bridges ─────────────────────────────────────────────
const notifyAdminRequest = async (payload) => {
  return createAdminNotification({
    type: payload.module,
    request: payload.request,
    user: payload.user,
    status: payload.newStatus || payload.request?.status || 'PENDING',
    details: payload.note,
    req: payload.req
  });
};

const notifyUserRequestStatus = async (payload) => {
  return createUserNotification({
    userId: payload.user?._id || payload.request?.userId,
    requestType: payload.module,
    requestId: payload.request?._id,
    status: payload.newStatus || payload.request?.status || 'PENDING',
    adminComment: payload.note,
    request: payload.request,
    req: payload.req
  });
};

requestEvents.on('request:created', (payload) => {
  Promise.allSettled([
    createAdminNotification({
      type: payload.module,
      request: payload.request,
      user: payload.user,
      status: 'PENDING',
      req: payload.req
    }),
    createUserNotification({
      userId: payload.user?._id || payload.request?.userId,
      requestType: payload.module,
      requestId: payload.request?._id,
      status: 'PENDING',
      request: payload.request,
      req: payload.req
    })
  ]).catch(err => console.error('[RequestNotification] Error on request:created:', err.message));
});

requestEvents.on('request:status_changed', (payload) => {
  Promise.allSettled([
    createUserNotification({
      userId: payload.user?._id || payload.request?.userId,
      requestType: payload.module,
      requestId: payload.request?._id,
      status: payload.newStatus,
      adminComment: payload.note,
      request: payload.request,
      req: payload.req
    })
  ]).catch(err => console.error('[RequestNotification] Error on request:status_changed:', err.message));
});

const emitRequestCreated = (payload) => {
  requestEvents.emit('request:created', payload);
};

const emitRequestStatusChanged = (payload) => {
  requestEvents.emit('request:status_changed', payload);
};

module.exports = {
  createAdminNotification,
  createUserNotification,
  generateStatusTitle,
  generateStatusMessage,
  generateRequestRedirectUrl,
  generateAdminReviewUrl,
  notifyAdminRequest,
  notifyUserRequestStatus,
  emitRequestCreated,
  emitRequestStatusChanged,
  requestEvents,
  getAdminWhatsAppNumber,
  getAllAdminPhoneNumbers,
  getAllAdminEmailRecipients,
  normalizePhoneNumber,
  getModuleMeta,
  formatRequestId,
  getAdminReviewUrl,
  getUserDeepLinkPath,
  getUserReviewUrl,
  getStatusEmoji,
  formatDisplayStatus,
  dispatchWhatsApp
};
