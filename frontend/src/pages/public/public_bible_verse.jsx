import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GiSpellBook, GiCrucifix } from 'react-icons/gi';
import { FiChevronLeft, FiChevronRight, FiExternalLink, FiShare2, FiCalendar, FiRefreshCw, FiHome, FiType, FiImage, FiDownload } from 'react-icons/fi';
import { FaWhatsapp, FaPrayingHands } from 'react-icons/fa';
import toast from 'react-hot-toast';
import * as htmlToImage from 'html-to-image';
import downloadjs from 'downloadjs';
import PageHero from '../../components/common/common_page_hero';
import api from '../../services/api';


// ── Date helpers — always use LOCAL time, never UTC ────────────────────────
function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d); // local midnight — no UTC shift
  dt.setDate(dt.getDate() + n);
  return localDateKey(dt);
}

function formatDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Clean & filter paragraphs for a section ────────────────────────────────
const cleanSectionParagraphs = (paragraphs = []) => {
  if (!paragraphs || !paragraphs.length) return [];

  // Filter out month/year lines (e.g. ஆகஸ்ட்-2026, 2026, 2027, etc.)
  const filtered = paragraphs.filter(p => {
    if (!p) return false;
    const trimmed = p.trim();
    if (/^(ஜனவரி|பிப்ரவரி|மார்ச்|ஏப்ரல்|மே|ஜூன்|ஜூலை|ஆகஸ்ட்|ஆகத்து|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்|January|February|March|April|May|June|July|August|September|October|November|December)[-\s]?\d{4}$/i.test(trimmed)) return false;
    if (/^(19|20)\d{2}$/.test(trimmed)) return false;
    if (/^(ஞா|தி|செ|பு|வி|வெ|ச|Sun|Mon|Tue|Wed|Thu|Fri|Sat|\d{1,2})$/i.test(trimmed)) return false;
    if (trimmed.startsWith('Archive') || trimmed.includes('Download Mass Readings')) return false;
    return true;
  });

  // Deduplicate consecutive identical lines (e.g. repeated "ஆண்டவரின் அருள்வாக்கு.")
  const deduplicated = [];
  filtered.forEach((line) => {
    const trimmed = line.trim();
    if (deduplicated.length === 0 || deduplicated[deduplicated.length - 1].trim() !== trimmed) {
      deduplicated.push(trimmed);
    }
  });

  return deduplicated;
};

