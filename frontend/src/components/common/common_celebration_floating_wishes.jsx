import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/context_auth_context';
import { useTranslation } from 'react-i18next';
import {
  getActiveCelebration,
  getCelebrationDetails,
  openCelebrationPopup
} from '../../services/celebrationService';
import api from '../../services/api';

/**
 * Floating Celebration Wishes on the Homepage
 * Surrounds the circular St. John de Britto portrait on celebration days:
 * - Birthday (personal, logged-in user only)
 * - St. John de Britto Feast (Feb 4 — PUBLIC)
 * - Christmas (Dec 25 — PUBLIC)
 * - Easter Sunday (Computus — PUBLIC)
 * - New Year (Jan 1 — PUBLIC)
 *
 * Automatically appears at 12:00:00 AM IST and ends at 11:59:59 PM IST.
 * Clicking any wish re-opens the Celebration Wish Popup.
 * Zero elements / loops rendered on normal days.
 */
export default function CelebrationFloatingWishes() {
  const { user } = useAuth();
  const { i18n } = useTranslation();

  // Active celebration state
  const [activeCelebration, setActiveCelebration] = useState(null);
  const [serverCelebration, setServerCelebration] = useState(null);

  const currentLang = user?.preferredLanguage || user?.settings?.language || i18n.language || 'en';

  // Check celebration status (both locally in IST & via server API)
  useEffect(() => {
    let isMounted = true;

    const checkCelebration = async () => {
      // 1. Local calculation in Asia/Kolkata (IST)
      const localActive = getActiveCelebration(user);
      if (isMounted) {
        setActiveCelebration(localActive);
      }

      // 2. Query server for active celebration status
      try {
        const res = await api.get('/notifications/active-celebrations');
        if (isMounted && res.data?.success && res.data.active && Array.isArray(res.data.celebrations) && res.data.celebrations.length > 0) {
          const first = res.data.celebrations[0];
          setServerCelebration(first);
          if (!localActive) {
            setActiveCelebration({
              type: first.celebrationType,
              year: first.year,
              userName: first.userName,
              isPublic: first.isPublic
            });
          }
        }
      } catch (err) {
        // Fallback to local IST calculation if offline or unauthenticated
      }
    };

    checkCelebration();

    // Check periodically (every 20s) to catch 12:00:00 AM IST midnight boundary without page reload
    const interval = setInterval(checkCelebration, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window !== 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // If no active celebration, render nothing (normal homepage)
  if (!activeCelebration) {
    return null;
  }

  const celebrationData = getCelebrationDetails({
    type: activeCelebration.type,
    userName: activeCelebration.userName || serverCelebration?.userName || user?.name || 'Parishioner',
    language: currentLang
  });

  const cards = celebrationData.floatingWishes || [];
  if (!cards.length) return null;

  const handleCardClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCelebrationPopup({
      type: activeCelebration.type,
      year: activeCelebration.year,
      userName: activeCelebration.userName || serverCelebration?.userName || user?.name || 'Parishioner',
      serverHeading: serverCelebration?.heading,
      serverMessage: serverCelebration?.message,
      serverButtonText: serverCelebration?.buttonText
    });
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center z-20"
      aria-label="Celebration wishes"
    >
      {/* Subtle Background Golden Star Particles (Celebration Mode Atmosphere) */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.span
              key={`star-${i}`}
              className="absolute text-amber-300/40 select-none text-xs"
              style={{
                left: `${15 + (i * 10)}%`,
                top: `${10 + ((i % 4) * 20)}%`
              }}
              animate={{
                scale: [0.6, 1.2, 0.6],
                opacity: [0.2, 0.8, 0.2],
                y: [-6, 6, -6]
              }}
              transition={{
                duration: 3 + (i % 3),
                repeat: Infinity,
                delay: i * 0.4,
                ease: 'easeInOut'
              }}
            >
              ✦
            </motion.span>
          ))}
        </div>
      )}

      {/* ─── DESKTOP / TABLET: 4 Subtly Floating Cards around Saint Portrait ─── */}
      {/* 1. TOP-LEFT CARD */}
      <motion.button
        type="button"
        onClick={handleCardClick}
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [-4, 6, -4],
                x: [-3, 2, -3],
                rotate: [-0.6, 0.6, -0.6]
              }
        }
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        className="hidden md:flex flex-col items-start absolute -left-56 lg:-left-64 top-2 pointer-events-auto bg-[#0b1739]/85 hover:bg-[#122353]/95 backdrop-blur-md border border-amber-400/60 hover:border-amber-300 rounded-2xl p-3.5 shadow-[0_8px_25px_rgba(217,151,38,0.28)] hover:shadow-[0_12px_32px_rgba(217,151,38,0.45)] hover:scale-105 transition-all duration-300 text-left cursor-pointer group max-w-[210px]"
        title="Click to view celebration greeting"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-400 text-base">{cards[0]?.icon || '✨'}</span>
          <span className="text-amber-300 font-bold text-xs tracking-wider uppercase">
            {cards[0]?.title}
          </span>
        </div>
        <p className="text-white font-medium text-xs leading-tight line-clamp-2">
          {cards[0]?.subtitle}
        </p>
        <div className="mt-1 flex items-center justify-between w-full text-[10px] text-amber-200/80">
          <span>{cards[0]?.detail}</span>
          <span className="text-amber-400 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
            ✦
          </span>
        </div>
      </motion.button>

      {/* 2. TOP-RIGHT CARD */}
      <motion.button
        type="button"
        onClick={handleCardClick}
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [5, -5, 5],
                x: [2, -3, 2],
                rotate: [0.6, -0.6, 0.6]
              }
        }
        transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        className="hidden md:flex flex-col items-start absolute -right-56 lg:-right-64 top-2 pointer-events-auto bg-[#0b1739]/85 hover:bg-[#122353]/95 backdrop-blur-md border border-amber-400/60 hover:border-amber-300 rounded-2xl p-3.5 shadow-[0_8px_25px_rgba(217,151,38,0.28)] hover:shadow-[0_12px_32px_rgba(217,151,38,0.45)] hover:scale-105 transition-all duration-300 text-left cursor-pointer group max-w-[210px]"
        title="Click to view celebration greeting"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-400 text-base">{cards[1]?.icon || '✨'}</span>
          <span className="text-amber-300 font-bold text-xs tracking-wider uppercase">
            {cards[1]?.title}
          </span>
        </div>
        <p className="text-white font-medium text-xs leading-tight line-clamp-2">
          {cards[1]?.subtitle}
        </p>
        <div className="mt-1 flex items-center justify-between w-full text-[10px] text-amber-200/80">
          <span>{cards[1]?.detail}</span>
          <span className="text-amber-400 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
            ✦
          </span>
        </div>
      </motion.button>

      {/* 3. BOTTOM-LEFT CARD */}
      <motion.button
        type="button"
        onClick={handleCardClick}
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [-3, 5, -3],
                x: [3, -2, 3],
                rotate: [-0.5, 0.5, -0.5]
              }
        }
        transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        className="hidden lg:flex flex-col items-start absolute -left-52 lg:-left-60 bottom-4 pointer-events-auto bg-[#0b1739]/85 hover:bg-[#122353]/95 backdrop-blur-md border border-amber-400/60 hover:border-amber-300 rounded-2xl p-3.5 shadow-[0_8px_25px_rgba(217,151,38,0.28)] hover:shadow-[0_12px_32px_rgba(217,151,38,0.45)] hover:scale-105 transition-all duration-300 text-left cursor-pointer group max-w-[200px]"
        title="Click to view celebration greeting"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-400 text-base">{cards[2]?.icon || '🙏'}</span>
          <span className="text-amber-300 font-bold text-xs tracking-wider uppercase">
            {cards[2]?.title}
          </span>
        </div>
        <p className="text-white font-medium text-xs leading-tight line-clamp-2">
          {cards[2]?.subtitle}
        </p>
        <div className="mt-1 flex items-center justify-between w-full text-[10px] text-amber-200/80">
          <span>{cards[2]?.detail}</span>
          <span className="text-amber-400 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
            ✦
          </span>
        </div>
      </motion.button>

      {/* 4. BOTTOM-RIGHT CARD */}
      <motion.button
        type="button"
        onClick={handleCardClick}
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [4, -4, 4],
                x: [-2, 3, -2],
                rotate: [0.5, -0.5, 0.5]
              }
        }
        transition={{ duration: 5.0, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
        className="hidden lg:flex flex-col items-start absolute -right-52 lg:-right-60 bottom-4 pointer-events-auto bg-[#0b1739]/85 hover:bg-[#122353]/95 backdrop-blur-md border border-amber-400/60 hover:border-amber-300 rounded-2xl p-3.5 shadow-[0_8px_25px_rgba(217,151,38,0.28)] hover:shadow-[0_12px_32px_rgba(217,151,38,0.45)] hover:scale-105 transition-all duration-300 text-left cursor-pointer group max-w-[200px]"
        title="Click to view celebration greeting"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-400 text-base">{cards[3]?.icon || '✨'}</span>
          <span className="text-amber-300 font-bold text-xs tracking-wider uppercase">
            {cards[3]?.title}
          </span>
        </div>
        <p className="text-white font-medium text-xs leading-tight line-clamp-2">
          {cards[3]?.subtitle}
        </p>
        <div className="mt-1 flex items-center justify-between w-full text-[10px] text-amber-200/80">
          <span>{cards[3]?.detail}</span>
          <span className="text-amber-400 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
            ✦
          </span>
        </div>
      </motion.button>

      {/* ─── DESKTOP TOP HALO EMBELLISHMENT ─── */}
      <motion.button
        type="button"
        onClick={handleCardClick}
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [-3, 3, -3]
              }
        }
        transition={{ duration: 4.0, repeat: Infinity, ease: 'easeInOut' }}
        className="hidden md:inline-flex items-center gap-2 absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-auto bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 backdrop-blur-md border border-amber-300/60 rounded-full px-4 py-1.5 shadow-[0_4px_16px_rgba(217,151,38,0.3)] hover:scale-105 transition-all cursor-pointer"
        title="Click to view celebration greeting"
      >
        <span className="text-amber-300 text-xs">✨</span>
        <span className="text-amber-200 text-xs font-semibold tracking-wide">
          {cards[0]?.title} • {cards[0]?.subtitle}
        </span>
        <span className="text-amber-300 text-xs">✨</span>
      </motion.button>

      {/* ─── MOBILE: 1-2 Subtle, Compact Non-Intrusive Floating Elements ─── */}
      {/* Mobile Element 1: Floating pill badge placed above the halo, leaving Saint's face 100% visible */}
      <motion.button
        type="button"
        onClick={handleCardClick}
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [-2, 3, -2],
                scale: [0.98, 1.02, 0.98]
              }
        }
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        className="flex md:hidden items-center gap-1.5 absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#0b1739]/90 backdrop-blur-md border border-amber-400/70 rounded-full px-3.5 py-1.5 shadow-[0_4px_20px_rgba(217,151,38,0.35)] active:scale-95 transition-all cursor-pointer whitespace-nowrap z-30"
        title="Tap to celebrate"
      >
        <span className="text-amber-400 text-xs">{cards[0]?.icon || '✨'}</span>
        <span className="text-amber-300 text-[11px] font-bold tracking-wide">
          {cards[0]?.title}
        </span>
        <span className="text-[10px] text-amber-100/90 font-medium">
          • {cards[0]?.detail || 'Tap to view'}
        </span>
        <span className="text-amber-400 text-xs">✨</span>
      </motion.button>

      {/* Mobile Element 2: Small badge near bottom corner of the halo */}
      <motion.button
        type="button"
        onClick={handleCardClick}
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [2, -2, 2]
              }
        }
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="flex md:hidden items-center gap-1 absolute -bottom-3 right-2 pointer-events-auto bg-[#0b1739]/85 backdrop-blur-md border border-amber-400/60 rounded-full px-2.5 py-1 shadow-[0_4px_16px_rgba(217,151,38,0.3)] active:scale-95 transition-all cursor-pointer z-30"
        title="Tap to view celebration"
      >
        <span className="text-amber-400 text-xs">{cards[1]?.icon || '✝'}</span>
        <span className="text-white text-[10px] font-medium">
          {cards[1]?.title}
        </span>
      </motion.button>
    </div>
  );
}
