import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/context_auth_context';
import { useNotifications } from '../../context/context_notification_context';
import { UPLOADS_URL, getMediaUrl } from '../../services/api';


import {
  FiMenu, FiX, FiUser, FiLogOut,
  FiSettings, FiUserCheck, FiBell, FiGlobe, FiVolume2, FiVolumeX, FiMusic, FiHeadphones, FiChevronDown, FiLayout
} from 'react-icons/fi';
import { FaUserCog } from 'react-icons/fa';
import { GiChurch, GiCrucifix } from 'react-icons/gi';
import churchLogo from '../../assets/church_extirior.png';
import DailySaintTicker from './common_daily_saint_ticker';
import PreMaintenanceBanner from './common_pre_maintenance_banner';
import RosaryModal from './common_rosary_modal';

const navLinks = [
  { key: 'rosary', path: '/rosary' },
  { key: 'home', path: '/' },
  { key: 'about', path: '/about' },
];
const MORE_LINKS = [
  // { key: 'devotional_songs', label: 'Devotional Songs', labelTa: 'பக்திப் பாடல்கள்', isDevotional: true },
  { key: 'priests', path: '/priests', label: 'Priests' },
  { key: 'anbiyams', path: '/anbiyams', label: 'Anbiyams' },
  { key: 'gallery', path: '/gallery', label: 'Gallery' },
  { key: 'live', path: '/live', label: 'Live Stream' },
  { key: 'nearby_parishes', path: '/nearby-parishes', label: 'Nearby Shrines' },
  { key: 'team', path: '/team', label: 'Our Team' },
];



