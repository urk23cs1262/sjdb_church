import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiAlertTriangle, FiClock, FiPhone, FiMail, FiRefreshCw,
  FiShield, FiArrowRight, FiCheckCircle
} from 'react-icons/fi';
import { FaFacebook, FaInstagram, FaYoutube } from 'react-icons/fa';
import churchLogo from '../../assets/church_extirior.png';
import constructionImg from '../../assets/construction.png';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function Maintenance({ isPreview = false }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const fetchStatus = async (showToast = false) => {
    if (showToast) setChecking(true);
    try {
      const res = await api.get('/maintenance/status');
      if (res.data.success) {
        setStatus(res.data);
        if (!res.data.isEnabled && !isPreview) {
          if (showToast) toast.success('Maintenance completed! Redirecting to home...');
          navigate('/', { replace: true });
        } else if (showToast) {
          toast('Maintenance mode is still active. Please check back shortly.');
        }
      }
    } catch (err) {
      console.error('Failed to fetch maintenance status:', err);
    } finally {
      setLoading(false);
      if (showToast) setChecking(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    if (!isPreview) {
      // Track access attempt for analytics
      api.post('/maintenance/track-attempt').catch(() => { });

      // Periodic check every 15s to auto-redirect when admin disables maintenance
      const autoCheckInterval = setInterval(() => {
        api.get('/maintenance/status').then(res => {
          if (res.data.success && !res.data.isEnabled) {
            toast.success('Website is back online! Redirecting to home...');
            navigate('/', { replace: true });
          }
        }).catch(() => { });
      }, 15000);

      return () => clearInterval(autoCheckInterval);
    }
  }, [navigate, isPreview]);

  // Countdown timer calculations with Auto-Redirect on completion
  useEffect(() => {
    if (!status?.expectedCompletion || status?.showCountdown === false) return;

    const target = new Date(status.expectedCompletion).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(interval);
        if (!isPreview) {
          toast.success('Maintenance period completed! Redirecting to home page...', { id: 'maint-complete' });
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1500);
        }
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, navigate]);

  const formattedDate = status?.expectedCompletion
    ? new Date(status.expectedCompletion).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    })
    : 'Shortly';

  const mediaSource = (status?.mediaUrl && status?.mediaType !== 'none')
    ? status.mediaUrl
    : constructionImg;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/70 via-slate-50 to-amber-100/50 text-slate-800 flex flex-col items-center justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden font-sans">

      {/* Light Background Decorative Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Header / Brand Bar */}
      <header className="w-full max-w-6xl flex items-center justify-between z-10 py-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white ring-2 ring-church-gold/40 border border-amber-300 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
            <img src={churchLogo} alt="Church Logo" className="w-full h-full object-cover object-[center_15%] rounded-full" />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg text-church-royal-blue tracking-wide">St. John de britto Church</h1>
            <p className="text-[11px] text-amber-700 font-semibold">Kalayarkoil — Official Portal</p>
          </div>
        </div>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-amber-50/80 border border-amber-200/80 text-xs font-bold text-church-royal-blue transition-all shadow-sm cursor-pointer"
        >
          <FiShield className="text-amber-600 text-sm" />
          <span>Technical Team Access</span>
        </Link>
      </header>

      {/* Main Grid Content (Left: Fully Visible Image, Right: Title & Countdown) */}
      <main className="w-full max-w-6xl my-auto z-10 py-6">

        {/* Category & Announcement Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs sm:text-sm font-bold shadow-sm mb-3"
          >
            <span className="text-base"></span>
            <span>Website Under Maintenance</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-church-royal-blue tracking-tight leading-tight max-w-3xl mx-auto"
          >
            {status?.title || 'Website Under Maintenance'}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 text-xs sm:text-sm md:text-base max-w-2xl mx-auto mt-4 font-medium space-y-2"
          >
            <p>Our website is currently undergoing scheduled maintenance to improve performance, security, and user experience.</p>
            <p>We apologize for the inconvenience.</p>
            <p>Please check back again shortly.</p>
            {/* <p className="text-amber-800 font-semibold bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 inline-block mt-1">
               Only Administrators and the Technical Team can access the website during maintenance.
            </p> */}
          </motion.div>
        </div>

        {/* 2-Column Split: Image Left, Countdown & Login Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">

          {/* Left Column: Construction Illustration Only */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full flex items-center justify-center p-6 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 shadow-lg"
          >
            <img
              src={constructionImg}
              alt="Under Construction"
              className="w-full h-auto max-h-[350px] object-contain drop-shadow-xl"
            />
          </motion.div>

          {/* Right Column: Login CTA & Countdown Timer */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/90 backdrop-blur-xl border border-amber-200/80 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col items-center justify-center text-center space-y-6"
          >
            {/* Primary Action: Admin / Technical Team Login */}
            {/* <div className="w-full space-y-3">
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-church-royal-blue hover:bg-blue-900 text-white font-bold text-sm sm:text-base shadow-xl hover:shadow-blue-900/30 transition-all cursor-pointer border border-blue-800"
              >
                <FiShield className="text-amber-400 text-lg" />
                <span>Admin / Technical Team Login</span>
                <FiArrowRight className="text-amber-400 text-base" />
              </Link>
              <p className="text-[11px] text-slate-500">
                Restricted portal access for authorised parish administrators and tech team.
              </p>
            </div> */}

            {status?.showCountdown !== false && (
              <div className="w-full space-y-4 pt-4 border-t border-amber-100">
                <div className="flex items-center justify-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <FiClock className="text-amber-600 text-sm" />
                  <span>Estimated Completion Counter</span>
                </div>

                {/* Digital Counter Cards */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 sm:p-4 text-center">
                    <span className="block text-2xl sm:text-4xl font-black text-church-royal-blue font-mono">{String(timeLeft.days).padStart(2, '0')}</span>
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1 block">Days</span>
                  </div>
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 sm:p-4 text-center">
                    <span className="block text-2xl sm:text-4xl font-black text-amber-600 font-mono">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1 block">Hours</span>
                  </div>
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 sm:p-4 text-center">
                    <span className="block text-2xl sm:text-4xl font-black text-church-royal-blue font-mono">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1 block">Mins</span>
                  </div>
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 sm:p-4 text-center">
                    <span className="block text-2xl sm:text-4xl font-black text-amber-600 font-mono">{String(timeLeft.seconds).padStart(2, '0')}</span>
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1 block">Secs</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-amber-100 flex items-center justify-between text-xs text-gray-600">
                  <span>Expected Completion:</span>
                  <span className="font-bold text-church-royal-blue">{formattedDate}</span>
                </div>
              </div>
            )}

            {/* Interactive Refresh Action Button */}
            <div className="w-full pt-1">
              <button
                onClick={() => fetchStatus(true)}
                disabled={checking}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-church-royal-blue hover:bg-blue-900 text-white font-bold text-xs sm:text-sm border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 group"
              >
                <FiRefreshCw className={`text-base text-church-gold ${checking ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span>{checking ? 'Checking Status...' : 'Check If Site Is Live'}</span>
              </button>
              <p className="text-[11px] text-gray-500 mt-2">
                This page will automatically redirect to the home page once maintenance is finished.
              </p>
            </div>
          </motion.div>

        </div>
      </main>

      {/* Footer Info & Contacts */}
      <footer className="w-full max-w-5xl z-10 pt-4 border-t border-amber-200/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-600">

        {/* Contact info */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
          <span className="font-bold text-church-royal-blue">Need Assistance?</span>
          <a href={`tel:${status?.contactPhone || '+919443100000'}`} className="inline-flex items-center gap-1.5 hover:text-amber-700 font-semibold transition-colors">
            <FiPhone className="text-amber-600" />
            <span>{status?.contactPhone || '+91 94431 00000'}</span>
          </a>
          <a href={`mailto:${status?.contactEmail || 'support@stjohndebrittochurch.org'}`} className="inline-flex items-center gap-1.5 hover:text-amber-700 font-semibold transition-colors">
            <FiMail className="text-amber-600" />
            <span>{status?.contactEmail || 'support@stjohndebrittochurch.org'}</span>
          </a>
        </div>

        {/* Social Links */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 font-semibold">Follow Us:</span>
          <a href={status?.socialLinks?.facebook || 'https://facebook.com'} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-white border border-amber-200 text-slate-600 hover:text-blue-600 transition-colors shadow-2xs">
            <FaFacebook className="text-sm" />
          </a>
          <a href={status?.socialLinks?.instagram || 'https://instagram.com'} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-white border border-amber-200 text-slate-600 hover:text-pink-600 transition-colors shadow-2xs">
            <FaInstagram className="text-sm" />
          </a>
          <a href={status?.socialLinks?.youtube || 'https://youtube.com'} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-white border border-amber-200 text-slate-600 hover:text-red-600 transition-colors shadow-2xs">
            <FaYoutube className="text-sm" />
          </a>
        </div>
      </footer>

    </div>
  );
}
