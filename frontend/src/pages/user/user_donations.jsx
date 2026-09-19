import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiSearch, FiX, FiDownload,
  FiChevronLeft, FiChevronRight, FiRefreshCw,
  FiCheckCircle, FiFilter,
} from 'react-icons/fi';
import { FaDonate } from 'react-icons/fa';
import { useAuth } from '../../context/context_auth_context';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import churchLogo from '../../assets/church_extirior.png';

const ITEMS_PER_PAGE = 10;

const DONATION_TYPES = [
  { id: 'general',  label: 'General Offering' },
  { id: 'feast',    label: 'Feast Donation' },
  { id: 'building', label: 'Building Fund' },
  { id: 'candle',   label: 'Candle Offering' },
];

const STATUS_OPTIONS = [
  { id: 'all',      label: 'All Status' },
  { id: 'paid',     label: 'Paid' },
  { id: 'verified', label: 'Verified' },
  { id: 'created',  label: 'Created' },
  { id: 'pending',  label: 'Pending' },
  { id: 'rejected', label: 'Rejected' },
];

const STATUS_STYLE = {
  paid:     'bg-green-100 text-green-700 border border-green-200',
  verified: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  created:  'bg-amber-100  text-amber-800  border border-amber-200',
  pending:  'bg-amber-100  text-amber-800  border border-amber-200',
  rejected: 'bg-red-100   text-red-700   border border-red-200',
};

