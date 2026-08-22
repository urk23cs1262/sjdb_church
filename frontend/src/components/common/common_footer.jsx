import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { GiChurch, GiCrucifix, GiDove } from 'react-icons/gi';
import { FiFacebook, FiYoutube, FiInstagram, FiMapPin, FiPhone, FiMail, FiClock, FiShield, FiFileText, FiLock } from 'react-icons/fi';
import churchLogo from '../../assets/church_extirior.png';
import PolicyModal from './common_policy_modal';

const quickLinks = [
  { label: 'nav.home', name: 'Home', path: '/' },
  { label: 'nav.about', name: 'About Church', path: '/about' },
  { label: 'nav.priests', name: 'Priests', path: '/priests' },
  { label: 'nav.anbiyams', name: 'Anbiyams', path: '/anbiyams' },
  { label: 'nav.mass', name: 'Mass Timings', path: '/mass-timings' },
  { label: 'nav.events', name: 'Events', path: '/events' },
  { label: 'nav.gallery', name: 'Gallery', path: '/gallery' },
  { label: 'nav.contact', name: 'Contact', path: '/contact' },
  { label: 'nav.nearby', name: 'Nearby Shrines', path: '/nearby-parishes' },
  { label: 'nav.team', name: 'Our Team', path: '/team' },
  { label: 'nav.council', name: 'Parish Council', path: '/parish-council' },
  { label: 'nav.faq', name: 'FAQ', path: '/faq' },
];

const serviceLinks = [
  { label: 'nav.bookings', name: 'Book a Holy Mass', path: '/bookings' },
  { label: 'nav.documents', name: 'Request Documents', path: '/documents' },
  { label: 'nav.prayers', name: 'Prayer Requests', path: '/prayers' },
  { label: 'nav.announcements', name: 'Announcements', path: '/announcements' },
  { label: 'nav.donate', name: 'Donate', path: '/donate' },
  { label: 'nav.live', name: 'Live Stream', path: '/live' },
  { label: 'nav.rosary', name: 'Rosary', path: '/rosary' },
  { label: 'nav.calendar', name: 'Catholic Calendar', path: '/calendar' },
  { label: 'nav.bibleVerse', name: 'Daily Bible Verse', path: '/bible-verse' },
  // { label: 'nav.whatsappBot', name: 'WhatsApp Bot', external: 'https://wa.me/917639520006?text=HI%0A%0A%F0%9F%99%8F%20SJDB%20Connect%0AConnecting%20Faith%20%26%20Community' },
];

