import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiExternalLink, FiInfo } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { fetchSaintOfTheDay } from '../../services/saintOfDay';
import { getSaintForDate } from '../../data/catholic_saints_calendar';

function checkIsTamil() {
  if (typeof document === 'undefined') return false;
  const cookie = document.cookie || '';
  const htmlLang = document.documentElement?.lang || '';
  const hasGoogTransTa = cookie.includes('/ta') || cookie.includes('googtrans=/en/ta') || cookie.includes('googtrans=/auto/ta');
  const isHtmlTa = htmlLang.toLowerCase().startsWith('ta');
  return hasGoogTransTa || isHtmlTa;
}

export default function DailySaintTicker() {
  const { i18n } = useTranslation();
  
  // Default authentic liturgical saint for today's date
  const todayLiturgical = useMemo(() => getSaintForDate(new Date()), []);

  // Single global Saint of the Day state initialized immediately
  const [saintOfDay, setSaintOfDay] = useState(() => {
    const today = new Date();
    const fallback = getSaintForDate(today);
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return {
      date: `${today.getFullYear()}-${month}-${day}`,
      saintName: fallback.name,
      englishName: fallback.name,
      tamilName: fallback.nameTa,
      description: fallback.description,
      descriptionTa: fallback.descriptionTa,
      image: fallback.image,
      feastDay: fallback.feastDay,
      source: "Vatican News",
      sourceUrl: `https://www.vaticannews.va/en/saints/${month}/${day}.html`,
      link: fallback.link || `https://www.vaticannews.va/en/saints/${month}/${day}.html`
    };
  });

  const [showModal, setShowModal] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Fetch Saint of the Day from backend Vatican News API & setup midnight auto-rotation
  useEffect(() => {
    let isMounted = true;

    const loadSaint = async () => {
      try {
        const data = await fetchSaintOfTheDay();
        if (isMounted && data && (data.saintName || data.englishName)) {
          setSaintOfDay(data);
          setImgError(false);
        }
      } catch (err) {
        console.error('Failed to load saint of the day:', err);
      }
    };

    loadSaint();

    // Automatically check for date rollover at midnight (every 60s)
    const timer = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        loadSaint();
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Language Detection
  const isTamil = checkIsTamil() || i18n.language === 'ta';

  // Extract display values from the SAME single saintOfDay object
  const displayName = isTamil && saintOfDay.tamilName 
    ? saintOfDay.tamilName 
    : (saintOfDay.englishName || saintOfDay.saintName || "Saint of the Day");

  const displayDescription = isTamil && saintOfDay.descriptionTa 
    ? saintOfDay.descriptionTa 
    : (saintOfDay.description || "");

  // Dynamic formatted feast date (e.g., "Friday, August 28, 2026")
  const formattedFeastDate = useMemo(() => {
    const feastDate = new Date();
    return feastDate.toLocaleDateString(isTamil ? 'ta-IN' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, [isTamil]);

  const defaultSacredImage = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato.jpg/500px-Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato.jpg";
  const activeImage = (!imgError && saintOfDay.image) ? saintOfDay.image : (todayLiturgical.image || defaultSacredImage);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (!showModal) return;

    const scrollY = window.scrollY;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';

      window.scrollTo(0, scrollY);
    };
  }, [showModal]);

  if (!saintOfDay) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const tickerDuration = isMobile ? 22 : 25;

  return (
    <>
      <div className="bg-church-gold/10 border-b border-church-gold/20 py-2 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 flex items-center">
          {/* Ticker Button with Badge */}
          <button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 bg-church-gold text-white text-[10px] font-bold px-2 py-1 rounded mr-2 z-10 flex items-center gap-1.5 hover:bg-church-gold/90 transition-colors cursor-pointer uppercase tracking-wider shadow-2xs"
          >
            <FiInfo className="text-xs" /> 
            <span>{isTamil ? 'இன்றைய புனிதர்' : 'SAINT OF THE DAY'}</span>
          </button>

          {/* Marquee Ticker */}
          <div className="relative flex-1 overflow-hidden h-6">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: '-100%' }}
              transition={{
                duration: tickerDuration,
                repeat: Infinity,
                ease: "linear"
              }}
              className="whitespace-nowrap absolute flex items-center"
            >
              <button
                onClick={() => setShowModal(true)}
                className="text-white font-semibold hover:text-church-gold transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span className="notranslate" translate="no">
                  {isTamil ? "இன்றைய புனிதர்" : "Today's Saint"}: <span className="font-bold text-amber-300">{displayName}</span> - {displayDescription.slice(0, 85)}... <span className="text-church-gold italic text-sm">({isTamil ? "முழு விவரம்" : "Click for details"} →)</span>
                </span>
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {showModal && (
            <>
              {/* BACKDROP */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowModal(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99998]"
              />

              {/* MODAL */}
              <div className="fixed inset-0 z-[99999]">
                <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 10 }}
                    transition={{
                      duration: 0.25,
                      ease: "easeOut"
                    }}
                    className="
                      relative
                      w-full
                      max-w-4xl
                      bg-white
                      rounded-3xl
                      shadow-2xl
                      overflow-hidden
                      max-h-[92vh]
                      md:h-[460px]
                      flex flex-col
                      border border-gray-100
                    "
                  >
                    {/* CLOSE BUTTON */}
                    <button
                      onClick={() => setShowModal(false)}
                      className="
                        absolute
                        top-3.5
                        right-3.5
                        z-50
                        w-10
                        h-10
                        rounded-full
                        bg-white/95
                        hover:bg-white
                        text-gray-700
                        hover:text-gray-950
                        shadow-md
                        flex
                        items-center
                        justify-center
                        transition-all
                        cursor-pointer
                      "
                      title="Close"
                    >
                      <FiX className="text-xl" />
                    </button>

                    <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
                      {/* SAINT IMAGE BANNER (LEFT SIDE: ONLY SAINT NAME UNDER SAINT OF THE DAY) */}
                      <div className="w-full md:w-5/12 relative h-[260px] sm:h-[300px] md:h-full flex-shrink-0 bg-slate-950 overflow-hidden">
                        {activeImage ? (
                          <img
                            src={activeImage}
                            alt={displayName}
                            onError={() => setImgError(true)}
                            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-church-royal-blue to-indigo-950 text-church-gold text-6xl">
                            ✝
                          </div>
                        )}

                        {/* Dark Gradient Overlay for Title Legibility - only on bottom where text sits */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 via-40% to-transparent pointer-events-none" />

                        {/* Name & Title on Image: Only saint name under Saint of the Day */}
                        <div className="absolute bottom-3 left-4 right-4 sm:bottom-5 sm:left-6 sm:right-6 text-white select-none">
                          <span className="inline-block bg-church-gold/95 text-amber-950 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-1.5 shadow-xs">
                            {isTamil ? 'இன்றைய புனிதர்' : 'Saint of the Day'}
                          </span>

                          <h2 className="text-lg sm:text-xl md:text-2xl font-bold font-display leading-tight drop-shadow-md text-white">
                            {displayName}
                          </h2>
                        </div>
                      </div>

                      {/* CONTENT DETAILS (RIGHT SIDE: FEAST DAY, DYNAMIC DATE, DESCRIPTION, ACTIONS) */}
                      <div className="flex-1 p-5 sm:p-7 md:p-8 overflow-y-auto flex flex-col justify-between notranslate" translate="no">
                        <div className="space-y-4">
                          {/* Feast Day Section */}
                          <div className="border-b border-gray-100 pb-3">
                            <p className="text-[11px] uppercase tracking-[0.25em] text-gray-500 font-bold mb-1">
                              {isTamil ? 'திருவிழா நாள்' : 'FEAST DAY'}
                            </p>
                            <h2 className="text-xl sm:text-2xl font-bold text-church-gold font-display">
                              {formattedFeastDate}
                            </h2>
                          </div>

                          {/* Biography text */}
                          <div className="text-gray-700 leading-relaxed text-sm sm:text-base font-normal">
                            <p>{displayDescription}</p>
                          </div>
                        </div>

                        {/* Link to Vatican News Official Page */}
                        <div className="pt-5 mt-4 border-t border-gray-100">
                          {saintOfDay.sourceUrl && (
                            <a
                              href={saintOfDay.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="
                                flex
                                items-center
                                justify-center
                                gap-2.5
                                py-3
                                px-6
                                rounded-xl
                                bg-gradient-to-r
                                from-church-royal-blue
                                to-indigo-900
                                hover:from-blue-900
                                hover:to-indigo-950
                                text-white
                                font-bold
                                text-sm
                                shadow-md
                                hover:shadow-lg
                                transition-all
                                cursor-pointer
                                active:scale-98
                              "
                            >
                              <FiExternalLink className="text-base" />
                              <span>{isTamil ? 'வத்திக்கான் செய்திகளில் வாசிக்க (Vatican News)' : 'Read on Vatican News'}</span>
                            </a>
                          )}
                        </div>

                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
