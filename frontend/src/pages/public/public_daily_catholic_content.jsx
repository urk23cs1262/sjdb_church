import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GiSpellBook, GiCrucifix } from 'react-icons/gi';
import { FiChevronLeft, FiChevronRight, FiExternalLink, FiShare2, FiCalendar, FiRefreshCw, FiHome, FiType, FiImage, FiDownload, FiInfo } from 'react-icons/fi';
import { FaWhatsapp, FaPrayingHands } from 'react-icons/fa';
import toast from 'react-hot-toast';
import * as htmlToImage from 'html-to-image';
import downloadjs from 'downloadjs';
import PageHero from '../../components/common/common_page_hero';
import api from '../../services/api';
import { fetchSaintOfTheDay, searchSaintImage, cleanSaintName, formatFiveLines } from '../../services/saintOfDay';
import { getTamilBibleReference, getEnglishBibleReference } from '../../utils/bibleRefHelper';


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

  // 1. Ending Liturgical Proclamations & Responses
  const isGospelSection = lowerHeading.includes('gospel') || (lowerHeading.includes('நற்செய்தி') && !lowerHeading.includes('முன்'));

  const isWordOfLord = (
    trimmed === 'ஆண்டவரின் அருள்வாக்கு.' ||
    trimmed === 'ஆண்டவரின் அருள்வாக்கு' ||
    trimmed === '— இறைவா உமக்கு நன்றி.' ||
    trimmed === 'இறைவா உமக்கு நன்றி.' ||
    trimmed === '— இறைவா உமக்கு நன்றி' ||
    lower === 'the word of the lord.' ||
    lower === 'the word of the lord' ||
    lower === '— thanks be to god.' ||
    lower === 'thanks be to god.' ||
    lower === 'thanks be to god' ||
    (index === total - 1 && (lower.startsWith('the word of the lord') || trimmed.startsWith('ஆண்டவரின் அருள்வாக்கு')))
  );

  const isGospelEnding = (
    trimmed === 'இது கிறிஸ்து வழங்கும் நற்செய்தி.' ||
    trimmed === 'கிறிஸ்து வழங்கும் நற்செய்தி.' ||
    trimmed === 'கிறிஸ்து வழங்கும் நற்செய்தி' ||
    trimmed === '— கிறிஸ்துவே உமக்கு புகழ்.' ||
    trimmed === 'கிறிஸ்துவே உமக்கு புகழ்.' ||
    trimmed === '— கிறிஸ்துவே உமக்கு புகழ்' ||
    lower === 'the gospel of the lord.' ||
    lower === 'the gospel of the lord' ||
    lower === 'this is the gospel of the lord.' ||
    lower === 'this is the gospel that christ offers.' ||
    lower === 'this is the gospel that christ offers' ||
    lower === '— praise to you, lord jesus christ.' ||
    lower === 'praise to you, lord jesus christ.' ||
    (index === total - 1 && (lower.startsWith('the gospel of the lord') || lower.startsWith('this is the gospel') || trimmed.includes('கிறிஸ்து வழங்கும் நற்செய்தி')))
  );

  if (isGospelEnding || (isGospelSection && isWordOfLord)) {
    const isTa = trimmed.includes('கிறிஸ்து') || trimmed.includes('ஆண்டவரின்');
    const proclamation = (trimmed.includes('ஆண்டவரின்') || lower.includes('word of the lord'))
      ? (isTa ? 'ஆண்டவரின் அருள்வாக்கு.' : 'The Gospel of the Lord.')
      : (isTa ? 'இது கிறிஸ்து வழங்கும் நற்செய்தி.' : 'The Gospel of the Lord.');
    return (
      <div className="mt-4 pt-3 border-t border-gray-200/70 space-y-1">
        <p className="font-bold text-church-royal-blue text-sm md:text-base">
          {proclamation}
        </p>
        <p className="font-bold text-church-maroon text-sm md:text-base">
          {isTa ? '— கிறிஸ்துவே உமக்கு புகழ்.' : '— Praise to you, Lord Jesus Christ.'}
        </p>
      </div>
    );
  }

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

  // 2. Responsorial Psalm Elements
  const isPsalmSection = lowerHeading.includes('psalm') || lowerHeading.includes('பதிலுரை');
  if (isPsalmSection) {
    // Psalm Reference
    if (trimmed.startsWith('திபா') || trimmed.startsWith('Diba') || lower.startsWith('psalm') || lower.startsWith('ps ')) {
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

    // Psalm verse ending with "– பல்லவி" or "– R." or "- Response" or "- Refrain"
    const responseSuffixMatch = trimmed.match(/(–\s*பல்லவி|–\s*R\.?|–\s*Response|–\s*refrain|- பல்லவி|- R\.?|- Response|- Refrain)/i);
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
    trimmed.includes('✠') ||
    trimmed.includes('நூலிலிருந்து வாசகம்') ||
    trimmed.includes('திருத்தூதர் பணி நூலிலிருந்து') ||
    trimmed.includes('திருமுகத்திலிருந்து') ||
    trimmed.includes('எழுதிய தூய நற்செய்தியிலிருந்து') ||
    lower.includes('reading from the book') ||
    lower.includes('reading from the letter') ||
    lower.includes('reading from the holy gospel') ||
    lower.includes('gospel according to') ||
    lower.startsWith('a reading from') ||
    lower.startsWith('text from the prophet') ||
    lower.startsWith('text from the letter') ||
    lower.startsWith('text from the holy gospel') ||
    lower.startsWith('text from the pure gospel') ||
    ((lower.includes('reading') || lower.includes('epistle') || trimmed.includes('வாசகம்')) && /\d+:\s*\d+/.test(trimmed) && trimmed.length < 200);

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
    trimmed === 'சகோதரர் சகோதரிகளே,' ||
    trimmed === 'சகோதரர்களே,' ||
    lower === 'thus says the lord:' ||
    lower === 'in those days:' ||
    lower === 'at that time' ||
    lower === 'at that time:' ||
    lower === 'brothers and sisters,' ||
    lower === 'brothers and sisters:' ||
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
export default function DailyCatholicContent() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const isTamil = i18n.language === 'ta';
  const dateInputRef = useRef(null);
  const verseCardRef = useRef(null);

  // Catholic Gallery live readings & date selection
  const today = localDateKey();
  const [date, setDate] = useState(today);
  const [reading, setReading] = useState(null);
  const [originalTamilData, setOriginalTamilData] = useState(null);
  const [englishData, setEnglishData] = useState(null);
  const [displayLang, setDisplayLang] = useState('ta'); // 'ta' (original) or 'en' (translated)
  const [loading, setLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState(null);

  // Daily verse from API (same source as admin dashboard)
  const [dailyVerseData, setDailyVerseData] = useState(null);
  const [verseLoading, setVerseLoading] = useState(true);

  // Saint of the Day from API (single source of truth)
  const [saintData, setSaintData] = useState(null);
  const [selectedSaintIdx, setSelectedSaintIdx] = useState(0);
  const [saintLoading, setSaintLoading] = useState(true);
  const [saintImgError, setSaintImgError] = useState(false);

  useEffect(() => {
    api.get('/daily-verse')
      .then(res => {
        if (res.data.success) setDailyVerseData(res.data);
      })
      .catch(e => console.error('Failed to load daily verse:', e))
      .finally(() => setVerseLoading(false));
  }, []);

  // Re-fetch Saint of the Day whenever the selected date changes
  useEffect(() => {
    setSaintLoading(true);
    setSaintImgError(false);
    setSelectedSaintIdx(0);
    fetchSaintOfTheDay(date)
      .then(async (data) => {
        if (data) {
          // If image is missing, a fallback, or broken placeholder, fetch authentic portrait from Wikipedia / online search
          const isBrittoFallback = data.image?.includes('St._John_De_Britto.jpg') && !data.saintName?.toLowerCase().includes('britto');
          if (!data.image || data.imageFallback || isBrittoFallback || data.image.includes('Virgin_Mary_by_Giovanni_Battista_Salvi_da_Sassoferrato')) {
            try {
              const found = await searchSaintImage(data.englishName || data.saintName);
              if (found && found.image && !found.imageFallback) {
                data.image = found.image;
                data.imageSource = found.imageSource || 'wikipedia';
                data.imageFallback = false;
              }
            } catch (err) {
              console.warn('Auto search saint image notice:', err);
            }
          }
          setSaintData(data);
        }
      })
      .catch(e => console.error('Failed to load saint of the day:', e))
      .finally(() => setSaintLoading(false));
  }, [date]);

  // Fallback image error handler: if the saint image fails, fetch verified portrait from Wikipedia
  const handleSaintImageError = async () => {
    if (saintImgError) return;
    setSaintImgError(true);
    const targetName = saintData?.englishName || saintData?.saintName;
    if (targetName) {
      try {
        const found = await searchSaintImage(targetName);
        if (found && found.image && !found.image.includes('shutterstock')) {
          setSaintData(prev => ({
            ...prev,
            image: found.image,
            imageSource: found.imageSource || 'wikipedia',
            imageFallback: false
          }));
          setSaintImgError(false);
          return;
        }
      } catch (e) {
        console.warn('Fallback saint image search failed:', e);
      }
    }
  };

  // Smooth scroll to targeted anchor based on path or hash
  useEffect(() => {
    const pathname = location.pathname;
    const hash = window.location.hash;
    const timer = setTimeout(() => {
      if (pathname.includes('saint-of-the-day') || hash === '#saint-of-the-day') {
        const el = document.getElementById('saint-of-the-day');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (pathname.includes('reflection') || hash === '#reflection') {
        const el = document.getElementById('reflection');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (pathname.includes('daily-mass-readings') || pathname.includes('readings') || hash === '#readings') {
        const el = document.getElementById('readings');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (pathname.includes('bible-verse') || hash === '#verse') {
        const el = document.getElementById('verse');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [location.pathname, location.hash]);

  // Normalise to a single shape used throughout the JSX
  const verse = dailyVerseData
    ? {
      ref: dailyVerseData.reference || dailyVerseData.ref,
      en: dailyVerseData.english || dailyVerseData.verseTextEn,
      ta: dailyVerseData.tamil || dailyVerseData.verseTextTa || dailyVerseData.english,
      category: dailyVerseData.category,
      refEn: dailyVerseData.refEn,
      refTa: dailyVerseData.refTa
    }
    : null;

  const refEn = verse ? (verse.refEn || getEnglishBibleReference(verse.ref)) : '';
  const refTa = verse ? (verse.refTa || getTamilBibleReference(verse.ref)) : '';

  // Fetch Original Tamil Reading for a date
  const fetchReading = async (d, force = false) => {
    setLoading(true);
    setError(null);
    setReading(null);
    setOriginalTamilData(null);
    setEnglishData(null);
    setDisplayLang('ta');

    try {
      const url = force ? `/daily-reading?date=${d}&lang=ta&refresh=true` : `/daily-reading?date=${d}&lang=ta`;
      const res = await api.get(url);
      if (res.data.success && res.data.data) {
        // If server returned an old or mismatched date reading, trigger on-demand sync
        if (res.data.data.date && res.data.data.date !== d) {
          console.warn(`[Readings] Date mismatch: requested ${d} but got ${res.data.data.date}. Triggering sync...`);
          try {
            const syncRes = await api.get(`/daily-reading/sync?date=${d}`);
            if (syncRes.data?.success && syncRes.data?.data) {
              setOriginalTamilData(syncRes.data.data);
              setReading(syncRes.data.data);
              return;
            }
          } catch (syncErr) {
            console.warn('[Readings] Sync attempt error:', syncErr.message);
          }
        }
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

  // Helper to verify if English translation is truly in English
  const isCleanEnglish = (data) => {
    if (!data || !data.sections?.length) return false;
    const titleHasTamil = /[\u0B80-\u0BFF]/.test(data.title || '');
    const firstParaHasTamil = /[\u0B80-\u0BFF]/.test(data.sections[0]?.paragraphs?.[0] || '');
    return !titleHasTamil && !firstParaHasTamil;
  };

  // Toggle Translation: Original Tamil <-> English translation
  const handleToggleTranslation = async () => {
    if (isTranslating || loading) return;

    if (displayLang === 'ta') {
      // Switch to English
      if (englishData && isCleanEnglish(englishData)) {
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
    let text = `📖 *${isTamil ? 'இன்றைய இறைவார்த்தை / DAILY BIBLE VERSE' : 'DAILY BIBLE VERSE / இன்றைய இறைவார்த்தை'}*\n\n`;
    if (isTamil) {
      if (verse.ta) {
        text += `"${verse.ta}"\n— *${refTa}*\n\n`;
      }
      if (verse.en && verse.en !== verse.ta) {
        text += `"${verse.en}"\n— *${refEn}*\n\n`;
      }
    } else {
      if (verse.en) {
        text += `"${verse.en}"\n— *${refEn}*\n\n`;
      }
      if (verse.ta && verse.ta !== verse.en) {
        text += `"${verse.ta}"\n— *${refTa}*\n\n`;
      }
    }
    text += `*St. John De Britto Church, Kalayarkoil*`;
    shareOnWhatsApp(text);
  };

  const downloadVerseImage = async () => {
    if (!verseCardRef.current) return;
    try {
      toast.loading('Generating HD image...', { id: 'img-gen' });
      const dataUrl = await htmlToImage.toPng(verseCardRef.current, {
        quality: 1.0,
        pixelRatio: 3,
        cacheBust: true,
        filter: (node) => {
          if (node.tagName === 'BUTTON' || node.classList?.contains('no-export')) return false;
          return true;
        }
      });
      downloadjs(dataUrl, `daily-verse-${localDateKey()}.png`, 'image/png');
      toast.success('HD Image downloaded!', { id: 'img-gen' });
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
      <PageHero title={<>Daily Catholic Content</>} subtitle={<>God's Word & Liturgy</>} />

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4">

          {/* ── Quick Navigation Anchor Tabs ─────────────────────────── */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap mb-10">
            <a
              href="#verse"
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-white text-church-royal-blue shadow-sm hover:shadow-md border border-gray-200 flex items-center gap-1.5 transition-all hover:bg-blue-50"
            >
              <GiSpellBook className="text-church-gold" />
              <span>{isTamil ? 'இறைவார்த்தை' : 'Bible Verse'}</span>
            </a>
            <a
              href="#readings"
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-white text-church-royal-blue shadow-sm hover:shadow-md border border-gray-200 flex items-center gap-1.5 transition-all hover:bg-blue-50"
            >
              <GiCrucifix className="text-church-gold" />
              <span>{isTamil ? 'திருப்பலி வாசகங்கள்' : 'Mass Readings'}</span>
            </a>
            <a
              href="#reflection"
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-white text-church-royal-blue shadow-sm hover:shadow-md border border-gray-200 flex items-center gap-1.5 transition-all hover:bg-blue-50"
            >
              <FaPrayingHands className="text-church-gold" />
              <span>{isTamil ? 'இன்றைய சிந்தனை' : 'Daily Reflection'}</span>
            </a>
            <a
              href="#saint-of-the-day"
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-white text-church-royal-blue shadow-sm hover:shadow-md border border-gray-200 flex items-center gap-1.5 transition-all hover:bg-blue-50"
            >
              <span className="text-church-gold">✨</span>
              <span>{isTamil ? 'இன்றைய புனிதர்' : 'Saint of the Day'}</span>
            </a>
          </div>

          {/* ── Featured Daily Verse (from /daily-verse API) ──────────── */}
          <motion.div
            id="verse"
            key="daily-verse"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-14 relative scroll-mt-28"
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

                    {isTamil ? (
                      /* Tamil mode: Tamil verse first with Tamil chapter name, English verse below with English chapter name */
                      <div className="space-y-6 max-w-2xl mx-auto">
                        <div>
                          <p className="font-tamil text-xl md:text-2xl text-church-royal-blue font-bold leading-relaxed mb-3">
                            "{verse.ta}"
                          </p>
                          <p className="text-church-gold font-bold text-base md:text-lg font-tamil tracking-wide">
                            — {refTa}
                          </p>
                        </div>
                        {verse.en && verse.en !== verse.ta && (
                          <div className="pt-4 border-t border-gray-100">
                            <p className="font-serif italic text-base md:text-lg text-gray-600 leading-relaxed mb-2">
                              "{verse.en}"
                            </p>
                            <p className="text-church-gold/90 font-bold text-sm md:text-base tracking-wide">
                              — {refEn}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* English mode: English verse first with English chapter name, Tamil verse below with Tamil chapter name */
                      <div className="space-y-6 max-w-2xl mx-auto">
                        <div>
                          <p className="font-serif italic text-2xl md:text-3xl text-church-royal-blue leading-relaxed mb-3">
                            "{verse.en}"
                          </p>
                          <p className="text-church-gold font-bold text-base md:text-lg tracking-wide">
                            — {refEn}
                          </p>
                        </div>
                        {verse.ta && verse.ta !== verse.en && (
                          <div className="pt-4 border-t border-gray-100">
                            <p className="font-tamil text-lg md:text-xl text-gray-700 font-semibold leading-relaxed mb-2">
                              "{verse.ta}"
                            </p>
                            <p className="text-church-gold font-bold text-base md:text-lg font-tamil tracking-wide">
                              — {refTa}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400 italic">No verse set for today.</p>
                )}

                {/* Clean Church Footer Watermark inside card */}
                {verse && !verseLoading && (
                  <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    <span>St. John de Britto Church</span>
                    <span>•</span>
                    <span>Kalayarkoil</span>
                  </div>
                )}
              </div>
            </div>

            {/* Verse action buttons (outside verseCardRef so they NEVER appear in downloaded image) */}
            {verse && !verseLoading && (
              <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6 pt-2 flex-wrap no-export">
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
          </motion.div>

          {/* ── Section header ────────────────────────────────────────── */}
          <div id="readings" className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 scroll-mt-28">
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
                onClick={() => fetchReading(date, true)}
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
                  <button onClick={() => fetchReading(date, true)} className="btn-gold"><FiRefreshCw /> Try Again</button>
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
                        transition={{ delay: i * 0.07 }} className="glass-card p-7 sm:p-8">

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

                        {/* Specialized Responsorial Psalm Layout or Global Liturgical Formatting */}
                        {(() => {
                          const isPsalm = section.heading?.includes('பதிலுரை') || section.heading?.toLowerCase().includes('psalm') || formatLiturgicalHeading(section.heading, displayLang) === 'Responsorial Psalm';
                          const psalmVerses = (section.verses && section.verses.length > 0) ? section.verses : (isPsalm && displayLang === 'ta' && reading.responsorialPsalm?.verses?.length > 0) ? reading.responsorialPsalm.verses : null;
                          const psalmRef = section.reference || (isPsalm ? reading.responsorialPsalm?.reference : '');
                          const psalmRefrain = section.refrain || (isPsalm ? (reading.responsorialPsalm?.refrain || reading.responsorialPsalm?.response?.replace(/^பல்லவி:\s*/, '')) : '');

                          if (isPsalm && psalmVerses && psalmVerses.length > 0) {
                            return (
                              <div className="space-y-4 pl-0 sm:pl-11">
                                {/* Psalm Reference */}
                                {psalmRef && (
                                  <p className="font-bold text-purple-900 text-sm md:text-base">
                                    {psalmRef}
                                  </p>
                                )}

                                {/* Main Response / Refrain Callout */}
                                {psalmRefrain && (
                                  <div className="font-bold text-amber-950 bg-amber-50/90 p-3.5 rounded-xl border border-amber-200/80 text-sm md:text-base my-2.5 shadow-2xs">
                                    {displayLang === 'ta' ? 'பல்லவி:' : 'Response:'} {psalmRefrain}
                                  </div>
                                )}

                                {/* Individual Verse Groups with Refrain after each group */}
                                <div className="space-y-4 pt-1">
                                  {psalmVerses.map((verseGroup, vIdx) => (
                                    <div key={vIdx} className="p-3.5 sm:p-4 rounded-xl bg-purple-50/40 border border-purple-100/80 space-y-2.5 shadow-2xs transition-all hover:bg-purple-50/60">
                                      <div className="flex items-start gap-2.5">
                                        {verseGroup.numbers && (
                                          <span className="inline-block px-2.5 py-0.5 bg-purple-200 text-purple-950 text-xs sm:text-sm font-bold rounded-md flex-shrink-0 mt-0.5">
                                            {verseGroup.numbers}
                                          </span>
                                        )}
                                        <p className="font-normal text-gray-800 leading-relaxed text-sm md:text-base">
                                          {verseGroup.text}
                                        </p>
                                      </div>
                                      {psalmRefrain && (
                                        <div className="pt-2 pl-0 sm:pl-2 border-t border-purple-100/60 flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-900">
                                          <span className="text-church-gold">✦</span>
                                          <span>{displayLang === 'ta' ? 'பல்லவி' : 'Response'}: {psalmRefrain}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          return cleanSectionParagraphs(section.paragraphs)?.length > 0 ? (
                            <div className="space-y-3.5 pl-0 sm:pl-11">
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
                            <p className="text-gray-400 text-sm pl-0 sm:pl-11 italic">No text content available for this section.</p>
                          );
                        })()}

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
                        id="reflection"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="glass-card p-4 sm:p-6 md:p-8 bg-gradient-to-br from-white via-emerald-50/20 to-white shadow-lg rounded-2xl space-y-5 scroll-mt-28"
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
                              <h3 className="font-bold text-church-royal-blue text-base md:text-lg font-display leading-snug">
                                {displayLang === 'ta' ? 'இன்றைய சிந்தனை & நற்செய்தி தியானம்' : 'Today’s Reflection & Gospel Meditation'}
                              </h3>
                            </div>
                          </div>
                        </div>

                        {/* Scripture Quotation & Reference */}
                        {(reading.reflection.scriptureQuote || reading.reflection.title) && (
                          <div className="p-4 bg-emerald-50/80 border-l-4 border-emerald-600 rounded-r-xl shadow-xs">
                            <p className="font-medium text-emerald-950 text-base md:text-lg italic leading-relaxed whitespace-pre-line">
                              {reading.reflection.scriptureQuote || reading.reflection.title}
                            </p>
                          </div>
                        )}

                        {/* Reflection Content Paragraphs */}
                        <div className="space-y-3.5 pl-0 sm:pl-2 text-gray-800 leading-relaxed text-sm md:text-base">
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
                            <p className="text-gray-800 text-sm md:text-base leading-relaxed pl-0 sm:pl-7 italic font-medium">
                              {reading.reflection.prayer}
                            </p>
                          </div>
                        )}

                        {/* Source Attribution Link */}
                        <div className="pt-3.5 border-t border-emerald-100/80 flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              {displayLang === 'ta' ? 'Source:' : 'Source:'}
                            </span>
                            <a
                              href={reading.reflection.sourceUrl || "https://www.tamilcatholicdaily.com/dailyverse"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-800 hover:underline font-semibold inline-flex items-center gap-1"
                              title={reading.reflection.sourceUrl || "https://www.tamilcatholicdaily.com/dailyverse"}
                            >
                              <span>{displayLang === 'ta' ? 'Tamil Catholic Daily' : 'Tamil Catholic Daily'}</span>
                              <FiExternalLink className="text-[11px]" />
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

          {/* ── Saint of the Day Section (Single Source of Truth) ──────────── */}
          <motion.div
            id="saint-of-the-day"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-14 scroll-mt-28"
          >
            <div className="glass-card p-6 sm:p-8 md:p-10 bg-white shadow-xl rounded-3xl border border-amber-100 overflow-hidden relative">
              {(() => {
                const saintsList = saintData?.saints || saintData?.allSaints || [];
                const primarySaintObj = saintData?.primarySaint || (saintsList.length > 0 ? saintsList[0] : (saintData || {}));
                const otherSaintsList = (saintData?.otherSaints && saintData.otherSaints.length > 0)
                  ? saintData.otherSaints
                  : saintsList.slice(1);

                const activeSaint = (saintsList.length > selectedSaintIdx && saintsList[selectedSaintIdx])
                  ? saintsList[selectedSaintIdx]
                  : (saintData || {});

                const isViewingPrimary = selectedSaintIdx === 0;

                const primaryDisplayName = cleanSaintName(
                  isTamil && primarySaintObj?.tamilName
                    ? primarySaintObj.tamilName
                    : (primarySaintObj?.englishName || primarySaintObj?.name || 'Saint of the Day')
                );

                const isPrimarySaint = cleanSaintName(activeSaint.englishName || activeSaint.name).toLowerCase() === cleanSaintName(saintData?.saintName || saintData?.name).toLowerCase();
                const activeImage = activeSaint.image || activeSaint.imageUrl || (isPrimarySaint ? saintData?.image : null);
                const activeName = isTamil && activeSaint.tamilName
                  ? activeSaint.tamilName
                  : cleanSaintName(activeSaint.englishName || activeSaint.saintName || activeSaint.name);
                const activeDesc = isTamil && activeSaint.descriptionTa
                  ? activeSaint.descriptionTa
                  : (activeSaint.description || saintData?.description || 'Daily Saint details.');
                const activeSourceUrl = activeSaint.sourceUrl || activeSaint.detailUrl || (isPrimarySaint ? (saintData?.primaryCelebration?.sourceUrl || saintData?.primarySaint?.sourceUrl) : null) || saintData?.sourceUrl || 'https://www.vaticannews.va/en/saints.html';
                const celebrationType = isViewingPrimary
                  ? (activeSaint.celebrationType || saintData?.celebrationType || saintData?.feastType || null)
                  : null;

                return (
                  <div>
                    {/* If viewing an other saint, show quick return button to primary celebration */}
                    {!isViewingPrimary && (
                      <div className="mb-5 pb-3 border-b border-amber-100 flex items-center justify-between flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSaintIdx(0);
                            setSaintImgError(false);
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs border border-amber-300/70"
                        >
                          <span>←</span>
                          <span>{isTamil ? 'முதன்மை கொண்டாட்டத்திற்குத் திரும்பு' : 'Back to Primary Celebration'}: <span className="underline font-black">{primaryDisplayName}</span></span>
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row items-stretch gap-6 md:gap-8">
                      {/* Image portrait */}
                      <div className="w-full md:w-5/12 min-h-[280px] sm:min-h-[320px] md:min-h-[360px] h-[280px] sm:h-[320px] md:h-auto rounded-2xl overflow-hidden bg-slate-950 shadow-md relative flex-shrink-0 flex items-center justify-center">
                        {(!saintImgError && activeImage) ? (
                          <img
                            src={activeImage}
                            alt={activeName}
                            referrerPolicy="no-referrer"
                            onError={handleSaintImageError}
                            className="w-full h-full object-contain object-center transition-transform duration-700 hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-church-royal-blue to-indigo-950 text-church-gold text-5xl">
                            ✝
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                        <div className="absolute bottom-3 left-4 right-4 text-white">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="inline-block px-2.5 py-0.5 rounded-md bg-church-gold text-amber-950 font-black text-[10px] uppercase tracking-wider">
                              {isViewingPrimary 
                                ? (isTamil ? 'இன்றைய புனிதர்' : 'Saint of the Day')
                                : (isTamil ? 'பிற புனிதர்' : 'Other Saint')}
                            </span>
                            {celebrationType && (
                              <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider shadow-xs">
                                {celebrationType}
                              </span>
                            )}
                            {activeImage && (activeImage.includes('vaticannews.va') || activeSaint.imageSource === 'vatican') ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-xs text-white text-[9px] font-bold tracking-wider">
                                Vatican News
                              </span>
                            ) : activeImage ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-xs text-white text-[9px] font-bold tracking-wider">
                                Wikipedia
                              </span>
                            ) : null}
                          </div>
                          <h4 className="font-bold text-base sm:text-lg text-white drop-shadow">
                            {activeName}
                          </h4>
                        </div>
                      </div>

                      {/* Details & Biography */}
                      <div className="flex-1 space-y-4 text-left flex flex-col justify-between">
                        <div>
                          {/* Dedicated OTHER SAINTS Section (ABOVE FEAST DAY) */}
                          {otherSaintsList.length > 0 && (
                            <div className="mb-4 pb-3 border-b border-amber-100">
                              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                                <span>{isTamil ? 'இன்று நினைவுகூரப்படும் பிற புனிதர்கள்' : 'OTHER SAINTS'}</span>
                                <span className="text-xs text-gray-400">({otherSaintsList.length})</span>
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {otherSaintsList.map((os, osIdx) => {
                                  const actualIdx = osIdx + 1;
                                  const isSelected = selectedSaintIdx === actualIdx;
                                  const osName = cleanSaintName(isTamil && os.tamilName ? os.tamilName : (os.englishName || os.name));
                                  return (
                                    <button
                                      key={osIdx}
                                      type="button"
                                      onClick={() => {
                                        setSelectedSaintIdx(actualIdx);
                                        setSaintImgError(false);
                                      }}
                                      className={`group px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
                                        isSelected
                                          ? 'bg-church-gold text-amber-950 ring-2 ring-church-gold/60 scale-102 font-bold'
                                          : 'bg-amber-50/80 hover:bg-amber-100 text-gray-800 border border-amber-200/60 hover:scale-102'
                                      }`}
                                    >
                                      {os.image && (
                                        <img src={os.image} alt="" className="w-5 h-5 rounded-full object-cover border border-amber-300" />
                                      )}
                                      <span>{osName}</span>
                                      <span className="text-[10px] text-church-gold group-hover:translate-x-0.5 transition-transform">→</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-gray-400">
                                {isTamil ? 'திருவிழா நாள்' : 'FEAST DAY'}
                              </span>
                              <h3 className="text-xl sm:text-2xl font-bold text-church-gold font-display mt-0.5">
                                {saintData?.feastDay || formatDisplay(date)}
                              </h3>
                            </div>
                            {celebrationType && (
                              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300">
                                {celebrationType}
                              </span>
                            )}
                          </div>

                          <div className="text-gray-700 leading-relaxed text-sm sm:text-base font-normal mt-3">
                            <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-1.5">
                              {isTamil ? 'புனிதரைப் பற்றி' : 'ABOUT THE SAINT'}
                            </p>
                            <div className="max-h-[260px] sm:max-h-[300px] md:max-h-[340px] overflow-y-auto pr-2 space-y-2.5 text-gray-800 leading-relaxed text-justify">
                              {(() => {
                                const paras = activeDesc.split(/\n+/).map(p => p.trim()).filter(Boolean);
                                if (paras.length === 0) return <p>{activeDesc}</p>;
                                return paras.map((p, idx) => (
                                  <p key={idx} className="leading-relaxed">
                                    {p}
                                  </p>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                          {(() => {
                            // Content is ONLY from Wikipedia if the content was fetched with a confirmed, valid Wikipedia article URL.
                            const hasVerifiedWikiUrl = Boolean(
                              activeSourceUrl &&
                              activeSourceUrl.includes('wikipedia.org/wiki/') &&
                              !activeSourceUrl.includes('Candida%2C') &&
                              !activeSourceUrl.includes('Candida,')
                            );

                            const isContentFromWiki = Boolean(
                              hasVerifiedWikiUrl && (
                                (activeSaint.contentSource && activeSaint.contentSource.toLowerCase() === 'wikipedia') ||
                                (saintData?.contentSource && saintData.contentSource.toLowerCase() === 'wikipedia') ||
                                (activeSaint.source && activeSaint.source.toLowerCase() === 'wikipedia') ||
                                (saintData?.source && saintData.source.toLowerCase() === 'wikipedia')
                              )
                            );

                            const siteName = isContentFromWiki ? 'Wikipedia' : 'Vatican News';

                            const now = new Date();
                            const monthNum = String(now.getMonth() + 1).padStart(2, '0');
                            const dayNum = String(now.getDate()).padStart(2, '0');
                            const defaultVaticanUrl = `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`;

                            const targetUrl = isContentFromWiki
                              ? activeSourceUrl
                              : ((activeSourceUrl && activeSourceUrl.includes('vaticannews.va'))
                                  ? activeSourceUrl
                                  : (saintData?.primaryCelebration?.sourceUrl && saintData.primaryCelebration.sourceUrl.includes('vaticannews.va'))
                                    ? saintData.primaryCelebration.sourceUrl
                                    : (saintData?.sourceUrl && saintData.sourceUrl.includes('vaticannews.va'))
                                      ? saintData.sourceUrl
                                      : defaultVaticanUrl);

                            return (
                              <a
                                href={targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-royal text-xs sm:text-sm py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer"
                              >
                                <FiExternalLink />
                                <span>
                                  {isTamil ? (isContentFromWiki ? 'Wikipedia-ல் வாசிக்க' : 'Vatican News') : siteName}
                                </span>
                              </a>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>

        </div>
      </section>
    </div>
  );
}
