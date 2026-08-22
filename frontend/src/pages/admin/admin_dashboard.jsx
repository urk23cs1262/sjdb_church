import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FiUsers, FiBriefcase, FiVolume2, FiBookOpen, FiCalendar, FiFileText, FiMessageSquare, FiDollarSign, FiSettings, FiImage, FiBell, FiGift, FiHeart, FiClock, FiTool, FiRefreshCw, FiShield, FiDownload, FiCheckCircle, FiKey } from 'react-icons/fi';
import { SiWhatsapp } from 'react-icons/si';
import { GiSpellBook, GiChurch, GiCrucifix, GiPrayer } from 'react-icons/gi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import { useNotifications } from '../../context/context_notification_context';
import AdminAnalyticsSection from '../../components/admin/admin_analytics_section';

const COLORS = ['#d4a017', '#1e3a8a', '#800020', '#059669', '#7c3aed'];

const NAV_ITEMS = [
  { icon: <FiUsers className="text-2xl" />, label: 'Users', path: '/admin/users', color: 'bg-blue-500' },
  { icon: <GiChurch className="text-2xl" />, label: 'Anbiyams', path: '/admin/anbiyam', color: 'bg-indigo-600' },
  { icon: <FiBriefcase className="text-2xl" />, label: 'Manage Team', path: '/admin/team', color: 'bg-emerald-600' },
  { icon: <GiChurch className="text-2xl" />, label: 'Priests', path: '/admin/priests', color: 'bg-amber-600' },
  { icon: <FiCalendar className="text-2xl" />, label: 'Events', path: '/admin/events', color: 'bg-emerald-500' },
  { icon: <FiImage className="text-2xl" />, label: 'Gallery', path: '/admin/gallery', color: 'bg-purple-600' },
  { icon: <FiVolume2 className="text-2xl" />, label: 'Announcements', path: '/admin/announcements', color: 'bg-orange-500' },
  { icon: <FiBookOpen className="text-2xl" />, label: 'Bookings', path: '/admin/bookings', color: 'bg-indigo-600' },
  { icon: <FiFileText className="text-2xl" />, label: 'Documents', path: '/admin/documents', color: 'bg-teal-600' },
  { icon: <FiDollarSign className="text-2xl" />, label: 'Donations', path: '/admin/donations', color: 'bg-amber-500' },
  { icon: <FiMessageSquare className="text-2xl" />, label: 'Tickets', path: '/admin/tickets', color: 'bg-rose-600' },
  { icon: <GiPrayer className="text-2xl" />, label: 'Prayers', path: '/admin/prayers', color: 'bg-yellow-600' },
  { icon: <SiWhatsapp className="text-2xl" />, label: 'WhatsApp Bot', path: '/admin/whatsapp', color: 'bg-emerald-500' },
  { icon: <FiSettings className="text-2xl" />, label: 'Site Settings', path: '/admin/settings', color: 'bg-slate-700' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changingVerse, setChangingVerse] = useState(false);
  const [resettingOtp, setResettingOtp] = useState(false);
  const [showOtpResetModal, setShowOtpResetModal] = useState(false);
  const [showPendingOtpModal, setShowPendingOtpModal] = useState(false);
  const [pendingUsersList, setPendingUsersList] = useState([]);
  const [loadingPendingUsers, setLoadingPendingUsers] = useState(false);
  const [remindingPendingUsers, setRemindingPendingUsers] = useState(false);
  const { adminUnreadCount } = useNotifications();

  const fetchDashboardData = () => {
    api.get('/admin/dashboard')
      .then(r => setStats(r.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  const handleOpenPendingOtpModal = async () => {
    setShowPendingOtpModal(true);
    setLoadingPendingUsers(true);
    try {
      const res = await api.get('/admin/pending-otp-users');
      if (res.data.success) {
        setPendingUsersList(res.data.users || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch pending users');
    } finally {
      setLoadingPendingUsers(false);
    }
  };

  const handleRemindPendingUsers = async () => {
    setRemindingPendingUsers(true);
    try {
      const res = await api.post('/admin/remind-pending-otp');
      if (res.data.success) {
        toast.success(res.data.message || 'Re-verification reminders sent to all pending parishioners and report delivered to Admin!');
        fetchDashboardData();
        const refreshRes = await api.get('/admin/pending-otp-users');
        if (refreshRes.data.success) {
          setPendingUsersList(refreshRes.data.users || []);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch reminders');
    } finally {
      setRemindingPendingUsers(false);
    }
  };

  const handleForceGlobalOtpReset = async () => {
    setResettingOtp(true);
    try {
      const res = await api.post('/admin/force-otp-reverification');
      if (res.data.success) {
        toast.success(res.data.message || 'Global OTP Re-verification cycle activated!');
        setShowOtpResetModal(false);
        fetchDashboardData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger global OTP reset');
    } finally {
      setResettingOtp(false);
    }
  };

  const handleChangeVerse = async () => {
    setChangingVerse(true);
    try {
      const res = await api.post('/settings/daily-verses/change-today');
      if (res.data.success && res.data.verse) {
        setStats(prev => ({
          ...prev,
          todayVerse: res.data.verse
        }));
        toast.success(`Today's verse changed to ${res.data.verse.ref || res.data.verse.reference}!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change verse');
    } finally {
      setChangingVerse(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const s = stats?.stats || {};

  const STAT_CARDS = [
    {
      icon: <FiUsers className="text-xl" />,
      label: 'Registered Members',
      value: s.totalUsers || 0,
      subText: `+${s.newMembersThisMonth || 0} this month`,
      color: 'from-blue-700 to-indigo-900',
      link: '/admin/users'
    },
    {
      icon: <FiBookOpen className="text-xl" />,
      label: "Today's Mass Bookings",
      value: s.todayBookings || 0,
      subText: `${s.pendingBookings || 0} pending review`,
      color: 'from-amber-600 to-amber-800',
      urgent: s.pendingBookings > 0,
      link: '/admin/bookings'
    },
    {
      icon: <FiDollarSign className="text-xl" />,
      label: 'Monthly Donations',
      value: `₹${(s.donationsThisMonth || 0).toLocaleString()}`,
      subText: `₹${(s.donationsToday || 0).toLocaleString()} today`,
      badge: currentMonthYear,
      color: 'from-emerald-600 to-teal-800',
      link: '/admin/donations'
    },
    {
      icon: <FiCalendar className="text-xl" />,
      label: 'Upcoming Events',
      value: s.upcomingEventsCount || 0,
      subText: `${s.totalEvents || 0} total published`,
      color: 'from-purple-600 to-indigo-800',
      link: '/admin/events'
    },
    {
      icon: <FiBell className="text-xl" />,
      label: 'Active Announcements',
      value: s.activeAnnouncementsCount || 0,
      subText: 'Published on portal',
      color: 'from-rose-600 to-pink-800',
      link: '/admin/announcements'
    },
    {
      icon: <FiGift className="text-xl" />,
      label: 'Upcoming Birthdays',
      value: s.upcomingBirthdaysCount ?? (stats?.upcomingBirthdays?.length || 0),
      subText: 'In current month',
      color: 'from-orange-500 to-amber-700',
      link: '/admin/users'
    },
    {
      icon: <FiHeart className="text-xl" />,
      label: 'Wedding Anniversaries',
      value: s.upcomingAnniversariesCount ?? (stats?.upcomingAnniversaries?.length || 0),
      subText: 'Parish couples this month',
      color: 'from-pink-600 to-purple-800',
      link: '/admin/users'
    },
    {
      icon: <FiBriefcase className="text-xl" />,
      label: 'Manage Team',
      value: s.totalTeamMembers || 0,
      subText: `${s.activeTeamMembers || 0} active members`,
      color: 'from-sky-600 to-blue-800',
      link: '/admin/team'
    },
    {
      icon: <FiMessageSquare className="text-xl" />,
      label: 'Pending Messages',
      value: s.pendingMessages || 0,
      subText: `${s.openTickets || 0} tickets & ${s.pendingPrayers || 0} prayers`,
      color: 'from-amber-700 to-red-800',
      urgent: s.pendingMessages > 0,
      link: '/admin/tickets'
    },
    {
      icon: <FiDollarSign className="text-xl" />,
      label: 'Total All-Time Donations',
      value: `₹${(s.totalDonations || 0).toLocaleString()}`,
      subText: `₹${(s.donationsThisYear || 0).toLocaleString()} this year`,
      color: 'from-amber-600 to-yellow-800',
      link: '/admin/donations'
    }
  ];

  const handleClearTimeline = async () => {
    try {
      await api.post('/admin/reset-timeline');
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to reset timeline:', err);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shadow-xs gap-2">
        <h1 className="font-display text-lg sm:text-2xl font-black text-church-royal-blue truncate">SJDB Admin Dashboard</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/admin/maintenance"
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 via-red-600 to-amber-700 hover:from-amber-700 hover:via-red-700 hover:to-amber-800 text-white rounded-xl sm:rounded-2xl font-extrabold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 cursor-pointer whitespace-nowrap group"
            title="Maintenance Mode Control"
          >
            <FiTool className="text-base sm:text-lg text-amber-200 group-hover:rotate-45 transition-transform duration-300" />
            <span className="hidden sm:inline">Maintenance Mode</span>
          </Link>

          <Link
            to="/admin/notifications"
            className="relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl bg-church-royal-blue/5 text-church-royal-blue hover:bg-church-royal-blue/10 border border-church-royal-blue/20 transition-all text-xs sm:text-sm font-extrabold shadow-xs"
            title="Admin Notifications"
          >
            <span className="relative flex items-center justify-center">
              <FiBell className="text-lg sm:text-lg text-church-gold" />
              {adminUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse ring-2 ring-white" />
              )}
            </span>
            <span className="hidden sm:inline">Notifications</span>
            {adminUnreadCount > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-black px-1.5 py-0.5 rounded-full">
                {adminUnreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="p-3.5 sm:p-6 max-w-full overflow-hidden">
        {loading ? <SectionLoader /> : (
          <>
            {/* Today's Scripture Banner */}
            {stats?.todayVerse && (
              <div className="bg-gradient-to-r from-church-royal-blue to-blue-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-church-gold/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 mb-6 min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-church-gold text-white font-bold text-2xl sm:text-3xl flex items-center justify-center flex-shrink-0 shadow-gold">
                    <GiSpellBook />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-church-gold bg-white/15 px-2.5 py-1 rounded-full inline-block truncate max-w-full">
                      TODAY'S SCRIPTURE — {stats.todayVerse.ref || stats.todayVerse.reference}
                    </span>
                    <p className="text-sm sm:text-base italic text-gray-100 font-serif mt-1.5 line-clamp-3 leading-relaxed">
                      "{stats.todayVerse.verseTextEn || stats.todayVerse.english || stats.todayVerse.verseTextTa || stats.todayVerse.tamil}"
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0 self-end md:self-auto w-full md:w-auto justify-end mt-2 md:mt-0">
                  <button
                    type="button"
                    onClick={handleChangeVerse}
                    disabled={changingVerse}
                    className="bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/60 text-amber-200 hover:text-white text-xs sm:text-sm py-2 px-3.5 sm:px-4 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FiRefreshCw className={`text-sm ${changingVerse ? 'animate-spin' : ''}`} />
                    <span>{changingVerse ? 'Changing...' : 'Change Verse'}</span>
                  </button>
                  <Link to="/bible-verse" className="btn-gold text-xs sm:text-sm py-2 px-3.5 sm:px-4 whitespace-nowrap font-bold shadow-gold flex-shrink-0">
                    Read Full Verse
                  </Link>
                </div>
              </div>
            )}

            {/* Stat Cards Grid — 2 cols mobile, 3 cols tablet, 5 cols large desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5 mb-8">
              {STAT_CARDS.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`bg-gradient-to-br ${card.color} rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-white shadow-lg flex flex-col justify-between h-full border border-white/10 ${card.urgent ? 'ring-2 ring-red-400 ring-offset-2' : ''
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-bold shadow-xs text-base sm:text-lg">
                      {card.icon}
                    </div>
                    {card.badge && (
                      <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border border-white/20 shadow-2xs">
                        {card.badge}
                      </span>
                    )}
                    {card.urgent && (
                      <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
                        Action!
                      </span>
                    )}
                  </div>
                  <div className="mt-3 sm:mt-4">
                    <div className="text-3xl sm:text-4xl font-black font-display tracking-tight leading-none">{card.value}</div>
                    <p className="font-extrabold text-xs sm:text-sm text-white mt-1.5 sm:mt-1 leading-snug">{card.label}</p>
                    <p className="text-[11px] sm:text-[11px] font-medium text-white/90 mt-1 line-clamp-1">{card.subText}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quick Access — Mobile View */}
            <div className="block md:hidden mb-8">
              <h3 className="text-sm font-extrabold uppercase tracking-wider mb-3.5 px-1 text-slate-800">QUICK ACCESS</h3>
              <div className="grid grid-cols-3 gap-3">
                {NAV_ITEMS.map((item, i) => (
                  <Link key={i} to={item.path}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-xs border border-gray-100 hover:shadow-md active:scale-95 transition-all h-full"
                    >
                      <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center text-white text-2xl shadow-xs mb-1.5 flex-shrink-0`}>
                        {item.icon}
                      </div>
                      <span className="text-xs font-bold text-gray-800 text-center leading-tight line-clamp-2">
                        {item.label}
                      </span>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Dedicated Analytics Section with Clean Bar Charts */}
            <AdminAnalyticsSection />

            {/* Dedicated Admin Security & User Activity Notification System Section */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 mb-6 sm:mb-8 min-w-0 max-w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 uppercase tracking-wide">
                    <FiShield className="text-church-gold text-base sm:text-lg flex-shrink-0" /> SECURITY & USER ACTIVITY NOTIFICATION CENTER
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Centralized audit monitor • Real-time event notifications • 30-Day OTP Cycle</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowOtpResetModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
                    title="Force all users and admins to re-verify OTP and invalidate all active sessions"
                  >
                    <FiKey className="text-amber-600" size={13} /> Force Global OTP Reset
                  </button>
                  <Link
                    to="/admin/notifications?category=security"
                    className="px-3 py-1.5 rounded-xl bg-church-royal-blue/10 hover:bg-church-royal-blue/20 text-church-royal-blue text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FiBell size={13} /> View All Security Alerts →
                  </Link>
                </div>
              </div>

              {/* Force Global OTP Re-verification Confirmation Modal */}
              {showOtpResetModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center gap-3 mb-4 text-amber-700">
                      <div className="p-3 bg-amber-100 rounded-2xl">
                        <FiShield size={24} />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-gray-900">Force Global OTP Re-verification</h4>
                        <p className="text-xs text-gray-500">Global Session Invalidation & Re-authentication</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs text-gray-700 bg-amber-50/70 p-4 rounded-2xl border border-amber-200/60 mb-6">
                      <p className="font-bold text-amber-900">
                        Are you sure you want to trigger a Global OTP Reset?
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-600">
                        <li><strong>Instant Logout:</strong> All active sessions on all devices (phones, laptops, tablets) for every user and administrator will be terminated immediately.</li>
                        <li><strong>Multi-Channel Broadcast:</strong> Official security advisory emails, in-app notifications, and web push alerts will be dispatched immediately to all registered parishioners.</li>
                        <li><strong>Fresh Verification:</strong> Every account must enter their password and verify a new 6-digit OTP code on their next sign-in.</li>
                        <li><strong>New 30-Day Window:</strong> Once verified, each account will enjoy another 30-day single-verification window across all their devices.</li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setShowOtpResetModal(false)}
                        disabled={resettingOtp}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleForceGlobalOtpReset}
                        disabled={resettingOtp}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {resettingOtp ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Broadcasting Alerts & Invalidating...
                          </>
                        ) : (
                          <>
                            <FiKey /> Invalidate Sessions & Require OTP
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4 Security & Activity Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 p-4 rounded-2xl border border-blue-100 min-w-0">
                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <span className="text-xs uppercase font-black tracking-wider text-blue-700 truncate">TOTAL MEMBERS</span>
                    <span className="p-1.5 bg-blue-600 text-white rounded-lg text-sm flex-shrink-0"><FiUsers /></span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-blue-900 leading-none my-1">{stats?.stats?.totalUsers || 0}</p>
                  <p className="text-xs text-blue-600/80 font-semibold mt-0.5 truncate">Registered parishioners</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4 rounded-2xl border border-emerald-100 min-w-0">
                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <span className="text-xs uppercase font-black tracking-wider text-emerald-700 truncate">NEW TODAY</span>
                    <span className="p-1.5 bg-emerald-600 text-white rounded-lg text-sm flex-shrink-0"><FiCheckCircle /></span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-900 leading-none my-1">+{stats?.stats?.newMembersToday || 0}</p>
                  <p className="text-xs text-emerald-600/80 font-semibold mt-0.5 truncate">Joined today</p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-yellow-50/40 p-4 rounded-2xl border border-amber-100 min-w-0">
                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <span className="text-xs uppercase font-black tracking-wider text-amber-700 truncate">AUTH & LOGINS</span>
                    <span className="p-1.5 bg-amber-600 text-white rounded-lg text-sm flex-shrink-0"><FiKey /></span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-amber-900 leading-none my-1">{stats?.stats?.loginAttemptsTodayCount || 0}</p>
                  <p className="text-xs text-amber-600/80 font-semibold mt-0.5 truncate">Security events today</p>
                </div>

                <div
                  onClick={handleOpenPendingOtpModal}
                  className="bg-gradient-to-br from-purple-50 to-pink-50/40 p-4 rounded-2xl border border-purple-100 min-w-0 cursor-pointer hover:shadow-md transition-all hover:border-purple-300 group relative"
                  title="Click to view all parishioners with pending re-verification and send multi-channel reminders"
                >
                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <span className="text-xs uppercase font-black tracking-wider text-purple-700 truncate">OTP PENDING</span>
                    <span className="p-1.5 bg-purple-600 text-white rounded-lg text-sm flex-shrink-0 group-hover:scale-110 transition-transform"><FiClock /></span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-purple-900 leading-none my-1">{stats?.stats?.otpPendingCount || 0}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-purple-600/80 font-semibold truncate">Awaiting verification</p>
                    <span className="text-xs font-bold text-purple-700 underline group-hover:text-purple-900 whitespace-nowrap">View List →</span>
                  </div>
                </div>
              </div>

              {/* Pending OTP Parishioners List & Multi-Channel Reminder Modal */}
              {showPendingOtpModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
                  <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4 flex-shrink-0">
                      <div className="flex items-center gap-3 text-purple-700">
                        <div className="p-2.5 bg-purple-100 rounded-2xl">
                          <FiClock size={22} />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-gray-900">Parishioners Pending OTP Re-verification</h4>
                          <p className="text-xs text-gray-500">Awaiting 30-day cycle renewal or initial account verification</p>
                        </div>
                      </div>
                      <span className="bg-purple-100 text-purple-800 font-extrabold text-xs px-3 py-1 rounded-full">
                        {pendingUsersList.length} Pending
                      </span>
                    </div>

                    {loadingPendingUsers ? (
                      <div className="py-12 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        Loading pending parishioners list...
                      </div>
                    ) : pendingUsersList.length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-xs italic bg-gray-50 rounded-2xl border border-gray-100">
                        All parishioners are currently fully verified. No pending OTP re-verifications.
                      </div>
                    ) : (
                      <div className="overflow-y-auto flex-1 pr-1 space-y-2 max-h-[360px] custom-scrollbar">
                        {pendingUsersList.map((u) => (
                          <div key={u._id} className="p-3 bg-gray-50/80 hover:bg-purple-50/50 rounded-2xl border border-gray-100 transition-colors flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-gray-900 text-xs truncate flex items-center gap-1.5">
                                <span>{u.name}</span>
                                <span className="font-mono text-[10px] text-gray-400 font-normal">({u.parishMemberId})</span>
                              </p>
                              <p className="text-gray-500 text-[11px] truncate mt-0.5">
                                {u.email} • {u.phone}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                u.status === 'Initial Verification Pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {u.status}
                              </span>
                              <p className="text-[10px] text-gray-400 mt-0.5">{u.daysPending} days pending</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-gray-100 pt-4 mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                      <p className="text-[11px] text-gray-500 text-center sm:text-left">
                        Reminders will be sent via <strong>Email</strong>, <strong>Push</strong>, <strong>In-App</strong>, &amp; <strong>WhatsApp</strong>. Full report will also be emailed to Admin.
                      </p>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setShowPendingOtpModal(false)}
                          disabled={remindingPendingUsers}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={handleRemindPendingUsers}
                          disabled={remindingPendingUsers || pendingUsersList.length === 0}
                          className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {remindingPendingUsers ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Dispatching Reminders...
                            </>
                          ) : (
                            <>
                              <FiBell size={13} /> Send Reminders to All ({pendingUsersList.length})
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Middle Section: Recent Activity Timeline & Calendar Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mb-6 sm:mb-8 min-w-0 max-w-full">

              {/* Recent Activity Timeline (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 min-w-0 max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-gray-100 pb-3">
                  <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 tracking-wide uppercase">
                    <FiClock className="text-church-gold text-base sm:text-lg flex-shrink-0" /> RECENT PARISH ACTIVITY TIMELINE
                  </h3>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={handleClearTimeline}
                      className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                      title="Clear past activity and start logging fresh from now"
                    >
                      Clear / Start From Now
                    </button>
                    <span className="text-xs font-bold text-gray-400 whitespace-nowrap">Live Updates</span>
                  </div>
                </div>

                {stats?.recentActivities?.length > 0 ? (
                  <div className="space-y-2.5 min-w-0">
                    {stats.recentActivities.map((act, idx) => (
                      <div key={act.id || idx} className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-gray-50/70 border-l-4 border-church-gold hover:bg-gold-50/40 transition-colors shadow-2xs gap-2 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-church-royal-blue/10 text-church-royal-blue flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0">
                            {act.icon || ''}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-xs truncate">{act.title}</p>
                            <p className="text-gray-500 text-[10px] sm:text-[11px] mt-0.5 truncate">{act.description}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap flex-shrink-0">
                          {new Date(act.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic py-8 text-center">No recent parish activity logged today.</p>
                )}
              </div>

              {/* Parish Calendar Overview (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 flex flex-col justify-between min-w-0 max-w-full overflow-hidden">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-gray-100 pb-3">
                    <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 uppercase tracking-wide">
                      <FiCalendar className="text-church-gold text-base sm:text-lg flex-shrink-0" /> PARISH CALENDAR OVERVIEW
                    </h3>
                    <span className="text-xs font-bold text-church-gold bg-amber-50 px-2.5 py-1 rounded-full self-start sm:self-auto whitespace-nowrap border border-amber-200/60">
                      {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100 text-center mb-5">
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">TODAY'S DATE</p>
                    <p className="text-4xl font-black text-church-royal-blue my-1">
                      {new Date().getDate()} {new Date().toLocaleString('default', { month: 'long' })}
                    </p>
                    <p className="text-xs font-bold text-church-gold">
                      {new Date().toLocaleDateString('default', { weekday: 'long' })}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-black text-gray-700 uppercase tracking-wider mb-3">UPCOMING EVENTS SPOTLIGHT</p>
                    {stats?.upcomingEvents?.length > 0 ? (
                      <div className="space-y-2.5">
                        {stats.upcomingEvents.slice(0, 3).map((ev, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                            <div className="w-10 h-10 rounded-xl bg-church-gold text-white font-black flex flex-col items-center justify-center text-xs flex-shrink-0">
                              <span>{new Date(ev.date).getDate()}</span>
                              <span className="text-[9px] uppercase">{new Date(ev.date).toLocaleString('default', { month: 'short' })}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-extrabold text-gray-900 text-xs truncate">{ev.title}</p>
                              <p className="text-[10px] text-gray-400 capitalize">{ev.category || 'Other'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-3">No upcoming events scheduled.</p>
                    )}
                  </div>
                </div>

                <Link to="/admin/events" className="btn-gold w-full text-xs font-extrabold py-3 text-center mt-6 shadow-gold rounded-2xl block">
                  Open Full Event Calendar
                </Link>
              </div>

            </div>

            {/* Bottom Section: Birthdays & Anniversaries Spotlight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 min-w-0 max-w-full">

              {/* Birthdays this Month */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 min-w-0 max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4 border-b border-gray-100 pb-3">
                  <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 uppercase tracking-wide">
                    <FiGift className="text-pink-500 flex-shrink-0" /> BIRTHDAYS THIS MONTH ({stats?.upcomingBirthdays?.length || 0})
                  </h3>
                  <Link to="/admin/users" className="text-xs text-church-gold font-bold hover:underline whitespace-nowrap">View All Members</Link>
                </div>

                {stats?.upcomingBirthdays?.length > 0 ? (
                  <div className="space-y-2.5 min-w-0">
                    {stats.upcomingBirthdays.map((u, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 sm:p-3 bg-pink-50/50 rounded-2xl border border-pink-100 gap-2 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-pink-500 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                            <FiGift />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-xs truncate">{u.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">Parish ID: {u.parishMemberId || 'N/A'}</p>
                          </div>
                        </div>
                        <span className="text-[11px] sm:text-xs font-extrabold text-pink-700 bg-pink-100 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                          {new Date(u.dob).getDate()} {new Date(u.dob).toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic py-6 text-center">No member birthdays recorded for this month.</p>
                )}
              </div>

              {/* Anniversaries this Month */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 min-w-0 max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4 border-b border-gray-100 pb-3">
                  <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 uppercase tracking-wide">
                    <FiHeart className="text-rose-500 flex-shrink-0" /> WEDDING ANNIVERSARIES ({stats?.upcomingAnniversaries?.length || 0})
                  </h3>
                  <Link to="/admin/users" className="text-xs text-church-gold font-bold hover:underline whitespace-nowrap">View All Couples</Link>
                </div>

                {stats?.upcomingAnniversaries?.length > 0 ? (
                  <div className="space-y-2.5 min-w-0">
                    {stats.upcomingAnniversaries.map((u, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 sm:p-3 bg-rose-50/50 rounded-2xl border border-rose-100 gap-2 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                            <FiHeart />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-xs truncate">{u.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">Family ID: {u.familyId || 'N/A'}</p>
                          </div>
                        </div>
                        <span className="text-[11px] sm:text-xs font-extrabold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                          {new Date(u.weddingDate).getDate()} {new Date(u.weddingDate).toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic py-6 text-center">No wedding anniversaries recorded for this month.</p>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
