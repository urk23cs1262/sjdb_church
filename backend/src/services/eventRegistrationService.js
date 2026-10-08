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
const { sendMail } = require('../config/mailer');
const { sendSMS } = require('../config/twilio');
const { sendPushToUser } = require('./webPushService');
const { getSiteUrl } = require('../config/siteRoutes');
const { getAdminEmails, getAdminPhones } = require('../config/contactConfig');

function sendWA(phoneOrUser, text) {
  try {
    const { sendWhatsAppNotification } = require('./whatsAppNotificationService');
    return sendWhatsAppNotification(phoneOrUser, text).catch(err => {
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

  // Remove from EventRegistration collection
  await EventRegistration.deleteMany({
    eventId: event._id,
    userId
  });

  // Remove from embedded registrations array
  const initialLength = (event.registrations || []).length;
  event.registrations = (event.registrations || []).filter(
    r => r.userId?.toString() !== userId.toString()
  );
  event.registrationCount = Math.max(0, event.registrations.length);
  await event.save();

  if (initialLength === event.registrations.length) {
    const err = new Error('You are not currently registered for this event.');
    err.statusCode = 400;
    throw err;
  }

  console.log(`[EVENT WITHDRAWAL] User (${userId}) withdrew from "${event.title}". Total: ${event.registrationCount}`);

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

module.exports = {
  registerUserForEvent,
  withdrawUserRegistration,
  dispatchRegistrationNotifications,
  getPublicFrontendUrl,
  formatEventDate
};
