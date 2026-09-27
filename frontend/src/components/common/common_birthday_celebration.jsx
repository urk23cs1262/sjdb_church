import { useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/context_auth_context';
import { useTranslation } from 'react-i18next';
import { FiX } from 'react-icons/fi';
import api from '../../services/api';
import {
  getActiveCelebration,
  getCelebrationDetails,
  getTodayISTParts,
  isUserBirthdayToday,
  isCelebrationPopupAcknowledged,
  acknowledgeCelebrationPopup,
  onCelebrationPopupOpen
} from '../../services/celebrationService';

/**
 * Reusable Celebration Wish Popup Component
 * Displays full-screen celebratory modal for:
 * 1. Birthday (personal, logged-in user only)
 * 2. St. John de Britto Feast (Feb 4 — PUBLIC)
 * 3. Christmas (Dec 25 — PUBLIC)
 * 4. Easter Sunday (Computus — PUBLIC)
 * 5. New Year (Jan 1 — PUBLIC)
 *
 * Automatic Popup Rule:
 * - Pops up at 12:00:00 AM IST or on first visit of the celebration day if not acknowledged.
 * - Closing the popup records popupAcknowledged = true in localStorage.
 * - Refreshing the page does NOT repeatedly open the popup.
 * - Floating wishes on the homepage STAY ON all day.
 * - Clicking any floating wish or celebration badge RE-OPENS this exact popup immediately!
 */
export default function BirthdayCelebration() {
  const { user, isAuthenticated } = useAuth();
  const { i18n } = useTranslation();

  // Queue of celebration modals to display
  const [celebrationQueue, setCelebrationQueue] = useState([]);
  const [currentCelebration, setCurrentCelebration] = useState(null);

  const confettiIntervalRef = useRef(null);
  // Session-level dismissal set: keeps popup closed during current view, but re-triggers on every page refresh
  const sessionDismissedRef = useRef(new Set());

  // Current language preference
  const currentLang = user?.preferredLanguage || user?.settings?.language || i18n.language || 'en';

  // ─── CONFETTI CANNON ANIMATION ─────────────────────────────────────────────
  const triggerConfetti = useCallback(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
      confettiIntervalRef.current = null;
    }

    const duration = 4.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    confettiIntervalRef.current = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
        return;
      }

      const particleCount = 45 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  }, []);

  const stopConfetti = useCallback(() => {
    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
      confettiIntervalRef.current = null;
    }
    try {
      confetti.reset();
    } catch (e) {}
  }, []);

  // ─── LISTEN FOR MANUAL RE-OPEN EVENT (From Floating Wishes / Badges) ─────────
  useEffect(() => {
    const unsubscribe = onCelebrationPopupOpen((e) => {
      const data = e.detail;
      if (!data || !data.type) return;

      // Allow reopening manually anytime from floating wishes
      sessionDismissedRef.current.delete(data.type);

      const details = getCelebrationDetails({
        type: data.type,
        userName: data.userName || user?.name || 'Parishioner',
        language: currentLang
      });

      setCurrentCelebration({
        type: data.type,
        year: data.year || getTodayISTParts().year,
        userName: data.userName || user?.name || 'Parishioner',
        notificationId: data.notificationId || null,
        serverHeading: data.serverHeading || details.heading,
        serverMessage: data.serverMessage || details.message,
        serverButtonText: data.serverButtonText || details.buttonText,
        isManualReopen: true
      });

      triggerConfetti();
    });

    return unsubscribe;
  }, [user, currentLang, triggerConfetti]);

  // ─── CHECK ACTIVE CELEBRATIONS & AUTO-POPUP (Appears on Every Page Refresh) ───
  useEffect(() => {
    let isMounted = true;

    async function evaluateAutoPopup() {
      const detected = [];

      // 1. Local calculation in Asia/Kolkata (IST)
      const localActive = getActiveCelebration(user);
      if (localActive) {
        const isDismissed = sessionDismissedRef.current.has(localActive.type);
        // Automatically open on every page load/refresh if not dismissed in current view
        if (!isDismissed) {
          const details = getCelebrationDetails({
            type: localActive.type,
            userName: localActive.userName || user?.name || 'Parishioner',
            language: currentLang
          });

          detected.push({
            type: localActive.type,
            year: localActive.year,
            userName: localActive.userName || user?.name || 'Parishioner',
            notificationId: null,
            serverHeading: details.heading,
            serverMessage: details.message,
            serverButtonText: details.buttonText
          });
        }
      }

      // 2. Query backend for active celebrations
      try {
        const res = await api.get('/notifications/active-celebrations');
        if (res.data?.success && res.data.active && Array.isArray(res.data.celebrations)) {
          for (const serverCel of res.data.celebrations) {
            // Safety: verify birthday matches today's IST date
            if (serverCel.celebrationType === 'birthday') {
              const ist = getTodayISTParts();
              const birthdayMatchesToday = isUserBirthdayToday(user?.dob, ist.month, ist.day);
              if (!birthdayMatchesToday) continue;
            }

            const isDismissed = sessionDismissedRef.current.has(serverCel.celebrationType);
            if (!isDismissed && !detected.some(d => d.type === serverCel.celebrationType)) {
              detected.push({
                type: serverCel.celebrationType,
                year: serverCel.year,
                userName: serverCel.userName || user?.name || 'Parishioner',
                notificationId: serverCel.notificationId || null,
                serverHeading: serverCel.heading,
                serverMessage: serverCel.message,
                serverButtonText: serverCel.buttonText
              });
            }
          }
        }
      } catch (err) {
        // Fallback to local calculation if network or unauthenticated
      }

      if (isMounted && detected.length > 0 && !currentCelebration) {
        setCelebrationQueue(detected);
      }
    }

    evaluateAutoPopup();

    // Check periodically (every 20s) to catch 12:00:00 AM IST midnight boundary without page reload
    const interval = setInterval(evaluateAutoPopup, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      stopConfetti();
    };
  }, [user, isAuthenticated, currentLang, stopConfetti]);

  // Manage queue transition to currentCelebration (fire confetti cannon on auto popup)
  useEffect(() => {
    if (!currentCelebration && celebrationQueue.length > 0) {
      const nextCel = celebrationQueue[0];
      setCurrentCelebration(nextCel);
      triggerConfetti();
    }
  }, [celebrationQueue, currentCelebration, triggerConfetti]);

  // ─── ACKNOWLEDGE / CLOSE CELEBRATION MODAL ──────────────────────────────────
  const handleAcknowledge = async () => {
    if (!currentCelebration) return;

    const { type, year, notificationId } = currentCelebration;

    // Dismiss for the current page view so user can browse without repeated pops,
    // but on every page refresh, sessionDismissedRef will be fresh and it WILL pop up again!
    sessionDismissedRef.current.add(type);
    acknowledgeCelebrationPopup(type, year, user);

    // Notify backend of acknowledgment and mark notifications read if user is logged in
    try {
      await api.post('/notifications/acknowledge-celebration', {
        celebrationType: type,
        year,
        celebrationKey: `${type.toUpperCase()}_${year}_${user?._id || 'PUBLIC'}`,
        notificationId
      });
    } catch (e) {}

    // Advance queue and close popup
    setCurrentCelebration(null);
    setCelebrationQueue(prev => prev.filter(item => item.type !== type));
  };

  // Called when user clicks action button (Thank You!, Amen, Alleluia!): triggers extra confetti & closes
  const handleActionClick = () => {
    triggerConfetti();
    handleAcknowledge();
  };

  if (!currentCelebration) return null;

  const content = getCelebrationDetails({
    type: currentCelebration.type,
    userName: currentCelebration.userName || user?.name || 'Parishioner',
    language: currentLang
  });

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[99998] pointer-events-none flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative flex flex-col items-center w-full max-w-sm sm:max-w-md mx-auto pointer-events-auto"
        >
          {/* Celebratory Rounded Card Modal */}
          <div className="w-full bg-white/95 sm:bg-white backdrop-blur-2xl border-2 border-amber-300/80 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(217,151,38,0.45)] px-7 py-8 sm:px-9 sm:py-9 text-center relative z-10 overflow-hidden">
            {/* Close 'X' Button at Top-Right */}
            <button
              onClick={handleAcknowledge}
              aria-label="Close celebration popup"
              className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-colors cursor-pointer z-30"
            >
              <FiX className="text-xl sm:text-2xl" />
            </button>

            {/* Large Personalized Celebration Heading */}
            <h2
              id="celebration-title"
              className="font-serif font-black text-2xl sm:text-3xl text-church-royal-blue tracking-wide uppercase leading-tight mb-4 whitespace-pre-line"
            >
              {currentCelebration.serverHeading || content.heading}
            </h2>

            {/* Message Body */}
            <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-7 font-normal max-w-xs sm:max-w-sm mx-auto whitespace-pre-line">
              {currentCelebration.serverMessage || content.message}
            </p>

            {/* Large Action Button (Thank You!, Amen, Alleluia!) */}
            <button
              onClick={handleActionClick}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#d99726] hover:bg-[#c2841e] active:scale-[0.98] text-white font-bold text-base sm:text-lg tracking-wide shadow-lg shadow-amber-500/30 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-300"
            >
              {currentCelebration.serverButtonText || content.buttonText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
