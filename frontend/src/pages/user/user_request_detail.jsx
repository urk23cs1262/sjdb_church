import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiClock as FiPending,
  FiFileText,
  FiDownload,
  FiCopy,
  FiMessageSquare,
  FiSend,
  FiPhone,
  FiMail,
  FiCheck,
  FiRefreshCw
} from 'react-icons/fi';
import { GiChurch, GiPrayer } from 'react-icons/gi';
import { HiSparkles } from 'react-icons/hi2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import api, { getMediaUrl } from '../../services/api';
import { useAuth } from '../../context/context_auth_context';
import { SectionLoader } from '../../components/common/common_loader';
import churchLogo from '../../assets/church_extirior.png';
import { getChurchPhone, getParishOfficePhone, getChurchEmail, getWhatsAppNumber } from '../../config/contactConfig';

const MASS_BOOKING_CONFIG = {
  title: 'Mass Intention Booking',
  icon: GiChurch,
  apiEndpoint: '/bookings',
  dataKey: 'booking',
  accentColor: 'blue',
  backLink: '/dashboard/booking',
  backLabel: 'My Mass Bookings'
};

const PRAYER_CONFIG = {
  title: 'Prayer Intention Request',
  icon: GiPrayer,
  apiEndpoint: '/prayers',
  dataKey: 'prayer',
  accentColor: 'amber',
  backLink: '/prayers',
  backLabel: 'Prayer Wall'
};

const DOCUMENT_CONFIG = {
  title: 'Document & Certificate Request',
  icon: FiFileText,
  apiEndpoint: '/documents',
  dataKey: 'document',
  accentColor: 'emerald',
  backLink: '/dashboard/documents',
  backLabel: 'My Documents'
};

const TICKET_CONFIG = {
  title: 'Support Inquiry & Ticket',
  icon: FiMessageSquare,
  apiEndpoint: '/tickets',
  dataKey: 'ticket',
  accentColor: 'purple',
  backLink: '/dashboard/tickets',
  backLabel: 'My Tickets'
};

const MODULE_CONFIG = {
  'mass-intentions': MASS_BOOKING_CONFIG,
  'mass_intentions': MASS_BOOKING_CONFIG,
  'mass-booking': MASS_BOOKING_CONFIG,
  'mass-bookings': MASS_BOOKING_CONFIG,
  'bookings': MASS_BOOKING_CONFIG,
  'booking': MASS_BOOKING_CONFIG,

  'prayer-requests': PRAYER_CONFIG,
  'prayer_requests': PRAYER_CONFIG,
  'prayer': PRAYER_CONFIG,
  'prayers': PRAYER_CONFIG,
  'confession': PRAYER_CONFIG,

  'document-requests': DOCUMENT_CONFIG,
  'document_requests': DOCUMENT_CONFIG,
  'documents': DOCUMENT_CONFIG,
  'document': DOCUMENT_CONFIG,

  'tickets': TICKET_CONFIG,
  'ticket': TICKET_CONFIG,
  'enquiry': TICKET_CONFIG,
  'support': TICKET_CONFIG
};

