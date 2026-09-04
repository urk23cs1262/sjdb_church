const User = require('../models/User');
const OTPVerification = require('../models/OTPVerification');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Document = require('../models/Document');
const Donation = require('../models/Donation');
const Ticket = require('../models/Ticket');
const Announcement = require('../models/Announcement');
const PrayerRequest = require('../models/PrayerRequest');
const DailyVerse = require('../models/DailyVerse');
const TeamMember = require('../models/TeamMember');
const Notification = require('../models/Notification');
const SecurityIncident = require('../models/SecurityIncident');
const { getTodayVerseData } = require('./dailyVerseController');

let timelineResetCutoff = new Date(); // Start timeline fresh from now

const resetTimeline = async (req, res) => {
  try {
    timelineResetCutoff = new Date();
    res.json({ success: true, message: 'Activity timeline cleared successfully. Starting fresh from now!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalUsers,
      totalAdmins,
      newMembersToday,
      newMembersThisMonth,
      todayBookings,
      totalEvents,
      upcomingEventsCount,
      activeAnnouncementsCount,
      pendingBookings,
      pendingDocuments,
      openTickets,
      pendingPrayers,
      totalTeamMembers,
      activeTeamMembers,
      otpPendingCount,
      loginAttemptsTodayCount,
      recentSecurityAlerts,
      donationsTodayAgg,
      donationsMonthAgg,
      donationsYearAgg,
      totalDonationsAgg,
      recentUsers,
      upcomingEvents,
      recentBookings,
      recentDonations,
      recentTickets,
      recentAnnouncements,
      todayVerse,
      allUsersForSpecialDays
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Booking.countDocuments({
        $or: [
          { massDate: { $gte: startOfToday, $lte: endOfToday } },
          { createdAt: { $gte: startOfToday, $lte: endOfToday } }
        ]
      }),
      Event.countDocuments({ isPublished: true }),
      Event.countDocuments({ date: { $gte: startOfToday }, isPublished: true }),
      Announcement.countDocuments({ isPublished: { $ne: false } }),
      Booking.countDocuments({ status: 'pending' }),
      Document.countDocuments({ status: 'pending' }),
      Ticket.countDocuments({ status: { $in: ['open', 'in_progress', 'pending'] } }),
      PrayerRequest.countDocuments({ status: 'pending' }),
      TeamMember.countDocuments(),
      TeamMember.countDocuments({ isActive: true }),
      User.countDocuments({
        $or: [
          { otpVerified: false },
          { isVerified: false },
          { account_verified: false },
          { otpVerifiedAt: null },
          { otpVerifiedAt: { $lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
        ],
        isActive: { $ne: false },
        role: { $ne: 'admin' }
      }),
      Notification.countDocuments({ recipient: 'admin', category: { $in: ['security', 'auth', 'account'] }, createdAt: { $gte: startOfToday } }),
      Notification.find({ recipient: 'admin', category: { $in: ['security', 'auth', 'account', 'system'] } }).sort({ createdAt: -1 }).limit(10),
      Donation.aggregate([
        { $match: { createdAt: { $gte: startOfToday, $lte: endOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Donation.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Donation.aggregate([
        { $match: { createdAt: { $gte: startOfYear } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      User.find({ createdAt: { $gte: timelineResetCutoff } }).select('name email phone parishMemberId familyId createdAt profilePhoto registrationReportPdfUrl').sort({ createdAt: -1 }).limit(10),
      Event.find({ date: { $gte: startOfToday }, isPublished: true }).sort({ date: 1 }).limit(5),
      Booking.find({ createdAt: { $gte: timelineResetCutoff } }).populate('userId', 'name').sort({ createdAt: -1 }).limit(10),
      Donation.find({ createdAt: { $gte: timelineResetCutoff } }).populate('userId', 'name').sort({ createdAt: -1 }).limit(10),
      Ticket.find({ createdAt: { $gte: timelineResetCutoff } }).populate('userId', 'name').sort({ createdAt: -1 }).limit(5),
      Announcement.find({ createdAt: { $gte: timelineResetCutoff } }).sort({ createdAt: -1 }).limit(5),
      getTodayVerseData(),
      User.find().select('name phone dob weddingDate profilePhoto parishMemberId familyId')
    ]);

    // Calculate Birthdays and Anniversaries accurately in current month
    const currentMonth = now.getMonth();

    const allBirthdaysThisMonth = allUsersForSpecialDays.filter(u => {
      if (!u.dob) return false;
      const d = new Date(u.dob);
      return !isNaN(d.getTime()) && d.getMonth() === currentMonth;
    });

    const allAnniversariesThisMonth = allUsersForSpecialDays.filter(u => {
      if (!u.weddingDate) return false;
      const d = new Date(u.weddingDate);
      return !isNaN(d.getTime()) && d.getMonth() === currentMonth;
    });

    const upcomingBirthdays = allBirthdaysThisMonth.slice(0, 5);
    const upcomingAnniversaries = allAnniversariesThisMonth.slice(0, 5);

    // Build timeline activities accurately
    const activities = [];

    recentUsers.forEach(u => {
      activities.push({
        id: `user-${u._id}`,
        type: 'member',
        icon: '',
        title: 'New Member Registered',
        description: `${u.name} registered as a parish member`,
        time: u.createdAt
      });
    });

    recentBookings.forEach(b => {
      const person = b.personName || b.familyName || b.userId?.name || 'Member';
      activities.push({
        id: `booking-${b._id}`,
        type: 'booking',
        icon: '',
        title: 'Mass Booking Requested',
        description: `Booking for ${b.intentionType || 'Mass'} (${person})`,
        time: b.createdAt
      });
    });

    recentDonations.forEach(d => {
      const donor = d.donorName || d.userId?.name || 'Anonymous';
      activities.push({
        id: `donation-${d._id}`,
        type: 'donation',
        icon: '',
        title: 'Donation Received',
        description: `₹${d.amount} donated by ${donor} for ${d.type || 'General'}`,
        time: d.createdAt
      });
    });

    recentTickets.forEach(t => {
      const requester = t.userId?.name || t.name || 'Member';
      activities.push({
        id: `ticket-${t._id}`,
        type: 'ticket',
        icon: '',
        title: 'Support Ticket Raised',
        description: `${t.subject || 'Ticket'} submitted by ${requester}`,
        time: t.createdAt
      });
    });

    recentAnnouncements.forEach(a => {
      activities.push({
        id: `announcement-${a._id}`,
        type: 'announcement',
        icon: '',
        title: 'Announcement Published',
        description: a.title,
        time: a.createdAt
      });
    });

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers + totalAdmins,
        registeredMembersOnly: totalUsers,
        totalAdmins,
        newMembersToday,
        newMembersThisMonth,
        otpPendingCount,
        loginAttemptsTodayCount,
        todayBookings,
        totalEvents,
        upcomingEventsCount,
        activeAnnouncementsCount,
        pendingBookings,
        pendingDocuments,
        openTickets,
        pendingPrayers,
        pendingMessages: pendingPrayers + openTickets,
        totalTeamMembers,
        activeTeamMembers,
        upcomingBirthdaysCount: allBirthdaysThisMonth.length,
        upcomingAnniversariesCount: allAnniversariesThisMonth.length,
        donationsToday: donationsTodayAgg[0]?.total || 0,
        donationsThisMonth: donationsMonthAgg[0]?.total || 0,
        donationsThisYear: donationsYearAgg[0]?.total || 0,
        totalDonations: totalDonationsAgg[0]?.total || 0
      },
      recentUsers,
      upcomingEvents,
      upcomingBirthdays,
      upcomingAnniversaries,
      todayVerse,
      recentSecurityAlerts,
      recentActivities: activities.slice(0, 10)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Forces a global OTP re-verification cycle for all parishioners and administrators.
 * Increments authVersion and tokenVersion to immediately invalidate all active JWT sessions on all devices,
 * sets otpVerified: false so the next login requires a fresh OTP,
 * and sends in-app notifications, web push notifications, and email alerts to all users.
 */
const forceGlobalOtpReverification = async (req, res) => {
  try {
    const OTPVerification = require('../models/OTPVerification');
    const { notifyAdmin } = require('../services/adminNotificationService');
    const { createNotification } = require('../services/notificationService');
    const { sendPushBroadcast } = require('../services/webPushService');
    const { sendMail } = require('../config/mailer');

    // 1. Update all users and admins: set otpVerified: false, otpVerifiedAt: null, increment authVersion & tokenVersion
    const result = await User.updateMany(
      {},
      {
        $set: {
          otpVerified: false,
          otpVerifiedAt: null
        },
        $inc: {
          tokenVersion: 1,
          authVersion: 1
        },
        $unset: {
          otp: "",
          otpExpires: ""
        }
      }
    );

    // 2. Invalidate all pending OTPVerification sessions
    await OTPVerification.updateMany(
      { status: 'pending' },
      { $set: { status: 'replaced' } }
    );

    // 3. Create In-App Notification (Broadcast to all parishioners)
    const notifTitle = 'Security Advisory: Account Re-verification & OTP Required';
    const notifMessage = 'Dear Parishioners, for enhanced account security, all active sessions have been safely reset. Please log in with your credentials and verify the 6-digit OTP code to continue accessing your parish profile.';

    let inAppNotif = null;
    try {
      inAppNotif = await createNotification({
        isBroadcast: true,
        title: notifTitle,
        message: notifMessage,
        type: 'security',
        category: 'security',
        priority: 'high',
        recipient: 'user',
        actionUrl: '/login',
        channels: ['in_app']
      });
    } catch (notifErr) {
      console.warn('[forceGlobalOtpReverification] In-app notification creation error:', notifErr.message);
    }

    // 4. Send Web Push Notification Broadcast
    try {
      await sendPushBroadcast({
        title: 'Security Alert — Re-verification Required',
        body: 'All active sessions have been safely reset. Please log in with your password and verify your OTP.',
        notificationId: inAppNotif?._id ? inAppNotif._id.toString() : 'global-otp-reset',
        url: '/login',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: 'sjdb-global-otp-reset',
        renotify: true
      });
    } catch (pushErr) {
      console.warn('[forceGlobalOtpReverification] Push broadcast error:', pushErr.message);
    }

    // 5. Send Security Advisory Email to All Registered Users
    const clientUrl = (process.env.CLIENT_URL || 'https://stjb-church.vercel.app').replace('http://localhost:5173', 'https://stjb-church.vercel.app');

    // Fetch all users with valid email
    const usersWithEmail = await User.find({
      email: { $exists: true, $ne: null, $ne: '' },
      isActive: { $ne: false }
    }).select('name email preferredLanguage parishMemberId');

    // Send emails asynchronously in the background so HTTP response is fast
    (async () => {
      console.log(`[forceGlobalOtpReverification] Starting email broadcast to ${usersWithEmail.length} users...`);
      let emailSuccessCount = 0;
      let emailFailCount = 0;

      for (const u of usersWithEmail) {
        if (!u.email) continue;
        const userName = u.name || 'Parishioner';
        const userMemberId = u.parishMemberId || 'Parish Member';

        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Security Advisory: Account Re-verification Required</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 12px 8px !important; }
      .email-card { border-radius: 12px !important; }
      .email-body { padding: 20px 14px !important; }
      .email-header { padding: 25px 15px !important; }
      .btn-responsive { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div class="email-wrapper" style="background-color: #f1f5f9; padding: 24px 12px; width: 100%; box-sizing: border-box;">
    <div class="email-card" style="max-width: 580px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
      
      <!-- HEADER -->
      <div class="email-header" style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        <div style="width: 75px; height: 75px; background: #ffffff; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #fbbf24; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
        </div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24; letter-spacing: 0.5px;">St. John de britto Church</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">புனித அருளானந்தர் தேவாலயம்</p>
        <div style="display: inline-block; margin-top: 12px; padding: 4px 14px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 999px; font-size: 11px; font-weight: 700; color: #fef08a; text-transform: uppercase; letter-spacing: 0.8px;">
          Official Security Advisory
        </div>
      </div>

      <!-- BODY CONTENT -->
      <div class="email-body" style="padding: 24px 18px;">
        <h2 style="margin: 0 0 10px; font-size: 17px; font-weight: 800; color: #0f172a;">
          Dear ${userName},
        </h2>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475569;">
          As part of our periodic parish security routine, church administration has initiated a <strong>global session reset and OTP re-verification cycle</strong> for all user and administrative accounts.
        </p>

        <!-- HIGHLIGHT BOX -->
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 20px;">
          <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #92400e;">
             What this means for your account:
          </p>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #78350f; line-height: 1.5;">
            <li style="margin-bottom: 4px;"><strong>Active Sessions Terminated:</strong> All devices currently signed into your account have been securely logged out.</li>
            <li style="margin-bottom: 4px;"><strong>Data Protected:</strong> Your sacraments, family records, mass bookings, and profile remain completely safe.</li>
            <li><strong>Seamless 30-Day Window:</strong> After verifying your OTP once, you will not be prompted again on this device for 30 days.</li>
          </ul>
        </div>

        <!-- ACTION REQUIRED -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 16px; text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px; font-size: 14.5px; font-weight: 700; color: #1e3a8a;">
            How to Re-authenticate / கணக்கை சரிபார்க்கும் முறை:
          </h3>
          <p style="margin: 0 0 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
            Click the button below to visit the church portal, sign in with your password, and enter the 6-digit OTP code sent to your registered contact.
          </p>
          <a href="${clientUrl}/login" class="btn-responsive" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); text-align: center;">
            Log In & Verify Account →
          </a>
        </div>

        <!-- TAMIL SECTION -->
        <div style="border-top: 1px dashed #cbd5e1; padding-top: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #334155;">
            தமிழ் அறிவிப்பு (Tamil Notice):
          </p>
          <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
            பங்கு குடும்ப உறுப்பினர்களின் கணக்கு பாதுகாப்பிற்காக அனைத்து சாதனங்களிலும் அமர்வுகள் மீட்டமைக்கப்பட்டுள்ளன. தயவுசெய்து உங்கள் கடவுச்சொல் மற்றும் புதிய OTP குறியீட்டைப் பயன்படுத்தி மீண்டும் உள்நுழையவும்.
          </p>
        </div>

        <!-- FOOTER INFO -->
        <div style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #64748b; line-height: 1.5;">
          <strong>Member Name:</strong> ${userName} &bull; <strong>Parish ID:</strong> <span style="font-family: monospace;">${userMemberId}</span>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="background-color: #0f172a; padding: 16px 18px; text-align: center; color: #94a3b8; font-size: 11.5px;">
        <p style="margin: 0; font-weight: 700; color: #f8fafc;">St. John de britto Church, Kalayarkoil</p>
        <p style="margin: 4px 0 0; color: #64748b;">Automated Security Advisory • Do not reply</p>
      </div>

    </div>
  </div>
</body>
</html>
        `;

        try {
          await sendMail({
            to: u.email,
            subject: `Security Advisory: Account Re-verification Required — St. John de britto Church`,
            html: emailHtml
          });
          emailSuccessCount++;
        } catch (e) {
          emailFailCount++;
          console.error(`[forceGlobalOtpReverification] Email send error to ${u.email}:`, e.message);
        }
      }
      console.log(`[forceGlobalOtpReverification] Email broadcast completed: ${emailSuccessCount} sent, ${emailFailCount} failed.`);
    })().catch(e => console.error('[forceGlobalOtpReverification] Async email broadcast error:', e.message));

    // 6. Notify Admin Activity Stream
    notifyAdmin({
      type: 'SECURITY_ALERT',
      req,
      title: 'Global OTP Re-verification & Broadcast Sent',
      reason: `Admin triggered global OTP reset. ${result.modifiedCount} accounts reset. In-app notifications, web push broadcast, and ${usersWithEmail.length} security advisory emails dispatched to all users.`
    }).catch(e => console.warn('Admin notification error:', e.message));

    res.json({
      success: true,
      message: `Global OTP Re-verification successfully activated. ${result.modifiedCount} accounts have been reset, in-app notifications created, web push broadcast sent, and security advisory emails are being dispatched to ${usersWithEmail.length} registered users.`,
      modifiedCount: result.modifiedCount,
      emailRecipientsCount: usersWithEmail.length
    });
  } catch (err) {
    console.error('forceGlobalOtpReverification error:', err);
    res.status(500).json({ success: false, message: 'Failed to trigger global OTP reset: ' + err.message });
  }
};

/**
 * Returns the list of all parishioners whose account re-verification is pending.
 */
const getPendingOtpUsers = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const pendingUsers = await User.find({
      $or: [
        { otpVerified: false },
        { isVerified: false },
        { account_verified: false },
        { otpVerifiedAt: null },
        { otpVerifiedAt: { $lte: thirtyDaysAgo } }
      ],
      isActive: { $ne: false },
      role: { $ne: 'admin' }
    })
      .select('name email phone parishMemberId familyId createdAt lastLogin last_verified_at otpVerifiedAt')
      .sort({ createdAt: -1 });

    const formatted = pendingUsers.map(u => {
      const refDate = u.otpVerifiedAt || u.last_verified_at || u.createdAt || now;
      const daysPending = Math.max(0, Math.floor((now.getTime() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24)));
      return {
        _id: u._id,
        name: u.name || 'Anonymous Parishioner',
        email: u.email || 'None',
        phone: u.phone || 'None',
        parishMemberId: u.parishMemberId || 'N/A',
        familyId: u.familyId || 'N/A',
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        otpVerifiedAt: u.otpVerifiedAt,
        daysPending: daysPending > 30 ? daysPending - 30 : daysPending,
        status: !u.otpVerifiedAt ? 'Initial Verification Pending' : '30-Day Window Expired'
      };
    });

    res.json({ success: true, count: formatted.length, users: formatted });
  } catch (err) {
    console.error('getPendingOtpUsers error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Manually dispatches re-verification reminders to all pending parishioners and emails the summary report to Admin.
 */
const remindPendingOtpUsers = async (req, res) => {
  try {
    const { checkAndSendMonthlyVerificationReminders } = require('../services/accountVerificationService');
    const result = await checkAndSendMonthlyVerificationReminders({ forceAll: true, triggerSource: 'admin_dashboard_manual' });

    res.json({
      success: true,
      message: `Re-verification reminders sent to ${result.remindedCount} pending parishioners across Email, Web Push, In-App, and WhatsApp. Full report delivered to Admin.`,
      remindedCount: result.remindedCount,
      pendingCount: result.pendingCount,
      adminReportSent: result.adminReportSent
    });
  } catch (err) {
    console.error('remindPendingOtpUsers error:', err);
    res.status(500).json({ success: false, message: 'Failed to send reminders: ' + err.message });
  }
};

module.exports = {
  getDashboardStats,
  resetTimeline,
  forceGlobalOtpReverification,
  getPendingOtpUsers,
  remindPendingOtpUsers
};
