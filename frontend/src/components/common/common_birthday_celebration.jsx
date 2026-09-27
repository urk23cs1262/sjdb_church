import { useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/context_auth_context';
import { useTranslation } from 'react-i18next';
import { FiX } from 'react-icons/fi';
import api from '../../services/api';
import stJohnSrc from '../../assets/sjdb_image.png';

/**
 * Computus Easter Calculation (Meeus/Jones/Butcher algorithm)
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Content definitions for all 5 annual celebrations across English, Tamil & Both
 */
function getCelebrationContent({ type, userName = 'Parishioner', language = 'en' }) {
  const lang = String(language || 'en').toLowerCase();
  const isTa = lang === 'ta';
  const isBoth = lang === 'both';
  const rawName = String(userName || 'Parishioner').trim();
  const upperName = rawName.toUpperCase();

  switch (type) {
    case 'birthday':
      return {
        type: 'birthday',
        heading: isBoth
          ? `HAPPY BIRTHDAY, ${upperName}!\nஇனிய பிறந்தநாள் நல்வாழ்த்துகள்!`
          : isTa
            ? `இனிய பிறந்தநாள் நல்வாழ்த்துகள்,\n${rawName}!`
            : `HAPPY BIRTHDAY,\n${upperName}!`,
        message: isBoth
          ? `St. John de Britto Church wishes you a blessed day and year filled with joy and peace.\n\nபுனித அருளானந்தர் திருத்தலம் உங்கள் வாழ்வில் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருள் நிறைய வாழ்த்துகிறது.`
          : isTa
            ? `புனித அருளானந்தர் திருத்தலம் உங்கள் வாழ்வில் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருள் நிறைய வாழ்த்துகிறது.`
            : `St. John de Britto Church wishes you a blessed day and year filled with joy and peace.`,
        buttonText: isBoth ? `Thank You! / நன்றி!` : isTa ? `நன்றி!` : `Thank You!`
      };

    case 'new_year':
      return {
        type: 'new_year',
        heading: isBoth
          ? `HAPPY NEW YEAR!\nஇனிய புத்தாண்டு நல்வாழ்த்துகள்!`
          : isTa
            ? `இனிய புத்தாண்டு\nநல்வாழ்த்துகள்!`
            : `HAPPY NEW YEAR!`,
        message: isBoth
          ? `May the Lord bless you and your family with peace, joy, good health, and abundant grace throughout the new year.\n\nஆண்டவர் இந்த புதிய ஆண்டில் உங்களையும் உங்கள் குடும்பத்தையும் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளால் ஆசீர்வதிப்பாராக.`
          : isTa
            ? `ஆண்டவர் இந்த புதிய ஆண்டில் உங்களையும் உங்கள் குடும்பத்தையும் அமைதி, மகிழ்ச்சி, நல்வாழ்வு மற்றும் அருளால் ஆசீர்வதிப்பாராக.`
            : `May the Lord bless you and your family with peace, joy, good health, and abundant grace throughout the new year.`,
        buttonText: isBoth ? `Thank You! / நன்றி!` : isTa ? `நன்றி!` : `Thank You!`
      };

    case 'st_john_britto_feast':
      return {
        type: 'st_john_britto_feast',
        heading: isBoth
          ? `HAPPY FEAST OF ST. JOHN DE BRITTO!\nபுனித அருளானந்தர் திருவிழா நல்வாழ்த்துகள்!`
          : isTa
            ? `புனித அருளானந்தர்\nதிருவிழா நல்வாழ்த்துகள்!`
            : `HAPPY FEAST OF\nST. JOHN DE BRITTO!`,
        message: isBoth
          ? `May the intercession of St. John de Britto strengthen your faith and inspire you to live with courage, love, and devotion to Christ.\n\nபுனித ஜான் டி பிரிட்டோவின் பரிந்துரை உங்கள் விசுவாசத்தை உறுதிப்படுத்தி, கிறிஸ்துவின் மீது அன்பும் தைரியமும் கொண்டு வாழ உங்களை வழிநடத்தட்டும்.`
          : isTa
            ? `புனித ஜான் டி பிரிட்டோவின் பரிந்துரை உங்கள் விசுவாசத்தை உறுதிப்படுத்தி, கிறிஸ்துவின் மீது அன்பும் தைரியமும் கொண்டு வாழ உங்களை வழிநடத்தட்டும்.`
            : `May the intercession of St. John de Britto strengthen your faith and inspire you to live with courage, love, and devotion to Christ.`,
        buttonText: isBoth ? `Amen / ஆமென்` : isTa ? `ஆமென்` : `Amen`
      };

    case 'easter':
      return {
        type: 'easter',
        heading: isBoth
          ? `HAPPY EASTER!\nஇனிய பாஸ்கா திருநாள் வாழ்த்துகள்!`
          : isTa
            ? `இனிய பாஸ்கா\nதிருநாள் வாழ்த்துகள்!`
            : `HAPPY EASTER!`,
        message: isBoth
          ? `Christ is Risen! May the joy of the Resurrection fill your heart and home with hope, peace, love, and God's abundant blessings.\n\nகிறிஸ்து உயிர்த்தெழுந்தார்! உயிர்ப்பின் பெருவிழா உங்கள் உள்ளத்திலும் இல்லத்திலும் நம்பிக்கை, அமைதி, அன்பு மற்றும் ஆசீர்வாதங்களை நிறைக்கட்டும்.`
          : isTa
            ? `கிறிஸ்து உயிர்த்தெழுந்தார்! உயிர்ப்பின் பெருவிழா உங்கள் உள்ளத்திலும் இல்லத்திலும் நம்பிக்கை, அமைதி, அன்பு மற்றும் ஆசீர்வாதங்களை நிறைக்கட்டும்.`
            : `Christ is Risen! May the joy of the Resurrection fill your heart and home with hope, peace, love, and God's abundant blessings.`,
        buttonText: isBoth ? `Alleluia! / அல்லேலூயா!` : isTa ? `அல்லேலூயா!` : `Alleluia!`
      };

    case 'christmas':
      return {
        type: 'christmas',
        heading: isBoth
          ? `MERRY CHRISTMAS!\nஇனிய கிறிஸ்துமஸ் நல்வாழ்த்துகள்!`
          : isTa
            ? `இனிய கிறிஸ்துமஸ்\nநல்வாழ்த்துகள்!`
            : `MERRY CHRISTMAS!`,
        message: isBoth
          ? `May the birth of our Lord Jesus Christ fill your heart and home with peace, joy, hope, and love.\n\nநம் ஆண்டவர் இயேசு கிறிஸ்துவின் பிறப்பு உங்கள் உள்ளத்திலும் இல்லத்திலும் அமைதி, மகிழ்ச்சி, நம்பிக்கை மற்றும் அன்பை நிறைக்கட்டும்.`
          : isTa
            ? `நம் ஆண்டவர் இயேசு கிறிஸ்துவின் பிறப்பு உங்கள் உள்ளத்திலும் இல்லத்திலும் அமைதி, மகிழ்ச்சி, நம்பிக்கை மற்றும் அன்பை நிறைக்கட்டும்.`
            : `May the birth of our Lord Jesus Christ fill your heart and home with peace, joy, hope, and love.`,
        buttonText: isBoth ? `Amen / ஆமென்` : isTa ? `ஆமென்` : `Amen`
      };

    default:
      return {
        type,
        heading: `PEACE & BLESSINGS!`,
        message: `St. John de Britto Church wishes you abundant grace and peace.`,
        buttonText: `Amen`
      };
  }
}

export default function BirthdayCelebration() {
  const { user, isAuthenticated } = useAuth();
  const { i18n } = useTranslation();

  // Queue of celebration modals to display
  const [celebrationQueue, setCelebrationQueue] = useState([]);
  const [currentCelebration, setCurrentCelebration] = useState(null);

  const confettiIntervalRef = useRef(null);
  // In-memory dismissal set: prevents repeat during SPA route navigation, but resets on page refresh
  const dismissedInSession = useRef(new Set());

  // Determine user language preference
  const currentLang = user?.preferredLanguage || user?.settings?.language || i18n.language || 'en';

  // ─── CONFETTI ANIMATION CONTROLLER ──────────────────────────────────────────
  const startConfetti = useCallback(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Stop any existing confetti
    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
      confettiIntervalRef.current = null;
    }

    const festiveColors = ['#d99726', '#fbbf24', '#1e3a8a', '#3b82f6', '#10b981', '#ec4899', '#f97316'];
    const duration = 12 * 1000;
    const end = Date.now() + duration;

    // Initial burst from center
    try {
      confetti({
        particleCount: 75,
        spread: 100,
        origin: { y: 0.35 },
        colors: festiveColors,
        zIndex: 100000
      });
    } catch (e) {}

    // Continuous natural falling confetti from top/sides
    confettiIntervalRef.current = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
        return;
      }

      try {
        confetti({
          particleCount: 15,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: Math.random() * 0.3 },
          colors: festiveColors,
          zIndex: 100000
        });
        confetti({
          particleCount: 15,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: Math.random() * 0.3 },
          colors: festiveColors,
          zIndex: 100000
        });
      } catch (e) {}
    }, 450);
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

  // ─── CHECK ACTIVE CELEBRATIONS ─────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function evaluateCelebrations() {
      const now = new Date();
      // Date in Asia/Kolkata timezone
      const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [yearStr, monthStr, dayStr] = istFormatter.format(now).split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);

      const detected = [];

      // 1. Check Birthday (if authenticated user with DOB)
      if (isAuthenticated && user?.dob) {
        const birthdayKey = `CELEBRATION_BIRTHDAY_${year}_${user._id || 'USER'}`;
        if (!dismissedInSession.current.has(birthdayKey)) {
          // Compare month and day
          const d = new Date(user.dob);
          let isBday = false;
          if (!isNaN(d.getTime())) {
            const bParts = istFormatter.format(d).split('-');
            const bM = parseInt(bParts[1], 10);
            const bD = parseInt(bParts[2], 10);
            if (bM === month && bD === day) isBday = true;

            // UTC component fallback
            if (!isBday && (d.getUTCMonth() + 1 === month) && (d.getUTCDate() === day)) {
              isBday = true;
            }
          }

          if (isBday) {
            detected.push({
              type: 'birthday',
              key: birthdayKey,
              year,
              userName: user?.name || (user?.role === 'admin' ? 'Parish Admin' : 'Parishioner')
            });
          }
        }
      }

      // 2. Check New Year (Jan 1)
      if (month === 1 && day === 1) {
        const nyKey = `CELEBRATION_NEW_YEAR_${year}_${user?._id || 'ALL'}`;
        if (!dismissedInSession.current.has(nyKey)) {
          detected.push({
            type: 'new_year',
            key: nyKey,
            year,
            userName: user?.name || ''
          });
        }
      }

      // 3. Check St. John de Britto Feast (Feb 4)
      if (month === 2 && day === 4) {
        const feastKey = `CELEBRATION_ST_JOHN_DE_BRITTO_FEAST_${year}_${user?._id || 'ALL'}`;
        if (!dismissedInSession.current.has(feastKey)) {
          detected.push({
            type: 'st_john_britto_feast',
            key: feastKey,
            year,
            userName: user?.name || ''
          });
        }
      }

      // 4. Check Easter Sunday
      const easter = getEasterSunday(year);
      if (month === easter.month && day === easter.day) {
        const easterKey = `CELEBRATION_EASTER_${year}_${user?._id || 'ALL'}`;
        if (!dismissedInSession.current.has(easterKey)) {
          detected.push({
            type: 'easter',
            key: easterKey,
            year,
            userName: user?.name || ''
          });
        }
      }

      // 5. Check Christmas (Dec 25)
      if (month === 12 && day === 25) {
        const xmasKey = `CELEBRATION_CHRISTMAS_${year}_${user?._id || 'ALL'}`;
        if (!dismissedInSession.current.has(xmasKey)) {
          detected.push({
            type: 'christmas',
            key: xmasKey,
            year,
            userName: user?.name || ''
          });
        }
      }

      // Also try fetching server-side pending celebrations if authenticated
      if (isAuthenticated) {
        try {
          const res = await api.get('/notifications/active-celebrations');
          if (res.data?.success && Array.isArray(res.data.celebrations)) {
            res.data.celebrations.forEach(serverCel => {
              const localKey = `CELEBRATION_${serverCel.celebrationType.toUpperCase()}_${serverCel.year}_${user?._id}`;
              if (!dismissedInSession.current.has(localKey) && !detected.some(d => d.type === serverCel.celebrationType)) {
                detected.push({
                  type: serverCel.celebrationType,
                  key: localKey,
                  year: serverCel.year,
                  userName: serverCel.userName || user?.name || 'Parishioner',
                  notificationId: serverCel.notificationId || null,
                  serverHeading: serverCel.heading,
                  serverMessage: serverCel.message,
                  serverButtonText: serverCel.buttonText
                });
              }
            });
          }
        } catch (e) {
          // If network / unauthenticated, local calculation above acts as reliable fallback
        }
      }

      if (isMounted && detected.length > 0) {
        setCelebrationQueue(detected);
      }
    }

    evaluateCelebrations();

    return () => {
      isMounted = false;
      stopConfetti();
    };
  }, [isAuthenticated, user, stopConfetti]);

  // Manage queue transition to currentCelebration
  useEffect(() => {
    if (!currentCelebration && celebrationQueue.length > 0) {
      const nextCel = celebrationQueue[0];
      setCurrentCelebration(nextCel);
      startConfetti();
    }
  }, [celebrationQueue, currentCelebration, startConfetti]);

  // ─── ACKNOWLEDGE / DISMISS CELEBRATION ──────────────────────────────────────
  const handleAcknowledge = async () => {
    if (!currentCelebration) return;

    const { type, year, key, notificationId } = currentCelebration;

    // 1. Mark in session ref only (allows repeat on page refresh, prevents repeat during same session navigation)
    dismissedInSession.current.add(key);

    // 2. Stop confetti animation
    stopConfetti();

    // 3. Notify backend of acknowledgment and mark notification as read
    if (isAuthenticated) {
      api.post('/notifications/acknowledge-celebration', {
        celebrationType: type,
        year,
        celebrationKey: key,
        notificationId
      }).catch(() => {});
    }

    // 4. Advance queue and close popup
    setCurrentCelebration(null);
    setCelebrationQueue(prev => prev.filter(item => item.key !== key));
  };

  if (!currentCelebration) return null;

  const content = getCelebrationContent({
    type: currentCelebration.type,
    userName: currentCelebration.userName || user?.name || 'Parishioner',
    language: currentLang
  });

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative flex flex-col items-center w-full max-w-sm sm:max-w-md mx-auto"
        >
          {/* Top Circular St. John de Britto Golden Portrait Halo */}
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-white/20 backdrop-blur-md border-4 border-amber-400 p-1 shadow-2xl flex items-center justify-center overflow-hidden z-20 mb-[-3.5rem] sm:mb-[-4rem]">
            <img
              src={stJohnSrc}
              alt="St. John de Britto Church"
              className="w-full h-full object-cover object-[center_12%] rounded-full shadow-inner"
            />
          </div>

          {/* Celebratory Rounded Card Modal */}
          <div className="w-full bg-white/95 sm:bg-white backdrop-blur-2xl border-2 border-amber-300/80 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(217,151,38,0.45)] px-6 pt-16 pb-8 sm:px-8 sm:pt-20 sm:pb-9 text-center relative z-10 overflow-hidden">
            {/* Close 'X' Button at Top-Right */}
            <button
              onClick={handleAcknowledge}
              aria-label="Close celebration popup"
              className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-colors cursor-pointer z-30"
            >
              <FiX className="text-xl sm:text-2xl" />
            </button>

            {/* Large Personalized Heading */}
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

            {/* Prominent Golden Action Button */}
            <button
              onClick={handleAcknowledge}
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
