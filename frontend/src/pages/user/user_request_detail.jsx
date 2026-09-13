import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiClock as FiPending,
  FiFileText,
  FiDownload,
  FiCopy,
  FiShare2,
  FiMessageSquare,
  FiSend,
  FiUser,
  FiHeart,
  FiPhone,
  FiMail,
  FiCheck,
  FiPrinter
} from 'react-icons/fi';
import { GiChurch, GiPrayer } from 'react-icons/gi';
import { HiSparkles } from 'react-icons/hi2';
import api, { getMediaUrl } from '../../services/api';
import { useAuth } from '../../context/context_auth_context';
import { SectionLoader } from '../../components/common/common_loader';

const MODULE_CONFIG = {
  'mass-intentions': {
    title: 'Mass Intention Booking',
    icon: GiChurch,
    apiEndpoint: '/bookings',
    dataKey: 'booking',
    accentColor: 'blue',
    backLink: '/dashboard/booking',
    backLabel: 'My Mass Bookings'
  },
  'mass_intentions': {
    title: 'Mass Intention Booking',
    icon: GiChurch,
    apiEndpoint: '/bookings',
    dataKey: 'booking',
    accentColor: 'blue',
    backLink: '/dashboard/booking',
    backLabel: 'My Mass Bookings'
  },
  'prayer-requests': {
    title: 'Prayer Intention Request',
    icon: GiPrayer,
    apiEndpoint: '/prayers',
    dataKey: 'prayer',
    accentColor: 'amber',
    backLink: '/prayers',
    backLabel: 'Prayer Wall'
  },
  'prayer_requests': {
    title: 'Prayer Intention Request',
    icon: GiPrayer,
    apiEndpoint: '/prayers',
    dataKey: 'prayer',
    accentColor: 'amber',
    backLink: '/prayers',
    backLabel: 'Prayer Wall'
  },
  'document-requests': {
    title: 'Document & Certificate Request',
    icon: FiFileText,
    apiEndpoint: '/documents',
    dataKey: 'document',
    accentColor: 'emerald',
    backLink: '/dashboard/documents',
    backLabel: 'My Documents'
  },
  'document_requests': {
    title: 'Document & Certificate Request',
    icon: FiFileText,
    apiEndpoint: '/documents',
    dataKey: 'document',
    accentColor: 'emerald',
    backLink: '/dashboard/documents',
    backLabel: 'My Documents'
  },
  'tickets': {
    title: 'Support Inquiry & Ticket',
    icon: FiMessageSquare,
    apiEndpoint: '/tickets',
    dataKey: 'ticket',
    accentColor: 'purple',
    backLink: '/dashboard/tickets',
    backLabel: 'My Tickets'
  }
};