// ── Universal Liturgical Formatter for Paragraphs ───────────────────────────
function LiturgicalParagraph({ text, index, total, heading }) {
  if (!text) return null;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const lowerHeading = (heading || '').toLowerCase();

  // 1. Ending Liturgical Proclamations & Responses (Both displayed in Bold)
  const isWordOfLord =
    trimmed.includes('ஆண்டவரின் அருள்வாக்கு') ||
    lower.includes('the word of the lord') ||
    lower.includes('word of the lord') ||
    lower.includes('thanks be to god') ||
    trimmed.includes('இறைவா உமக்கு நன்றி');

  if (isWordOfLord) {
    const isTa = trimmed.includes('ஆண்டவரின்') || trimmed.includes('இறைவா');
    return (
      <div className="mt-4 pt-3 border-t border-gray-200/70 space-y-1">
        <p className="font-bold text-church-royal-blue text-sm md:text-base">
          {isTa ? 'ஆண்டவரின் அருள்வாக்கு.' : 'The word of the Lord.'}
        </p>
        <p className="font-bold text-amber-900 text-sm md:text-base">
          {isTa ? '— இறைவா உமக்கு நன்றி.' : '— Thanks be to God.'}
        </p>
      </div>
    );
  }

  const isGospelEnding =
    trimmed.includes('கிறிஸ்து வழங்கும் நற்செய்தி') ||
    lower.includes('the gospel of the lord') ||
    lower.includes('gospel of the lord') ||
    lower.includes('praise to you, lord jesus christ') ||
    lower.includes('praise to you') ||
    trimmed.includes('கிறிஸ்துவே உமக்கு புகழ்');

  if (isGospelEnding) {
    const isTa = trimmed.includes('கிறிஸ்து');
    return (
      <div className="mt-4 pt-3 border-t border-gray-200/70 space-y-1">
        <p className="font-bold text-church-royal-blue text-sm md:text-base">
          {isTa ? 'இது கிறிஸ்து வழங்கும் நற்செய்தி.' : 'The Gospel of the Lord.'}
        </p>
        <p className="font-bold text-church-maroon text-sm md:text-base">
          {isTa ? '— கிறிஸ்துவே உமக்கு புகழ்.' : '— Praise to you, Lord Jesus Christ.'}
        </p>
      </div>
    );
  }

  // 2. Responsorial Psalm Elements
  const isPsalmSection = lowerHeading.includes('psalm') || lowerHeading.includes('பதிலுரை');
  if (isPsalmSection) {
    // Psalm Reference
    if (trimmed.startsWith('திபா') || lower.startsWith('psalm') || lower.startsWith('ps ')) {
      return (
        <p className="font-bold text-purple-900 text-sm md:text-base mb-2">
          {trimmed}
        </p>
      );
    }

    // Main Psalm Response (Always Bold with distinct callout)
    if (
      trimmed.startsWith('பல்லவி:') ||
      lower.startsWith('response:') ||
      lower.startsWith('r.') ||
      lower.startsWith('refrain:') ||
      trimmed.includes('பல்லவி:')
    ) {
      return (
        <div className="font-bold text-amber-950 bg-amber-50/90 p-3.5 rounded-xl border border-amber-200/80 text-sm md:text-base my-2.5 shadow-2xs">
          {trimmed}
        </div>
      );
    }

    // Psalm verse ending with "– பல்லவி" or "– R." or "- Response"
    const responseSuffixMatch = trimmed.match(/(–\s*பல்லவி|–\s*R\.?|–\s*Response|–\s*refrain|- பல்லவி|- R\.?|- Response)/i);
    if (responseSuffixMatch) {
      const splitIdx = responseSuffixMatch.index;
      const verseText = trimmed.substring(0, splitIdx).trim();
      const responseSuffix = trimmed.substring(splitIdx).trim();
      return (
        <p className="text-gray-800 leading-relaxed text-sm md:text-base">
          <span className="font-normal">{verseText}</span>{' '}
          <strong className="font-bold text-amber-900">{responseSuffix}</strong>
        </p>
      );
    }
  }

  // 3. Alleluia Section Elements (Always Bold)
  const isAlleluiaSection = lowerHeading.includes('alleluia') || lowerHeading.includes('வாழ்த்தொலி') || lowerHeading.includes('acclamation');
  if (isAlleluiaSection) {
    return (
      <p className="font-bold text-amber-900 text-sm md:text-base leading-relaxed">
        {trimmed}
      </p>
    );
  }

  // 4. Bible Book & Chapter/Verse Reference (Always Bold)
  const isScriptureReference =
    trimmed.includes('\u2720') ||
    trimmed.includes('நூலிலிருந்து வாசகம்') ||
    trimmed.includes('திருத்தூதர் பணி நூலிலிருந்து') ||
    trimmed.includes('திருமுகத்திலிருந்து') ||
    trimmed.includes('எழுதிய தூய நற்செய்தியிலிருந்து') ||
    lower.includes('reading from the book') ||
    lower.includes('reading from the letter') ||
    lower.includes('reading from the holy gospel') ||
    lower.includes('gospel according to') ||
    lower.startsWith('a reading from') ||
    ((lower.includes('reading') || trimmed.includes('வாசகம்')) && /\d+:\s*\d+/.test(trimmed) && trimmed.length < 200);

  if (isScriptureReference) {
    return (
      <p className="font-bold text-blue-900 text-sm md:text-base mb-2">
        {trimmed}
      </p>
    );
  }

  // 5. Introductory Speaker Phrases (Always Bold)
  const isIntroductoryPhrase =
    trimmed === 'இறைவன் கூறுவது:' ||
    trimmed === 'ஆண்டவர் கூறுவது:' ||
    trimmed === 'அக்காலத்தில்' ||
    trimmed === 'அக்காலத்தில்:' ||
    lower === 'thus says the lord:' ||
    lower === 'in those days:' ||
    lower === 'at that time:' |
    lower === 'the lord says:';

  if (isIntroductoryPhrase) {
    return (
      <p className="font-bold text-gray-900 text-sm md:text-base mb-1">
        {trimmed}
      </p>
    );
  }

  // 6. Subtitle / Intro Theme Quote (Paragraph index 0 in reading sections, Always Bold)
  const isIntroSubtitle = (index === 0 && trimmed.length < 250 && total > 2);
  if (isIntroSubtitle) {
    return (
      <p className="font-bold text-amber-900 text-sm md:text-base mb-2">
        {trimmed}
      </p>
    );
  }

  // 7. Normal Scripture Reading Body (font-weight: 400 / font-normal)
  return (
    <p className="font-normal text-gray-800 leading-relaxed text-sm md:text-base">
      {trimmed}
    </p>
  );
}

