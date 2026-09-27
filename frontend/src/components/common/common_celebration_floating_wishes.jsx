import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronRight, FiChevronLeft } from 'react-icons/fi';
import { useAuth } from '../../context/context_auth_context';
import { useTranslation } from 'react-i18next';
import {
  getActiveCelebration,
  openCelebrationPopup
} from '../../services/celebrationService';
import api from '../../services/api';

/**
 * Responsive Catholic Floating Celebration Wishes (Left & Right Viewport Panels + Top Center Banner)
 * Designed strictly to match the SJDB Church theme (Gold + Royal Blue + Deep Navy):
 *
 * 1. LEFT FLOATING WISH PANEL:
 *    - Fixed to the left edge of viewport (safe-area aware).
 *    - Vertically centered around hero.
 *    - Pill/capsule card with gold border & subtle glow.
 *    - Festive icon, title, current highlighted person/wish, rotating items, +more indicator, gold navigation arrow.
 *
 * 2. RIGHT FLOATING WISH PANEL:
 *    - Fixed to the right edge of viewport (safe-area aware).
 *    - Vertically centered around hero.
 *    - Pill/capsule card with gold border & subtle glow.
 *    - Star/Dove icon, pastoral greeting ("Many Happy Returns", "Peace, Joy & Hope"), gold navigation arrow.
 *
 * 3. TOP CENTER FLOATING WISH:
 *    - Centered above the Saint portrait.
 *    - Responsive max-width (calc(100vw - 32px)) with graceful truncation on small screens.
 *    - Never causes horizontal overflow.
 *
 * 4. RESPONSIVE BREAKPOINTS:
 *    - Desktop (>= 1200px): Width ~85-105px.
 *    - Tablet (768px-1199px): Width ~70-85px.
 *    - Mobile (<= 767px, e.g. 386x548): Width ~50-62px, ultra compact.
 *    - Very Small Mobile (<= 360px): Width ~44-50px.
 *
 * 5. ROTATION & ACCESSIBILITY:
 *    - Rotates one wish at a time with smooth fade/slide transition.
 *    - Pauses on hover, touch, or keyboard focus.
 *    - Clicking card or arrow re-opens the existing celebration modal.
 */