export default function UserRequestDetail({ module: moduleProp }) {
  const { module: paramModule, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState(null);
  const [resolvedModule, setResolvedModule] = useState(moduleProp || paramModule || '');
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Auto-detect module if URL is generic or passed differently
  const detectModule = (modStr, reqId) => {
    const s = String(modStr || '').toLowerCase().replace(/[-_ ]/g, '');
    if (s.includes('mass') || s.includes('booking') || s.includes('intention')) return 'mass-intentions';
    if (s.includes('prayer') || s.includes('confession')) return 'prayer-requests';
    if (s.includes('doc') || s.includes('certificate')) return 'document-requests';
    if (s.includes('ticket') || s.includes('support')) return 'tickets';

    // Infer from request ID prefix
    const rid = String(reqId || '').toUpperCase();
    if (rid.startsWith('MI-') || rid.startsWith('MB-')) return 'mass-intentions';
    if (rid.startsWith('PR-')) return 'prayer-requests';
    if (rid.startsWith('DOC-')) return 'document-requests';
    if (rid.startsWith('TKT-')) return 'tickets';

    return 'mass-intentions';
  };

  const currentModuleKey = detectModule(moduleProp || paramModule, id);
  const currentConfig = MODULE_CONFIG[currentModuleKey] || MODULE_CONFIG['mass-intentions'];

  useEffect(() => {
    fetchRequestDetails();
  }, [currentModuleKey, id]);

  const fetchRequestDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${currentConfig.apiEndpoint}/${id}`);
      const data = res.data[currentConfig.dataKey] || res.data.booking || res.data.prayer || res.data.document || res.data.ticket || res.data;
      setRequestData(data);
    } catch (err) {
      console.error('Error fetching request details:', err);
      // Fallback try other modules if ID prefix might belong elsewhere
      let recovered = false;
      const otherModules = Object.keys(MODULE_CONFIG).filter(k => k !== currentModuleKey && !k.includes('_'));
      for (const altKey of otherModules) {
        try {
          const altRes = await api.get(`${MODULE_CONFIG[altKey].apiEndpoint}/${id}`);
          const altData = altRes.data[MODULE_CONFIG[altKey].dataKey] || altRes.data;
          if (altData) {
            setRequestData(altData);
            setResolvedModule(altKey);
            recovered = true;
            break;
          }
        } catch {
          // ignore fallback error
        }
      }

      if (!recovered) {
        toast.error(err.response?.data?.message || 'Unable to load request details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    toast.success('Request ID copied to clipboard!');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSendTicketReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply || !requestData) return;
    setSubmittingReply(true);
    try {
      const res = await api.post(`/tickets/${requestData._id}/reply`, {
        message: replyText.trim(),
        from: 'user'
      });
      setRequestData(res.data.ticket);
      setReplyText('');
      toast.success('Reply sent to Church administration');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDownloadDocument = (fileUrl, title) => {
    if (!fileUrl) return;
    const directUrl = getMediaUrl(fileUrl);
    window.open(directUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-16 flex items-center justify-center bg-church-cream dark:bg-slate-950">
        <SectionLoader title="Fetching Request Information..." />
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className="min-h-screen pt-28 pb-16 bg-church-cream dark:bg-slate-950 px-4">
        <div className="max-w-xl mx-auto text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 text-2xl">
            <FiAlertCircle />
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-800 dark:text-white mb-2">Request Not Found</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
            We could not locate this request or you do not have permission to view it. Please check the link or navigate from your dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/dashboard" className="btn-primary inline-flex items-center justify-center gap-2 text-sm py-2.5 px-5">
              <FiArrowLeft /> Return to Dashboard
            </Link>
            <Link to={currentConfig.backLink} className="btn-secondary inline-flex items-center justify-center gap-2 text-sm py-2.5 px-5">
              View {currentConfig.backLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Derive status details
  const statusStr = String(requestData.status || 'pending').toLowerCase();
  const isApproved = statusStr === 'approved' || statusStr === 'confirmed';
  const isRejected = statusStr === 'rejected' || statusStr === 'declined';
  const isCancelled = statusStr === 'cancelled';
  const isCompleted = statusStr === 'completed';
  const isProcessing = statusStr === 'processing' || statusStr === 'in_progress';
  const isPending = statusStr === 'pending' || statusStr === 'open';

  const statusConfig = isApproved
    ? { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', icon: FiCheckCircle, text: 'Approved by Church' }
    : isRejected
    ? { label: 'Rejected', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30', icon: FiXCircle, text: 'Request Not Approved' }
    : isCancelled
    ? { label: 'Cancelled', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30', icon: FiXCircle, text: 'Cancelled' }
    : isCompleted
    ? { label: 'Completed', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30', icon: HiSparkles, text: 'Completed by Church' }
    : isProcessing
    ? { label: 'Processing', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30', icon: FiPending, text: 'Under Church Review' }
    : { label: 'Pending Review', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', icon: FiPending, text: 'Pending Church Review' };

  // Reference number
  const referenceId = requestData.bookingNumber ||
    requestData.ticketNumber ||
    requestData.referenceNumber ||
    (requestData._id ? (currentModuleKey.includes('mass') ? `MI-${requestData._id.slice(-6).toUpperCase()}` : currentModuleKey.includes('prayer') ? `PR-${requestData._id.slice(-6).toUpperCase()}` : currentModuleKey.includes('doc') ? `DOC-${requestData._id.slice(-6).toUpperCase()}` : `TKT-${requestData._id.slice(-6).toUpperCase()}`) : id);

  const createdAt = requestData.createdAt ? new Date(requestData.createdAt) : new Date();
  const updatedAt = requestData.updatedAt ? new Date(requestData.updatedAt) : createdAt;

  const adminNote = requestData.adminNote || requestData.rejectionReason || requestData.reply || null;
  const suggestedDate = requestData.suggestedDate ? new Date(requestData.suggestedDate) : null;
  const suggestedTime = requestData.suggestedTime || null;

  return (
    <div className="min-h-screen pt-24 pb-20 bg-gradient-to-b from-church-cream via-slate-50 to-church-cream/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white py-8 border-b border-indigo-900/50 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <Link
              to={currentConfig.backLink}
              className="inline-flex items-center gap-2 text-gold-400 hover:text-gold-300 font-medium text-sm transition-colors"
            >
              <FiArrowLeft /> {currentConfig.backLabel}
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur transition-all"
                title="Print request summary"
              >
                <FiPrinter /> Print Receipt
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gold-500/20 text-gold-300 border border-gold-500/30">
                  <currentConfig.icon className="text-sm" /> {currentConfig.title}
                </span>
                <span className="text-xs text-slate-300">
                  Ref: <strong className="font-mono text-white">{referenceId}</strong>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
                Request Status & Review
              </h1>
            </div>

            {/* Status Pill in Header */}
            <div className={`self-start sm:self-center px-4 py-2 rounded-2xl border ${statusConfig.color} bg-white/95 dark:bg-slate-900 shadow-md flex items-center gap-2.5`}>
              <statusConfig.icon className="text-lg animate-pulse" />
              <div>
                <div className="text-xs uppercase font-bold tracking-wider opacity-75">Status</div>
                <div className="text-sm font-extrabold capitalize">{statusConfig.label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4">
        {/* Progression Timeline Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl mb-8 backdrop-blur"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <HiSparkles className="text-amber-500 text-base" /> Request Lifecycle Timeline
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Last updated: {updatedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Step 1: Received */}
            <div className="relative flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                <FiCheck />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Request Received</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Step 2: Under Review */}
            <div className={`relative flex items-start gap-3 p-3.5 rounded-2xl border ${!isPending ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60' : 'bg-amber-500/10 border-amber-500/40'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold ${!isPending ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 animate-pulse'}`}>
                {!isPending ? <FiCheck /> : <FiPending />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">2. Parish Administration Review</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isPending ? 'Currently in queue for review' : 'Processed by Church office'}
                </div>
              </div>
            </div>

            {/* Step 3: Decision / Outcome */}
            <div className={`relative flex items-start gap-3 p-3.5 rounded-2xl border ${isApproved || isCompleted ? 'bg-emerald-500/10 border-emerald-500/30' : isRejected ? 'bg-rose-500/10 border-rose-500/30' : isCancelled ? 'bg-slate-500/10 border-slate-500/30' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/40 dark:border-slate-700/40 opacity-70'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold ${isApproved || isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400' : isRejected ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400' : isCancelled ? 'bg-slate-200 dark:bg-slate-700 text-slate-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                {isApproved || isCompleted ? <FiCheck /> : isRejected ? <FiXCircle /> : isCancelled ? <FiXCircle /> : '3'}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  3. {statusConfig.label}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isApproved || isCompleted ? 'Approved & confirmed' : isRejected ? 'Declined by parish' : isCancelled ? 'Cancelled' : 'Awaiting confirmation'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Suggested Alternative Date Callout (if priest suggested another date/time for Mass Booking) */}
        {suggestedDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400/80 rounded-3xl p-5 mb-8 shadow-md flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shrink-0 shadow-md">
              <FiCalendar />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 dark:text-amber-200 text-base mb-1">
                Parish Priest Suggested Alternative Date / Time
              </h4>
              <p className="text-amber-800 dark:text-amber-300 text-sm mb-2 leading-relaxed">
                The church office has proposed an alternative slot for this mass intention:
              </p>
              <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-bold text-sm text-slate-800 dark:text-slate-100 shadow-sm">
                <span>📅 {suggestedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                {suggestedTime && <span>⏰ {suggestedTime}</span>}
              </div>
            </div>
          </motion.div>
        )}

        {/* Church Official Admin Message Callout */}
        {adminNote && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-3xl p-5 mb-8 shadow-md flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md">
              <GiChurch />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-blue-950 dark:text-blue-200 text-sm uppercase tracking-wider mb-1">
                Official Parish Message
              </h4>
              <p className="text-blue-900 dark:text-blue-100 text-sm font-medium leading-relaxed italic">
                "{adminNote}"
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Details Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Details Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
              <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white mb-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>Request Particulars</span>
                <span className="text-xs font-mono font-normal text-slate-400">ID: {referenceId}</span>
              </h2>

              {/* Module-Specific Renderers */}
              {currentModuleKey.includes('mass') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="text-xs font-bold text-slate-400 uppercase">Intention Type</div>
                      <div className="text-base font-bold text-slate-800 dark:text-slate-100 capitalize mt-0.5">
                        {requestData.intentionType ? requestData.intentionType.replace(/_/g, ' ') : 'Holy Mass Intention'}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="text-xs font-bold text-slate-400 uppercase">Target Mass Date & Time</div>
                      <div className="text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                        {requestData.massDate ? new Date(requestData.massDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                        {requestData.massTime ? ` • ${requestData.massTime}` : ''}
                      </div>
                    </div>
                  </div>

                  {(requestData.personName || requestData.familyName) && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="text-xs font-bold text-slate-400 uppercase">Offered For</div>
                      <div className="text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                        {requestData.personName || requestData.familyName}
                      </div>
                    </div>
                  )}

                  {requestData.intentionDetails && (
                    <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1.5 mb-1">
                        <GiPrayer /> Prayer Intention / Petition
                      </div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                        "{requestData.intentionDetails}"
                      </div>
                    </div>
                  )}

                  {requestData.offertory > 0 && (
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Offertory Contribution</span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">₹{requestData.offertory}</span>
                    </div>
                  )}
                </div>
              )}

              {currentModuleKey.includes('prayer') && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-xs font-bold text-slate-400 uppercase">Prayer Type / Mode</div>
                    <div className="text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5 capitalize">
                      {requestData.type || 'General Prayer Request'}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1.5 mb-1">
                      <GiPrayer /> Prayer Intention
                    </div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                      "{requestData.intention}"
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-sm">
                      <span className="text-xs text-slate-400 uppercase block">Public Prayer Wall</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{requestData.isPublic ? 'Yes (Visible on Wall)' : 'Private (Parish Priest Only)'}</span>
                    </div>
                    {requestData.candleCount > 0 && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-sm">
                        <span className="text-xs text-slate-400 uppercase block">Candles Lit</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          🕯️ {requestData.candleCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentModuleKey.includes('doc') && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-xs font-bold text-slate-400 uppercase">Document Requested</div>
                    <div className="text-base font-bold text-slate-800 dark:text-slate-100 capitalize mt-0.5">
                      {requestData.type ? requestData.type.replace(/_/g, ' ') : 'Certificate'} Certificate
                    </div>
                  </div>

                  {requestData.requestDetails && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="text-xs font-bold text-slate-400 uppercase">Purpose / Additional Details</div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                        {requestData.requestDetails}
                      </div>
                    </div>
                  )}

                  {/* Document Download Ready Card */}
                  {requestData.uploadedFile ? (
                    <div className="p-5 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-2xl shadow-md">
                          <FiFileText />
                        </div>
                        <div>
                          <div className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                            Official Certificate Ready for Download
                          </div>
                          <div className="text-xs text-emerald-700 dark:text-emerald-400">
                            Issued and digitally stamped by parish administration.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadDocument(requestData.uploadedFile, requestData.type)}
                        className="btn-primary text-sm py-2.5 px-5 shrink-0 inline-flex items-center gap-2"
                      >
                        <FiDownload /> Download Certificate
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <FiPending className="text-amber-500 text-base" />
                      Certificate will be available here for download once issued and signed by the parish priest.
                    </div>
                  )}
                </div>
              )}

              {currentModuleKey.includes('ticket') && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-xs font-bold text-slate-400 uppercase">Subject</div>
                    <div className="text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                      {requestData.subject}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-xs font-bold text-slate-400 uppercase">Initial Inquiry Message</div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                      {requestData.message}
                    </div>
                  </div>

                  {/* Ticket Replies Thread */}
                  <div className="pt-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <FiMessageSquare /> Conversation Thread ({requestData.replies?.length || 0} Replies)
                    </h3>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 mb-4">
                      {requestData.replies && requestData.replies.length > 0 ? (
                        requestData.replies.map((reply, i) => (
                          <div
                            key={i}
                            className={`p-4 rounded-2xl text-sm ${
                              reply.from === 'admin'
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 ml-4'
                                : 'bg-slate-100 dark:bg-slate-800 mr-4'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-semibold mb-1">
                              <span className={reply.from === 'admin' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}>
                                {reply.from === 'admin' ? '🏛️ Parish Administrator' : '👤 You'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {reply.createdAt ? new Date(reply.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                              {reply.message}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 italic p-3 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                          No replies yet. You will be notified as soon as church administration responds.
                        </div>
                      )}
                    </div>

                    {/* Inline Reply Form for User */}
                    {statusStr !== 'closed' && (
                      <form onSubmit={handleSendTicketReply} className="relative mt-2">
                        <textarea
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type a reply to church administration..."
                          className="w-full px-4 py-3 pr-14 text-sm rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <button
                          type="submit"
                          disabled={submittingReply || !replyText.trim()}
                          className="absolute right-3 bottom-3.5 p-2 rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-all shadow-md"
                          title="Send reply"
                        >
                          <FiSend className="text-sm" />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar / Metadata Column (1 Col) */}
          <div className="space-y-6">
            {/* Quick Identifier Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Reference & Parishioner
              </h3>

              <div className="space-y-3.5 text-sm">
                <div>
                  <div className="text-xs text-slate-400">Request Identifier</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-base">
                      {referenceId}
                    </span>
                    <button
                      onClick={() => handleCopyId(referenceId)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Copy Reference ID"
                    >
                      {copiedId ? <FiCheck className="text-emerald-500" /> : <FiCopy />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-400">Parishioner Name</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {requestData.userId?.name || user?.name || requestData.personName || requestData.name || 'Parishioner'}
                  </div>
                </div>

                {(requestData.userId?.parishMemberId || user?.parishMemberId) && (
                  <div>
                    <div className="text-xs text-slate-400">Parish Member ID</div>
                    <div className="font-mono font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                      {requestData.userId?.parishMemberId || user?.parishMemberId}
                    </div>
                  </div>
                )}

                {(requestData.userId?.familyId || user?.familyId) && (
                  <div>
                    <div className="text-xs text-slate-400">Family ID</div>
                    <div className="font-mono font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                      {requestData.userId?.familyId || user?.familyId}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-400">Submission Date</div>
                  <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    {createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Channels Connected Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-800/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-3 flex items-center gap-1.5">
                <HiSparkles className="text-amber-400" /> Automated Updates Active
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Whenever this request changes status, instant alerts are dispatched through:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <div className="p-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                  <span>💬 WhatsApp Bot</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                  <span>✉️ Email Alert</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                  <span>🔔 In-App Center</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/10 flex items-center gap-2">
                  <span>📱 Push Notification</span>
                </div>
              </div>
            </div>

            {/* Church Office Contact & Help Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Parish Administration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Need urgent assistance or have questions regarding this request? Contact the parish office:
              </p>
              <div className="space-y-2 text-xs">
                <a
                  href="https://wa.me/919655639144"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <FiPhone /> WhatsApp Parish Admin (+91 96556 39144)
                </a>
                <a
                  href="mailto:stjdbchurch@gmail.com"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-semibold hover:bg-blue-100 transition-colors"
                >
                  <FiMail /> stjdbchurch@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
