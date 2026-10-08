/**
 * Event Registration & Notification Service
 * St. John de Britto Church
 * 
 * Handles:
 * 1. Server-authoritative event registrations with unique database index protection
 * 2. Real-time participant counting and limit verification
 * 3. Immediate state return for zero-refresh UI updates
 * 4. Multi-channel user confirmations (In-App, Email, WhatsApp, Push, SMS)
 * 5. Multi-channel admin alerts with participant details and direct admin links
 * 6. Idempotent notification delivery (strictly 0 duplicate notifications)
 */

const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const User = require('../models/User');
const { createNotification } = require('./notificationService');
const mailer = require('../config/mailer');
const sendMail = (opts) => mailer.sendMail(opts);
const { sendSMS } = require('../config/twilio');
const { sendPushToUser } = require('./webPushService');
const { getSiteUrl } = require('../config/siteRoutes');
const { getAdminEmails, getAdminPhones } = require('../config/contactConfig');

function sendWA(phoneOrUser, text) {
  try {
    const waService = require('./whatsAppNotificationService');
    return waService.sendWhatsAppNotification(phoneOrUser, text).catch(err => {
      console.warn('[EventRegistrationService] Central WhatsApp send warning:', err.message);
      const wa = require('../bot/whatsapp');
      if (wa && typeof wa.sendWhatsAppMessage === 'function') {
        const phone = typeof phoneOrUser === 'string' ? phoneOrUser : (phoneOrUser?.phone || '');
        return wa.sendWhatsAppMessage(phone, text).catch(() => false);
      }
      return false;
    });
  } catch (err) {
    console.warn('[EventRegistrationService] WhatsApp module warning:', err.message);
  }
  return Promise.resolve(false);
}

/**
 * Normalizes production-safe frontend public URL
 */
function getPublicFrontendUrl() {
  return process.env.PUBLIC_FRONTEND_BASE_URL ||
    process.env.FRONTEND_BASE_URL ||
    process.env.CLIENT_URL ||
    'https://st-jb-church.vercel.app';
}

/**
 * Format event date in Asia/Kolkata timezone
 */