export default function UserDonations() {
  const { user } = useAuth();
  const [donations, setDonations]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage]             = useState(1);
  const [viewingDonation, setViewingDonation] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const receiptRef = useRef(null);

  const fetchDonations = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/donations/my');
      const sorted = (res.data.donations || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setDonations(sorted);
    } catch { /* fail silently */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDonations(); }, []);
  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter]);

  const filtered = useMemo(() => {
    let result = donations;
    if (typeFilter !== 'all') result = result.filter(d => d.type === typeFilter);
    if (statusFilter !== 'all') result = result.filter(d => (d.status || 'pending') === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        (d.type || '').toLowerCase().includes(q) ||
        (d.transactionId || '').toLowerCase().includes(q) ||
        String(d.amount || '').includes(q) ||
        (DONATION_TYPES.find(t => t.id === d.type)?.label || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [donations, search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated  = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalDonated = donations
    .filter(d => d.status === 'paid' || d.status === 'verified')
    .reduce((sum, d) => sum + (d.amount || 0), 0);

  const downloadReceipt = async (donation) => {
    setIsGeneratingPDF(true);
    setTimeout(async () => {
      try {
        const element = receiptRef.current;
        if (!element) throw new Error('Receipt template not found');
        const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        pdf.save(`Donation_Receipt_${donation._id.slice(-6).toUpperCase()}.pdf`);
        toast.success('Receipt downloaded!');
      } catch (e) {
        console.error(e);
        toast.error('Failed to generate PDF receipt');
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 500);
  };

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
                <FaDonate className="text-church-gold text-2xl" />
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  My Donations
                </h1>
              </div>
              <p className="text-gray-300 text-xs sm:text-sm mt-0.5">
                All your offering records and payment history
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchDonations(true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Refresh"
              >
                <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
              </button>
              <Link
                to="/donate"
                className="btn-gold py-2.5 px-5 text-xs sm:text-sm shadow-sm flex items-center gap-2 whitespace-nowrap"
              >
                <FaDonate /> + Make Donation
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Summary card */}
        {donations.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Offerings', value: donations.length, color: 'text-church-royal-blue' },
              { label: 'Total Donated', value: `₹${totalDonated.toLocaleString('en-IN')}`, color: 'text-green-600' },
              { label: 'This Month', value: donations.filter(d => {
                  const m = new Date(d.createdAt);
                  const now = new Date();
                  return m.getMonth() === now.getMonth() && m.getFullYear() === now.getFullYear();
                }).length, color: 'text-church-gold' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className={`text-lg sm:text-2xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by type, amount, or transaction ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-church-gold transition-colors"
            />
          </div>

          {/* Dropdowns */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <FiFilter className="text-gray-400 flex-shrink-0" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-church-gold cursor-pointer"
              >
                <option value="all">All Types</option>
                {DONATION_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-church-gold cursor-pointer"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            {(typeFilter !== 'all' || statusFilter !== 'all' || search) && (
              <button
                onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearch(''); }}
                className="text-xs text-gray-500 hover:text-church-royal-blue font-semibold flex items-center gap-1 cursor-pointer"
              >
                <FiX /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Donations List */}
        {loading ? (
          <SectionLoader />
        ) : paginated.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
            <FaDonate className="text-5xl text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">
              {search || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'No donations match your filters.'
                : 'No donations recorded yet.'}
            </p>
            {!search && typeFilter === 'all' && statusFilter === 'all' && (
              <Link to="/donate" className="btn-gold mt-4 inline-flex items-center gap-2 py-2.5 px-5 text-sm">
                <FaDonate /> Make Your First Donation
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {paginated.map((d, i) => (
                <motion.div
                  key={d._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 sm:p-5"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-gold-50 text-church-gold flex items-center justify-center text-2xl flex-shrink-0">
                      <FaDonate />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-gray-900 text-lg">₹{(d.amount || 0).toLocaleString('en-IN')}</span>
                          <span className="text-[10px] bg-blue-50 text-church-royal-blue px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {DONATION_TYPES.find(t => t.id === d.type)?.label || 'General Offering'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_STYLE[d.status] || STATUS_STYLE.pending}`}>
                            {d.status || 'pending'}
                          </span>
                        </div>
                        <button
                          onClick={() => setViewingDonation(d)}
                          className="text-xs text-church-gold hover:underline font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          View Receipt →
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-[11px] text-gray-500">
                        <span>
                          {new Date(d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {d.transactionId && (
                          <span
                            className="font-mono text-gray-400 cursor-pointer hover:text-church-gold transition-colors"
                            title={d.transactionId}
                            onClick={() => {
                              navigator.clipboard?.writeText(d.transactionId);
                              toast.success('Transaction ID copied!');
                            }}
                          >
                            {d.transactionId.length > 18 ? `${d.transactionId.slice(0, 18)}…` : d.transactionId}
                          </span>
                        )}
                      </div>
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
                        page === p ? 'bg-church-gold text-white' : 'text-gray-600 hover:bg-gray-100'
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

      {/* ── Donation Detail Modal ── */}
      <AnimatePresence>
        {viewingDonation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewingDonation(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="bg-church-royal-blue p-8 text-white">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl">
                    <FaDonate className="text-church-gold" />
                  </div>
                  <button onClick={() => setViewingDonation(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                    <FiX size={24} />
                  </button>
                </div>
                <h3 className="text-2xl font-bold font-display">Donation Details</h3>
                <p className="text-blue-200 text-sm mt-1">Ref: SJBC-{viewingDonation._id.slice(-6).toUpperCase()}</p>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Amount Paid</p>
                    <p className="text-2xl font-black text-church-royal-blue">₹{viewingDonation.amount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Status</p>
                    <div className="flex items-center gap-2 text-green-500 font-bold">
                      <FiCheckCircle /> Recorded
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-50">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Purpose:</span>
                    <span className="font-bold text-gray-700">{DONATION_TYPES.find(t => t.id === viewingDonation.type)?.label || 'General Offering'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Date:</span>
                    <span className="font-bold text-gray-700">{new Date(viewingDonation.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Transaction ID:</span>
                    <span className="font-mono text-xs font-bold text-church-gold">{viewingDonation.transactionId || 'Manual Entry'}</span>
                  </div>
                  {viewingDonation.note && (
                    <div className="pt-4 mt-4 border-t border-gray-50">
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Message / Intention</p>
                      <p className="italic text-gray-600 text-sm bg-gray-50 p-4 rounded-2xl">"{viewingDonation.note}"</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => downloadReceipt(viewingDonation)}
                  disabled={isGeneratingPDF}
                  className="btn-gold w-full justify-center py-4 text-base shadow-gold-lg mt-4 cursor-pointer"
                >
                  {isGeneratingPDF ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating PDF...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FiDownload /> Download Official Receipt
                    </div>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden PDF receipt template */}
      <div className="fixed left-[-9999px] top-0">
        <div ref={receiptRef} style={{ width: '800px', margin: 'auto', background: '#ffffff', padding: '35px', fontFamily: 'Arial, sans-serif', color: '#222' }}>
          {viewingDonation && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '20px' }}>
                <div>{new Date(viewingDonation.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}, {new Date(viewingDonation.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                <div>SJBC-{viewingDonation._id.slice(-6).toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e5e5', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <img src={churchLogo} style={{ width: '70px', height: '70px', objectFit: 'contain' }} alt="Logo" />
                  <div style={{ textAlign: 'left' }}>
                    <h1 style={{ margin: 0, fontSize: '30px', color: '#1e3a8a' }}>ST. JOHN DE Britto CHURCH</h1>
                    <h2 style={{ margin: '5px 0', fontSize: '18px', color: '#b8860b', fontWeight: 'normal' }}>புனித அருளானந்தர் தேவாலயம்</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>Murthi Nagar, Kalayarkoil, Tamil Nadu 630551, India.</p>
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>Receipt</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', fontSize: '16px' }}>
                <div style={{ flex: 1 }}>
                  {[
                    ['Receipt No', `SJBC-${new Date(viewingDonation.createdAt).getFullYear()}-${viewingDonation._id.slice(-6).toUpperCase()}`],
                    ['Name', viewingDonation.donorName || user?.name || 'N/A'],
                    ['Donation Type', DONATION_TYPES.find(t => t.id === viewingDonation.type)?.label || 'Donation'],
                    ['Purpose', `${DONATION_TYPES.find(t => t.id === viewingDonation.type)?.label || 'Donation'} Offering`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', marginBottom: '10px' }}>
                      <div style={{ width: '150px', fontWeight: 'bold' }}>{label} :</div>
                      <div>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, paddingLeft: '20px' }}>
                  {[
                    ['Receipt Date', new Date(viewingDonation.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })],
                    ['Total Paid', `INR. ${(viewingDonation.amount || 0).toFixed(2)}`],
                    ['Payment Method', 'UPI'],
                    ['UPI Ref No', viewingDonation.transactionId || 'N/A'],
                    ['Status', (viewingDonation.status || 'pending').toUpperCase()],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', marginBottom: '10px' }}>
                      <div style={{ width: '150px', fontWeight: 'bold' }}>{label} :</div>
                      <div style={label === 'Status' ? { fontWeight: 'bold', color: viewingDonation.status === 'verified' || viewingDonation.status === 'paid' ? '#16a34a' : viewingDonation.status === 'rejected' ? '#dc2626' : '#b45309', textTransform: 'uppercase' } : {}}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '30px', fontSize: '15px' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#f3f4f6', textAlign: 'left', padding: '14px', border: '1px solid #ddd' }}>Donation Description</th>
                    <th style={{ background: '#f3f4f6', textAlign: 'left', padding: '14px', border: '1px solid #ddd' }}>Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '14px', border: '1px solid #ddd' }}>{DONATION_TYPES.find(t => t.id === viewingDonation.type)?.label || 'Donation'} Donation</td>
                    <td style={{ padding: '14px', border: '1px solid #ddd' }}>₹{(viewingDonation.amount || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '30px', border: '1px solid #ddd', padding: '18px', background: '#fafafa', lineHeight: '1.8' }}>
                <strong style={{ display: 'block', marginBottom: '10px' }}>Message / Intention :</strong>
                "{viewingDonation.note || 'Prayers for family blessings'}"
              </div>
              <div style={{ marginTop: '40px', textAlign: 'center', lineHeight: '1.9', fontSize: '15px' }}>
                Thank you for your generous contribution<br />
                towards the ministry and mission of<br />
                <strong>St. John de Britto's Church.</strong><br /><br />
                May God bless you abundantly.
              </div>
              <div style={{ marginTop: '45px', textAlign: 'center', fontSize: '14px', lineHeight: '1.8', color: '#555' }}>
                Contact Details :<br />
                Parish Office Phone : +91 96291 95484 <br />
                Parish Office Email : stjdbchurch@gmail.com <br />
                Parish Office Website : www.stjohnchurch.com
              </div>
              <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}>
                Computer Generated Receipt. <span style={{ color: 'red' }}>SIGNATURE NOT REQUIRED</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