// ── Liturgical Heading Standardizer ────────────────────────────────────────
function formatLiturgicalHeading(heading = '', lang = 'ta') {
  if (!heading || typeof heading !== 'string') return heading || '';
  const trimmed = heading.trim();
  const lower = trimmed.toLowerCase();

  if (lang === 'en' || lower.includes('text') || lower.includes('reading') || lower.includes('gospel') || lower.includes('psalm') || lower.includes('greeting')) {
    if (trimmed === 'முதல் வாசகம்' || lower.includes('first') || lower.includes('1st') || lower === 'first text') return 'First Reading';
    if (trimmed === 'இரண்டாம் வாசகம்' || lower.includes('second') || lower.includes('2nd') || lower === 'second text') return 'Second Reading';
    if (trimmed === 'மூன்றாம் வாசகம்' || lower.includes('third') || lower.includes('3rd') || lower === 'third text') return 'Third Reading';
    if (trimmed === 'நான்காம் வாசகம்' || lower.includes('fourth') || lower.includes('4th') || lower === 'fourth text') return 'Fourth Reading';
    if (trimmed === 'ஐந்தாம் வாசகம்' || lower.includes('fifth') || lower.includes('5th') || lower === 'fifth text') return 'Fifth Reading';
    if (trimmed === 'ஆறாம் வாசகம்' || lower.includes('sixth') || lower.includes('6th') || lower === 'sixth text') return 'Sixth Reading';
    if (trimmed === 'ஏழாம் வாசகம்' || lower.includes('seventh') || lower.includes('7th') || lower === 'seventh text') return 'Seventh Reading';
    if (trimmed === 'பதிலுரைப் பாடல்' || lower.includes('psalm') || lower.includes('response song') || lower.includes('responsive')) return 'Responsorial Psalm';
    if (trimmed.includes('வாழ்த்தொலி') || trimmed.includes('அல்லேலூயா') || lower.includes('alleluia') || lower.includes('acclamation') || lower.includes('greeting before')) return 'Gospel Acclamation';
    if (trimmed.includes('நற்செய்தி') || lower.includes('gospel')) return 'Gospel';
    if (trimmed.includes('சிந்தனை') || lower.includes('reflection')) return 'Daily Reflection';
  }

  return trimmed;
}

// ── Section colour chips ───────────────────────────────────────────────────
const sectionColor = (heading = '') => {
  const h = heading.toLowerCase();
  if (h.includes('first') || h.includes('முதல்')) return 'bg-blue-600';
  if (h.includes('second') || h.includes('இரண்டாம்')) return 'bg-indigo-600';
  if (h.includes('third') || h.includes('மூன்றாம்')) return 'bg-teal-600';
  if (h.includes('fourth') || h.includes('நான்காம்')) return 'bg-cyan-600';
  if (h.includes('psalm') || h.includes('பதிலுரை')) return 'bg-purple-600';
  if (h.includes('alleluia') || h.includes('acclamation') || h.includes('வாழ்த்தொலி')) return 'bg-amber-500';
  if (h.includes('gospel') || h.includes('நற்செய்தி')) return 'bg-church-maroon';
  return 'bg-church-royal-blue';
};