function checkIsTamil() {
  if (typeof document === 'undefined') return false;
  const cookie = document.cookie || '';
  const htmlLang = document.documentElement?.lang || '';
  const hasGoogTransTa = cookie.includes('/ta') || cookie.includes('googtrans=/en/ta') || cookie.includes('googtrans=/auto/ta');
  const isHtmlTa = htmlLang.toLowerCase().startsWith('ta');
  const localLang = localStorage.getItem('lang') === 'ta';
  return hasGoogTransTa || isHtmlTa || localLang;
}

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout, isAdmin, isAuthenticated } = useAuth();
  const { unreadCount, adminUnreadCount } = useNotifications();

  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(window.scrollY > 20);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showRosaryModal, setShowRosaryModal] = useState(false);
  const [rosaryModalMode, setRosaryModalMode] = useState('rosary');
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);

  const isTamil = checkIsTamil();

  // Sync i18n react language with cookie/local settings on mount/render
  useEffect(() => {
    const isCurrentlyTamil = checkIsTamil();
    if (i18n && typeof i18n.changeLanguage === 'function') {
      i18n.changeLanguage(isCurrentlyTamil ? 'ta' : 'en');
    }
  }, [i18n]);

  const toggleRosaryAudio = () => {
    setRosaryModalMode('rosary');
    setShowRosaryModal(true);
  };

  const openDevotionalSongs = () => {
    setRosaryModalMode('songs');
    setShowRosaryModal(true);
  };

  // Expose global window triggers for Devotional Songs continuous playlist
  useEffect(() => {
    window.openDevotionalSongs = openDevotionalSongs;
    window.openRosaryModal = toggleRosaryAudio;

    const handleOpenDevotional = () => openDevotionalSongs();
    const handleOpenRosary = () => toggleRosaryAudio();

    window.addEventListener('open-devotional-songs', handleOpenDevotional);
    window.addEventListener('open-rosary-modal', handleOpenRosary);

    return () => {
      window.removeEventListener('open-devotional-songs', handleOpenDevotional);
      window.removeEventListener('open-rosary-modal', handleOpenRosary);
    };
  }, []);

  const toggleGoogleTranslate = () => {
    const nextLang = isTamil ? 'en' : 'ta';
    sessionStorage.setItem('scrollPos', window.scrollY);

    if (i18n && typeof i18n.changeLanguage === 'function') {
      i18n.changeLanguage(nextLang);
    }
    localStorage.setItem('lang', nextLang);

    if (nextLang === 'ta') {
      document.cookie = 'googtrans=/en/ta; path=/';
      document.cookie = `googtrans=/en/ta; domain=${window.location.hostname}; path=/`;
    } else {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${window.location.hostname}; path=/;`;
      document.cookie = 'googtrans=/en/en; path=/';
      document.cookie = `googtrans=/en/en; domain=${window.location.hostname}; path=/`;
    }

    // Instantly switch Google Translate in-page combo box (0ms delay)
    const selectEl = document.querySelector('.goog-te-combo');
    if (selectEl) {
      selectEl.value = nextLang;
      selectEl.dispatchEvent(new Event('change'));
    } else {
      // Fallback reload if dropdown not initialized
      window.location.reload();
    }
  };

  useEffect(() => {
    if (showRosaryModal || showLogoutConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showRosaryModal, showLogoutConfirm]);

  useEffect(() => {
    const savedPos = sessionStorage.getItem('scrollPos');
    if (savedPos) {
      window.scrollTo(0, parseInt(savedPos));
      sessionStorage.removeItem('scrollPos');
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogoutClick = () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    navigate('/');
    toast.success(isTamil ? 'வெற்றிகரமாக வெளியேற்றப்பட்டீர்கள்' : 'Logged out successfully');
  };

  const isHome = location.pathname === '/';

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled || !isHome
          ? 'bg-church-royal-blue/95 backdrop-blur-xl shadow-royal py-2'
          : 'bg-transparent py-4'
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-gold-400/50 flex items-center justify-center shadow-gold group-hover:shadow-gold-lg transition-all duration-300">
                <img src={churchLogo} alt="Church Logo" className="w-full h-full object-cover object-[center_20%]" />
              </div>
              <div className="hidden sm:block">
                <p className="text-white font-display text-sm font-bold leading-tight">St. John de Britto</p>
                <p className="text-gold-400 text-xs font-tamil">புனித அருளானந்தர்</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map(link => (
                <div key={link.key} className="relative group">
                  {link.key === 'rosary' ? (
                    <button
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 text-gray-200 hover:text-church-gold hover:bg-white/10`}
                      onClick={toggleRosaryAudio}
                    >
                      <FiHeadphones />
                      <span className="notranslate" translate="no">{t(`nav.${link.key}`)}</span>
                    </button>
                  ) : (
                    <NavLink
                      to={link.path}
                      className={({ isActive }) =>
                        `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${isActive
                          ? 'bg-church-gold text-white shadow-gold'
                          : 'text-gray-200 hover:text-church-gold hover:bg-white/10'
                        }`
                      }
                    >
                      <span className="notranslate" translate="no">{t(`nav.${link.key}`)}</span>
                    </NavLink>
                  )}
                </div>
              ))}

              {/* More Info Dropdown */}
              <div className="relative" onMouseEnter={() => setMoreInfoOpen(true)} onMouseLeave={() => setMoreInfoOpen(false)}>
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${moreInfoOpen ? 'text-church-gold bg-white/10' : 'text-gray-200 hover:text-church-gold hover:bg-white/10'
                    }`}
                >
                  <span className="notranslate" translate="no">{isTamil ? 'மேலும் தகவல்' : 'More Info'}</span>
                  <FiChevronDown className={`transition-transform duration-200 ${moreInfoOpen ? 'rotate-180 text-church-gold' : ''}`} />
                </button>

                <AnimatePresence>
                  {moreInfoOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-44 bg-white/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      {MORE_LINKS.map((item, i) => (
                        item.isDevotional ? (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => { openDevotionalSongs(); setMoreInfoOpen(false); }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-150 border-b border-gray-100 last:border-0 text-gray-800 hover:text-church-royal-blue hover:bg-gold-50/60 text-left cursor-pointer"
                          >
                            <FiMusic className="text-church-gold flex-shrink-0" />
                            <span className="notranslate font-semibold" translate="no">
                              {isTamil ? (item.labelTa || item.label) : item.label}
                            </span>
                          </button>
                        ) : (
                          <NavLink
                            key={item.key}
                            to={item.path}
                            onClick={() => setMoreInfoOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-150 border-b border-white/5 last:border-0 ${isActive
                                ? 'bg-church-gold text-black'
                                : 'text-black hover:text-church-gold hover:bg-white/10'
                              }`
                            }
                          >
                            <span className="notranslate" translate="no">{t(`nav.${item.key}`, item.label)}</span>
                          </NavLink>
                        )
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Contact — after More Info */}
              <NavLink
                to="/contact"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${isActive
                    ? 'bg-church-gold text-white shadow-gold'
                    : 'text-gray-200 hover:text-church-gold hover:bg-white/10'
                  }`
                }
              >
                <span className="notranslate" translate="no">{t('nav.contact')}</span>
              </NavLink>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Rosary Button Mobile/Tablets */}
              <button
                onClick={toggleRosaryAudio}
                className="lg:hidden flex items-center gap-1 text-gray-200 hover:text-gold-300 transition-colors p-2 rounded-lg hover:bg-white/10"
                title="Rosary"
              >
                <FiHeadphones className="text-base" />
              </button>

              {/* Google Translate Hidden Widget */}
              <div id="google_translate_element" style={{ display: 'none' }}></div>

              <button
                onClick={toggleGoogleTranslate}
                translate="no"
                className="notranslate flex items-center gap-1.5 text-gray-200 hover:text-gold-300 transition-colors p-2 rounded-lg hover:bg-white/10"
                title={isTamil ? "Switch to English" : "தமிழில் பார்க்க"}
              >
                <FiGlobe className="text-base text-gold-400 notranslate" translate="no" />
                <span className="notranslate text-xs font-bold whitespace-nowrap" translate="no">
                  {isTamil ? "English" : "தமிழில்"}
                </span>
              </button>

              {/* Auth buttons */}
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="relative flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition-all duration-200"
                  >
                    <div className="w-7 h-7 rounded-full bg-church-gold flex items-center justify-center overflow-hidden border border-gold-400/50">
                      {user?.profilePhoto ? (
                        <img
                          src={getMediaUrl(user.profilePhoto)}
                          alt="profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (

                        <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <span className="hidden sm:block text-sm font-medium max-w-[140px] md:max-w-[200px] truncate">{user?.name}</span>
                    {(isAdmin ? adminUnreadCount : unreadCount) > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-church-royal-blue animate-pulse" />
                    )}
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[100]"
                      >
                        <div className="p-3 border-b border-gray-100 ">
                          <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                        </div>
                        {isAdmin && (
                          <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gold-50 transition-colors">
                            <FaUserCog className="text-church-gold" /> {t('nav.admin')}
                          </Link>
                        )}
                        <Link to="/dashboard" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gold-50 transition-colors">
                          <FiLayout className="text-church-gold" /> {t('nav.dashboard')}
                        </Link>
                        <Link to={isAdmin ? "/admin/notifications" : "/dashboard/notifications"} onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gold-50 transition-colors">
                          <span className="relative flex items-center justify-center">
                            <FiBell className="text-church-gold text-base" />
                            {(isAdmin ? adminUnreadCount : unreadCount) > 0 && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-2 ring-white" />
                            )}
                          </span>
                          <span>Notifications</span>
                          {(isAdmin ? adminUnreadCount : unreadCount) > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                              {isAdmin ? adminUnreadCount : unreadCount}
                            </span>
                          )}
                        </Link>
                        <Link to="/dashboard/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gold-50 transition-colors">
                          <FiSettings className="text-church-gold" /> Settings
                        </Link>

                        <button onClick={handleLogoutClick} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                          <FiLogOut /> {t('nav.logout')}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Link to="/login" className="text-gray-200 hover:text-gold-300 text-[10px] sm:text-sm font-bold px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-white/10 transition-all border border-white/10">
                    {t('nav.login')}
                  </Link>
                  <Link to="/register" className="btn-gold text-[10px] sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4 whitespace-nowrap">
                    {t('nav.register')}
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden text-gray-200 hover:text-gold-300 p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                {mobileOpen ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-church-royal-blue/98 backdrop-blur-xl border-t border-white/10"
            >
              <div className="px-4 py-4 space-y-1">
                {navLinks.map(link => (
                  <div key={link.key} className="flex items-center">
                    {link.key === 'rosary' ? (
                      <button
                        onClick={() => { toggleRosaryAudio(); setMobileOpen(false); }}
                        className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer text-gray-200 hover:bg-white/10`}
                      >
                        <FiHeadphones />
                        <span className="notranslate" translate="no">{t(`nav.${link.key}`)}</span>
                      </button>
                    ) : (
                      <NavLink
                        to={link.path}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex-1 block px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-church-gold text-white' : 'text-gray-200 hover:bg-white/10'
                          }`
                        }
                      >
                        <span className="notranslate" translate="no">{t(`nav.${link.key}`)}</span>
                      </NavLink>
                    )}
                  </div>
                ))}

                {/* Contact Link */}
                <div className="flex items-center">
                  <NavLink
                    to="/contact"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex-1 block px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-church-gold text-white' : 'text-gray-200 hover:bg-white/10'
                      }`
                    }
                  >
                    <span className="notranslate" translate="no">{t('nav.contact')}</span>
                  </NavLink>
                </div>

                {/* More Info links in mobile */}
                <div className="pt-1">
                  <p className="px-4 text-[10px] text-church-gold/70 font-bold uppercase tracking-widest mb-1 notranslate" translate="no">{isTamil ? 'மேலும் தகவல்' : 'More Info'}</p>
                  {MORE_LINKS.map(item => (
                    item.isDevotional ? (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => { openDevotionalSongs(); setMobileOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-gray-200 hover:text-church-gold hover:bg-white/10 text-left cursor-pointer"
                      >
                        <FiMusic className="text-church-gold text-sm" />
                        <span className="notranslate" translate="no">
                          {isTamil ? (item.labelTa || item.label) : item.label}
                        </span>
                      </button>
                    ) : item.external ? (
                      <a
                        key={item.key}
                        href={item.external}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMobileOpen(false)}
                        className="block px-4 py-3 rounded-xl text-sm font-medium transition-all text-gray-200 hover:text-church-gold hover:bg-white/10"
                      >
                        <span className="notranslate" translate="no">{t(`nav.${item.key}`, item.label)}</span>
                      </a>
                    ) : (
                      <NavLink
                        key={item.key}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `block px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-church-gold text-white' : 'text-gray-200 hover:text-church-gold hover:bg-white/10'}`
                        }
                      >
                        <span className="notranslate" translate="no">{t(`nav.${item.key}`, item.label)}</span>
                      </NavLink>
                    )
                  ))}
                </div>

                <div className="h-px bg-white/10 my-2" />

                {/* Google Translate Mobile Hidden */}
                <div id="google_translate_element_mobile" style={{ display: 'none' }}></div>

                {/* <div className="pt-2">
                  <button
                    onClick={() => { toggleGoogleTranslate(); setMobileOpen(false); }}
                    translate="no"
                    className="notranslate w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/10 text-white text-xs font-bold transition-all border border-white/20"
                    title={isTamil ? "Switch to English" : "தமிழில் பார்க்க"}
                  >
                    <FiGlobe className="text-base text-gold-400 notranslate" translate="no" />
                    <span className="notranslate text-xs font-bold" translate="no">
                      {isTamil ? "English" : "தமிழில்"}
                    </span>
                  </button>
                </div> */}

                {!isAuthenticated ? null : (
                  <div className="pt-2 flex flex-col gap-2">
                    <button onClick={handleLogoutClick} className="flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all cursor-pointer">
                      <FiLogOut /> {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!mobileOpen && !location.pathname.startsWith('/admin') && (
          <>
            <DailySaintTicker />
            <PreMaintenanceBanner />
          </>
        )}
      </motion.nav>

      {/* Centered Logout Confirmation Modal with Blurred Background */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 w-full max-w-[360px] sm:max-w-sm text-center shadow-2xl relative"
            >
              {/* Circular Red Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#fff1f2] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5">
                <svg
                  className="w-7 h-7 sm:w-8 sm:h-8 text-[#dc2626]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>

              {/* Title */}
              <h2 className="font-serif text-2xl sm:text-[26px] font-bold text-church-royal-blue tracking-wide mb-2">
                {isTamil ? 'LOG OUT' : 'LOG OUT'}
              </h2>

              {/* Description Text */}
              <p className="text-gray-500 text-sm sm:text-[15px] leading-relaxed mb-6 px-1">
                {isTamil
                  ? 'உங்கள் கணக்கிலிருந்து உறுதியாக வெளியேற விரும்புகிறீர்களா?'
                  : location.pathname.startsWith('/admin')
                    ? 'Are you sure you want to Log out of the Admin Panel?'
                    : 'Are you sure you want to Log out?'}
              </p>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3.5 w-full">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full py-3 sm:py-3.5 rounded-2xl font-bold text-gray-700 bg-[#f1f5f9] hover:bg-slate-200 transition-colors text-sm sm:text-base cursor-pointer"
                >
                  {isTamil ? 'Cancel' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={confirmLogout}
                  className="w-full py-3 sm:py-3.5 rounded-2xl font-bold text-white bg-[#dc2626] hover:bg-red-700 transition-all shadow-md active:scale-95 text-sm sm:text-base cursor-pointer"
                >
                  {isTamil ? 'Log Out' : 'Log Out'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rosary Audio Modal */}
      <RosaryModal
        isOpen={showRosaryModal}
        onClose={() => setShowRosaryModal(false)}
        initialMode={rosaryModalMode}
        t={t}
      />
    </>
  );
}
