import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiSearch, FiTrash2, FiCheckCircle, FiX, FiCheck,
  FiFilter, FiAlertCircle, FiRefreshCw, FiMoreVertical, FiArrowLeft,
  FiShield, FiCalendar, FiDollarSign, FiFileText, FiBookOpen, FiVolume2, FiUsers, FiUser,
  FiMail, FiGlobe
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { GiPrayer } from 'react-icons/gi';
import { MdOutlinePushPin, MdPushPin } from 'react-icons/md';
import api from '../../services/api';
import { useNotifications } from '../../context/context_notification_context';
import { useAuth } from '../../context/context_auth_context';
import { SectionLoader } from '../../components/common/common_loader';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

// ── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'messages', label: 'Admin Messages' },
  { key: 'daily_spiritual', label: 'Daily Catholic Blessings' },
  { key: 'permission', label: 'Permission Log' },
  { key: 'events', label: 'Events' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'donations', label: 'Donations' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'documents', label: 'Documents' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'family', label: 'Family' },
  { key: 'account', label: 'Account' },
  { key: 'general', label: 'General' },
];

const CATEGORY_ICONS = {
  messages: <FiMail />,
  daily_spiritual: <FiBookOpen />,
  permission: <FiShield />,
  events: <FiCalendar />,
  announcements: <FiVolume2 />,
  donations: <FiDollarSign />,
  bookings: <FiCalendar />,
  documents: <FiFileText />,
  tickets: <FiBookOpen />,
  prayer: <GiPrayer />,
  family: <FiUsers />,
  account: <FiUser />,
  general: <FiBell />,
  all: <FiBell />
};

const CATEGORY_COLORS = {
  messages: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
  daily_spiritual: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
  permission: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
  events: 'bg-blue-100 text-blue-700 border-blue-200',
  announcements: 'bg-orange-100 text-orange-700 border-orange-200',
  donations: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  bookings: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  documents: 'bg-teal-100 text-teal-700 border-teal-200',
  tickets: 'bg-rose-100 text-rose-700 border-rose-200',
  prayer: 'bg-purple-100 text-purple-700 border-purple-200',
  family: 'bg-green-100 text-green-700 border-green-200',
  account: 'bg-gray-100 text-gray-700 border-gray-200',
  general: 'bg-gray-100 text-gray-700 border-gray-200',
};

const PRIORITY_COLORS = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-gray-300',
};

function timeAgo(date) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '';
  }
}