// ── Main component ─────────────────────────────────────────────────────────
export default function BibleVerse() {
  const { i18n } = useTranslation();
  const isTamil = i18n.language === 'ta';
  const dateInputRef = useRef(null);
  const verseCardRef = useRef(null);

  // Daily verse from API (same source as admin dashboard)
  const [dailyVerseData, setDailyVerseData] = useState(null);
  const [verseLoading, setVerseLoading] = useState(true);

  useEffect(() => {
    api.get('/daily-verse')
      .then(res => {
        if (res.data.success) setDailyVerseData(res.data);
      })
      .catch(e => console.error('Failed to load daily verse:', e))
      .finally(() => setVerseLoading(false));
  }, []);

  // Normalise to a single shape used throughout the JSX
  const verse = dailyVerseData
    ? {
      ref: dailyVerseData.reference,
      en: dailyVerseData.english,
      ta: dailyVerseData.tamil || dailyVerseData.english,
      category: dailyVerseData.category
    }
    : null;

  // Catholic Gallery live readings — Always default to Original Tamil
  const today = localDateKey();
  const [date, setDate] = useState(today);
  const [reading, setReading] = useState(null);
  const [originalTamilData, setOriginalTamilData] = useState(null);
  const [englishData, setEnglishData] = useState(null);
  const [displayLang, setDisplayLang] = useState('ta'); // 'ta' (original) or 'en' (translated)
  const [loading, setLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Original Tamil Reading for a date
  const fetchReading = async (d) => {
    setLoading(true);
    setError(null);
    setReading(null);
    setOriginalTamilData(null);
    setEnglishData(null);
    setDisplayLang('ta');

    try {
      const res = await api.get(`/daily-reading?date=${d}&lang=ta`);
      if (res.data.success && res.data.data) {
        setOriginalTamilData(res.data.data);
        setReading(res.data.data);
      } else {
        setError(res.data.message || 'Failed to load reading');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReading(date);
  }, [date]);

  // Toggle Translation: Original Tamil <-> English translation
  const handleToggleTranslation = async () => {
    if (isTranslating || loading) return;

    if (displayLang === 'ta') {
      // Switch to English
      if (englishData) {
        setReading(englishData);
        setDisplayLang('en');
      } else {
        setIsTranslating(true);
        try {
          const res = await api.get(`/daily-reading?date=${date}&lang=en`);
          if (res.data.success && res.data.data) {
            setEnglishData(res.data.data);
            setReading(res.data.data);
            setDisplayLang('en');
          } else {
            toast.error('Translation unavailable');
            if (originalTamilData) setReading(originalTamilData);
            setDisplayLang('ta');
          }
        } catch {
          toast.error('Translation unavailable');
          if (originalTamilData) setReading(originalTamilData);
          setDisplayLang('ta');
        } finally {
          setIsTranslating(false);
        }
      }
    } else {
      // Switch back to authoritative Original Tamil
      if (originalTamilData) {
        setReading(originalTamilData);
      }
      setDisplayLang('ta');
    }
  };

  const isToday = date === today;
  const goToPrev = () => setDate(prev => addDays(prev, -1));
  const goToNext = () => {
    const next = addDays(date, 1);
    if (next <= today) setDate(next);
  };
  const goToday = () => setDate(today);

  const shareOnWhatsApp = (message) => {
    if (!message || !message.trim()) return;
    const encodedMessage = encodeURIComponent(message.trim());
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const shareVerse = () => {
    if (!verse) return;
    let text = `Daily Verse / தினசரி விவிலிய வசனம்\n\n`;
    if (verse.en) {
      text += `"${verse.en}"\n`;
    }
    if (verse.ta && verse.ta !== verse.en) {
      text += `\n"${verse.ta}"\n`;
    }
    text += `\n— ${verse.ref}`;
    shareOnWhatsApp(text);
  };

  const downloadVerseImage = async () => {
    if (!verseCardRef.current) return;
    try {
      toast.loading('Generating image...', { id: 'img-gen' });
      const dataUrl = await htmlToImage.toPng(verseCardRef.current, { quality: 0.95, cacheBust: true });
      downloadjs(dataUrl, 'daily-verse.png');
      toast.success('Image downloaded!', { id: 'img-gen' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate image', { id: 'img-gen' });
    }
  };

  const whatsappReading = () => {
    if (!reading) return;

    let text = `*${reading.title || 'Daily Mass Reading'}*\n${formatDisplay(date)}\n`;
    if (reading.liturgicalDay) text += `${reading.liturgicalDay}\n`;
    if (reading.celebration) text += `${reading.celebration}\n`;
    text += `\n`;

    if (reading.sections && reading.sections.length > 0) {
      reading.sections.forEach(section => {
        if (section.heading) {
          text += `*${formatLiturgicalHeading(section.heading, displayLang)}*\n`;
        }
        if (section.paragraphs && section.paragraphs.length > 0) {
          const cleanP = cleanSectionParagraphs(section.paragraphs);
          cleanP.forEach(p => {
            text += `${p}\n`;
          });
        }
        text += `\n`;
      });
    } else if (reading.rawText) {
      text += `${reading.rawText}\n\n`;
    }

    if (reading.reflection && (reading.reflection.title || reading.reflection.content || reading.reflection.paragraphs?.length > 0)) {
      text += `*${reading.reflection.heading || (displayLang === 'ta' ? 'இன்றைய சிந்தனை' : 'Daily Reflection')}*\n`;
      if (reading.reflection.title) text += `*${reading.reflection.title}*\n\n`;
      if (reading.reflection.paragraphs && reading.reflection.paragraphs.length > 0) {
        reading.reflection.paragraphs.forEach(p => {
          text += `${p}\n\n`;
        });
      } else if (reading.reflection.content) {
        text += `${reading.reflection.content}\n\n`;
      }
      if (reading.reflection.prayer) {
        text += `*${displayLang === 'ta' ? 'மன்றாட்டு:' : 'Prayer:'}*\n${reading.reflection.prayer}\n\n`;
      }
    }

    text += `*St. John De Britto Church*\n`;

    shareOnWhatsApp(text);
  };

  return (
    <div className="min-h-screen pt-10 bg-church-cream">
      <PageHero title={<>Daily Mass Readings</>} subtitle={<>God's Word</>} />

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">

          {/* ── Featured Daily Verse (from /daily-verse API) ──────────── */}
          <motion.div
            key="daily-verse"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-14 relative"
          >
            {/* The actual element to capture as image */}
            <div ref={verseCardRef} className="glass-card p-10 text-center relative overflow-hidden bg-white">
              <GiSpellBook className="text-church-gold/10 text-[200px] absolute -right-10 -top-10 pointer-events-none" />
              <div className="relative z-10">
                <p className="section-subtitle mb-2">Daily Bible Verse</p>

                {verseLoading ? (
                  /* Loading skeleton */
                  <div className="space-y-3 animate-pulse py-4">
                    <div className="h-4 bg-gray-200 rounded-full w-3/4 mx-auto" />
                    <div className="h-4 bg-gray-200 rounded-full w-5/6 mx-auto" />
                    <div className="h-4 bg-gray-200 rounded-full w-2/3 mx-auto" />
                    <div className="h-5 bg-amber-100 rounded-full w-1/3 mx-auto mt-4" />
                  </div>
                ) : verse ? (
                  <>
                    {verse.category && (
                      <span className="inline-block px-3 py-1 bg-church-gold/10 text-church-gold text-xs font-bold uppercase tracking-widest rounded-full mb-4">
                        {verse.category}
                      </span>
                    )}

                    {/* Tamil verse (shown when language is Tamil or if both exist) */}
                    {isTamil && verse.ta ? (
                      <p className="font-tamil text-xl md:text-2xl text-church-royal-blue font-bold leading-relaxed mb-4">
                        "{verse.ta}"
                      </p>
                    ) : (
                      /* English verse */
                      <p className="font-serif italic text-2xl md:text-3xl text-church-royal-blue leading-relaxed mb-4">
                        "{verse.en}"
                      </p>
                    )}

                    {/* Show the other language as secondary text */}
                    {isTamil && verse.en && verse.en !== verse.ta && (
                      <p className="font-serif italic text-sm text-gray-500 mb-3 max-w-xl mx-auto">
                        "{verse.en}"
                      </p>
                    )}
                    {!isTamil && verse.ta && verse.ta !== verse.en && (
                      <p className="font-tamil text-sm text-gray-500 mb-3 max-w-xl mx-auto">
                        "{verse.ta}"
                      </p>
                    )}

                    <p className="text-church-gold font-bold text-base md:text-lg tracking-wide">
                      — {verse.ref}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400 italic">No verse set for today.</p>
                )}

                {/* Verse action buttons */}
                {verse && !verseLoading && (
                  <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6 pt-5 border-t border-gray-100/80 flex-wrap">
                    <button
                      onClick={shareVerse}
                      className="btn-gold text-sm sm:text-base font-bold py-2.5 sm:py-3 px-5 sm:px-7 flex items-center justify-center gap-2 shadow-md hover:shadow-lg rounded-xl sm:rounded-full transition-all duration-300 active:scale-95"
                    >
                      <FaWhatsapp className="text-lg sm:text-xl flex-shrink-0" />
                      <span>Share on WhatsApp</span>
                    </button>
                    <button
                      onClick={downloadVerseImage}
                      className="btn-outline-gold text-sm sm:text-base font-bold py-2.5 sm:py-3 px-5 sm:px-7 flex items-center justify-center gap-2 shadow-sm hover:shadow-md rounded-xl sm:rounded-full transition-all duration-300 active:scale-95"
                    >
                      <FiDownload className="text-lg sm:text-xl flex-shrink-0" />
                      <span>Download Image</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Section header ────────────────────────────────────────── */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h2 className="section-title text-2xl sm:text-3xl font-serif text-church-royal-blue mb-0">Daily Mass Readings</h2>
            </div>

            {/* Action Buttons — Horizontal UI across all device sizes */}
            <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
              <button
                onClick={whatsappReading}
                className="btn-gold text-[12px] sm:text-sm py-2 px-1.5 sm:px-4 flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm whitespace-nowrap rounded-xl sm:rounded-full h-10 transition-transform active:scale-95"
                title="Share on WhatsApp"
              >
                <FaWhatsapp className="text-sm sm:text-base flex-shrink-0" />
                <span className="sm:hidden">WhatsApp</span>
                <span className="hidden sm:inline">Share on WhatsApp</span>
              </button>

              <button
                onClick={() => fetchReading(date)}
                disabled={loading || isTranslating}
                className="btn-outline-gold text-[12px] sm:text-sm py-2 px-1.5 sm:px-4 flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm whitespace-nowrap rounded-xl sm:rounded-full h-10 transition-transform active:scale-95 disabled:opacity-60"
                title="Refresh Readings"
              >
                <FiRefreshCw className={`text-sm sm:text-base flex-shrink-0 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>

              {/* Dynamic Translation Toggle Button */}
              <button
                onClick={handleToggleTranslation}
                disabled={loading || isTranslating || !reading}
                className="bg-white hover:bg-blue-50 border border-blue-200 text-church-royal-blue text-[12px] sm:text-sm font-bold py-2 px-1.5 sm:px-4 flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm hover:shadow-md transition-all whitespace-nowrap rounded-xl sm:rounded-full h-10 active:scale-95 disabled:opacity-60"
                title={displayLang === 'ta' ? 'View in English' : 'View in Tamil'}
              >
                <FiRefreshCw className={`text-sm sm:text-base flex-shrink-0 ${isTranslating ? 'animate-spin text-church-gold' : 'text-church-gold'}`} />
                <span className="sm:hidden">{isTranslating ? 'Translating...' : displayLang === 'ta' ? 'English' : 'Tamil'}</span>
                <span className="hidden sm:inline">{isTranslating ? 'Translating...' : displayLang === 'ta' ? 'View in English' : 'View in Tamil'}</span>
              </button>
            </div>
          </div>

          {/* ── Date Navigator ────────────────────────────────────────── */}
          <div className="glass-card p-4 mb-8">
            <div className="flex items-center justify-between">
              {/* Prev */}
              <button
                onClick={goToPrev}
                className="w-10 h-10 rounded-full bg-church-gradient text-white flex items-center justify-center hover:scale-110 transition-transform shadow-gold flex-shrink-0"
              >
                <FiChevronLeft className="text-xl" />
              </button>

              {/* Date label */}
              <div className="text-center px-3">
                <div
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="relative flex items-center gap-2 justify-center text-church-gold font-semibold text-sm md:text-base cursor-pointer hover:bg-yellow-50 px-3 py-1.5 rounded-lg transition-colors group"
                >
                  <FiCalendar className="group-hover:scale-110 transition-transform" />
                  <span>{formatDisplay(date)}</span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => {
                      if (e.target.value) setDate(e.target.value);
                    }}
                    className="absolute bottom-0 left-1/2 w-0 h-0 opacity-0 pointer-events-none"
                    title="Select a date"
                  />
                </div>
                {/* Today badge + go-to-today link */}
                <div className="flex items-center justify-center gap-3 mt-1">
                  {isToday
                    ? <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Today</span>
                    : (
                      <button
                        onClick={goToday}
                        className="text-xs text-church-gold hover:underline flex items-center gap-1"
                      >
                        <FiHome className="text-xs" /> Go to Today
                      </button>
                    )
                  }
                </div>
              </div>

              {/* Next */}
              <button
                onClick={goToNext}
                disabled={isToday}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isToday
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-church-gradient text-white hover:scale-110 shadow-gold'
                  }`}
              >
                <FiChevronRight className="text-xl" />
              </button>
            </div>
          </div>

          {/* ── Reading Content ───────────────────────────────────────── */}
          <AnimatePresence mode="wait">

            {/* Loading */}
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="glass-card p-16 text-center">
                <GiCrucifix className="text-church-gold text-5xl mx-auto mb-4 animate-pulse" />
                <p className="text-gray-500 text-lg">Loading Mass readings…</p>
                <p className="text-gray-400 text-sm mt-1">Fetching from Catholic Gallery</p>
              </motion.div>
            )}

            {/* Error */}
            {error && !loading && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="glass-card p-10 text-center">
                <GiSpellBook className="text-gray-300 text-5xl mx-auto mb-4" />
                <p className="text-gray-500 mb-2">{error}</p>
                <p className="text-gray-400 text-sm mb-6">Could not fetch readings for this date.</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button onClick={() => fetchReading(date)} className="btn-gold"><FiRefreshCw /> Try Again</button>
                  <a href="https://www.catholicgallery.org/mass-reading/" target="_blank" rel="noreferrer" className="btn-outline-gold">
                    <FiExternalLink /> Open Catholic Gallery
                  </a>
                </div>
              </motion.div>
            )}

            {/* Success */}
            {reading && !loading && (
              <motion.div key={date} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* Page Title Banner */}
                {reading.title && (
                  <div className="bg-church-royal-blue text-white rounded-2xl px-6 py-4 mb-6 text-center shadow-royal">
                    <p className="font-semibold text-lg md:text-xl leading-relaxed">{reading.title}</p>
                    {(reading.liturgicalDay || reading.lectionary) && (
                      <div className="mt-2 pt-2 border-t border-white/20 text-sm text-blue-100 flex flex-col md:flex-row justify-center items-center gap-1 md:gap-4 font-medium">
                        {reading.liturgicalDay && <span>{reading.liturgicalDay}</span>}
                        {reading.liturgicalDay && reading.lectionary && <span className="hidden md:inline text-blue-300">•</span>}
                        {reading.lectionary && <span>{reading.lectionary}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Reading Sections with verse content */}
                {reading.sections?.length > 0 ? (
                  <div className="space-y-6">
                    {reading.sections.map((section, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }} className="glass-card p-6">

                        {/* Section heading */}
                        {section.heading && (
                          <div className="flex items-start gap-3 mb-4 pb-3 border-b border-gray-100">
                            <div className={`w-8 h-8 rounded-full ${sectionColor(formatLiturgicalHeading(section.heading, displayLang))} flex items-center justify-center flex-shrink-0 shadow-gold`}>
                              <GiCrucifix className="text-white text-xs" />
                            </div>
                            <h3 className="font-bold text-church-royal-blue text-base md:text-lg leading-snug">
                              {formatLiturgicalHeading(section.heading, displayLang)}
                            </h3>
                          </div>
                        )}

                        {/* Verse / reading paragraphs with global liturgical formatting */}
                        {cleanSectionParagraphs(section.paragraphs)?.length > 0 ? (
                          <div className="space-y-3 pl-11">
                            {cleanSectionParagraphs(section.paragraphs).map((p, j, arr) => (
                              <LiturgicalParagraph
                                key={j}
                                text={p}
                                index={j}
                                total={arr.length}
                                heading={formatLiturgicalHeading(section.heading, displayLang)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm pl-11 italic">No text content available for this section.</p>
                        )}

                        {/* Source Attribution Link at the end of Gospel */}
                        {i === reading.sections.length - 1 && (
                          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 mt-4">
                            <span className="flex items-center gap-1.5">
                              Source:
                              <a
                                href={reading.sourceUrl || 'https://www.catholicgallery.org/tamil-mass-readings-today/'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 hover:text-emerald-800 hover:underline font-semibold inline-flex items-center gap-1"
                              >
                                Catholic Gallery <FiExternalLink className="text-[10px]" />
                              </a>
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium">SJDB Church</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    

                    {/* ── Daily Reflection ("இன்றைய சிந்தனை") ────────────────── */}
                    {reading.reflection && (reading.reflection.title || reading.reflection.content || reading.reflection.paragraphs?.length > 0) && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="glass-card p-6 md:p-8 bg-gradient-to-br from-white via-emerald-50/20 to-white shadow-lg rounded-2xl space-y-5"
                      >
                        {/* Reflection Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-emerald-100/80">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-md text-white">
                              <GiSpellBook className="text-xl" />
                            </div>
                            <div>
                              <span className="text-[11px] uppercase tracking-widest font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full inline-block mb-1">
                                {reading.reflection.heading || (displayLang === 'ta' ? 'இன்றைய சிந்தனை' : 'Daily Reflection')}
                              </span>
                              <h3 className="font-bold text-church-royal-blue text-lg md:text-xl font-display leading-tight">
                                {reading.reflection.title}
                              </h3>
                            </div>
                          </div>
                        </div>

                        {/* Reflection Content Paragraphs */}
                        <div className="space-y-3.5 pl-1 md:pl-2 text-gray-800 leading-relaxed text-sm md:text-base">
                          {(reading.reflection.paragraphs && reading.reflection.paragraphs.length > 0) ? (
                            reading.reflection.paragraphs.map((p, idx) => (
                              <p key={idx} className="leading-relaxed font-normal">
                                {p}
                              </p>
                            ))
                          ) : (
                            <p className="whitespace-pre-line leading-relaxed font-normal">{reading.reflection.content}</p>
                          )}
                        </div>

                        {/* Concluding Prayer ("மன்றாட்டு") */}
                        {reading.reflection.prayer && (
                          <div className="bg-amber-50/90 border border-amber-200/90 p-4 md:p-5 rounded-xl space-y-2 mt-4 shadow-sm">
                            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm md:text-base">
                              <FaPrayingHands className="text-xl text-amber-700" />
                              <span>{displayLang === 'ta' ? 'மன்றாட்டு:' : 'Prayer:'}</span>
                            </div>
                            <p className="text-gray-800 text-sm md:text-base leading-relaxed pl-7 italic font-medium">
                              {reading.reflection.prayer}
                            </p>
                          </div>
                        )}

                        {/* Source Attribution Link */}
                        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center gap-1.5">
                            Source:
                            <a
                              href={reading.reflection.sourceUrl || 'https://www.tamilcatholicdaily.com/dailyverse'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-800 hover:underline font-semibold inline-flex items-center gap-1"
                            >
                              Tamil Catholic Daily <FiExternalLink className="text-[10px]" />
                            </a>
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">SJDB Church</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : reading.rawText ? (
                  <div className="glass-card p-6">
                    <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-line">{reading.rawText}</p>
                  </div>
                ) : (
                  <div className="glass-card p-10 text-center">
                    <GiSpellBook className="text-church-gold text-5xl mx-auto mb-4" />
                    <p className="text-gray-500">No reading content found for this date.</p>
                  </div>
                )}


              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
