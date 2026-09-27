import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiDownload, 
  FiCheckCircle, 
  FiShare, 
  FiPlusSquare, 
  FiZap, 
  FiBell, 
  FiCheck, 
  FiLoader,
  FiX,
  FiMoreVertical
} from 'react-icons/fi';
import { useAuth } from '../../context/context_auth_context';
import { usePWA } from '../../context/context_pwa';
import appIcon from '../../assets/sjdb_image.png';

export default function PWAInstallModal() {
  const location = useLocation();
  const modalRef = useRef(null);
  const primaryBtnRef = useRef(null);
  const { t, i18n } = useTranslation();
  const isTamil = i18n.language === 'ta';
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { 
    showModal, 
    installState, 
    dismissInstallPrompt, 
    triggerInstall,
    checkPostLoginPrompt
  } = usePWA();

  // Run PWA install check upon route change or when user logs in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      checkPostLoginPrompt(true);
    }
  }, [location.pathname, isAuthenticated, authLoading, checkPostLoginPrompt]);

  // Keyboard navigation & accessibility (Escape to dismiss, focus management)
  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        dismissInstallPrompt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus primary action button when modal opens
    const focusTimer = setTimeout(() => {
      if (primaryBtnRef.current) {
        primaryBtnRef.current.focus();
      }
    }, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [showModal, dismissInstallPrompt]);

  if (!showModal) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        onClick={dismissInstallPrompt}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-dialog-title"
        aria-describedby="pwa-dialog-desc"
      >
        <motion.div
          ref={modalRef}
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white/95 backdrop-blur-xl rounded-[28px] sm:rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-gray-100/80 text-center relative my-auto space-y-6"
        >
          {/* Close button (top right) */}
          <button
            type="button"
            onClick={dismissInstallPrompt}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-church-gold"
            aria-label="Close dialog"
          >
            <FiX className="w-5 h-5" />
          </button>

          {/* Top Saint Portrait Icon */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-amber-50/70 border border-amber-200/90 flex items-center justify-center mx-auto overflow-hidden p-1 shadow-md">
            <img 
              src={appIcon} 
              alt="St. John de Britto Church" 
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* STATE: INSTALLING */}
          {installState === 'installing' && (
            <div className="py-2 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-church-gold border border-amber-200/80 flex items-center justify-center mx-auto shadow-inner">
                <FiLoader className="w-7 h-7 animate-spin text-church-gold" />
              </div>

              <div className="space-y-1.5">
                <h2 id="pwa-dialog-title" className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Installing SJDB Church
                </h2>
                <p id="pwa-dialog-desc" className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                  Please wait while the app is being installed on your device...
                </p>
              </div>
            </div>
          )}

          {/* STATE: COMPLETE */}
          {installState === 'complete' && (
            <div className="py-2 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-inner">
                <FiCheckCircle className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h2 id="pwa-dialog-title" className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Installation Complete
                </h2>
                <p id="pwa-dialog-desc" className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                  SJDB Church is now installed. You can launch it directly from your home screen.
                </p>
              </div>
            </div>
          )}

          {/* STATE: IOS SAFARI GUIDE */}
          {installState === 'ios-guide' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 id="pwa-dialog-title" className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Install SJDB Church
                </h2>
                <p id="pwa-dialog-desc" className="text-sm text-gray-600 leading-relaxed">
                  Install the SJDB Church app for quick and easy access to church updates, daily Catholic content, events, prayers, and more.
                </p>
              </div>

              {/* iOS Instructions Box */}
              <div className="bg-gray-50/90 border border-gray-200/80 rounded-2xl p-4 text-left text-xs text-gray-700 space-y-3">
                <p className="font-semibold text-gray-800 text-[13px] border-b border-gray-200 pb-1.5">
                  To install SJDB Church:
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <p>
                    Tap the <FiShare className="inline text-blue-600 mx-1 text-sm" /> <strong>Share</strong> button in Safari.
                  </p>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <p>
                    Select <FiPlusSquare className="inline text-amber-600 mx-1 text-sm" /> <strong>Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <p>
                    Tap <strong>Add</strong> in the top-right corner.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  ref={primaryBtnRef}
                  type="button"
                  onClick={dismissInstallPrompt}
                  className="w-full py-3 px-4 rounded-xl bg-church-royal-blue hover:bg-navy-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-church-gold"
                >
                  <FiCheck className="w-4 h-4 text-church-gold" />
                  <span>Got It</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE: MANUAL GUIDE (Browsers without deferredPrompt available) */}
          {installState === 'manual-guide' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 id="pwa-dialog-title" className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Install SJDB Church
                </h2>
                <p id="pwa-dialog-desc" className="text-sm text-gray-600 leading-relaxed">
                  Install the SJDB Church app for quick and easy access to church updates, daily Catholic content, events, prayers, and more.
                </p>
              </div>

              {/* Manual Steps Box */}
              <div className="bg-gray-50/90 border border-gray-200/80 rounded-2xl p-4 text-left text-xs text-gray-700 space-y-3">
                <p className="font-semibold text-gray-800 text-[13px] border-b border-gray-200 pb-1.5">
                  To install SJDB Church on your device:
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <p>
                    Tap the browser menu <FiMoreVertical className="inline text-blue-600 mx-1 text-sm" /> (three dots).
                  </p>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <p>
                    Select <FiDownload className="inline text-amber-600 mx-1 text-sm" /> <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                  </p>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <p>
                    Choose <strong>Install</strong> to add the standalone application.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={dismissInstallPrompt}
                  className="w-full sm:w-1/2 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold text-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-300 order-2 sm:order-1"
                >
                  Not Now
                </button>
                <button
                  ref={primaryBtnRef}
                  type="button"
                  onClick={dismissInstallPrompt}
                  className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-church-royal-blue hover:bg-navy-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-church-gold order-1 sm:order-2"
                >
                  <FiCheck className="w-4 h-4 text-church-gold" />
                  <span>Got It</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE: IDLE (Standard state with deferredPrompt ready) */}
          {installState === 'idle' && (
            <div className="space-y-6">
              {/* Header Title & Required Message */}
              <div className="space-y-2">
                <h2 id="pwa-dialog-title" className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  {isTamil ? "புனித அருளானந்தர் செயலியை நிறுவவும்" : "Install SJDB Church App"}
                </h2>
                <p id="pwa-dialog-desc" className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
                  {isTamil
                    ? "தினசரி திருப்பலி, பக்திப் பாடல்கள், நிகழ்வுகள் மற்றும் பங்கு அறிவிப்புகளை உடனுக்குடன் பெற செயலியை நிறுவவும்."
                    : "Install the SJDB Church app for quick and easy access to church updates, daily Catholic content, events, prayers, and more."}
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2.5 text-left">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50/90 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <FiZap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{isTamil ? "நேரடி அணுகல்" : "Instant Access"}</h4>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                      {isTamil
                        ? "முகப்புத் திரையிலிருந்து இணையதள முகவரிப் பட்டை இன்றி நேரடியாகத் திறக்கவும்."
                        : "Launch straight from your home screen or desktop without browser URL bars."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50/90 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-church-royal-blue flex items-center justify-center shrink-0 mt-0.5">
                    <FiBell className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{isTamil ? "பங்கு அறிவிப்புகள்" : "Parish Notifications"}</h4>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                      {isTamil
                        ? "திருப்பலி நேரங்கள், நவநாட்கள், திருவிழாக்கள் மற்றும் முக்கிய அறிவிப்புகளை உடனுக்குடன் பெறுக."
                        : "Get updates on Holy Mass schedules, novenas, feast days, and announcements."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Primary 'Install App' + Secondary 'Not Now' */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={dismissInstallPrompt}
                  className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100/80 font-semibold text-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-300 order-2 sm:order-1"
                >
                  {isTamil ? "இப்போது வேண்டாம்" : "Not Now"}
                </button>
                <button
                  ref={primaryBtnRef}
                  type="button"
                  onClick={triggerInstall}
                  className="btn-gold w-full sm:w-1/2 justify-center py-3.5 px-4 text-sm font-bold shadow-gold flex items-center gap-2 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-church-gold order-1 sm:order-2"
                >
                  <FiDownload className="w-4 h-4" />
                  <span>{isTamil ? "செயலியை நிறுவுக" : "Install App"}</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