export default function CelebrationFloatingWishes() {
  const { user } = useAuth();
  const { i18n } = useTranslation();

  const [activeCelebration, setActiveCelebration] = useState(null);
  const [serverCelebration, setServerCelebration] = useState(null);

  // Rotation indices
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentLang = user?.preferredLanguage || user?.settings?.language || i18n.language || 'en';
  const isTa = String(currentLang).toLowerCase() === 'ta';

  // Check celebration status (both locally in IST & via server API)
  useEffect(() => {
    let isMounted = true;

    const checkCelebration = async () => {
      const localActive = getActiveCelebration(user);
      if (isMounted) {
        setActiveCelebration(localActive);
      }

      try {
        const res = await api.get('/notifications/active-celebrations');
        if (
          isMounted &&
          res.data?.success &&
          res.data.active &&
          Array.isArray(res.data.celebrations) &&
          res.data.celebrations.length > 0
        ) {
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
        // Fallback to local IST calculation
      }
    };

    checkCelebration();
    const interval = setInterval(checkCelebration, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Format active user/parishioner name
  const rawName = useMemo(() => {
    const name = activeCelebration?.userName || serverCelebration?.userName || user?.name || '';
    return name.trim() || (isTa ? 'அன்புக்குரியவர்' : 'Parishioner');
  }, [activeCelebration, serverCelebration, user, isTa]);

  // Celebration-specific left & right rotation items
  const { leftItems, rightItems, topBadgeText, primaryIcon, secondaryIcon } = useMemo(() => {
    const type = activeCelebration?.type || 'birthday';

    switch (type) {
      case 'birthday':
        return {
          primaryIcon: '🎂',
          secondaryIcon: '⭐',
          topBadgeText: isTa
            ? `இனிய பிறந்தநாள் நல்வாழ்த்துகள் • ${rawName}`
            : `Happy Birthday • ${rawName}`,
          leftItems: [
            {
              title: isTa ? 'இனிய பிறந்தநாள்' : 'Happy Birthday',
              name: rawName,
              sub: isTa ? 'ஆண்டவர் ஆசி' : 'God Bless You',
              more: isTa ? '+மேலும்' : '+more'
            },
            {
              title: isTa ? 'அமைதியும் அருளும்' : 'Many Returns',
              name: isTa ? 'மகிழ்ச்சி நிறைக' : 'Joy & Health',
              sub: isTa ? 'இறை துணை' : 'Under His Care',
              more: ''
            },
            {
              title: isTa ? 'திருத்தல வாழ்த்து' : 'Parish Blessings',
              name: isTa ? 'புனித அருளானந்தர்' : 'SJDB Church',
              sub: isTa ? 'காளையார்கோவில்' : 'Kalayarkoil',
              more: ''
            }
          ],
          rightItems: [
            {
              title: isTa ? 'மகிழ்ச்சி நிறைக' : 'Many Happy Returns',
              detail: isTa ? 'அமைதியும் நம்பிக்கையும்' : 'Peace, Joy & Hope',
              tag: 'SJDB'
            },
            {
              title: isTa ? 'இறைவனின் பேரருள்' : 'Abundant Grace',
              detail: isTa ? 'வாழ்வில் நலம் பெறுக' : 'Throughout the Year',
              tag: 'Blessed'
            },
            {
              title: isTa ? 'பாதுகாப்பும் அருளும்' : 'Prayers & Peace',
              detail: isTa ? 'காளையார்கோவில்' : 'Under God’s Care',
              tag: 'Amen'
            }
          ]
        };

      case 'st_john_britto_feast':
        return {
          primaryIcon: '✝',
          secondaryIcon: '⛪',
          topBadgeText: isTa
            ? `புனித அருளானந்தர் திருவிழா நல்வாழ்த்துகள் • பிப்ரவரி 4`
            : `Blessed Feast of St. John de Britto • February 4`,
          leftItems: [
            {
              title: isTa ? 'அருளானந்தர் திருவிழா' : 'Blessed Feast',
              name: isTa ? 'புனித அருளானந்தர்' : 'St. John de Britto',
              sub: isTa ? 'பிப்ரவரி 4' : 'February 4',
              more: isTa ? '+விழா' : '+Feast'
            },
            {
              title: isTa ? 'எங்களுக்காக' : 'Pray For Us',
              name: isTa ? 'வேண்டிக்கொள்ளும்' : 'Patron Saint',
              sub: isTa ? 'விசுவாச சாட்சி' : 'Faith & Courage',
              more: ''
            },
            {
              title: isTa ? 'இறை சமாதானம்' : 'God Bless You',
              name: isTa ? 'திருத்தல மக்கள்' : 'SJDB Parish',
              sub: isTa ? 'காளையார்கோவில்' : 'Kalayarkoil',
              more: ''
            }
          ],
          rightItems: [
            {
              title: isTa ? 'பெருவிழா வாழ்த்துகள்' : 'Happy Feast Day',
              detail: isTa ? 'மகிழ்ச்சி நிறைக' : 'St. John de Britto',
              tag: 'Feb 4'
            },
            {
              title: isTa ? 'விசுவாசத்தின் சாட்சி' : 'Faith & Devotion',
              detail: isTa ? 'அருளானந்தர் துணை' : 'Follow Christ',
              tag: 'Patron'
            },
            {
              title: isTa ? 'அமைதியும் அருளும்' : 'Grace & Peace',
              detail: isTa ? 'காளையார்கோவில்' : 'Kalayarkoil Shrine',
              tag: 'SJDB'
            }
          ]
        };

      case 'christmas':
        return {
          primaryIcon: '🎄',
          secondaryIcon: '⭐',
          topBadgeText: isTa
            ? `இனிய கிறிஸ்துமஸ் நல்வாழ்த்துகள் • கிறிஸ்து பிறந்துள்ளார்`
            : `Merry Christmas • Glory to God in the Highest`,
          leftItems: [
            {
              title: isTa ? 'இனிய கிறிஸ்துமஸ்' : 'Merry Christmas',
              name: isTa ? 'நல்வாழ்த்துகள்' : 'Christ is Born!',
              sub: isTa ? 'டிசம்பர் 25' : 'December 25',
              more: isTa ? '+மகிழ்ச்சி' : '+Joy'
            },
            {
              title: isTa ? 'பாலகன் இயேசு' : 'Prince of Peace',
              name: isTa ? 'அமைதி தருகிறார்' : 'Peace on Earth',
              sub: isTa ? 'பெத்லகேம்' : 'Bethlehem',
              more: ''
            },
            {
              title: isTa ? 'இறை சமாதானம்' : 'May Christ Bless',
              name: isTa ? 'உங்கள் இல்லம்' : 'Your Family',
              sub: isTa ? 'புனித அருளானந்தர்' : 'SJDB Church',
              more: ''
            }
          ],
          rightItems: [
            {
              title: isTa ? 'மகிழ்ச்சியின் பெருவிழா' : 'Blessed Nativity',
              detail: isTa ? 'உன்னதத்தில் மாட்சி' : 'Glory to God',
              tag: 'Peace'
            },
            {
              title: isTa ? 'அமைதியின் தூதுவர்' : 'Hope & Love',
              detail: isTa ? 'இறை அமைதி நிறைக' : 'Light of the World',
              tag: 'Grace'
            },
            {
              title: isTa ? 'கிறிஸ்துமஸ் ஆசிகள்' : 'Christmas Joy',
              detail: isTa ? 'அருளானந்தர் திருத்தலம்' : 'SJDB Church',
              tag: 'Amen'
            }
          ]
        };

      case 'easter':
        return {
          primaryIcon: '✝',
          secondaryIcon: '🕊️',
          topBadgeText: isTa
            ? `கிறிஸ்து உயிர்த்தெழுந்தார்! அல்லேலூயா • பாஸ்கா திருநாள் வாழ்த்துகள்`
            : `Christ is Risen! Alleluia • Happy Easter`,
          leftItems: [
            {
              title: isTa ? 'பாஸ்கா திருநாள்' : 'Happy Easter',
              name: isTa ? 'கிறிஸ்து உயிர்த்தார்!' : 'Christ is Risen!',
              sub: isTa ? 'அல்லேலூயா!' : 'Alleluia!',
              more: isTa ? '+வெற்றி' : '+Life'
            },
            {
              title: isTa ? 'உயிர்ப்பின் பெருவிழா' : 'He is Risen Indeed',
              name: isTa ? 'வாழ்வின் வெற்றி' : 'Victory Over Death',
              sub: isTa ? 'அமைதி உரித்தாகுக' : 'Peace be with you',
              more: ''
            },
            {
              title: isTa ? 'நம்பிக்கையின் ஒளி' : 'Risen Lord',
              name: isTa ? 'புனித அருளானந்தர்' : 'SJDB Church',
              sub: isTa ? 'காளையார்கோவில்' : 'Kalayarkoil',
              more: ''
            }
          ],
          rightItems: [
            {
              title: isTa ? 'உயிர்த்த ஆண்டவர்' : 'Christ Our Hope',
              detail: isTa ? 'அல்லேலூயா!' : 'Alleluia, Alleluia!',
              tag: 'Victory'
            },
            {
              title: isTa ? 'நம்பிக்கை நிறைக' : 'Risen in Glory',
              detail: isTa ? 'இறைவனின் ஆசி' : 'Grace & Truth',
              tag: 'Hope'
            },
            {
              title: isTa ? 'பாஸ்கா ஆசிகள்' : 'Paschal Peace',
              detail: isTa ? 'அருளானந்தர் திருத்தலம்' : 'SJDB Church',
              tag: 'Amen'
            }
          ]
        };

      case 'new_year':
        return {
          primaryIcon: '🌟',
          secondaryIcon: '🕊️',
          topBadgeText: isTa
            ? `இனிய புத்தாண்டு நல்வாழ்த்துகள் • இறைவனின் ஆசி நிறைக`
            : `Happy New Year • Grace, Peace & Health`,
          leftItems: [
            {
              title: isTa ? 'இனிய புத்தாண்டு' : 'Happy New Year',
              name: isTa ? 'நல்வாழ்த்துகள்' : 'Grace & Peace',
              sub: isTa ? 'ஜனவரி 1' : 'January 1',
              more: isTa ? '+வளம்' : '+Grace'
            },
            {
              title: isTa ? 'இறை சமாதானம்' : 'A Blessed Year',
              name: isTa ? 'ஆண்டவர் துணை' : 'Under His Wings',
              sub: isTa ? 'நல்வாழ்வு உண்டாகுக' : 'Joy & Good Health',
              more: ''
            },
            {
              title: isTa ? 'புத்தாண்டு ஆசி' : 'Parish Blessings',
              name: isTa ? 'புனித அருளானந்தர்' : 'SJDB Church',
              sub: isTa ? 'காளையார்கோவில்' : 'Kalayarkoil',
              more: ''
            }
          ],
          rightItems: [
            {
              title: isTa ? 'நிறைவான ஆசிகள்' : 'New Beginnings',
              detail: isTa ? 'மகிழ்ச்சியும் நலமும்' : 'Abundant Grace',
              tag: 'Jan 1'
            },
            {
              title: isTa ? 'ஆண்டவர் ஆசி' : 'Peace & Health',
              detail: isTa ? 'எப்பொழுதும் தொடர்க' : 'In All You Do',
              tag: 'Grace'
            },
            {
              title: isTa ? 'புத்தாண்டு வாழ்த்துகள்' : 'Prayers for You',
              detail: isTa ? 'அருளானந்தர் திருத்தலம்' : 'SJDB Church',
              tag: 'Amen'
            }
          ]
        };

      default:
        return {
          primaryIcon: '✨',
          secondaryIcon: '⭐',
          topBadgeText: 'Peace & Blessings from St. John de Britto Church',
          leftItems: [{ title: 'Greetings', name: 'Parishioner', sub: 'God Bless You', more: '' }],
          rightItems: [{ title: 'Best Wishes', detail: 'Peace & Hope', tag: 'SJDB' }]
        };
    }
  }, [activeCelebration, isTa, rawName]);

  // Rotate items one by one with interval, paused on hover/touch
  useEffect(() => {
    if (isPaused) return;
    if (!leftItems?.length && !rightItems?.length) return;

    const interval = setInterval(() => {
      if (leftItems.length > 1) {
        setLeftIndex(prev => (prev + 1) % leftItems.length);
      }
      if (rightItems.length > 1) {
        setRightIndex(prev => (prev + 1) % rightItems.length);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isPaused, leftItems.length, rightItems.length]);

  // Click handler to open the full Celebration Popup
  const handleOpenPopup = e => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    openCelebrationPopup({
      type: activeCelebration.type,
      year: activeCelebration.year,
      userName: activeCelebration.userName || serverCelebration?.userName || user?.name || 'Parishioner',
      serverHeading: serverCelebration?.heading,
      serverMessage: serverCelebration?.message,
      serverButtonText: serverCelebration?.buttonText
    });
  };

  // If no celebration is active on this IST date, render nothing
  if (!activeCelebration) {
    return null;
  }

  const currentLeft = leftItems[leftIndex] || leftItems[0];
  const currentRight = rightItems[rightIndex] || rightItems[0];

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. TOP CENTER FLOATING WISH BANNER (Hugging top of Saint Portrait)
          - Centered directly above Saint image halo, safely below the Saint of the Day ticker.
          - Responsive width: max-w-[calc(100vw-32px)].
          - Never overflows horizontally; gracefully truncates on small screens.
         ───────────────────────────────────────────────────────────────────────────── */}
      <div className="absolute -top-7 sm:-top-8 md:-top-9 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-auto max-w-[calc(100vw-32px)] sm:max-w-md mx-auto select-none">
        <motion.button
          type="button"
          onClick={handleOpenPopup}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          animate={
            prefersReducedMotion
              ? {}
              : {
                  y: [-2, 2, -2]
                }
          }
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-[#0a1636]/90 hover:bg-[#102252]/95 backdrop-blur-md border border-amber-400/80 shadow-[0_4px_18px_rgba(217,151,38,0.38)] cursor-pointer transition-all"
          title="Click to view celebration greeting"
          aria-label="Open celebration greeting"
        >
          <span className="text-amber-300 text-xs sm:text-sm flex-shrink-0 animate-pulse">✨</span>
          <span className="text-amber-200 text-[10px] sm:text-xs md:text-sm font-bold tracking-wide truncate max-w-[190px] sm:max-w-[280px] md:max-w-none">
            {topBadgeText}
          </span>
          <span className="text-amber-300 text-xs sm:text-sm flex-shrink-0 animate-pulse">✨</span>
        </motion.button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. LEFT FLOATING WISH PANEL (Floating directly beside Saint Portrait)
          - Floats directly to the left of the Saint circle (NOT in screen corners).
          - Vertically centered beside the Saint portrait.
          - Compact pill/capsule shape with gold border and subtle glow.
          - Auto-rotates wishes, pauses on hover/touch.
          - Never overlaps screen edge; responsive down to 320px width.
         ───────────────────────────────────────────────────────────────────────────── */}
      <div
        className="absolute right-full mr-2 sm:mr-3.5 md:mr-5 lg:mr-8 top-1/2 -translate-y-1/2 z-20 pointer-events-auto select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <motion.div
          animate={
            prefersReducedMotion
              ? {}
              : {
                  y: [-5, 5, -5],
                  rotate: [-0.6, 0.6, -0.6]
                }
          }
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          onClick={handleOpenPopup}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && handleOpenPopup(e)}
          aria-label="Floating celebration banner left. Click to open wish."
          className="group relative flex flex-col items-center justify-between
            w-[48px] sm:w-[60px] md:w-[76px] lg:w-[92px]
            min-h-[142px] sm:min-h-[160px] md:min-h-[185px] lg:min-h-[210px]
            py-1.5 sm:py-2 md:py-3 lg:py-3.5 px-0.5 sm:px-1 md:px-1.5 lg:px-2
            rounded-[22px] sm:rounded-[26px] md:rounded-[30px] lg:rounded-[34px]
            bg-[#091533]/92 hover:bg-[#0e214d]/96 backdrop-blur-md
            border-2 border-amber-400/85 hover:border-amber-300
            shadow-[0_0_18px_rgba(217,151,38,0.35)] hover:shadow-[0_0_26px_rgba(217,151,38,0.55)]
            hover:scale-[1.04] active:scale-[0.96] transition-all duration-300 cursor-pointer"
        >
          {/* Top Festive Icon in Circular Holder */}
          <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 rounded-full bg-amber-400/15 border border-amber-400/50 flex items-center justify-center shadow-inner flex-shrink-0">
            <span className="text-xs sm:text-sm md:text-base select-none">{primaryIcon}</span>
          </div>

          {/* Rotating Wish Body */}
          <div className="flex-1 flex flex-col items-center justify-center my-1 w-full overflow-hidden text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`left-wish-${leftIndex}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center"
              >
                <span className="text-[7.5px] sm:text-[9px] md:text-[10.5px] lg:text-[11.5px] font-bold text-amber-300 uppercase tracking-tight leading-tight line-clamp-2 px-0.5">
                  {currentLeft.title}
                </span>

                <div className="w-3.5 sm:w-5 md:w-6 h-[1px] bg-amber-400/40 my-0.5 sm:my-1" />

                <span className="text-[8px] sm:text-[9.5px] md:text-[11px] lg:text-[12px] font-extrabold text-white leading-tight line-clamp-2 px-0.5 drop-shadow-sm">
                  {currentLeft.name}
                </span>

                {currentLeft.sub && (
                  <span className="text-[6.5px] sm:text-[8px] md:text-[9px] lg:text-[10px] text-amber-200/80 font-medium leading-none mt-0.5 line-clamp-1">
                    {currentLeft.sub}
                  </span>
                )}

                {currentLeft.more && (
                  <span className="hidden sm:inline-block text-[6.5px] md:text-[8px] text-amber-300/90 font-bold mt-0.5">
                    {currentLeft.more}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Round Gold Action Arrow Button */}
          <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 rounded-full bg-amber-400 group-hover:bg-amber-300 text-slate-950 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform flex-shrink-0">
            <FiChevronRight className="text-[10px] sm:text-xs md:text-sm font-black stroke-[3]" />
          </div>
        </motion.div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. RIGHT FLOATING WISH PANEL (Floating directly beside Saint Portrait)
          - Floats directly to the right of the Saint circle (NOT in screen corners).
          - Vertically centered beside the Saint portrait.
          - Pill/capsule card matching Left panel styling.
          - Auto-rotates pastoral greetings, pauses on hover/touch.
          - Never overlaps screen edge; responsive down to 320px width.
         ───────────────────────────────────────────────────────────────────────────── */}
      <div
        className="absolute left-full ml-2 sm:ml-3.5 md:ml-5 lg:ml-8 top-1/2 -translate-y-1/2 z-20 pointer-events-auto select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <motion.div
          animate={
            prefersReducedMotion
              ? {}
              : {
                  y: [5, -5, 5],
                  rotate: [0.6, -0.6, 0.6]
                }
          }
          transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          onClick={handleOpenPopup}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && handleOpenPopup(e)}
          aria-label="Floating celebration banner right. Click to open wish."
          className="group relative flex flex-col items-center justify-between
            w-[48px] sm:w-[60px] md:w-[76px] lg:w-[92px]
            min-h-[142px] sm:min-h-[160px] md:min-h-[185px] lg:min-h-[210px]
            py-1.5 sm:py-2 md:py-3 lg:py-3.5 px-0.5 sm:px-1 md:px-1.5 lg:px-2
            rounded-[22px] sm:rounded-[26px] md:rounded-[30px] lg:rounded-[34px]
            bg-[#091533]/92 hover:bg-[#0e214d]/96 backdrop-blur-md
            border-2 border-amber-400/85 hover:border-amber-300
            shadow-[0_0_18px_rgba(217,151,38,0.35)] hover:shadow-[0_0_26px_rgba(217,151,38,0.55)]
            hover:scale-[1.04] active:scale-[0.96] transition-all duration-300 cursor-pointer"
        >
          {/* Top Star/Church Emblem in Circular Holder */}
          <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 rounded-full bg-amber-400/15 border border-amber-400/50 flex items-center justify-center shadow-inner flex-shrink-0">
            <span className="text-xs sm:text-sm md:text-base select-none">{secondaryIcon}</span>
          </div>

          {/* Rotating Greeting Body */}
          <div className="flex-1 flex flex-col items-center justify-center my-1 w-full overflow-hidden text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`right-wish-${rightIndex}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center"
              >
                <span className="text-[7.5px] sm:text-[9px] md:text-[10.5px] lg:text-[11.5px] font-bold text-amber-300 uppercase tracking-tight leading-tight line-clamp-2 px-0.5">
                  {currentRight.title}
                </span>

                <div className="w-3.5 sm:w-5 md:w-6 h-[1px] bg-amber-400/40 my-0.5 sm:my-1" />

                <span className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-semibold text-slate-100 leading-tight line-clamp-2 px-0.5">
                  {currentRight.detail}
                </span>

                {currentRight.tag && (
                  <span className="text-[6.5px] sm:text-[8px] md:text-[9px] text-amber-300/80 font-medium mt-0.5 line-clamp-1">
                    {currentRight.tag}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Round Gold Action Arrow Button */}
          <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 rounded-full bg-amber-400 group-hover:bg-amber-300 text-slate-950 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform flex-shrink-0">
            <FiChevronLeft className="text-[10px] sm:text-xs md:text-sm font-black stroke-[3]" />
          </div>
        </motion.div>
      </div>
    </>
  );
}
