import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import toast from 'react-hot-toast';
import CountUpLib from 'react-countup';
const CountUp = CountUpLib.default || CountUpLib;
import { GiChurch, GiCrucifix, GiCandleLight, GiDove, GiPrayer, GiSpellBook } from 'react-icons/gi';
import { FaDonate } from "react-icons/fa";
import { FiCalendar, FiClock, FiMapPin, FiArrowRight, FiVolume2, FiLayout } from 'react-icons/fi';
import { MdNotifications } from 'react-icons/md';
import { FaCalendarAlt } from "react-icons/fa";
import { GiPrayerBeads, GiHolyGrail, GiAngelWings } from "react-icons/gi";
import api, { UPLOADS_URL } from '../../services/api';
import { useAuth } from '../../context/context_auth_context';
import heroBgImage from '../../assets/church_extirior.png';
import stJohnImage from '../../assets/sjdb_image.png';
import priestImage from '../../assets/NIVESH R 1.jpg';

const BIBLE_VERSES = [
  { ref: 'John 3:16', en: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.', ta: 'தேவன் உலகத்தையே இவ்வளவாக நேசித்தார், அதினால் தம்முடைய ஒரேபேறான குமாரனை அனுப்பினார்; அவரை விசுவாசிக்கிறவன் எவனோ அவன் கெட்டுப்போகாமல் நித்தியஜீவனை அடையும்படிக்கே அவரை அனுப்பினார்.' },
  { ref: 'Psalm 23:1', en: 'The Lord is my shepherd; I shall not want.', ta: 'கர்த்தர் என் மேய்ப்பர்; எனக்கு குறைவில்லை.' },
  { ref: 'Philippians 4:13', en: 'I can do all things through Christ who strengthens me.', ta: 'என்னை பலப்படுத்துகிற கிறிஸ்துவினாலே எல்லாவற்றையும் செய்யக்கூடும்.' },
  { ref: 'Matthew 11:28', en: 'Come to me, all you who are weary and burdened, and I will give you rest.', ta: 'பல்லாயிரவர் வருத்தப்பட்டு சுமையடிக்கப்பட்டவர்களே! நீங்கள் எல்லாரும் என்னிடத்தில் வாருங்கள், நான் உங்களுக்கு இளைப்பாறுதல் தருவேன்.' },
  { ref: 'Proverbs 3:5-6', en: 'Trust in the Lord with all your heart and lean not on your own understanding.', ta: 'உன் முழு இருதயத்தோடும் கர்த்தரை நம்பு; உன் சுயபுத்தியை நம்பாதே.' },
];

const QUICK_LINKS = [
  { icon: <GiPrayerBeads />, labelKey: 'nav.rosary', defaultLabel: 'Rosary', path: '/rosary', color: 'from-purple-600 to-indigo-800' },
  { icon: <GiAngelWings />, labelKey: 'nav.calendar', defaultLabel: 'Catholic Calendar', path: '/calendar', color: 'from-amber-600 to-orange-800' },
  { icon: <GiSpellBook />, labelKey: 'nav.bibleVerse', defaultLabel: 'Daily Mass Readings', path: '/bible-verse', color: 'from-green-600 to-teal-800' },
  { icon: <FiCalendar />, labelKey: 'nav.events', defaultLabel: 'Events', path: '/events', color: 'from-pink-600 to-rose-800' },
  { icon: <GiPrayer />, labelKey: 'nav.prayer', defaultLabel: 'Prayer Wall', path: '/prayers', color: 'from-blue-600 to-royal-800', requireAuth: true },
  { icon: <FaDonate />, labelKey: 'nav.donate', defaultLabel: 'Donate', path: '/donate', color: 'from-yellow-600 to-gold-800', requireAuth: true },
];


function CountdownTimer({ targetDate }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) return clearInterval(interval);
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return (
    <div className="flex gap-3 justify-center">
      {Object.entries(time).map(([k, v]) => (
        <div key={k} className="flex flex-col items-center">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-church-gradient rounded-xl flex items-center justify-center shadow-gold">
            <span className="text-2xl md:text-3xl font-bold text-white font-display">{String(v).padStart(2, '0')}</span>
          </div>
          <span className="text-xs text-gold-400 uppercase mt-1 font-semibold">{k === 'd' ? 'Days' : k === 'h' ? 'Hrs' : k === 'm' ? 'Min' : 'Sec'}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { ref: statsRef, inView: statsInView } = useInView({ triggerOnce: true });
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);

  const handleQuickLinkClick = (e, ql) => {
    if (ql.requireAuth && !isAuthenticated) {
      e.preventDefault();
      toast.error(`Please login first to use ${ql.label}`);
      sessionStorage.setItem('redirectAfterLogin', ql.path);
      navigate(`/login?redirect=${encodeURIComponent(ql.path)}`);
    }
  };

  const [verseIdx, setVerseIdx] = useState(0);
  const [dailyVerse, setDailyVerse] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const isTamil = i18n.language === 'ta';
  const [dynamicImages, setDynamicImages] = useState({});

  const resolveUrl = (val) => {
    if (!val) return null;
    return val.startsWith('http') ? val : `${UPLOADS_URL.replace('/uploads', '')}${val}`;
  };

  const heroSrc = resolveUrl(dynamicImages.heroImage) || heroBgImage;
  const stJohnSrc = resolveUrl(dynamicImages.stJohnImage) || stJohnImage;
  const priestSrc = resolveUrl(dynamicImages.priestImage) || priestImage;

  useEffect(() => {
    // Rotate fallback verse index
    const day = new Date().getDay();
    setVerseIdx(day % BIBLE_VERSES.length);

    // Fetch live active daily verse from uploaded dataset
    api.get('/daily-verse')
      .then(r => {
        if (r.data && r.data.success) {
          setDailyVerse(r.data);
        }
      })
      .catch(() => { });

    // Fetch data
    api.get('/events?upcoming=true&limit=3')
      .then(r => setEvents(r.data.events || []))
      .catch(() => { })
      .finally(() => setEventsLoading(false));

    api.get('/announcements?limit=4')
      .then(r => setAnnouncements(r.data.announcements || []))
      .catch(() => { })
      .finally(() => setAnnouncementsLoading(false));

    // Fetch dynamic images from settings
    api.get('/settings').then(r => setDynamicImages(r.data.settings || {})).catch(() => { });
  }, []);

  const verse = dailyVerse ? {
    ref: dailyVerse.reference,
    en: dailyVerse.english,
    ta: dailyVerse.tamil || BIBLE_VERSES[verseIdx].ta
  } : BIBLE_VERSES[verseIdx];

  return (
    <div className="min-h-screen bg-church-cream ">
      {/* ─── HERO ─── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Parallax background */}
        <motion.div style={{ y }} className="absolute inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${heroSrc})` }}
          />
          <div className="absolute inset-0 bg-church-gradient opacity-80 mix-blend-multiply" />
          {/* Animated cross decorations */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="absolute top-20 right-20 text-white/5 text-[200px] font-display select-none"
          ></motion.div>
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
            className="absolute bottom-20 left-10 text-white/5 text-[150px] font-display select-none"
          ></motion.div>
          {/* Floating particles */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-gold-400/40"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
              animate={{ y: [-20, 20, -20], opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 2 }}
            />
          ))}
        </motion.div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto pt-32">
          {/* Church icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="mb-6 flex justify-center"
          >
            <div className="w-60 h-60 rounded-full bg-white/10 backdrop-blur-sm border-2 border-gold-400/50 flex items-center justify-center animate-float shadow-gold-lg overflow-hidden p-1">
              <img src={stJohnSrc} alt="Logo" className="w-full h-full object-cover object-[center_10%] rounded-full" />
            </div>
          </motion.div>

          {/* Church name */}
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-2">
              {t('home.welcome')}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-2 leading-tight">
              <span className="gradient-text">St. John de</span>
              <br />
              <span className="text-white">Britto's Church</span>
            </h1>
            <p className="text-gold-300 font-tamil text-2xl sm:text-3xl font-bold mb-3">
              புனித அருளானந்தர் தேவாலயம்
            </p>
            <p className="text-gray-200 text-lg md:text-xl mb-2 font-light">{t('home.subtitle')}</p>
            <div className="flex items-center justify-center gap-2 text-gold-400 text-sm mb-8">
              <FiMapPin /> <span>{t('home.location')}</span>
            </div>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 max-w-xs sm:max-w-none mx-auto w-full"
          >
            <Link to="/mass-timings" className="btn-gold text-base py-4 px-8 shadow-gold-lg animate-pulse-glow w-full sm:w-auto text-center justify-center flex items-center gap-2">
              <FiClock /> {t('home.viewMass')}
            </Link>
            {isAuthenticated ? (
              <Link to={isAdmin ? "/admin" : "/dashboard"} className="w-full sm:w-auto px-8 py-4 border-2 border-white/50 text-white font-semibold rounded-xl hover:bg-white/10 transition-all duration-300 inline-flex items-center justify-center gap-2 text-base text-center">
                <FiLayout /> {isAdmin ? "Go to Admin Panel" : "Go to Dashboard"}
              </Link>
            ) : (
              <Link to="/register" className="w-full sm:w-auto px-8 py-4 border-2 border-white/50 text-white font-semibold rounded-xl hover:bg-white/10 transition-all duration-300 inline-flex items-center justify-center gap-2 text-base text-center">
                <GiDove /> {t('home.joinUs')}
              </Link>
            )}
          </motion.div>

          {/* Quick nav icons */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-8 grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-4 max-w-5xl px-2 sm:px-4 mx-auto w-full justify-items-center"
          >
            {QUICK_LINKS.map((ql, i) => (
              <Link
                key={i}
                to={ql.path}
                onClick={(e) => handleQuickLinkClick(e, ql)}
                className={`w-full max-w-[145px] aspect-square flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-gradient-to-br ${ql.color} bg-opacity-30 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 group cursor-pointer text-center`}
              >
                <span className="text-white text-3xl sm:text-3xl mb-2 sm:mb-2 flex-shrink-0 group-hover:scale-110 transition-transform drop-shadow-md">
                  {ql.icon}
                </span>
                <span className="text-white text-xs font-bold leading-snug notranslate drop-shadow-sm px-0.5 line-clamp-2" translate="no">
                  {t(ql.labelKey, ql.defaultLabel)}
                </span>
              </Link>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        {/* <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute top-[56rem] left-100 text-white/60 text-xs flex flex-col items-center gap-2"
        >
          <span>Scroll down</span>

          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-gold-400"
            />
          </div>
        </motion.div> */}
      </section>

      {/* ─── DAILY BIBLE VERSE ─── */}
      <section className=" py-16 bg-church-royal-blue relative overflow-hidden">
        <div className=" inset-0 opacity-5">
          <GiSpellBook className="text-white text-[400px] absolute -right-20 -top-20" />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="section-subtitle text-gold-400 mb-2">{t('home.dailyVerse')}</p>
            {verse.category && (
              <span className="inline-block bg-amber-400/20 text-gold-300 border border-gold-400/40 text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider mb-4 shadow-xs">
                 {verse.category}
              </span>
            )}
            <blockquote className="text-xl sm:text-2xl md:text-3xl text-white font-serif italic leading-relaxed mb-4">
              "{isTamil ? verse.ta : verse.en}"
            </blockquote>
            <p className="text-gold-400 font-semibold text-sm uppercase tracking-widest">— {verse.ref}</p>
            {!isTamil && <p className="text-gray-400 text-sm mt-3 font-tamil">{verse.ta}</p>}
          </motion.div>
        </div>
      </section>

      {/* ─── STATISTICS ─── */}
      <section className="py-20 bg-white " ref={statsRef}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="section-subtitle">{t('home.statistics')}</p>
            <h2 className="section-title mt-1">{t('home.statistics')}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: <GiChurch />, value: 500, suffix: '+', label: t('home.members') },
              { icon: <GiCrucifix />, value: 150, suffix: '+', label: t('home.years') },
              { icon: <FiClock />, value: 6, suffix: '', label: t('home.masses') },
              { icon: <GiDove />, value: 50, suffix: '+', label: t('home.volunteers') },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={statsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1 }}
                className="text-center church-card"
              >
                <div className="text-church-gold text-4xl mb-3 flex justify-center">{stat.icon}</div>
                <div className="text-3xl md:text-4xl font-bold font-display text-church-royal-blue ">
                  {statsInView ? <CountUp end={stat.value} duration={2.5} suffix={stat.suffix} /> : '0'}
                </div>
                <p className="text-gray-600 text-sm mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── UPCOMING EVENTS ─── */}
      <section className="py-20 bg-church-beige ">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <p className="section-subtitle">{t('home.upcomingEvents')}</p>
              <h2 className="section-title mt-1">{t('home.upcomingEvents')}</h2>
            </div>
            <Link to="/events" className="btn-outline-gold hidden sm:flex">{t('common.seeAll')} <FiArrowRight /></Link>
          </div>
          {eventsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="church-card animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-3 w-3/4" />
                  <div className="h-3 bg-gray-100 rounded mb-2 w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="bg-amber-50/50 rounded-2xl p-8 text-center border border-amber-200/60 shadow-xs my-2">

              <h3 className="font-display font-bold text-gray-800 text-base mb-1">No Upcoming Events Found</h3>
              <p className="text-gray-500 text-xs max-w-sm mx-auto">
                There are currently no upcoming events scheduled. Please check back later or explore all church activities.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {events.map((ev, i) => (
                <motion.div
                  key={ev._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="church-card group"
                >
                  <div className="flex items-start gap-4">
                    <div className="min-w-14 h-14 rounded-xl bg-church-gradient flex flex-col items-center justify-center shadow-gold">
                      <span className="text-white text-xl font-bold leading-none">{new Date(ev.date).getDate()}</span>
                      <span className="text-gold-300 text-xs">{new Date(ev.date).toLocaleString('default', { month: 'short' })}</span>
                    </div>
                    <div>
                      <span className="badge badge-gold mb-2 capitalize">{ev.category}</span>
                      <h3 className="font-semibold text-gray-800 group-hover:text-church-gold transition-colors">{ev.title}</h3>
                      {ev.venue && <p className="text-gray-500 text-xs mt-1 flex items-center gap-1"><FiMapPin /> {ev.venue}</p>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <div className="mt-6 text-center sm:hidden">
            <Link to="/events" className="btn-outline-gold">{t('common.seeAll')} <FiArrowRight /></Link>
          </div>
        </div>
      </section>

      {/* ─── FEAST COUNTDOWN ─── */}
      <section className="py-20 bg-church-gradient relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-[center_85%] bg-no-repeat opacity-100"
          style={{ backgroundImage: `url(${heroBgImage})` }}
        />
        <div className="absolute inset-0 bg-church-gradient opacity-80 mix-blend-multiply" />
        {/* </div> */}
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <GiCandleLight className="text-gold-300 text-5xl mx-auto mb-4 animate-candle-flicker" />
            <p className="text-gold-300 text-sm font-semibold uppercase tracking-widest mb-2">Feast Day Countdown</p>
            <h2 className="text-white font-display text-3xl md:text-4xl font-bold mb-2">Feast of St. John de Britto</h2>
            <p className="text-gray-300 text-sm mb-8">Patron Saint Feast Day - 4th February</p>
            <CountdownTimer targetDate={`${new Date().getFullYear() + (new Date().getMonth() >= 1 ? 1 : 0)}-02-04`} />
          </motion.div>
        </div>
      </section>

      {/* ─── ANNOUNCEMENTS ─── */}
      <section className="py-20 bg-white ">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="section-subtitle">{t('home.importantAnnouncements', 'Important Announcements')}</p>
              <h2 className="section-title mt-1">{t('nav.announcements')}</h2>
            </div>
            <Link to="/announcements" className="btn-outline-gold hidden sm:flex">{t('common.seeAll')} <FiArrowRight /></Link>
          </div>
          <div className="space-y-4">
            {announcementsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="p-5 rounded-2xl border border-gray-100 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded mb-2 w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <div className="bg-amber-50/50 rounded-2xl p-8 text-center border border-amber-200/60 shadow-xs my-2">
                <h3 className="font-display font-bold text-gray-800 text-base mb-1">No Announcements Found</h3>
                <p className="text-gray-500 text-xs max-w-sm mx-auto">
                  There are currently no active announcements published. Please check back later for parish updates.
                </p>
              </div>
            ) : (
              announcements.map((ann, i) => (
                <motion.div
                  key={ann._id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-4 p-5 rounded-2xl border border-gray-100 hover:border-church-gold transition-all duration-300 group"
                >
                  <div className="w-10 h-10 rounded-full bg-church-gradient flex items-center justify-center flex-shrink-0 shadow-gold">
                    <MdNotifications className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-800 group-hover:text-church-gold transition-colors">{ann.title}</h3>
                      <span className={`badge ${ann.priority === 'urgent' ? 'badge-red' : ann.priority === 'high' ? 'badge-gold' : 'badge-blue'} capitalize`}>{ann.priority}</span>
                    </div>
                    <p className="text-gray-500 text-sm line-clamp-2">{ann.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(ann.createdAt).toLocaleDateString()}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
          <div className="mt-6 text-center sm:hidden">
            <Link to="/announcements" className="btn-outline-gold">{t('common.seeAll')} <FiArrowRight /></Link>
          </div>
        </div>
      </section>

      {/* ─── PRIEST MESSAGE ─── */}
      <section className="py-20 bg-church-beige ">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-8 md:p-12 flex flex-col md:flex-row items-center gap-8"
          >
            <div className="flex-shrink-0">
              <div className="w-40 h-40 rounded-full bg-white/10 backdrop-blur-sm border-4 border-gold-300/50 flex items-center justify-center shadow-gold-lg overflow-hidden p-1">
                <img src={priestSrc} alt="Logo" className="w-full h-full object-cover object-[center_5%] rounded-full" />
              </div>
            </div>
            <div className="text-center md:text-left flex flex-col items-center md:items-start">
              <GiDove className="text-church-gold text-3xl mb-3" />
              <p className="text-gray-600 text-base md:text-lg italic leading-relaxed mb-4 text-justify md:text-left">
                "Welcome to St. John de Britto's Church, Kalayarkoil. We are a vibrant community united in faith, love, and service to God and our neighbors. May this digital space be a source of spiritual nourishment and connection for every member of our parish family."
              </p>
              <div className="text-center md:text-left">
                <p className="font-semibold text-church-royal-blue">Rev. Fr. Parish Priest</p>
                <p className="text-gray-500 text-sm">Parish Priest, St. John de Britto's Church</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── CONTACT CTA ─── */}
      <section className="py-16 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-[center_100%] bg-no-repeat opacity-100"
          style={{ backgroundImage: `url(${heroBgImage})` }}
        />
        <div className="absolute inset-0 bg-church-gradient opacity-80 mix-blend-multiply" />
        {/* Fade into footer */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-church-dark pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10 py-10">

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-white font-display text-3xl md:text-4xl font-bold mb-4">Come & Be Part of Our Community</h2>
            <p className="text-gray-300 mb-8 text-lg">Join us for Holy Mass, prayer, and fellowship. All are welcome.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/contact" className="btn-gold w-full sm:w-auto py-4 px-8 text-base shadow-gold-lg justify-center text-center notranslate" translate="no">{t('nav.contact')}</Link>
              <Link to="/events" className="w-full sm:w-auto px-8 py-4 border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition-all font-semibold text-base text-center">{t('home.upcomingEvents')}</Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