export default function Footer() {
  const { t } = useTranslation();
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyTab, setPolicyTab] = useState('terms');

  const openPolicyModal = (tab) => {
    setPolicyTab(tab);
    setPolicyModalOpen(true);
  };

  return (
    <footer className="bg-church-dark text-white">
      {/* Centered Large Premium Title Banner */}
      <div className="w-full text-center py-6 md:py-4 px-4 overflow-hidden bg-church-dark notranslate" translate="no">
        <h1 className="text-white text-6xl sm:text-7xl md:text-8xl lg:text-[7.5rem] font-premium-banner font-extrabold tracking-tight text-center leading-none text-white/95 drop-shadow-2xl select-none">
          St. John De Britto
        </h1>
      </div>

      {/* Top section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gold-400/40 shadow-gold flex items-center justify-center bg-white/5">
                <img src={churchLogo} alt="Church Logo" className="w-full h-full object-cover object-[center_20%]" />
              </div>
              <div>
                <h3 className="font-display text-gold-300 font-bold text-xl leading-tight">St. John de Britto's</h3>
                <p className="text-gold-400 text-sm font-tamil font-semibold">புனித அருளானந்தர் தேவாலயம்</p>
              </div>
            </div>
            <p className="text-gray-300 text-xs sm:text-sm leading-relaxed text-justify">
              A Roman Catholic parish serving the faithful community of Kalayarkoil with love, faith, and devotion. Protected with enterprise-grade security, encrypted credentials, and transparent privacy policies.
            </p>

            {/* Rich Church Contact Details */}
            <div className="space-y-2 text-xs text-gray-300 pt-3 border-t border-white/10">
              <div className="flex items-start gap-2">
                <FiMapPin className="text-gold-400 mt-0.5 text-sm shrink-0" />
                <span>Kalayarkoil, Sivagangai District, Tamil Nadu - 630551</span>
              </div>
              <div className="flex items-center gap-2">
                <FiPhone className="text-gold-400 text-sm shrink-0" />
                <a href="tel:+919443412345" className="hover:text-gold-300 transition-colors">+91 9xxxxxx</a>
              </div>
              <div className="flex items-center gap-2">
                <FiMail className="text-gold-400 text-sm shrink-0" />
                <a href="mailto:contact@stjohndebrittochurch.org" className="hover:text-gold-300 transition-colors">[Email Address]</a>
              </div>
              <div className="flex items-start gap-2">
                <FiClock className="text-gold-400 mt-0.5 text-sm shrink-0" />
                <span>Wednesday - Saturday {'->'} 5:00 PM | Sunday {'->'} 6:30 AM & 8:30 AM</span>
              </div>
            </div>

            {/* Social Icons with Gold Hover Glow */}
            <div className="flex items-center gap-3.5 pt-2">
              <a href="https://facebook.com" target="_blank" rel="noreferrer"
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-church-gold hover:text-church-dark hover:scale-110 hover:shadow-gold-lg transition-all duration-300 shadow-md">
                <FiFacebook className="text-xl" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer"
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-600 hover:text-white hover:scale-110 hover:shadow-red-600/50 transition-all duration-300 shadow-md">
                <FiYoutube className="text-xl" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer"
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-pink-600 hover:text-white hover:scale-110 hover:shadow-pink-600/50 transition-all duration-300 shadow-md">
                <FiInstagram className="text-xl" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-gold-300 mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
              <GiCrucifix className="text-gold-400" /> <span className="notranslate" translate="no">{t('footer.quickLinks', 'Quick Links')}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {quickLinks.map(link => (
                <li key={`ql-${link.label}`}>
                  <Link to={link.path} className="text-gray-300 hover:text-gold-300 transition-colors duration-200 hover:translate-x-1 inline-block">
                    <span className="notranslate" translate="no">{t(link.label, link.name)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-gold-300 mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
              <GiDove className="text-gold-400" /> <span className="notranslate" translate="no">{t('footer.services', 'Services')}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {serviceLinks.map(link => (
                <li key={`sl-${link.label}`}>
                  {link.external ? (
                    <a
                      href={link.external}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-gold-300 transition-colors duration-200 hover:translate-x-1 inline-block"
                    >
                      <span className="notranslate" translate="no">{t(link.label, link.name)}</span>
                    </a>
                  ) : (
                    <Link to={link.path} className="text-gray-300 hover:text-gold-300 transition-colors duration-200 hover:translate-x-1 inline-block">
                      <span className="notranslate" translate="no">{t(link.label, link.name)}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Trust Policies */}
          <div>
            <h4 className="font-semibold text-gold-300 mb-4 uppercase tracking-wider text-xs flex items-center gap-2">
              <FiShield className="text-gold-400" /> Legal & Security
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => openPolicyModal('terms')} className="text-gray-300 hover:text-gold-300 transition-colors text-left hover:text-gold-300 transition-colors duration-200 hover:translate-x-1 inline-block">
                  Terms & Conditions
                </button>
              </li>
              <li>
                <button onClick={() => openPolicyModal('privacy')} className="text-gray-300 hover:text-gold-300 transition-colors text-left hover:text-gold-300 transition-colors duration-200 hover:translate-x-1 inline-block">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={() => openPolicyModal('security')} className="text-gray-300 hover:text-gold-300 transition-colors text-left hover:text-gold-300 transition-colors duration-200 hover:translate-x-1 inline-block">
                  Security & Trust Policy
                </button>
              </li>
              <li>
                <button onClick={() => openPolicyModal('cookies')} className="text-gray-300 hover:text-gold-300 transition-colors text-left hover:text-gold-300 transition-colors duration-200 hover:translate-x-1 inline-block">
                  Cookie Policy
                </button>
              </li>
              <li>
                <button onClick={() => openPolicyModal('guidelines')} className="text-gray-300 hover:text-gold-300 transition-colors text-left hover:text-gold-300 transition-colors duration-200 hover:translate-x-1 inline-block">
                  Community Guidelines
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/15 bg-black/30 py-6">

        <p className="text-gold-300 font-bold flex items-center justify-center gap-1.5">
          <span className="italic text-sm">"Serving God, Serving People"</span>
          {/* <span className="text-white"></span> */}
        </p>

        <div className="max-w-7xl mx-auto mt-2 px-4 text-center flex flex-col items-center justify-center gap-2">
          <p className="text-white font-medium text-xs sm:text-sm tracking-wide">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>

          {/* <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/90 pt-1">
            <button onClick={() => openPolicyModal('privacy')} className="hover:text-gold-300 transition-colors">Privacy Policy</button>
            <span className="text-white">•</span>
            <button onClick={() => openPolicyModal('terms')} className="hover:text-gold-300 transition-colors">Terms & Conditions</button>
            <span className="text-white">•</span>
            <button onClick={() => openPolicyModal('security')} className="hover:text-gold-300 transition-colors">Security Policy</button>
          </div> */}
        </div>
      </div>

      <PolicyModal
        isOpen={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        initialTab={policyTab}
      />
    </footer>
  );
}
