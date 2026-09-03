import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowUp } from 'react-icons/fi';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const [showButton, setShowButton] = useState(false);
  const [isVideoWidgetOpen, setIsVideoWidgetOpen] = useState(true);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Track window scroll position to show/hide the floating button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowButton(true);
      } else {
        setShowButton(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen to video ad widget open/close/maximize status
  useEffect(() => {
    const handleVideoState = (e) => {
      if (e?.detail !== undefined) {
        setIsVideoWidgetOpen(Boolean(e.detail.isOpen && !e.detail.isMaximized));
      }
    };

    window.addEventListener('video-ad-state-change', handleVideoState);
    return () => window.removeEventListener('video-ad-state-change', handleVideoState);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Only consider video widget present on public layout pages
  const isAdminPage = pathname.startsWith('/admin');
  const isPublicPage = !pathname.startsWith('/admin') && !pathname.startsWith('/dashboard') && !pathname.startsWith('/login') && !pathname.startsWith('/register') && !pathname.startsWith('/maintenance');
  const hasFloatingVideo = isPublicPage && isVideoWidgetOpen;

  return (
    <AnimatePresence>
      {showButton && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25 }}
          className={`fixed z-40 p-3 sm:p-3.5 rounded-full bg-church-royal-blue text-white shadow-2xl hover:bg-blue-900 border border-white/20 transition-all duration-300 cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center group ${
            isAdminPage
              ? 'bottom-5 right-4 sm:right-6'
              : hasFloatingVideo 
                ? 'bottom-[220px] sm:bottom-[240px] right-4 sm:right-6' 
                : 'bottom-[104px] right-4 sm:right-6'
          }`}
          title="Back to Top / மேலே செல்ல"
          aria-label="Scroll to top"
        >
          <FiArrowUp className="text-lg sm:text-xl transition-transform group-hover:-translate-y-0.5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
