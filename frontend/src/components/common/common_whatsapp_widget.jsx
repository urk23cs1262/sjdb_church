import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { FaWhatsapp } from 'react-icons/fa';
import api from '../../services/api';

const WHATSAPP_MESSAGE = encodeURIComponent('HI\n\n SJDB Connect\nConnecting Faith & Community');

export default function WhatsAppWidget({ videoAdOpen = false }) {
  const location = useLocation();
  const [whatsappNumber, setWhatsappNumber] = useState('919655639144');

  useEffect(() => {
    api.get('/settings')
      .then(res => {
        const num = res.data?.settings?.whatsappBotPhoneNumber || res.data?.settings?.whatsapp_bot_phone_number;
        if (num) {
          setWhatsappNumber(String(num).replace(/\D/g, ''));
        }
      })
      .catch(() => {});
  }, []);

  // Hide WhatsApp widget only on admin & user portal routes
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/user')) {
    return null;
  }

  const zIndex = videoAdOpen ? 'z-[55]' : 'z-50';

  return (
    <AnimatePresence>
      <motion.div
        key="whatsapp-widget"
        initial={{ opacity: 0, scale: 0.5, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 18 }}
        className={`fixed bottom-6 left-6 ${zIndex} transition-[z-index] group`}
      >
        {/* Subtle Green Pulse Ring */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-40 animate-ping pointer-events-none" />

        {/* Main WhatsApp Button */}
        <motion.a
          href={`https://wa.me/${whatsappNumber}?text=${WHATSAPP_MESSAGE}`}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          className="relative w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg shadow-[#25D366]/40 hover:shadow-xl hover:shadow-[#25D366]/60 transition-all duration-300 border-2 border-white/20"
          // title="Chat with SJDB Connect "
          aria-label="Open WhatsApp chat"
        >
          <FaWhatsapp className="text-3xl text-white drop-shadow" />
        </motion.a>

        {/* Tooltip on Hover */}
        <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-gray-900/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200">
          Chat with SJDB Connect 
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/90" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