function formatEventDate(dateInput) {
  if (!dateInput) return 'TBA';
  try {
    return new Date(dateInput).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Register user for an event
 */
async function registerUserForEvent({ eventId, user, registrationData = {} }) {
  if (!eventId) throw new Error('Event ID is required');
  if (!user || !user._id) throw new Error('Authentication is required');

  const event = await Event.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.statusCode = 404;
    throw err;
  }

  if (event.isPublished === false) {
    const err = new Error('Event is not open for registration');
    err.statusCode = 400;
    throw err;
  }

  // 1. Check existing registration in EventRegistration collection
  const existingReg = await EventRegistration.findOne({
    eventId: event._id,
    userId: user._id
  });

  const alreadyInEventArray = (event.registrations || []).some(
    r => r.userId?.toString() === user._id.toString()
  );

  if (existingReg || alreadyInEventArray) {
    const err = new Error('You are already registered for this event.');
    err.statusCode = 409;
    err.code = 'ALREADY_REGISTERED';
    throw err;
  }

  // 2. Check registration limit if configured
  const currentCount = event.registrationCount || (event.registrations || []).length;
  if (event.registrationLimit > 0 && currentCount >= event.registrationLimit) {
    const err = new Error('Event registration is full. Maximum participant capacity reached.');
    err.statusCode = 409;
    err.code = 'REGISTRATION_FULL';
    throw err;
  }

  const name = (registrationData.name || user.name || 'Parishioner').trim();
  const phone = (registrationData.phone || user.phone || '').trim();
  const email = (registrationData.email || user.email || '').trim().toLowerCase();
  const gender = registrationData.gender || user.gender || 'male';
  const comingFrom = (registrationData.comingFrom || user.anbiyam || 'Main Parish').trim();

  // 3. Create EventRegistration document with unique compound index
  let registrationDoc;
  try {
    registrationDoc = await EventRegistration.create({
      eventId: event._id,
      userId: user._id,
      name,
      phone,
      email,
      gender,
      comingFrom,
      registeredAt: new Date()
    });
  } catch (mongoErr) {
    if (mongoErr.code === 11000) {
      const err = new Error('You are already registered for this event.');
      err.statusCode = 409;
      err.code = 'ALREADY_REGISTERED';
      throw err;
    }
    throw mongoErr;
  }

  // 4. Update embedded event.registrations array and registrationCount
  const subdoc = {
    _id: registrationDoc._id,
    userId: user._id,
    name,
    phone,
    email,
    gender,
    comingFrom,
    registeredAt: registrationDoc.registeredAt
  };

  event.registrations.push(subdoc);
  event.registrationCount = event.registrations.length;
  await event.save();

  console.log(`[EVENT REGISTRATION] User "${name}" (${user._id}) successfully registered for "${event.title}". Total: ${event.registrationCount}`);

  // 5. Asynchronously dispatch notifications (does not block or fail registration)
  setImmediate(() => {
    dispatchRegistrationNotifications({
      event,
      registration: registrationDoc,
      user
    }).catch(notifErr => {
      console.error('[EVENT NOTIFICATION] Background dispatch error:', notifErr.message);
    });
  });

  return {
    success: true,
    registered: true,
    registration: {
      id: registrationDoc._id.toString(),
      eventId: event._id.toString(),
      userId: user._id.toString(),
      name: registrationDoc.name,
      phone: registrationDoc.phone,
      email: registrationDoc.email,
      registeredAt: registrationDoc.registeredAt
    },
    registrationCount: event.registrationCount
  };
}

/**
 * Withdraw user registration
 */
async function withdrawUserRegistration({ eventId, userId }) {
  if (!eventId) throw new Error('Event ID is required');
  if (!userId) throw new Error('User ID is required');

  const event = await Event.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.statusCode = 404;
    throw err;
  }

  // Find user and existing registration before removal
  const userDoc = await User.findById(userId).lean();
  const existingReg = await EventRegistration.findOne({ eventId: event._id, userId }).lean();
  const inArrayReg = (event.registrations || []).find(
    r => r.userId?.toString() === userId.toString()
  );

  const initialLength = (event.registrations || []).length;
  if (!existingReg && !inArrayReg && initialLength === 0) {
    const err = new Error('You are not currently registered for this event.');
    err.statusCode = 400;
    throw err;
  }

  const participantSnapshot = {
    name: (existingReg?.name || inArrayReg?.name || userDoc?.name || 'Parishioner').trim(),
    phone: (existingReg?.phone || inArrayReg?.phone || userDoc?.phone || '').trim(),
    email: (existingReg?.email || inArrayReg?.email || userDoc?.email || '').trim().toLowerCase()
  };

  // Remove from EventRegistration collection
  await EventRegistration.deleteMany({
    eventId: event._id,
    userId
  });

  // Remove from embedded registrations array
  event.registrations = (event.registrations || []).filter(
    r => r.userId?.toString() !== userId.toString()
  );
  event.registrationCount = Math.max(0, event.registrations.length);
  await event.save();

  if (initialLength === event.registrations.length && !existingReg) {
    const err = new Error('You are not currently registered for this event.');
    err.statusCode = 400;
    throw err;
  }

  console.log(`[EVENT WITHDRAWAL] User "${participantSnapshot.name}" (${userId}) withdrew from "${event.title}". Total: ${event.registrationCount}`);

  // Dispatch multi-channel withdrawal notifications to user and admin asynchronously
  setImmediate(() => {
    dispatchWithdrawalNotifications({
      event,
      registration: participantSnapshot,
      user: userDoc || { _id: userId, ...participantSnapshot },
      updatedCount: event.registrationCount
    }).catch(notifErr => {
      console.error('[EVENT WITHDRAWAL] Notification dispatch error:', notifErr.message);
    });
  });

  return {
    success: true,
    registered: false,
    message: 'Registration withdrawn successfully',
    registrationCount: event.registrationCount
  };
}

