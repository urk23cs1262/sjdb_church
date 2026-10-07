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
const SecurityAuditLog = require('../models/SecurityAuditLog');
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
      todayAdminNotifsCount,
      todaySecurityAuditCount,
      recentSecurityLogs,
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
        isActive: { $ne: false },
        $or: [
          { verificationRequired: true },
          { otpVerificationRequired: true },
          { verificationStatus: { $in: ['Pending Verification', 'pending', 'expired', 'Expired', 'Overdue'] } },
          { isVerified: false },
          { verificationExpiresAt: { $lte: now } },
          { nextVerificationAt: { $lte: now } },
          { lastVerifiedAt: null }
        ]
      }),
      Notification.countDocuments({ recipient: 'admin', category: { $in: ['security', 'auth', 'account'] }, createdAt: { $gte: startOfToday } }),
      SecurityAuditLog.countDocuments({ timestamp: { $gte: startOfToday } }),
      SecurityAuditLog.find({
        timestamp: { $gte: timelineResetCutoff },
        eventType: {
          $in: [
            'GLOBAL_OTP_RESET_INITIATED',
            'GLOBAL_OTP_RESET',
            'GLOBAL_OTP_REVERIFICATION_SUCCESS',
            'USER_OTP_REVERIFIED',
            'ADMIN_OTP_REVERIFIED',
            'OTP_REVERIFICATION_REMINDER_SENT',
            'OTP_REVERIFICATION_EXPIRED'
          ]
        }
      }).populate('userId', 'name role').sort({ timestamp: -1 }).limit(15),
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

    // Add security events to timeline
    (recentSecurityLogs || []).forEach(sec => {
      let title = 'SECURITY EVENT';
      let desc = sec.details?.description || 'Security audit log recorded';
      const person = sec.userId?.name || sec.details?.userName || 'Parishioner';
      const role = sec.userId?.role || sec.details?.userRole || 'User';
      const isAdminRole = role === 'admin' || role === 'priest';

      if (sec.eventType === 'GLOBAL_OTP_RESET_INITIATED' || sec.eventType === 'GLOBAL_OTP_RESET') {
        title = 'GLOBAL OTP RESET INITIATED';
        desc = `Global OTP reset initiated by Admin — ${sec.affectedCount || 0} users affected.`;
      } else if (sec.eventType === 'GLOBAL_OTP_REVERIFICATION_SUCCESS' || sec.eventType === 'USER_OTP_REVERIFIED' || sec.eventType === 'ADMIN_OTP_REVERIFIED') {
        title = isAdminRole ? 'ADMIN OTP RE-VERIFIED' : 'USER OTP RE-VERIFIED';
        desc = isAdminRole ? `Admin ${person} re-verified successfully.` : `${person} re-verified successfully.`;
      } else if (sec.eventType === 'OTP_REVERIFICATION_REMINDER_SENT') {
        title = 'OTP RE-VERIFICATION REMINDER SENT';
        desc = sec.details?.description || `Re-verification reminders sent to ${sec.affectedCount || 'pending'} accounts.`;
      } else if (sec.eventType === 'OTP_REVERIFICATION_EXPIRED') {
        title = 'OTP RE-VERIFICATION EXPIRED';
        desc = sec.details?.description || `Verification window expired for ${person}.`;
      }

      activities.push({
        id: `security-${sec._id}`,
        type: 'security',
        icon: '🔐',
        title,
        description: desc,
        time: sec.timestamp
      });
    });

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    const totalSecurityEventsToday = (todaySecurityAuditCount || 0) + (todayAdminNotifsCount || 0);

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers + totalAdmins,
        registeredMembersOnly: totalUsers,
        totalAdmins,
        newMembersToday,
        newMembersThisMonth,
        otpPendingCount,
        loginAttemptsTodayCount: totalSecurityEventsToday,
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
 * Forces a global OTP re-verification requirement for all regular parishioners.
 * Sets otpVerificationRequired: true and verificationStatus: 'Pending Verification'
 * WITHOUT invalidating current sessions prematurely. Admins/priests are exempt.
 * Enforces 6-digit OTP verification upon the user's next login attempt.
 */
const forceGlobalOtpReverification = async (req, res) => {
  try {
    const { triggerGlobalOtpReset } = require('../services/globalOtpResetService');
    const result = await triggerGlobalOtpReset({ adminUser: req.user, req });

    return res.json({
      success: true,
      message: `Global OTP reset initiated for all ${result.affectedCount} registered users and administrators. Security notifications dispatched across all channels.`,
      resetId: result.resetId,
      affectedCount: result.affectedCount,
      deadline: result.deadline
    });
  } catch (err) {
    console.error('forceGlobalOtpReverification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to trigger global OTP reset: ' + err.message });
  }
};

const getPendingOtpUsers = async (req, res) => {
  try {
    const { getPendingOtpUsersList } = require('../services/globalOtpResetService');
    const users = await getPendingOtpUsersList();
    res.json({ success: true, count: users.length, users });
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
    const { checkAndSendGlobalResetReminders, getPendingOtpUsersList } = require('../services/globalOtpResetService');
    await checkAndSendGlobalResetReminders({ forceDay: 1 });
    const users = await getPendingOtpUsersList();

    res.json({
      success: true,
      message: `Re-verification reminders sent to ${users.length} pending accounts across Email, Web Push, In-App, and WhatsApp.`,
      remindedCount: users.length,
      pendingCount: users.length
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
