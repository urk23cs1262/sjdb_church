import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShield, FiFileText, FiDownload, FiLock, FiAlertTriangle, FiCheckCircle, FiUser, FiHome, FiPhone, FiMail, FiCalendar } from 'react-icons/fi';
import { GiChurch, GiCrucifix } from 'react-icons/gi';
import toast from 'react-hot-toast';
import api, { API_URL } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import { useAuth } from '../../context/context_auth_context';
import PageHero from '../../components/common/common_page_hero';

export default function MemberReport() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchReport = async () => {
      setLoading(true);
      setErrorInfo(null);
      try {
        const res = await api.get(`/users/member-report/${token}`);
        if (isMounted && res.data.success) {
          setMemberData(res.data.member);
          toast.success(`Member record verified: ${res.data.member.name}`);

          // ONE TIME ONLY: Download PDF report once after scanning QR and viewing report
          const sessionKey = `downloaded_report_${token}`;
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, 'true');
            triggerSinglePdfDownload(res.data.member._id, res.data.member.name);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        const data = err.response?.data;
        if (data?.requireLogin || err.response?.status === 401) {
          setErrorInfo({
            type: 'auth_required',
            title: 'Authentication Required',
            message: data?.message || 'Please log in with an authorized Parish account to view this confidential member report.'
          });
        } else if (data?.accessDenied || err.response?.status === 403) {
          setErrorInfo({
            type: 'access_denied',
            title: 'Access Restricted',
            message: data?.message || 'Only authorized parish administrators or the member themselves can view this report.'
          });
        } else {
          setErrorInfo({
            type: 'error',
            title: 'Invalid or Expired QR Link',
            message: data?.message || 'The QR report link is invalid or expired. Please request an updated member report.'
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReport();

    return () => { isMounted = false; };
  }, [token, isAuthenticated]);

  const triggerSinglePdfDownload = async (memberId, memberName) => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    const safeName = (memberName || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Member_${safeName}_Report.pdf`;

    try {
      const res = await api.get(`/users/${memberId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 3000);
      toast.success('Member report PDF downloaded!');
    } catch (e) {
      console.error('PDF download fallback error:', e);
      try {
        const authToken = localStorage.getItem('token') || '';
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `${API_URL}/users/member-report/${token}/pdf?token=${encodeURIComponent(authToken)}`;
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 6000);
      } catch (err) { }
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleManualDownload = () => {
    if (memberData && !downloadingPdf) {
      triggerSinglePdfDownload(memberData._id, memberData.name);
    }
  };

  return (
    <div className="min-h-screen bg-church-cream pt-6 pb-20">
      <PageHero
        title={<>Member Report Verification</>}
        subtitle={<>St. John de britto Church • Kalayarkoil</>}
      />

      <div className="max-w-2xl mx-auto px-4 -mt-8 relative z-10">
        {loading ? (
          <div className="glass-card p-12 text-center bg-white shadow-xl rounded-3xl">
            <SectionLoader />
            <p className="text-sm font-semibold text-church-royal-blue mt-4">Verifying Member Security Token...</p>
            <p className="text-xs text-gray-400 mt-1">Checking authorization credentials & retrieving member records</p>
          </div>
        ) : errorInfo ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 sm:p-10 bg-white rounded-3xl shadow-xl text-center border border-red-100"
          >
            {errorInfo.type === 'auth_required' ? (
              <>
                <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm">
                  <FiLock />
                </div>
                <h2 className="font-display text-xl font-bold text-gray-900 mb-2">{errorInfo.title}</h2>
                <p className="text-sm text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">{errorInfo.message}</p>
                <button
                  onClick={() => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)}
                  className="btn-gold px-8 py-3 rounded-2xl text-sm font-bold shadow-lg inline-flex items-center gap-2"
                >
                  <FiShield /> Log In with Authorized Account
                </button>
              </>
            ) : errorInfo.type === 'access_denied' ? (
              <>
                <div className="w-16 h-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm">
                  <FiAlertTriangle />
                </div>
                <h2 className="font-display text-xl font-bold text-gray-900 mb-2">{errorInfo.title}</h2>
                <p className="text-sm text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">{errorInfo.message}</p>
                <button
                  onClick={() => navigate('/')}
                  className="btn-outline-gold px-6 py-2.5 rounded-xl text-xs font-bold"
                >
                  Return to Home
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                  <FiAlertTriangle />
                </div>
                <h2 className="font-display text-xl font-bold text-gray-900 mb-2">{errorInfo.title}</h2>
                <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">{errorInfo.message}</p>
                <button
                  onClick={() => navigate('/')}
                  className="btn-outline-gold px-6 py-2.5 rounded-xl text-xs font-bold"
                >
                  Return to Home
                </button>
              </>
            )}
          </motion.div>
        ) : memberData ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card bg-white rounded-3xl shadow-2xl border border-church-gold/30 overflow-hidden"
          >
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-church-royal-blue via-blue-900 to-indigo-950 p-6 sm:p-8 text-white relative">
              <GiChurch className="text-white/10 text-9xl absolute -right-4 -bottom-4 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] bg-white/20 text-gold-300 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Official Parish Document
                  </span>
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-white mt-1.5">
                    St. John de britto Church
                  </h1>
                  <p className="text-white/70 text-xs mt-0.5">MEMBER PROFILE & ACTIVITY REPORT</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${memberData.isSuspended ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    }`}>
                    {memberData.statusText}
                  </span>
                </div>
              </div>
            </div>

            {/* Member Details */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-5 space-y-3 font-mono text-xs sm:text-sm text-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                  <span className="text-gray-500 font-sans font-medium text-xs">Full Name:</span>
                  <strong className="text-church-royal-blue text-base font-sans">{memberData.name}</strong>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                  <span className="text-gray-500 font-sans font-medium text-xs">Parish Member ID:</span>
                  <strong className="text-amber-800 font-bold tracking-wider">{memberData.parishMemberId}</strong>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                  <span className="text-gray-500 font-sans font-medium text-xs">Phone Number:</span>
                  <span className="font-semibold text-gray-900">{memberData.phone}</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                  <span className="text-gray-500 font-sans font-medium text-xs">Email Address:</span>
                  <span className="text-gray-900 font-semibold">{memberData.email}</span>
                </div>

                {memberData.familyName && memberData.familyName !== 'N/A' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                    <span className="text-gray-500 font-sans font-medium text-xs">Family Name:</span>
                    <span className="font-semibold text-gray-900">{memberData.familyName}</span>
                  </div>
                )}

                {memberData.roleInFamily && memberData.roleInFamily !== 'N/A' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                    <span className="text-gray-500 font-sans font-medium text-xs">Family Role:</span>
                    <span className="font-semibold text-gray-900">{memberData.roleInFamily}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                  <span className="text-gray-500 font-sans font-medium text-xs">Date of Birth:</span>
                  <span>{memberData.dob}</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                  <span className="text-gray-500 font-sans font-medium text-xs">System Role:</span>
                  <span className="font-bold text-indigo-700">{memberData.role}</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-amber-200/50">
                  <span className="text-gray-500 font-sans font-medium text-xs">Registration Date:</span>
                  <span>{memberData.createdAt}</span>
                </div>

                <div className="py-1.5 text-xs text-gray-600 font-sans">
                  <span className="text-gray-500 font-medium block mb-0.5">Residential Address:</span>
                  <span>{memberData.address}</span>
                </div>
              </div>

              {/* PDF Download Button */}
              <div className="pt-2">
                <button
                  onClick={handleManualDownload}
                  disabled={downloadingPdf}
                  className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <FiDownload className="text-xl" />
                  {downloadingPdf ? 'Downloading PDF Report...' : ' Download PDF Report'}
                </button>
                <p className="text-[11px] text-gray-400 text-center mt-2">
                  This confidential report is verified by St. John de britto Church Digital Registry.
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