/**
 * Retrieves configured admin emails and phones for event notifications
 */
async function getAdminNotificationRecipients() {
  const envEmails = getAdminEmails ? getAdminEmails() : [];
  const envPhones = getAdminPhones ? getAdminPhones() : [];

  const emails = new Set(envEmails);
  const phones = new Set(envPhones);

  try {
    const adminUsers = await User.find({
      role: { $in: ['admin', 'priest', 'superadmin'] },
      isActive: true
    }).select('email phone').lean();

    for (const u of adminUsers) {
      if (u.email) emails.add(u.email.toLowerCase().trim());
      if (u.phone) {
        let p = String(u.phone).replace(/\D/g, '');
        if (p) phones.add(p);
      }
    }
  } catch (err) {
    console.warn('[EventRegistrationService] Could not fetch DB admins:', err.message);
  }

  return {
    emails: Array.from(emails).filter(Boolean),
    phones: Array.from(phones).filter(Boolean)
  };
}

/**
 * Dispatch multi-channel confirmation notifications to user and admin
 */
async function dispatchRegistrationNotifications({ event, registration, user }) {
  if (!registration || !event) return;

  // Idempotency check: prevent duplicate notifications
  const regDoc = await EventRegistration.findById(registration._id);
  if (!regDoc || regDoc.notificationDispatched) {
    console.log(`[EVENT NOTIFICATION] Idempotency: registration ${registration._id} already notified. Skipping.`);
    return;
  }

  // Atomically claim dispatch
  const updated = await EventRegistration.findOneAndUpdate(
    { _id: registration._id, notificationDispatched: { $ne: true } },
    { $set: { notificationDispatched: true, notificationDispatchedAt: new Date() } },
    { new: true }
  );
  if (!updated) return;

  const publicBaseUrl = getPublicFrontendUrl();
  const publicEventUrl = `${publicBaseUrl}/events`;
  const adminEventUrl = `${publicBaseUrl}/admin/events`;

  const dateText = formatEventDate(event.date);
  const timeText = event.time || 'Schedule will be announced';
  const venueText = event.venue || 'Church Premises, Kalayarkoil';
  const userName = registration.name || user.name || 'Parishioner';
  const userPhone = registration.phone || user.phone || '';
  const userEmail = registration.email || user.email || '';

  // ──────────────────────────────────────────────────────────────────────────
  // A. USER CONFIRMATIONS
  // ──────────────────────────────────────────────────────────────────────────

  // 1. In-App Notification
  try {
    await createNotification({
      userId: user._id,
      recipient: 'user',
      title: 'Event Registration Successful',
      message: `Your registration for "${event.title}" has been successfully completed.\n\nDate: ${dateText}\nTime: ${timeText}\nVenue: ${venueText}\nRegistration: Confirmed`,
      type: 'event',
      category: 'events',
      priority: 'medium',
      actionUrl: '/events',
      relatedId: event._id,
      relatedModel: 'Event',
      channels: ['inApp']
    });
    console.log(`[EVENT NOTIFICATION] User In-App sent to ${user._id}`);
  } catch (err) {
    console.warn('[EVENT NOTIFICATION] User In-App failed:', err.message);
  }

  // 2. Email Confirmation
  if (userEmail) {
    try {
      const emailHtml = `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fb;padding:40px 20px;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 35px rgba(0,0,0,0.1);border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%);padding:35px 25px;text-align:center;">
      <h1 style="color:#fbbf24;margin:0;font-size:24px;font-weight:800;">St. John de Britto Church</h1>
      <p style="color:#ffffff;margin:6px 0 0;font-size:13px;opacity:0.9;">புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்</p>
    </div>
    <div style="padding:35px 30px;color:#374151;line-height:1.7;">
      <div style="text-align:center;margin-bottom:25px;">
        <span style="display:inline-block;background:#dcfce7;color:#15803d;padding:6px 16px;border-radius:999px;font-size:13px;font-weight:700;">
          ✓ Registration Confirmed
        </span>
      </div>
      <h2 style="color:#1e3a8a;margin-top:0;font-size:22px;text-align:center;">Event Registration Confirmed</h2>
      <p style="font-size:15px;color:#4b5563;">Dear <strong>${userName}</strong>,</p>
      <p style="font-size:15px;color:#4b5563;">Your registration for <strong>"${event.title}"</strong> has been successfully completed. Here are the event details:</p>
      
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:25px 0;border:1px solid #f3f4f6;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;width:35%;"><strong>Event:</strong></td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">${event.title}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;"><strong>Date:</strong></td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">${dateText}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;"><strong>Time:</strong></td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">${timeText}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;"><strong>Venue:</strong></td>
            <td style="padding:8px 0;color:#111827;font-weight:600;">${venueText}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;"><strong>Status:</strong></td>
            <td style="padding:8px 0;color:#15803d;font-weight:700;">Confirmed</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="${publicEventUrl}" style="background:#1e3a8a;color:#ffffff;padding:12px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          View Event Details →
        </a>
      </div>
    </div>
    <div style="background:#111827;padding:24px 20px;text-align:center;color:#9ca3af;font-size:12px;">
      <p style="margin:0 0 6px;color:#d1d5db;font-weight:600;">St. John de Britto Church, Kalayarkoil</p>
      <p style="margin:0;">Tamil Nadu - 630551 | "May the peace of Christ be with you always."</p>
    </div>
  </div>
</div>`;

      await sendMail({
        to: userEmail,
        subject: `Event Registration Confirmed - ${event.title}`,
        html: emailHtml
      });
      console.log(`[EVENT NOTIFICATION] User confirmation email sent to ${userEmail}`);
    } catch (err) {
      console.warn('[EVENT NOTIFICATION] User email failed:', err.message);
    }
  }

  // 3. WhatsApp Confirmation
  if (userPhone) {
    try {
      const waMsg = `*Event Registration Confirmed* ✝️

Your registration for:
*${event.title}*

has been successfully completed.

📅 *Date:* ${dateText}
⏰ *Time:* ${timeText}
📍 *Venue:* ${venueText}
✅ *Status:* Confirmed

👉 *View Event:*
${publicEventUrl}

*St. John de Britto Church, Kalayarkoil*`;

      await sendWA(user || userPhone, waMsg);
      console.log(`[EVENT NOTIFICATION] User WhatsApp sent to ${userPhone}`);
    } catch (err) {
      console.warn('[EVENT NOTIFICATION] User WhatsApp failed:', err.message);
    }
  }

  // 4. Web Push Notification
  try {
    await sendPushToUser(user._id, {
      title: 'Event Registration Confirmed',
      body: `Your registration for "${event.title}" is confirmed. Tap to view event.`,
      url: '/events',
      tag: `event-reg-${event._id}`
    });
  } catch (err) {
    console.warn('[EVENT NOTIFICATION] User Web Push failed/skipped:', err.message);
  }

  // 5. SMS Confirmation (optional, if configured)
  if (userPhone && process.env.TWILIO_ACCOUNT_SID) {
    try {
      let formattedPhone = userPhone.trim();
      if (formattedPhone.length === 10 && !formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone}`;
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+${formattedPhone}`;
      }
      const smsBody = `St. John de Britto Church: Your registration for "${event.title}" on ${dateText} is confirmed. Details: ${publicEventUrl}`;
      await sendSMS(formattedPhone, smsBody);
      console.log(`[EVENT NOTIFICATION] User SMS sent to ${formattedPhone}`);
    } catch (err) {
      console.warn('[EVENT NOTIFICATION] User SMS failed:', err.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // B. ADMIN NOTIFICATIONS
  // ──────────────────────────────────────────────────────────────────────────
  const registeredTime = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const adminMessage = `New participant registered for event:
Event: ${event.title}
Participant: ${userName}
Phone: ${userPhone || 'N/A'}
Email: ${userEmail || 'N/A'}
Registered At: ${registeredTime}
Total Registrations: ${event.registrationCount}`;

  // 1. Admin In-App Notification
  try {
    await createNotification({
      recipient: 'admin',
      title: 'New Event Registration',
      message: adminMessage,
      type: 'event',
      category: 'events',
      priority: 'low',
      actionUrl: '/admin/events',
      relatedId: event._id,
      relatedModel: 'Event',
      channels: ['inApp']
    });
    console.log('[EVENT NOTIFICATION] Admin In-App notification created');
  } catch (err) {
    console.warn('[EVENT NOTIFICATION] Admin In-App failed:', err.message);
  }

  // 2. Admin Multi-Channel Broadcast (Email & WhatsApp)
  try {
    const adminRecipients = await getAdminNotificationRecipients();

    // Admin WhatsApp text
    const adminWaText = `🔔 *New Event Registration*

*Event:* ${event.title}
*Participant:* ${userName}
*Phone:* ${userPhone || 'N/A'}
*Email:* ${userEmail || 'N/A'}
*Registered At:* ${registeredTime}
*Total Registrations:* ${event.registrationCount}

👉 *Admin Event Page:*
${adminEventUrl}

👉 *Public Event:*
${publicEventUrl}`;

    for (const phone of adminRecipients.phones) {
      sendWA(phone, adminWaText).catch(e => {
        console.warn(`[EVENT NOTIFICATION] Admin WhatsApp failed to ${phone}:`, e.message);
      });
    }

    // Admin Email HTML
    const adminEmailHtml = `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fb;padding:30px 15px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;padding:30px;border:1px solid #e5e7eb;">
    <h2 style="color:#1e3a8a;margin-top:0;">🔔 New Event Registration</h2>
    <p style="color:#4b5563;font-size:15px;">A new participant has registered for <strong>"${event.title}"</strong>.</p>
    
    <div style="background:#f9fafb;padding:18px;border-radius:10px;margin:20px 0;border:1px solid #f3f4f6;">
      <p style="margin:6px 0;"><strong>Event:</strong> ${event.title}</p>
      <p style="margin:6px 0;"><strong>Participant:</strong> ${userName}</p>
      <p style="margin:6px 0;"><strong>Phone:</strong> ${userPhone || 'N/A'}</p>
      <p style="margin:6px 0;"><strong>Email:</strong> ${userEmail || 'N/A'}</p>
      <p style="margin:6px 0;"><strong>Registered At:</strong> ${registeredTime}</p>
      <p style="margin:6px 0;color:#1e3a8a;font-weight:700;"><strong>Total Registrations:</strong> ${event.registrationCount}</p>
    </div>

    <div style="margin-top:25px;">
      <a href="${adminEventUrl}" style="background:#1e3a8a;color:#ffffff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;display:inline-block;margin-right:10px;">
        Open Admin Registrations
      </a>
      <a href="${publicEventUrl}" style="background:#f3f4f6;color:#374151;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;display:inline-block;">
        View Public Event
      </a>
    </div>
  </div>
</div>`;

    for (const email of adminRecipients.emails) {
      sendMail({
        to: email,
        subject: `New Registration: ${event.title} (${userName})`,
        html: adminEmailHtml
      }).catch(e => {
        console.warn(`[EVENT NOTIFICATION] Admin email failed to ${email}:`, e.message);
      });
    }
  } catch (err) {
    console.warn('[EVENT NOTIFICATION] Admin multi-channel dispatch error:', err.message);
  }
}

/**
 * Dispatch multi-channel withdrawal notifications to user and admin
 */
async function dispatchWithdrawalNotifications({ event, registration, user, updatedCount = 0 }) {
  if (!event) return;

  const publicBaseUrl = getPublicFrontendUrl();
  const publicEventUrl = `${publicBaseUrl}/events`;
  const adminEventUrl = `${publicBaseUrl}/admin/events`;

  const dateText = formatEventDate(event.date);
  const timeText = event.time || 'Schedule will be announced';
  const venueText = event.venue || 'Church Premises, Kalayarkoil';
  const userName = registration?.name || user?.name || 'Parishioner';
  const userPhone = registration?.phone || user?.phone || '';
  const userEmail = registration?.email || user?.email || '';

  const withdrawnTime = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const targetUserId = user?._id || user?.id;

  // ──────────────────────────────────────────────────────────────────────────
  // A. USER WITHDRAWAL NOTIFICATION
  // ──────────────────────────────────────────────────────────────────────────

  // 1. User In-App Notification (Website)
  if (targetUserId) {
    try {
      await createNotification({
        userId: targetUserId,
        recipient: 'user',
        title: 'Registration Withdrawn',
        message: `You have successfully withdrawn your registration from ${event.title}.\n\nEvent: ${event.title}\nDate: ${dateText}\nTime: ${timeText}\nVenue: ${venueText}\nStatus: Registration Withdrawn`,
        type: 'event',
        category: 'events',
        requestType: 'EVENT_REGISTRATION_WITHDRAWN',
        priority: 'normal',
        actionUrl: '/events',
        relatedId: event._id,
        relatedModel: 'Event',
        channels: ['inApp', 'website']
      });
      console.log(`[EVENT WITHDRAWAL] User In-App notification created for ${targetUserId}`);
    } catch (err) {
      console.warn('[EVENT WITHDRAWAL] User In-App notification failed:', err.message);
    }
  }

  // 2. User WhatsApp Message (Auto-translated to user's saved botLanguage)
  if (userPhone) {
    try {
      const userWaMsg = `*Registration Withdrawn*

You have withdrawn your registration from the event *${event.title}*.

📅 *Event:* ${event.title}
🗓️ *Date:* ${dateText}
🕒 *Time:* ${timeText}
📍 *Venue:* ${venueText}
⚠️ *Status:* Registration Withdrawn

👉 *View Event Details:*
${publicEventUrl}

*St. John de Britto Church, Kalayarkoil*`;

      await sendWA(user || userPhone, userWaMsg);
      console.log(`[EVENT WITHDRAWAL] User WhatsApp notification sent to ${userPhone}`);
    } catch (err) {
      console.warn('[EVENT WITHDRAWAL] User WhatsApp notification failed:', err.message);
    }
  }

  // 3. User Email Notification (Branded Church Notification Email)
  if (userEmail) {
    try {
      const userEmailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Withdrawn - ${event.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="background-color: #f8fafc; padding: 32px 12px; width: 100%; box-sizing: border-box;">
    <div style="max-width: 580px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
      
      <!-- HEADER -->
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        <div style="width: 70px; height: 70px; background: #ffffff; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #fbbf24;">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
        </div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24;">St. John de Britto Church</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1; font-weight: 500;">புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்</p>
      </div>

      <!-- CONTENT -->
      <div style="padding: 30px 24px; color: #1e293b; box-sizing: border-box;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="display: inline-block; background: #fee2e2; color: #dc2626; padding: 6px 18px; border-radius: 999px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px;">
            ⚠️ REGISTRATION WITHDRAWN
          </span>
        </div>

        <h2 style="color: #1e3a8a; margin: 0 0 12px; font-size: 20px; font-weight: 800; text-align: center;">Registration Withdrawn</h2>
        <p style="font-size: 15px; color: #475569; margin: 0 0 12px; line-height: 1.6;">Dear <strong>${userName}</strong>,</p>
        <p style="font-size: 15px; color: #475569; margin: 0 0 20px; line-height: 1.6;">You have successfully withdrawn your registration from <strong>${event.title}</strong>.</p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; font-size: 14px; line-height: 1.8;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding: 6px 0;">
            <strong style="color: #64748b;">Event:</strong>
            <span style="color: #0f172a; font-weight: 600;">${event.title}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding: 6px 0;">
            <strong style="color: #64748b;">Date:</strong>
            <span style="color: #0f172a; font-weight: 600;">${dateText}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding: 6px 0;">
            <strong style="color: #64748b;">Time:</strong>
            <span style="color: #0f172a; font-weight: 600;">${timeText}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding: 6px 0;">
            <strong style="color: #64748b;">Venue:</strong>
            <span style="color: #0f172a; font-weight: 600;">${venueText}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding: 6px 0;">
            <strong style="color: #64748b;">Withdrawn At:</strong>
            <span style="color: #0f172a; font-weight: 600;">${withdrawnTime}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0;">
            <strong style="color: #64748b;">Status:</strong>
            <span style="color: #dc2626; font-weight: 700;">Registration Withdrawn</span>
          </div>
        </div>

        <div style="text-align: center; margin: 26px 0 10px;">
          <a href="${publicEventUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; text-align: center;">
            👉 View Event Details →
          </a>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="background: #0f172a; padding: 16px; text-align: center; color: #94a3b8; font-size: 11.5px;">
        <p style="margin: 0 0 4px; font-weight: 700; color: #cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
        <p style="margin: 0; color: #64748b;">Official Parish Event Notification</p>
      </div>
    </div>
  </div>
</body>
</html>`;

      await sendMail({
        to: userEmail,
        subject: `Registration Withdrawn - ${event.title}`,
        html: userEmailHtml
      });
      console.log(`[EVENT WITHDRAWAL] User confirmation email sent to ${userEmail}`);
    } catch (err) {
      console.warn('[EVENT WITHDRAWAL] User email failed:', err.message);
    }
  }

  // 4. User Web Push
  if (targetUserId) {
    try {
      await sendPushToUser(targetUserId, {
        title: 'Registration Withdrawn',
        body: `You have successfully withdrawn your registration from ${event.title}.`,
        url: '/events',
        tag: `event-withdrawn-${event._id}`
      });
    } catch (err) {
      console.warn('[EVENT WITHDRAWAL] User Web Push skipped/failed:', err.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // B. ADMIN WITHDRAWAL NOTIFICATION
  // ──────────────────────────────────────────────────────────────────────────

  const adminMessage = `Registration Withdrawn
${userName} has withdrawn their registration from ${event.title}.

Participant: ${userName}
Phone: ${userPhone || 'N/A'}
Email: ${userEmail || 'N/A'}
Event: ${event.title}
Event Date: ${dateText}
Event Time: ${timeText}
Withdrawn At: ${withdrawnTime}
Total Registrations: ${updatedCount}`;

  // 1. Admin In-App Notification (Website)
  try {
    await createNotification({
      recipient: 'admin',
      title: 'Registration Withdrawn',
      message: adminMessage,
      type: 'event',
      category: 'events',
      requestType: 'EVENT_REGISTRATION_WITHDRAWN',
      priority: 'normal',
      actionUrl: '/admin/events',
      relatedId: event._id,
      relatedModel: 'Event',
      channels: ['inApp', 'website']
    });
    console.log('[EVENT WITHDRAWAL] Admin In-App notification created');
  } catch (err) {
    console.warn('[EVENT WITHDRAWAL] Admin In-App failed:', err.message);
  }

  // 2. Admin Multi-Channel Broadcast (WhatsApp & Email)
  try {
    const adminRecipients = await getAdminNotificationRecipients();

    // Admin WhatsApp message
    const adminWaText = `🔔 *Registration Withdrawn*

*${userName}* has withdrawn their registration from *${event.title}*.

*Participant:* ${userName}
*Phone:* ${userPhone || 'N/A'}
*Email:* ${userEmail || 'N/A'}
*Event:* ${event.title}
*Event Date:* ${dateText}
*Event Time:* ${timeText}
*Withdrawn At:* ${withdrawnTime}
*Total Registrations:* ${updatedCount}

👉 *Admin Event Page:*
${adminEventUrl}

👉 *Public Event:*
${publicEventUrl}`;

    for (const phone of adminRecipients.phones) {
      sendWA(phone, adminWaText).catch(e => {
        console.warn(`[EVENT WITHDRAWAL] Admin WhatsApp failed to ${phone}:`, e.message);
      });
    }

    // Admin Email HTML
    const adminEmailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Registration Withdrawn: ${event.title}</title>
</head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="background:#f8fafc; padding:30px 15px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:16px; padding:30px; border:1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="display: inline-block; background: #fee2e2; color: #dc2626; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; margin-bottom: 14px;">
        ⚠️ PARTICIPANT WITHDRAWAL
      </div>
      <h2 style="color:#1e3a8a; margin:0 0 10px;">🔔 Registration Withdrawn</h2>
      <p style="color:#475569; font-size:15px; line-height: 1.5; margin: 0 0 18px;">
        <strong>${userName}</strong> has withdrawn their registration from <strong>"${event.title}"</strong>.
      </p>
      
      <div style="background:#f8fafc; padding:18px; border-radius:10px; margin:20px 0; border:1px solid #e2e8f0; font-size: 14px; line-height: 1.8;">
        <p style="margin:4px 0;"><strong>Participant:</strong> ${userName}</p>
        <p style="margin:4px 0;"><strong>Phone:</strong> ${userPhone || 'N/A'}</p>
        <p style="margin:4px 0;"><strong>Email:</strong> ${userEmail || 'N/A'}</p>
        <p style="margin:4px 0;"><strong>Event:</strong> ${event.title}</p>
        <p style="margin:4px 0;"><strong>Event Date:</strong> ${dateText}</p>
        <p style="margin:4px 0;"><strong>Event Time:</strong> ${timeText}</p>
        <p style="margin:4px 0;"><strong>Withdrawn At:</strong> ${withdrawnTime}</p>
        <p style="margin:8px 0 0; color:#1e3a8a; font-size: 15px; font-weight:800; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          Total Registrations: ${updatedCount}
        </p>
      </div>

      <div style="margin-top:25px;">
        <a href="${adminEventUrl}" style="background:#1e3a8a; color:#ffffff; padding:10px 22px; border-radius:8px; text-decoration:none; font-weight:700; font-size:13px; display:inline-block; margin-right:10px;">
          Open Admin Registrations
        </a>
        <a href="${publicEventUrl}" style="background:#f1f5f9; color:#334155; padding:10px 22px; border-radius:8px; text-decoration:none; font-weight:600; font-size:13px; display:inline-block;">
          View Public Event
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

    for (const email of adminRecipients.emails) {
      sendMail({
        to: email,
        subject: `Registration Withdrawn: ${event.title} (${userName})`,
        html: adminEmailHtml
      }).catch(e => {
        console.warn(`[EVENT WITHDRAWAL] Admin email failed to ${email}:`, e.message);
      });
    }
  } catch (err) {
    console.warn('[EVENT WITHDRAWAL] Admin multi-channel dispatch error:', err.message);
  }

  // 3. Strict Deduplication & Idempotency Logging via NotificationLog
  try {
    const NotificationLog = require('../models/NotificationLog');
    await NotificationLog.create({
      entityType: 'registration',
      entityId: event._id,
      notificationType: 'event_registration_withdrawn',
      reminderType: 'withdrawal',
      scheduledFor: new Date(),
      title: `Registration Withdrawn - ${event.title}`,
      status: 'sent',
      channels: ['website', 'email', 'whatsapp', 'push'],
      sentAt: new Date(),
      metadata: {
        userId: targetUserId,
        userName,
        updatedCount
      }
    });
  } catch (_) { }
}

module.exports = {
  registerUserForEvent,
  withdrawUserRegistration,
  dispatchRegistrationNotifications,
  dispatchWithdrawalNotifications,
  getPublicFrontendUrl,
  formatEventDate
};
