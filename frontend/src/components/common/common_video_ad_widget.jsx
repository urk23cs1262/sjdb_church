import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiChevronLeft, FiPlay, FiYoutube } from 'react-icons/fi';
import api from '../../services/api';

// Default YouTube video ID for Catholic Church video (https://youtu.be/i1dEoV-p03k)
const DEFAULT_VIDEO_ID = 'i1dEoV-p03k';


export default function VideoAdWidget({ onOpenChange }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [videoId, setVideoId] = useState(DEFAULT_VIDEO_ID);
  const [videoError, setVideoError] = useState(false);
  const [openKey, setOpenKey] = useState(0); // increments each time user opens maximized view

  // Notify Layout & ScrollToTop whenever open state changes
  const handleSetIsOpen = (val) => {
    setIsOpen(val);
    onOpenChange?.(val);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('video-ad-state-change', { detail: { isOpen: val, isMaximized: false } }));
    }
  };
  const handleSetIsMaximized = (val) => {
    setIsMaximized(val);
    const isStillOpen = val ? true : isOpen;
    onOpenChange?.(isStillOpen);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('video-ad-state-change', { detail: { isOpen: isStillOpen, isMaximized: val } }));
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('video-ad-state-change', { detail: { isOpen: true, isMaximized: false } }));
    }
  }, []);

  useEffect(() => {
    api.get('/settings/videoAdId')
      .then(r => {
        if (r.data.value) {
          setVideoId(r.data.value);
          setVideoError(false);
        }
      })
      .catch(() => { }); // silently fall back to default
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => handleSetIsOpen(true)}
        className="fixed bottom-6 right-0 z-[40] bg-white rounded-l-xl shadow-2xl border-y-2 border-l-2 border-gray-200 pl-3 pr-2 py-3 flex items-center justify-center text-church-royal-blue hover:bg-gray-50 transition-all hover:-translate-x-1"
        title="Open Video"
      >
        <FiChevronLeft className="text-2xl" />
      </button>
    );
  }

  if (isMaximized) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
        {/* Close button ABOVE the video */}
        <div className="w-full max-w-4xl flex justify-end mb-2">
          <button
            onClick={() => handleSetIsMaximized(false)}
            className="w-10 h-10 bg-white/20 hover:bg-white/90 hover:text-gray-800 rounded-full flex items-center justify-center text-white transition-colors shadow-lg border border-white/30"
          >
            <FiX className="text-xl" />
          </button>
        </div>
        <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
          <iframe
            key={`max-${videoId}-${openKey}`}
            className="w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&start=0&rel=0&modestbranding=1&playsinline=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen>
          </iframe>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bottom-6 right-6 z-50 w-64 md:w-72 shadow-2xl"
      >
        {/* Close button sits ABOVE the video card */}
        <div className="flex justify-end mb-1.5">
          <button
            onClick={() => handleSetIsOpen(false)}
            className="w-7 h-7 bg-gray-800 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors shadow-lg"
            title="Close Video"
          >
            <FiX className="text-sm" />
          </button>
        </div>

        {/* Video card */}
        <div
          className="rounded-xl overflow-hidden cursor-pointer border-2 border-church-gold"
          onClick={() => {
            if (!videoError) {
              setOpenKey(k => k + 1); // force iframe remount → play from start
              handleSetIsMaximized(true);
            }
          }}
        >
          {videoError ? (
            /* Placeholder when video is unavailable */
            <div className="aspect-video bg-gray-900 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <FiYoutube className="text-4xl text-red-500" />
              <p className="text-white text-xs font-medium leading-tight">No video configured</p>
              <p className="text-gray-400 text-[10px]">Set a YouTube video in Admin → Settings</p>
            </div>
          ) : (
            <div className="relative aspect-video bg-black">
              {/* Muted autoplay preview */}
              <iframe
                key={videoId + '-mini'}
                className="w-full h-full pointer-events-none"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&modestbranding=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                onError={() => setVideoError(true)}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
