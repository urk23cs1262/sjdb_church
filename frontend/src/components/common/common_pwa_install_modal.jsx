import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiDownload, 
  FiCheckCircle, 
  FiShare, 
  FiPlusSquare, 
  FiZap, 
  FiBell, 
  FiCheck,
  FiLoader
} from 'react-icons/fi';
import { GiChurch } from 'react-icons/gi';
import { usePWA } from '../../context/context_pwa';
import sjdbImage from '../../assets/sjdb_image.png';

export default function PWAInstallModal() {
  const location = useLocation();
  const { 
    showModal, 
    installState, 
    setInstallState,
    closeInstallModal, 
    triggerInstall,
    checkPostLoginPrompt
  } = usePWA();

  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Initializing installation...');

  // Guard: Never auto-trigger PWA modal on auth / onboarding pages
  useEffect(() => {
    const isAuthPage = /^\/(login|register|verify-account|forgot-password|reset-password)/i.test(location.pathname);
    if (!isAuthPage) {
      checkPostLoginPrompt();
    }
  }, [location.pathname, checkPostLoginPrompt]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showModal) {
        closeInstallModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, closeInstallModal]);

  // Step progress animation during installation
  useEffect(() => {
    if (installState !== 'installing') {
      setProgress(0);
      return;
    }

    const steps = [
      { at: 25, text: 'Connecting to church services...' },
      { at: 55, text: 'Caching liturgical calendar & prayers for offline use...' },
      { at: 85, text: 'Enabling instant parish notifications...' },
      { at: 100, text: 'Finalizing installation on your device...' },
    ];

    const startTime = Date.now();
    const totalDuration = 3000; // 3 seconds smooth animation

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      setProgress(currentProgress);

      const currentStep = steps.find(s => currentProgress <= s.at) || steps[steps.length - 1];
      setProgressText(currentStep.text);

      if (currentProgress >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          setInstallState('complete');
        }, 400);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [installState, setInstallState]);

  // Auto-close on complete after success message display
  useEffect(() => {
    if (installState !== 'complete') return;
    const timer = setTimeout(() => {
      closeInstallModal();
    }, 3500);
    return () => clearTimeout(timer);
  }, [installState, closeInstallModal]);

  if (!showModal) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={closeInstallModal}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-gray-100 text-center relative space-y-6"
        >
          {/* STATE: INSTALLING */}
          {installState === 'installing' && (
            <div className="space-y-6 py-2">
              {/* Church Image with Loading Ring */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto">
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-church-gold via-amber-400 to-yellow-200 opacity-75 blur-sm animate-pulse" />
                <div className="relative w-full h-full rounded-2xl bg-white border-2 border-amber-400 shadow-lg flex items-center justify-center overflow-hidden p-1">
                  <img 
                    src={sjdbImage} 
                    alt="St. John de Britto Church" 
                    className="w-full h-full object-cover object-top rounded-xl"
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-church-royal-blue text-church-gold p-2 rounded-xl shadow-md border border-amber-300">
                  <FiLoader className="w-4 h-4 animate-spin" />
                </div>
              </div>

              {/* Texts */}
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Installing SJDB Church...
                </h2>
                <p className="text-xs text-gray-500 max-w-xs mx-auto animate-pulse min-h-[2.5rem] flex items-center justify-center">
                  {progressText}
                </p>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="space-y-2 max-w-xs mx-auto">
                <div className="flex justify-between items-center text-[11px] font-semibold text-gray-500">
                  <span className="flex items-center gap-1 text-church-gold">
                    <FiZap className="w-3.5 h-3.5 animate-bounce" /> Setting up app
                  </span>
                  <span className="font-mono text-church-royal-blue font-bold">{progress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-full transition-all duration-150 ease-out shadow-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-gray-400">
                Please wait while installation completes on your device...
              </p>
            </div>
          )}

          {/* STATE: COMPLETE */}
          {installState === 'complete' && (
            <div className="space-y-6 py-2">
              {/* Success Icon */}
              <motion.div 
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-300 flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/10 relative"
              >
                <FiCheckCircle className="w-10 h-10" />
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full border-2 border-emerald-400 opacity-40"
                />
              </motion.div>

              {/* Success Message */}
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Installation Successful!
                </h2>
                <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
                  SJDB Church is now installed on your device. You can launch it directly from your home screen or desktop for fast, offline-ready parish access.
                </p>
              </div>

              {/* Confirmation Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mx-auto">
                <FiCheck className="w-3.5 h-3.5" />
                <span>App Ready to Use</span>
              </div>

              {/* Done Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={closeInstallModal}
                  className="btn-gold w-full justify-center py-3 text-sm font-bold shadow-gold flex items-center gap-2 rounded-xl"
                >
                  <FiCheck className="w-4 h-4" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE: IOS SAFARI GUIDE */}
          {installState === 'ios-guide' && (
            <div className="space-y-5">
              {/* Church Image */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/60 border-2 border-amber-200/90 shadow-md flex items-center justify-center mx-auto overflow-hidden p-1">
                <img 
                  src={sjdbImage} 
                  alt="St. John de Britto Church" 
                  className="w-full h-full object-cover object-top rounded-xl"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <GiChurch className="w-8 h-8 text-church-royal-blue hidden only:block" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Install SJDB Church
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Add SJDB Church to your Home Screen for quick access.
                </p>
              </div>

              {/* Steps Box */}
              <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 text-left text-xs text-gray-700 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <p>
                    Tap the <FiShare className="inline text-blue-600 mx-1" /> <strong>Share</strong> button in Safari.
                  </p>
                </div>
                <div className="h-px bg-gray-200" />
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <p>
                    Select <FiPlusSquare className="inline text-amber-600 mx-1" /> <strong>Add to Home Screen</strong>.
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

              {/* Actions: Got It and Maybe Later */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={closeInstallModal}
                  className="w-full py-3.5 px-4 rounded-xl bg-church-royal-blue hover:bg-navy-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <FiCheck className="w-4 h-4 text-church-gold" />
                  <span>Got It</span>
                </button>

                <button
                  type="button"
                  onClick={closeInstallModal}
                  className="w-full py-2 px-4 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          )}

          {/* STATE: IDLE (MANDATORY CHROMIUM / DESKTOP / ANDROID) */}
          {installState === 'idle' && (
            <div className="space-y-6">
              {/* Church Image (sjdb_image.png) */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/60 border-2 border-amber-200/90 shadow-md flex items-center justify-center mx-auto overflow-hidden p-1">
                <img 
                  src={sjdbImage} 
                  alt="St. John de Britto Church" 
                  className="w-full h-full object-cover object-top rounded-xl"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <GiChurch className="w-10 h-10 text-church-royal-blue hidden only:block" />
              </div>

              {/* Header Texts */}
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  INSTALL SJDB CHURCH
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
                  Install SJDB Church on your device for faster access and an app-like experience.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2.5 text-left">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <FiZap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">Instant Access</h4>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                      Quick launch directly without browser search or URL bars.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-church-royal-blue flex items-center justify-center shrink-0 mt-0.5">
                    <FiBell className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">Parish Notifications</h4>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                      Receive updates for Mass schedules, feast days & events.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons: ONLY Install App and Maybe Later */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="btn-gold w-full justify-center py-3.5 text-sm font-bold shadow-gold flex items-center gap-2 rounded-xl"
                >
                  <FiDownload className="w-4 h-4" />
                  <span>Install App</span>
                </button>

                <button
                  type="button"
                  onClick={closeInstallModal}
                  className="w-full py-2 px-4 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
