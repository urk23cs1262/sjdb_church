import React, { useEffect } from 'react';
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
import churchLogo from '../../assets/church_extirior.png';

export default function PWAInstallModal() {
  const location = useLocation();
  const { 
    showModal, 
    installState, 
    closeInstallModal, 
    triggerInstall,
    checkPostLoginPrompt
  } = usePWA();

  useEffect(() => {
    checkPostLoginPrompt();
  }, [location.pathname, checkPostLoginPrompt]);

  if (!showModal) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
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
            <div className="py-4 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-church-gold border border-amber-200/80 flex items-center justify-center mx-auto shadow-inner">
                <FiLoader className="w-8 h-8 animate-spin text-church-gold" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Installing SJDB Church
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                  Please wait while the app is being installed...
                </p>
              </div>
            </div>
          )}

          {/* STATE: COMPLETE */}
          {installState === 'complete' && (
            <div className="py-4 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-inner">
                <FiCheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Installation complete
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                  SJDB Church is now installed on your device.
                </p>
              </div>
            </div>
          )}

          {/* STATE: IOS SAFARI GUIDE */}
          {installState === 'ios-guide' && (
            <div className="space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-church-royal-blue border border-amber-200/80 flex items-center justify-center mx-auto overflow-hidden p-1 shadow-sm">
                <img 
                  src={churchLogo} 
                  alt="SJDB Church" 
                  className="w-full h-full object-cover rounded-xl"
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

              {/* Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={closeInstallModal}
                  className="w-full py-3.5 px-4 rounded-xl bg-church-royal-blue hover:bg-navy-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <FiCheck className="w-4 h-4 text-church-gold" />
                  <span>Got It</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE: IDLE (MANDATORY CHROMIUM / DESKTOP / ANDROID) */}
          {installState === 'idle' && (
            <div className="space-y-6">
              {/* Church Icon */}
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-church-royal-blue border border-amber-200/80 flex items-center justify-center mx-auto overflow-hidden p-1 shadow-sm">
                <img 
                  src={churchLogo} 
                  alt="SJDB Church" 
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <GiChurch className="w-8 h-8 text-church-royal-blue hidden only:block" />
              </div>

              {/* Header Texts */}
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-church-royal-blue">
                  Install SJDB Church
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

              {/* Single Action: Install App */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="btn-gold w-full justify-center py-3.5 text-sm font-bold shadow-gold flex items-center gap-2 rounded-xl"
                >
                  <FiDownload className="w-4 h-4" />
                  <span>Install App</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
