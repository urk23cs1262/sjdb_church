import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCalendar, FiArrowLeft, FiSearch, FiInfo, FiPaperclip, FiChevronLeft, FiChevronRight, FiBookOpen, FiRefreshCw } from 'react-icons/fi';
import { GiChurch, GiCrucifix } from 'react-icons/gi';
import api, { UPLOADS_URL } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

const ITEMS_PER_PAGE = 10;

const STATUS_TABS = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Pending' },
  { id: 'approved',  label: 'Approved' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected',  label: 'Rejected' },
];

const STATUS_STYLE = {
  approved:  'bg-green-100 text-green-700 border border-green-200',
  completed: 'bg-blue-100  text-blue-700  border border-blue-200',
  rejected:  'bg-red-100   text-red-700   border border-red-200',
  pending:   'bg-amber-100 text-amber-800 border border-amber-200',
};

const INTENTION_LABEL = {
  thanksgiving:      'Thanksgiving Mass',
  birthday:          'Birthday Blessing',
  wedding_anniversary: 'Wedding Anniversary',
  healing:           'Good Health & Healing',
  special:           'Special Intention',
  death_anniversary: 'For Departed Soul (RIP)',
  other:             'Other Special Intention',
};

export default function UserBookings() {
  const [bookings, setBookings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);

  const fetchBookings = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/bookings/my');
      // Sort newest first
      const sorted = (res.data.bookings || []).sort(
        (a, b) => new Date(b.createdAt || b.massDate) - new Date(a.createdAt || a.massDate)
      );
      setBookings(sorted);
    } catch { /* fail silently */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  // Reset page when filter or search changes
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const filtered = useMemo(() => {
    let result = bookings;
    if (statusFilter !== 'all') result = result.filter(b => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        (b.intentionType || '').toLowerCase().includes(q) ||
        (b.intentionFor  || '').toLowerCase().includes(q) ||
        (b.personName    || '').toLowerCase().includes(q) ||
        (b.name          || '').toLowerCase().includes(q) ||
        (b.bookingNumber || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [bookings, statusFilter, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated   = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const tabCount = (id) =>
    id === 'all' ? bookings.length : bookings.filter(b => b.status === id).length;

  return (
    <div className="min-h-screen pt-20 bg-church-cream pb-16">
      {/* Header */}
      <div className="bg-gray-600 py-6 sm:py-8 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Link to="/dashboard" className="text-gold-400 text-xs sm:text-sm hover:underline flex items-center gap-1 mb-2">
                <FiArrowLeft /> Back to Dashboard
              </Link>
              <div className="flex items-center gap-2.5">
                <FiCalendar className="text-church-gold text-2xl" />
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  My Mass Bookings
                </h1>
              </div>
              <p className="text-gray-300 text-xs sm:text-sm mt-0.5">
                All your mass intention requests and their status
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchBookings(true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Refresh"
              >
                <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
              </button>
              <Link
                to="/dashboard/booking"
                className="btn-gold py-2.5 px-5 text-xs sm:text-sm shadow-sm flex items-center gap-2 whitespace-nowrap"
              >
                <FiBookOpen /> + New Booking
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Search + Status Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by intention, name, or booking ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-church-gold transition-colors"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {STATUS_TABS.map(tab => {
              const isActive = statusFilter === tab.id;
              const count = tabCount(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-church-gold text-white shadow-sm ring-2 ring-church-gold/20'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                  <span className={`text-[10px] px-1.5 rounded-full font-extrabold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-white text-gray-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Booking List */}
        {loading ? (
          <SectionLoader />
        ) : paginated.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
            <GiChurch className="text-5xl text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">
              {search || statusFilter !== 'all'
                ? 'No bookings match your filter.'
                : 'No mass bookings yet.'}
            </p>
            {!search && statusFilter === 'all' && (
              <Link to="/dashboard/booking" className="btn-gold mt-4 inline-flex items-center gap-2 py-2.5 px-5 text-sm">
                <FiBookOpen /> Book a Holy Mass
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {paginated.map((b, i) => (
                <motion.div
                  key={b._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5"
                >
                  <div className="flex items-start gap-4">
                    {/* Date block */}
                    <div className="min-w-12 h-14 rounded-xl bg-church-gradient flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-base leading-none">
                        {new Date(b.massDate).getDate()}
                      </span>
                      <span className="text-gold-300 text-[10px] font-bold uppercase mt-0.5">
                        {new Date(b.massDate).toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-bold text-gray-900 text-sm capitalize">
                            {INTENTION_LABEL[b.intentionType] || b.intentionType?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-gray-500 text-xs font-medium mt-0.5">
                            {b.intentionFor || b.personName || b.name || '—'}
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0 ${STATUS_STYLE[b.status] || STATUS_STYLE.pending}`}>
                          {b.status}
                        </span>
                      </div>

                      {/* Meta grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-3 text-[11px] text-gray-500">
                        {b.bookingNumber && (
                          <div>
                            <span className="text-gray-400 block text-[10px]">Booking ID</span>
                            <span className="font-mono font-semibold text-gray-700">{b.bookingNumber}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400 block text-[10px]">Mass Date</span>
                          <span className="font-semibold text-gray-700">
                            {new Date(b.massDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {b.massTime && (
                          <div>
                            <span className="text-gray-400 block text-[10px]">Mass Time</span>
                            <span className="font-semibold text-gray-700">{b.massTime}</span>
                          </div>
                        )}
                        {b.createdAt && (
                          <div>
                            <span className="text-gray-400 block text-[10px]">Submitted On</span>
                            <span className="font-semibold text-gray-700">
                              {new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Intention details */}
                      {b.intentionDetails && (
                        <p className="text-xs text-gray-500 italic mt-2 line-clamp-2">"{b.intentionDetails}"</p>
                      )}

                      {/* Reschedule suggestion */}
                      {b.suggestedDate && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-1.5">
                          <FiInfo className="text-blue-600 flex-shrink-0" />
                          <span><strong className="font-bold">Reschedule Suggestion:</strong> {new Date(b.suggestedDate).toLocaleDateString()} {b.suggestedTime ? `(${b.suggestedTime})` : ''}</span>
                        </div>
                      )}

                      {/* Admin note */}
                      {b.adminNote && (
                        <p className="text-xs text-amber-800 mt-1.5 font-medium bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                          📋 {b.adminNote}
                        </p>
                      )}

                      {/* Attachment */}
                      {b.attachmentUrl && (
                        <a
                          href={b.attachmentUrl.startsWith('http') ? b.attachmentUrl : `${UPLOADS_URL.replace('/uploads', '')}${b.attachmentUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-church-gold hover:underline flex items-center gap-1 mt-2 font-semibold"
                        >
                          <FiPaperclip /> View Attachment
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-xs text-gray-500 font-medium">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <FiChevronLeft />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        page === p
                          ? 'bg-church-gold text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