export default function UserRequestDetail({ module: moduleProp }) {
  const { module: paramModule, id } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const receiptRef = useRef(null);

  // Auto-detect module if URL is generic or passed differently
  const detectModule = useCallback((modStr, reqId) => {
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
  }, []);

  const currentModuleKey = detectModule(moduleProp || paramModule, id);
  const currentConfig = MODULE_CONFIG[currentModuleKey] || MODULE_CONFIG['mass-intentions'];

  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await api.get(`${currentConfig.apiEndpoint}/${id}`);
        const data = res.data[currentConfig.dataKey] || res.data.booking || res.data.prayer || res.data.document || res.data.ticket || res.data;
        if (isMounted) setRequestData(data);
      } catch (err) {
        console.error('Error fetching request details:', err);
        let recovered = false;
        const endpointsToTry = [
          { key: 'mass-intentions', endpoint: '/bookings', dataKey: 'booking' },
          { key: 'prayer-requests', endpoint: '/prayers', dataKey: 'prayer' },
          { key: 'document-requests', endpoint: '/documents', dataKey: 'document' },
          { key: 'tickets', endpoint: '/tickets', dataKey: 'ticket' }
        ].filter(e => e.endpoint !== currentConfig.apiEndpoint);

        for (const item of endpointsToTry) {
          try {
            const altRes = await api.get(`${item.endpoint}/${id}`);
            const altData = altRes.data[item.dataKey] || altRes.data;
            if (altData && isMounted) {
              setRequestData(altData);
              recovered = true;
              break;
            }
          } catch {
            // ignore fallback error
          }
        }

        if (!recovered && isMounted) {
          toast.error(err.response?.data?.message || 'Unable to load request details');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [currentConfig.apiEndpoint, currentConfig.dataKey, id]);

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

  const handleDownloadDocument = (fileUrl) => {
    if (!fileUrl) return;
    const directUrl = getMediaUrl(fileUrl);
    window.open(directUrl, '_blank');
  };

  // Reference number
  const referenceId = requestData ? (
    requestData.bookingNumber ||
    requestData.ticketNumber ||
    requestData.referenceNumber ||
    (requestData._id ? (
      currentModuleKey.includes('mass') ? `MB-${requestData._id.slice(-6).toUpperCase()}` :
      currentModuleKey.includes('prayer') ? `PR-${requestData._id.slice(-6).toUpperCase()}` :
      currentModuleKey.includes('doc') ? `DOC-${requestData._id.slice(-6).toUpperCase()}` :
      `TKT-${requestData._id.slice(-6).toUpperCase()}`
    ) : id)
  ) : id;

  // Portrait PDF Generation Handler
  const handleGeneratePDF = async () => {
    if (!requestData || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    const toastId = toast.loading('Generating portrait PDF receipt...');

    setTimeout(async () => {
      try {
        const element = receiptRef.current;
        if (!element) throw new Error('Receipt template element not found');

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');

        // Portrait A4: width 210mm, height 297mm
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight <= pdfHeight) {
          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        } else {
          let heightLeft = imgHeight;
          let position = 0;
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;

          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
          }
        }

        const safePrefix = currentModuleKey.includes('mass')
          ? 'Mass_Booking'
          : currentModuleKey.includes('prayer')
          ? 'Prayer_Request'
          : currentModuleKey.includes('doc')
          ? 'Document_Request'
          : 'Support_Ticket';

        const fileName = `${safePrefix}_Receipt_${referenceId}.pdf`;
        pdf.save(fileName);

        toast.success('Portrait PDF Receipt downloaded!', { id: toastId });
      } catch (err) {
        console.error('Error generating PDF receipt:', err);
        toast.error('Failed to generate PDF receipt. Please try again.', { id: toastId });
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 350);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-16 flex items-center justify-center bg-church-cream">
        <SectionLoader title="Fetching Request Information..." />
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className="min-h-screen pt-28 pb-16 bg-[#f8f9fa] px-4">
        <div className="max-w-xl mx-auto text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 text-2xl">
            <FiAlertCircle />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Request Not Found</h2>
          <p className="text-slate-600 mb-6 text-sm">
            We could not locate this request or you do not have permission to view it. Please check the link or navigate from your dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/dashboard" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2">
              <FiArrowLeft /> Return to Dashboard
            </Link>
            <Link to={currentConfig.backLink} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors inline-flex items-center justify-center gap-2">
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
    ? {
        label: 'Approved',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        iconColor: 'text-emerald-600',
        icon: FiCheckCircle,
        text: 'Approved by Church'
      }
    : isRejected
    ? {
        label: 'Rejected',
        badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
        iconColor: 'text-rose-600',
        icon: FiXCircle,
        text: 'Request Not Approved'
      }
    : isCancelled
    ? {
        label: 'Cancelled',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
        iconColor: 'text-slate-500',
        icon: FiXCircle,
        text: 'Cancelled'
      }
    : isCompleted
    ? {
        label: 'Completed',
        badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
        iconColor: 'text-purple-600',
        icon: FiCheckCircle,
        text: 'Completed by Church'
      }
    : isProcessing
    ? {
        label: 'Processing',
        badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
        iconColor: 'text-blue-600',
        icon: FiPending,
        text: 'Under Church Review'
      }
    : {
        label: 'Pending Review',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
        iconColor: 'text-amber-600',
        icon: FiPending,
        text: 'Pending Church Review'
      };

  const createdAt = requestData.createdAt ? new Date(requestData.createdAt) : new Date();
  const updatedAt = requestData.updatedAt ? new Date(requestData.updatedAt) : createdAt;

  const adminNote = requestData.adminNote || requestData.rejectionReason || requestData.reply || null;
  const suggestedDate = requestData.suggestedDate ? new Date(requestData.suggestedDate) : null;
  const suggestedTime = requestData.suggestedTime || null;

  const parishionerName = requestData.userId?.name || user?.name || requestData.personName || requestData.name || 'Parishioner';
  const parishionerPhone = requestData.userId?.phone || user?.phone || requestData.phone || 'N/A';

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 bg-[#f8f9fa] text-slate-800">
      {/* Print Specific CSS to enforce portrait mode & isolate receipt if browser print is used */}
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-portrait-receipt, #printable-portrait-receipt * {
            visibility: visible !important;
          }
          #printable-portrait-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: #ffffff !important;
            z-index: 99999 !important;
          }
        }
      `}</style>

      {/* Top Banner Header - Clean Normal Light UI */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs py-4 sm:py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Top Row: Back Navigation & Device-Responsive PDF Button */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <Link
              to={currentConfig.backLink}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-700 transition-colors"
            >
              <FiArrowLeft className="text-base shrink-0" />
              <span>{currentConfig.backLabel}</span>
            </Link>

            {/* Print / PDF Button: Portrait & Device Responsive - ONLY GENERATES PDF */}
            <button
              type="button"
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all disabled:opacity-60 cursor-pointer shrink-0"
              title="Generate and download official PDF receipt"
            >
              {isGeneratingPDF ? (
                <>
                  <FiRefreshCw className="animate-spin text-sm" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FiDownload className="text-sm sm:text-base shrink-0" />
                  <span className="hidden sm:inline">Download</span>
                  <span>PDF Receipt</span>
                </>
              )}
            </button>
          </div>

          {/* Main Title & Status Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <currentConfig.icon className="text-sm shrink-0" /> {currentConfig.title}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Ref: <strong className="font-mono text-slate-900 font-bold">{referenceId}</strong>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                Request Status & Review
              </h1>
            </div>

            {/* Status Badge in Header */}
            <div className={`self-start sm:self-center px-3.5 py-2 rounded-xl border ${statusConfig.badgeBg} shadow-2xs flex items-center gap-2.5`}>
              <statusConfig.icon className={`text-lg sm:text-xl shrink-0 ${statusConfig.iconColor}`} />
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Status</div>
                <div className="text-xs sm:text-sm font-bold capitalize leading-tight">
                  {statusConfig.label}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {/* Progression Timeline Card - Clean Light UI */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <HiSparkles className="text-amber-500 text-base" /> Request Lifecycle Timeline
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Last updated: {updatedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            {/* Step 1: Received */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-sm">
                <FiCheck />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">1. Request Received</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Step 2: Under Review */}
            <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${!isPending ? 'bg-slate-50/80 border-slate-200/80' : 'bg-amber-50/70 border-amber-300'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${!isPending ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {!isPending ? <FiCheck /> : <FiPending />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">2. Parish Administration Review</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  {isPending ? 'Currently in queue for review' : 'Processed by Church office'}
                </div>
              </div>
            </div>

            {/* Step 3: Decision / Outcome */}
            <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${isApproved || isCompleted ? 'bg-emerald-50 border-emerald-300' : isRejected ? 'bg-rose-50 border-rose-300' : isCancelled ? 'bg-slate-100 border-slate-300' : 'bg-slate-50/60 border-slate-200 opacity-75'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isApproved || isCompleted ? 'bg-emerald-100 text-emerald-700' : isRejected ? 'bg-rose-100 text-rose-700' : isCancelled ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                {isApproved || isCompleted ? <FiCheck /> : isRejected ? <FiXCircle /> : isCancelled ? <FiXCircle /> : '3'}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  3. {statusConfig.label}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  {isApproved || isCompleted ? 'Approved & confirmed' : isRejected ? 'Declined by parish' : isCancelled ? 'Cancelled' : 'Awaiting confirmation'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Suggested Alternative Date Callout */}
        {suggestedDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 mb-6 shadow-2xs flex items-start gap-3.5"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
              <FiCalendar />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm sm:text-base mb-1">
                Parish Priest Suggested Alternative Date / Time
              </h4>
              <p className="text-amber-800 text-xs sm:text-sm mb-2 leading-relaxed">
                The church office has proposed an alternative slot for this mass intention:
              </p>
              <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white border border-amber-300 font-bold text-xs sm:text-sm text-slate-800 shadow-2xs">
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
            className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-2xs flex items-start gap-3.5"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
              <GiChurch />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-blue-950 text-xs uppercase tracking-wider mb-1">
                Official Parish Message
              </h4>
              <p className="text-blue-900 text-xs sm:text-sm font-medium leading-relaxed italic">
                "{adminNote}"
              </p>
            </div>
          </motion.div>
        )}

        {/* Grid Layout: Main Details & Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Details Card - Clean Light UI */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>Request Particulars</span>
                <span className="text-xs font-mono font-medium text-slate-500">ID: {referenceId}</span>
              </h2>

              {/* Module-Specific Renderers */}
              {currentModuleKey.includes('mass') && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Intention Type</div>
                      <div className="text-sm sm:text-base font-bold text-slate-900 capitalize mt-0.5">
                        {requestData.intentionType ? requestData.intentionType.replace(/_/g, ' ') : 'Holy Mass Intention'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target Mass Date & Time</div>
                      <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                        {requestData.massDate ? new Date(requestData.massDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                        {requestData.massTime ? ` • ${requestData.massTime}` : ''}
                      </div>
                    </div>
                  </div>

                  {(requestData.personName || requestData.familyName) && (
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Offered For</div>
                      <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                        {requestData.personName || requestData.familyName}
                      </div>
                    </div>
                  )}

                  {requestData.intentionDetails && (
                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80">
                      <div className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1.5 mb-1.5">
                        <GiPrayer className="text-sm" /> Prayer Intention / Petition
                      </div>
                      <div className="text-sm font-medium text-slate-800 leading-relaxed">
                        "{requestData.intentionDetails}"
                      </div>
                    </div>
                  )}

                  {requestData.offertory > 0 && (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-sm">
                      <span className="text-slate-600 font-medium">Offertory Contribution</span>
                      <span className="font-bold text-slate-900 font-mono text-base">₹{requestData.offertory}</span>
                    </div>
                  )}
                </div>
              )}

              {currentModuleKey.includes('prayer') && (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Prayer Type / Mode</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 capitalize">
                      {requestData.type || 'General Prayer Request'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80">
                    <div className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1.5 mb-1.5">
                      <GiPrayer className="text-sm" /> Prayer Intention
                    </div>
                    <div className="text-sm font-medium text-slate-800 leading-relaxed">
                      "{requestData.intention}"
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-sm">
                      <span className="text-[11px] text-slate-500 uppercase font-semibold block">Public Prayer Wall</span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{requestData.isPublic ? 'Yes (Visible on Wall)' : 'Private (Parish Priest Only)'}</span>
                    </div>
                    {requestData.candleCount > 0 && (
                      <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-sm">
                        <span className="text-[11px] text-slate-500 uppercase font-semibold block">Candles Lit</span>
                        <span className="font-bold text-amber-700 flex items-center gap-1 text-xs sm:text-sm">
                          🕯️ {requestData.candleCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentModuleKey.includes('doc') && (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Document Requested</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 capitalize mt-0.5">
                      {requestData.type ? requestData.type.replace(/_/g, ' ') : 'Certificate'} Certificate
                    </div>
                  </div>

                  {requestData.requestDetails && (
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Purpose / Additional Details</div>
                      <div className="text-sm font-medium text-slate-800 mt-1">
                        {requestData.requestDetails}
                      </div>
                    </div>
                  )}

                  {/* Document Download Ready Card */}
                  {requestData.uploadedFile ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-xs">
                          <FiFileText />
                        </div>
                        <div>
                          <div className="font-bold text-emerald-900 text-sm">
                            Official Certificate Ready for Download
                          </div>
                          <div className="text-xs text-emerald-700">
                            Issued and digitally stamped by parish administration.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadDocument(requestData.uploadedFile)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shrink-0 inline-flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FiDownload /> Download Certificate
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs text-slate-600 flex items-center gap-2">
                      <FiPending className="text-amber-500 text-base shrink-0" />
                      Certificate will be available here for download once issued and signed by the parish priest.
                    </div>
                  )}
                </div>
              )}

              {currentModuleKey.includes('ticket') && (
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subject</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                      {requestData.subject}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Initial Inquiry Message</div>
                    <div className="text-sm font-medium text-slate-800 mt-1 leading-relaxed">
                      {requestData.message}
                    </div>
                  </div>

                  {/* Ticket Replies Thread */}
                  <div className="pt-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <FiMessageSquare /> Conversation Thread ({requestData.replies?.length || 0} Replies)
                    </h3>

                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 mb-3">
                      {requestData.replies && requestData.replies.length > 0 ? (
                        requestData.replies.map((reply, i) => (
                          <div
                            key={i}
                            className={`p-3.5 rounded-xl text-sm ${
                              reply.from === 'admin'
                                ? 'bg-indigo-50/80 border border-indigo-200 ml-3'
                                : 'bg-slate-100 border border-slate-200 mr-3'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-semibold mb-1">
                              <span className={reply.from === 'admin' ? 'text-indigo-700 font-bold' : 'text-slate-700 font-bold'}>
                                {reply.from === 'admin' ? '🏛️ Parish Administrator' : '👤 You'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {reply.createdAt ? new Date(reply.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-slate-800 whitespace-pre-line leading-relaxed text-xs sm:text-sm">
                              {reply.message}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic p-3 text-center bg-slate-50 rounded-xl border border-slate-200">
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
                          className="w-full px-3.5 py-2.5 pr-12 text-sm rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <button
                          type="submit"
                          disabled={submittingReply || !replyText.trim()}
                          className="absolute right-2.5 bottom-2.5 p-2 rounded-lg bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
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

          {/* Sidebar / Metadata Column (1 Col) - Clean Light UI */}
          <div className="space-y-6">
            {/* Quick Identifier Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3.5 pb-2 border-b border-slate-100">
                Reference & Parishioner
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold">Request Identifier</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-blue-700 text-base">
                      {referenceId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(referenceId)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="Copy Reference ID"
                    >
                      {copiedId ? <FiCheck className="text-emerald-600" /> : <FiCopy />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500 font-semibold">Parishioner Name</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {parishionerName}
                  </div>
                </div>

                {(requestData.userId?.parishMemberId || user?.parishMemberId) && (
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">Parish Member ID</div>
                    <div className="font-mono font-semibold text-slate-800 mt-0.5">
                      {requestData.userId?.parishMemberId || user?.parishMemberId}
                    </div>
                  </div>
                )}

                {(requestData.userId?.familyId || user?.familyId) && (
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">Family ID</div>
                    <div className="font-mono font-semibold text-slate-800 mt-0.5">
                      {requestData.userId?.familyId || user?.familyId}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500 font-semibold">Submission Date</div>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Channels Connected Card - Clean Light UI */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2 flex items-center gap-1.5">
                <HiSparkles className="text-amber-500" /> Automated Updates Active
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-3.5">
                Whenever this request changes status, instant alerts are dispatched through:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 flex items-center gap-2">
                  <span>💬 WhatsApp Bot</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 flex items-center gap-2">
                  <span>✉️ Email Alert</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 flex items-center gap-2">
                  <span>🔔 In-App Center</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 flex items-center gap-2">
                  <span>📱 Push Alerts</span>
                </div>
              </div>
            </div>

            {/* Church Office Contact & Help Card - Clean Light UI */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Parish Administration
              </h3>
              <p className="text-xs text-slate-600 mb-3.5 leading-relaxed">
                Need urgent assistance or have questions regarding this request? Contact the parish office:
              </p>
              <div className="space-y-2 text-xs">
                <a
                  href={`https://wa.me/${getWhatsAppNumber() || ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <FiPhone /> WhatsApp Parish ({getChurchPhone() || 'Parish Office'})
                </a>
                <a
                  href={`mailto:${getChurchEmail() || ''}`}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 font-semibold hover:bg-blue-100 transition-colors"
                >
                  <FiMail /> {getChurchEmail() || 'Contact Parish Office'}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        PORTRAIT PDF RECEIPT TEMPLATE (Hidden offscreen, captured by html2canvas)
        Standard A4 Portrait layout: width 794px (~210mm at 96dpi)
        ========================================================================
      */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none select-none" aria-hidden="true">
        <div
          id="printable-portrait-receipt"
          ref={receiptRef}
          style={{
            width: '794px',
            minHeight: '1050px',
            backgroundColor: '#ffffff',
            color: '#1f2937',
            padding: '36px 42px',
            fontFamily: 'Inter, Arial, sans-serif',
            boxSizing: 'border-box'
          }}
        >
          {/* Top Meta Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#4b5563', marginBottom: '14px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
            <div>Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}, {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
            <div style={{ fontWeight: 'bold', color: '#1e3a8a' }}>SJBC-REF-{referenceId}</div>
          </div>

          {/* Church Branding & Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '18px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <img
                src={churchLogo}
                alt="Church Logo"
                style={{ width: '72px', height: '72px', objectFit: 'contain' }}
              />
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a', letterSpacing: '-0.02em' }}>
                  ST. JOHN DE BRITTO CHURCH
                </h1>
                <h2 style={{ margin: '3px 0', fontSize: '16px', color: '#b45309', fontWeight: 'bold' }}>
                  புனித அருளானந்தர் தேவாலயம்
                </h2>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#4b5563' }}>
                  Murthi Nagar, Kalayarkoil, Sivagangai District, Tamil Nadu 630551, India.
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b7280' }}>
                  Parish Office: {getChurchPhone() || 'Contact Parish Office'} • Email: {getChurchEmail() || 'Contact Parish Office'}
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                RECEIPT
              </div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', marginTop: '2px' }}>
                {currentConfig.title}
              </div>
            </div>
          </div>

          {/* Particulars Grid: 2 Columns */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
            {/* Left Column */}
            <div style={{ flex: 1, backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#6b7280', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
                Request & Parishioner Details
              </div>

              <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Reference ID:</span>
                <span style={{ fontWeight: 'bold', color: '#1e3a8a', fontFamily: 'monospace' }}>{referenceId}</span>
              </div>

              <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Parishioner Name:</span>
                <span style={{ fontWeight: 'bold', color: '#111827' }}>{parishionerName}</span>
              </div>

              <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Phone Number:</span>
                <span style={{ color: '#111827' }}>{parishionerPhone}</span>
              </div>

              {(requestData.userId?.parishMemberId || user?.parishMemberId) && (
                <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Parish Member ID:</span>
                  <span style={{ fontFamily: 'monospace', color: '#111827' }}>{requestData.userId?.parishMemberId || user?.parishMemberId}</span>
                </div>
              )}

              <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Service Type:</span>
                <span style={{ fontWeight: '600', color: '#111827', textTransform: 'capitalize' }}>
                  {requestData.intentionType ? requestData.intentionType.replace(/_/g, ' ') : (requestData.type || currentConfig.title)}
                </span>
              </div>

              {(requestData.personName || requestData.familyName) && (
                <div style={{ display: 'flex', fontSize: '13px' }}>
                  <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Offered For:</span>
                  <span style={{ fontWeight: 'bold', color: '#111827' }}>{requestData.personName || requestData.familyName}</span>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div style={{ flex: 1, backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#6b7280', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
                Schedule & Status
              </div>

              <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Submission Date:</span>
                <span style={{ color: '#111827' }}>{createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>

              {requestData.massDate && (
                <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Target Mass Date:</span>
                  <span style={{ fontWeight: 'bold', color: '#111827' }}>
                    {new Date(requestData.massDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}

              {requestData.massTime && (
                <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Mass Time:</span>
                  <span style={{ fontWeight: 'bold', color: '#111827' }}>{requestData.massTime}</span>
                </div>
              )}

              <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Offertory:</span>
                <span style={{ fontWeight: 'bold', color: '#111827', fontFamily: 'monospace' }}>
                  {requestData.offertory > 0 ? `INR. ${Number(requestData.offertory).toFixed(2)}` : 'N/A / Voluntary'}
                </span>
              </div>

              <div style={{ display: 'flex', fontSize: '13px' }}>
                <span style={{ width: '130px', fontWeight: '600', color: '#4b5563' }}>Status:</span>
                <span
                  style={{
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    color: isApproved || isCompleted ? '#16a34a' : isRejected ? '#dc2626' : '#d97706'
                  }}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>

          {/* Description & Offertory Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', border: '1px solid #e5e7eb', color: '#111827', fontWeight: 'bold' }}>
                  Particulars / Description
                </th>
                <th style={{ textAlign: 'right', padding: '10px 14px', border: '1px solid #e5e7eb', color: '#111827', fontWeight: 'bold', width: '160px' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '12px 14px', border: '1px solid #e5e7eb', color: '#374151' }}>
                  <div style={{ fontWeight: 'bold', color: '#111827', marginBottom: '2px' }}>
                    {currentConfig.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {requestData.intentionType ? requestData.intentionType.replace(/_/g, ' ') : (requestData.type || 'Church Request')}
                    {requestData.personName ? ` — Offered for: ${requestData.personName}` : ''}
                  </div>
                </td>
                <td style={{ textAlign: 'right', padding: '12px 14px', border: '1px solid #e5e7eb', fontWeight: 'bold', color: '#111827', fontFamily: 'monospace' }}>
                  {requestData.offertory > 0 ? `₹${Number(requestData.offertory).toFixed(2)}` : '₹0.00'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Intention / Message Box */}
          {(requestData.intentionDetails || requestData.intention || requestData.message || requestData.requestDetails) && (
            <div style={{ marginBottom: '20px', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', backgroundColor: '#fffbeb' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#92400e', marginBottom: '6px' }}>
                Prayer Petition / Special Intention:
              </div>
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#1f2937', lineHeight: '1.6' }}>
                "{requestData.intentionDetails || requestData.intention || requestData.message || requestData.requestDetails}"
              </div>
            </div>
          )}

          {/* Alternative Date Proposal (if any) */}
          {suggestedDate && (
            <div style={{ marginBottom: '20px', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 16px', backgroundColor: '#fff7ed', fontSize: '12.5px' }}>
              <strong style={{ color: '#9a3412' }}>Parish Office Proposed Alternative Slot: </strong>
              <span>
                {suggestedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                {suggestedTime ? ` at ${suggestedTime}` : ''}
              </span>
            </div>
          )}

          {/* Official Remarks (if any) */}
          {adminNote && (
            <div style={{ marginBottom: '20px', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', backgroundColor: '#eff6ff', fontSize: '12.5px' }}>
              <strong style={{ color: '#1e40af' }}>Parish Administration Remarks: </strong>
              <span style={{ color: '#1e3a8a', fontStyle: 'italic' }}>"{adminNote}"</span>
            </div>
          )}

          {/* Blessing & Appreciation */}
          <div style={{ marginTop: '28px', textAlign: 'center', lineHeight: '1.7', fontSize: '13px', color: '#374151' }}>
            <div>Thank you for your active participation and devotion in the parish community of</div>
            <div style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: '14px' }}>St. John de Britto Church, Kalayarkoil.</div>
            <div style={{ color: '#b45309', fontWeight: 'bold', marginTop: '6px' }}>
              May God bless you and your family abundantly through the intercession of St. John de Britto.
            </div>
          </div>

          {/* Office Contact Info */}
          <div style={{ marginTop: '26px', borderTop: '1px dashed #d1d5db', paddingTop: '14px', textAlign: 'center', fontSize: '11px', color: '#6b7280', lineHeight: '1.6' }}>
            <div>Parish Office: Murthi Nagar, Kalayarkoil, Sivagangai Dist, Tamil Nadu 630551</div>
            <div>Phone: {[getChurchPhone(), getParishOfficePhone()].filter(Boolean).join(' / ') || 'Parish Office'} • Email: {getChurchEmail() || 'Parish Office'} • Web: www.stjohnchurch.com</div>
          </div>

          {/* Footer Statement */}
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#111827', borderTop: '2px solid #e5e7eb', paddingTop: '14px' }}>
            Official Computer-Generated Receipt. <span style={{ color: '#dc2626' }}>SIGNATURE NOT REQUIRED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