// ── Notification Card ────────────────────────────────────────────────────────
function NotifCard({ notif, onMarkRead, onDelete, onTogglePin, onAction, isHighlighted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useEffect(() => {
    if (isHighlighted) {
      const el = document.getElementById(`notif-${notif._id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isHighlighted, notif._id]);

  const isPermission = notif.relatedModel === 'PermissionRequest' || notif.category === 'permission' || notif.type === 'permission' || notif.title?.includes('Settings');
  const isMessage = notif.relatedModel === 'Message' || notif.type === 'message' || notif.category === 'messages';
  const cat = isPermission ? 'permission' : isMessage ? 'messages' : (notif.category || notif.type || 'general');
  const catConfig = CATEGORIES.find(c => c.key === cat) || CATEGORIES[CATEGORIES.length - 1];

  const isApproved = notif.title?.includes('Approved') || notif.message?.includes('approved');
  const isRejected = notif.title?.includes('Rejected') || notif.message?.includes('rejected');

  const targetUrl = notif.actionUrl || (
    isPermission && !isApproved && !isRejected ? `/dashboard?requestId=${notif.relatedId || ''}` :
    isMessage ? '/dashboard/notifications?category=messages' :
    cat === 'events' ? '/events' :
    cat === 'announcements' ? '/announcements' :
    cat === 'donations' ? '/donate' :
    cat === 'bookings' ? '/dashboard' :
    cat === 'documents' ? '/dashboard/documents' :
    cat === 'tickets' ? '/dashboard' :
    cat === 'prayer' ? '/prayers' : null
  );

  return (
    <motion.div
      layout
      id={`notif-${notif._id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`relative flex gap-4 p-4 rounded-2xl border transition-all group ${
        isHighlighted
          ? 'bg-amber-50/90 border-2 border-church-gold ring-4 ring-church-gold/20 shadow-lg'
          : notif.isRead
          ? 'bg-white border-gray-100 hover:border-gray-200'
          : 'bg-gradient-to-r from-amber-50/60 to-white border-l-4 border-church-gold shadow-sm'
      } ${notif.isPinned ? 'ring-1 ring-church-gold/30' : ''}`}
    >
      {/* Category Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border ${
        CATEGORY_COLORS[cat] || CATEGORY_COLORS.general
      }`}>
        {CATEGORY_ICONS[cat] || <FiBell />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-bold leading-snug ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
              {notif.title}
            </p>
            {isHighlighted && (
              <span className="text-[10px] font-extrabold bg-church-gold text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 animate-pulse">
                <FiBell className="text-[9px]" /> Focused from Push
              </span>
            )}
            {!notif.isRead && !isHighlighted && (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse ring-2 ring-red-200" title="Unread notification" />
            )}
            {notif.priority === 'high' && (
              <span className="text-[9px] font-black uppercase bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                Urgent
              </span>
            )}
            {notif.isPinned && (
              <MdPushPin className="text-church-gold text-sm flex-shrink-0" />
            )}
          </div>

          {/* Actions menu */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
            >
              <FiMoreVertical />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-gray-100 z-20 min-w-[150px] overflow-hidden"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  {!notif.isRead && (
                    <button onClick={() => { onMarkRead(notif._id); setMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium">
                      <FiCheck className="text-green-500" /> Mark as Read
                    </button>
                  )}
                  <button onClick={() => { onTogglePin(notif._id); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium">
                    <MdOutlinePushPin className="text-church-gold" />
                    {notif.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  {targetUrl && (
                    <button onClick={() => { onAction(notif); setMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium">
                      <FiAlertCircle className="text-blue-500" /> Go to Page
                    </button>
                  )}
                  <button onClick={() => { onDelete(notif._id); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 font-medium border-t border-gray-100">
                    <FiTrash2 /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-gray-500 text-xs mt-1 leading-relaxed line-clamp-2">{notif.message}</p>

        <div className="flex items-center justify-between gap-3 mt-3 pt-2 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              CATEGORY_COLORS[cat] || CATEGORY_COLORS.general
            }`}>
              {catConfig.label}
            </span>
            <span className="text-[10px] text-gray-400">{timeAgo(notif.createdAt)}</span>
          </div>

          {cat === 'prayer' || notif.relatedModel === 'PrayerRequest' ? (
            <Link
              to={notif.actionUrl || '/prayer-requests'}
              onClick={() => !notif.isRead && onMarkRead(notif._id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-church-royal-blue text-white hover:bg-church-royal-blue/90 text-xs font-bold transition-all shadow-sm flex-shrink-0 ml-auto"
            >
              <GiPrayer className="text-sm" /> View Prayer Wall
            </Link>
          ) : isApproved ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-green-100 text-green-700 text-xs font-black border border-green-300 ml-auto flex-shrink-0 shadow-xs">
              <FiCheckCircle className="text-sm text-green-600" /> Approved
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-red-100 text-red-700 text-xs font-black border border-red-300 ml-auto flex-shrink-0 shadow-xs">
              <FiX className="text-sm text-red-600" /> Rejected
            </span>
          ) : targetUrl ? (
            <Link
              to={targetUrl}
              onClick={() => !notif.isRead && onMarkRead(notif._id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-church-royal-blue text-white hover:bg-church-royal-blue/90 text-xs font-bold transition-all shadow-sm flex-shrink-0 ml-auto"
            >
              {isPermission ? <><FiShield className="text-xs" /> Review Request</> :
               cat === 'events' ? <><FiCalendar className="text-xs" /> View Event</> :
               cat === 'announcements' ? <><FiVolume2 className="text-xs" /> Read Announcement</> :
               cat === 'donations' ? <><FiDollarSign className="text-xs" /> View Donation</> :
               cat === 'bookings' ? <><FiCalendar className="text-xs" /> View Booking</> :
               cat === 'documents' ? <><FiFileText className="text-xs" /> View Document</> :
               'View Details →'}
            </Link>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function UserNotifications() {
  const { notifications, unreadCount, loading, markRead, markAllRead, deleteNotification, deleteAll, togglePin, refetch } = useNotifications();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin/notifications', { replace: true });
    }
  }, [user, navigate]);

  // Deep-link handling from push notification or email redirect
  const targetNotificationId = searchParams.get('notification') || searchParams.get('id') || searchParams.get('notifId');

  useEffect(() => {
    const requestId = searchParams.get('requestId');
    if (requestId) {
      setActiveCategory('permission');
    }
    if (targetNotificationId && notifications.length > 0) {
      const target = notifications.find(n => n._id === targetNotificationId);
      if (target) {
        if (!target.isRead) {
          markRead(target._id);
        }
      }
    }
  }, [searchParams, targetNotificationId, notifications, markRead]);

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      const isPermission = n.relatedModel === 'PermissionRequest' || n.category === 'permission' || n.type === 'permission' || n.title?.includes('Settings');
      const cat = isPermission ? 'permission' : (n.category || n.type || 'general');
      const matchCat = activeCategory === 'all' || cat === activeCategory;
      const matchSearch = !search || n.title?.toLowerCase().includes(search.toLowerCase()) || n.message?.toLowerCase().includes(search.toLowerCase());
      const matchUnread = !showUnreadOnly || !n.isRead;
      return matchCat && matchSearch && matchUnread;
    });
  }, [notifications, activeCategory, search, showUnreadOnly]);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleMarkRead = async (id) => {
    await markRead(id);
  };

  const handleDelete = async (id) => {
    await deleteNotification(id);
    toast.success('Notification deleted');
  };

  const handleDeleteAll = () => {
    setShowClearConfirm(true);
  };

  const confirmDeleteAll = async () => {
    setShowClearConfirm(false);
    await deleteAll();
    toast.success('All notifications cleared permanently');
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    toast.success('All marked as read');
  };

  const handleAction = (notif) => {
    if (!notif.isRead) markRead(notif._id);
    const isPermission = notif.relatedModel === 'PermissionRequest' || notif.category === 'permission' || notif.title?.includes('Settings');
    const target = notif.actionUrl || (isPermission ? `/dashboard?requestId=${notif.relatedId || ''}` : '/dashboard');
    if (target) navigate(target);
  };

  const [showDailyHistory, setShowDailyHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadDailyHistory = async () => {
    setHistoryLoading(true);
    setShowDailyHistory(true);
    try {
      const res = await api.get('/daily-notifications/my-history');
      if (res.data?.success) {
        setHistoryList(res.data.history || []);
      }
    } catch (err) {
      toast.error('Failed to load daily notification history');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 bg-church-cream">
      {/* Header */}
      <div className="bg-gray-600 py-8 sm:py-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-3">
            {isAdmin ? (
              <>
                <Link to="/admin" className="text-gold-400 text-sm font-bold hover:underline flex items-center gap-1">
                  <FiArrowLeft /> Back to Admin Panel
                </Link>
                <span className="text-gray-400 text-xs">|</span>
                <Link to="/dashboard" className="text-gray-200 text-sm hover:underline flex items-center gap-1">
                  User Dashboard
                </Link>
              </>
            ) : (
              <Link to="/dashboard" className="text-gold-400 text-sm hover:underline flex items-center gap-1">
                <FiArrowLeft /> Back to Dashboard
              </Link>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-white font-display font-bold text-2xl sm:text-3xl">Notifications</h1>
              <p className="text-gray-300 text-xs sm:text-sm mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>

            <button
              onClick={loadDailyHistory}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-church-gold hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              <FiBookOpen className="text-sm" />
              <span>Daily 4-Channel Delivery Log</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-church-gold/30 focus:border-church-gold transition-all"
            />
          </div>

          {/* Unread toggle */}
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              showUnreadOnly
                ? 'bg-church-gold text-white border-church-gold shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-church-gold'
            }`}
          >
            <FiFilter size={14} />
            Unread Only
          </button>

          {/* Refresh */}
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:border-church-gold transition-all"
          >
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(cat => {
            const count = cat.key === 'all'
              ? notifications.length
              : notifications.filter(n => {
                  const isPerm = n.relatedModel === 'PermissionRequest' || n.category === 'permission' || n.type === 'permission' || n.title?.includes('Settings');
                  const c = isPerm ? 'permission' : (n.category || n.type || 'general');
                  return c === cat.key;
                }).length;
            if (count === 0 && cat.key !== 'all') return null;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  activeCategory === cat.key
                    ? 'bg-church-royal-blue text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-church-royal-blue/40'
                }`}
              >
                <span className="text-sm">{CATEGORY_ICONS[cat.key]}</span>
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                    activeCategory === cat.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bulk Actions */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
            <span>Showing {filtered.length} of {notifications.length} notifications</span>
            <div className="flex items-center gap-3 font-semibold">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="hover:text-church-gold flex items-center gap-1 transition-colors">
                  <FiCheckCircle /> Mark All Read
                </button>
              )}
              <button onClick={handleDeleteAll} className="hover:text-red-600 flex items-center gap-1 text-red-500 transition-colors">
                <FiTrash2 /> Clear All
              </button>
            </div>
          </div>
        )}

        {/* Notification List */}
        {loading ? (
          <SectionLoader />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-church-gold text-2xl">
              <FiBell />
            </div>
            <h3 className="font-display font-bold text-gray-800 text-lg">No notifications found</h3>
            <p className="text-gray-400 text-sm mt-1">
              {search ? 'Try adjusting your search criteria' : 'You are all caught up with your notifications!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map(notif => (
                <NotifCard
                  key={notif._id}
                  notif={notif}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                  onTogglePin={togglePin}
                  onAction={handleAction}
                  isHighlighted={notif._id === targetNotificationId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowClearConfirm(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-red-100 text-center space-y-4 relative"
            >
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-200 shadow-inner text-2xl">
                <FiTrash2 />
              </div>

              <div>
                <h3 className="font-display font-bold text-gray-900 text-xl">Clear All Notifications?</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete all {notifications.length} notifications? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAll}
                  className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <FiTrash2 /> Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Daily 4-Channel Notification Delivery History Modal */}
      <AnimatePresence>
        {showDailyHistory && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDailyHistory(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] shadow-2xl border border-gray-100 flex flex-col space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-amber-50 text-church-gold rounded-xl text-lg">
                    <FiBookOpen />
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-lg">Daily Catholic Notifications Log</h3>
                    <p className="text-xs text-gray-500">Your 4-channel daily spiritual delivery history</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowDailyHistory(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              {historyLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <FiRefreshCw className="animate-spin text-2xl text-church-gold" />
                  <p className="text-xs text-gray-500 font-medium">Loading delivery history...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FiBell className="mx-auto text-3xl text-gray-300" />
                  <p className="text-sm font-bold text-gray-700">No Delivery Logs Yet</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Daily 12:00 AM IST deliveries across Email, In-App, Push, and WhatsApp will be logged here.
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto space-y-3 pr-1">
                  {historyList.map(log => (
                    <div key={log._id || log.dateKey} className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-church-royal-blue">{log.dateKey}</span>
                          <span className="text-[10px] text-gray-400">•</span>
                          <span className="text-xs text-gray-600 font-medium">{log.summary?.bibleRef || 'Daily Word'}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'sent' ? 'bg-green-100 text-green-800' :
                          log.status === 'partially_sent' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {log.status === 'sent' ? 'Delivered' : log.status === 'partially_sent' ? 'Partially Sent' : 'Skipped'}
                        </span>
                      </div>

                      {/* 4 Channels Status Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {/* Email */}
                        <div className="p-2 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-gray-600 font-semibold text-[11px]">
                            <FiMail className="text-church-royal-blue" /> Email
                          </span>
                          <span className={`text-[10px] font-bold ${
                            log.channels?.email?.status === 'sent' ? 'text-green-600' :
                            log.channels?.email?.status === 'disabled' ? 'text-gray-400' : 'text-red-500'
                          }`}>
                            {log.channels?.email?.status === 'sent' ? 'Sent' :
                             log.channels?.email?.status === 'disabled' ? 'Off' : 'Failed'}
                          </span>
                        </div>

                        {/* In-App */}
                        <div className="p-2 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-gray-600 font-semibold text-[11px]">
                            <FiBell className="text-amber-600" /> In-App
                          </span>
                          <span className={`text-[10px] font-bold ${
                            log.channels?.inApp?.status === 'sent' ? 'text-green-600' :
                            log.channels?.inApp?.status === 'disabled' ? 'text-gray-400' : 'text-red-500'
                          }`}>
                            {log.channels?.inApp?.status === 'sent' ? 'Sent' :
                             log.channels?.inApp?.status === 'disabled' ? 'Off' : 'Failed'}
                          </span>
                        </div>

                        {/* Push */}
                        <div className="p-2 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-gray-600 font-semibold text-[11px]">
                            <FiGlobe className="text-blue-500" /> Push
                          </span>
                          <span className={`text-[10px] font-bold ${
                            log.channels?.push?.status === 'sent' ? 'text-green-600' :
                            log.channels?.push?.status === 'disabled' ? 'text-gray-400' : 'text-red-500'
                          }`}>
                            {log.channels?.push?.status === 'sent' ? 'Sent' :
                             log.channels?.push?.status === 'disabled' ? 'Off' : 'Failed'}
                          </span>
                        </div>

                        {/* WhatsApp */}
                        <div className="p-2 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-gray-600 font-semibold text-[11px]">
                            <FaWhatsapp className="text-emerald-600" /> WhatsApp
                          </span>
                          <span className={`text-[10px] font-bold ${
                            log.channels?.whatsapp?.status === 'sent' ? 'text-green-600' :
                            log.channels?.whatsapp?.status === 'disabled' ? 'text-gray-400' : 'text-red-500'
                          }`}>
                            {log.channels?.whatsapp?.status === 'sent' ? 'Sent' :
                             log.channels?.whatsapp?.status === 'disabled' ? 'Off' : 'Failed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
