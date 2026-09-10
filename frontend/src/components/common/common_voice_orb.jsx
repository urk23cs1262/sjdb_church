/**
 * common_voice_orb.jsx
 *
 * SJDB Connect — Compact Floating Voice Assistant (Bottom-Center)
 *
 * Based directly on the reference design:
 * Panel 1: User says "Hey Connect" -> Soft sound plays, small orb rises from bottom center
 * Panel 2: Connect greets -> Speech bubble: "Hello! I'm Connect. How can I help you?" + mini waveform
 * Panel 3: Listening -> Speech bubble: "I'm listening..." (or transcript) + waveform, orb with glowing ripple rings
 * Panel 4: Understanding -> Speech bubble: "Understanding..." + 3 pulsing dots, orb with tilted glowing Saturn ring
 * Panel 5: Going to page -> Speech bubble: "Going to [Page Name]" + navigation arrow icon
 * Panel 6: Navigates and closes -> Orb smoothly slides back down
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiNavigation } from 'react-icons/fi';
import { VA_STATE } from '../../hooks/useVoiceAssistant';
import voiceOrbImg from '../../assets/voice_orb.png';

// ─── Play soft pleasant chime ──────────────────────────────────────────────────
function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Note 1 (C5 - 523.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.22, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.32);

    // Note 2 (E5 - 659.25Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.52);
  } catch {
    // Silently continue if audio context is blocked
  }
}

// ─── Bubble Waveform ───────────────────────────────────────────────────────────
function BubbleWaveform({ audioLevel, active }) {
  const BAR_COUNT = 15;
  return (
    <div className="cv-bubble-wave" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const center = BAR_COUNT / 2;
        const dist = Math.abs(i - center) / center;
        const baseHeight = 4 + (1 - dist) * 8;
        const energy = active ? (audioLevel || 45) * (1 - dist * 0.5) : 0;
        const noise = active ? Math.random() * 6 : 0;
        const h = Math.max(3, Math.min(22, baseHeight + energy * 0.18 + noise));
        return <div key={i} className="cv-bubble-bar" style={{ height: `${h}px` }} />;
      })}
    </div>
  );
}

// ─── Bubble Dots (Understanding...) ───────────────────────────────────────────
function BubbleDots() {
  return (
    <div className="cv-bubble-dots" aria-hidden="true">
      <span className="cv-bubble-dot" />
      <span className="cv-bubble-dot" />
      <span className="cv-bubble-dot" />
    </div>
  );
}

// ─── Concentric Ripple Rings (Listening) ───────────────────────────────────────
function RippleRings() {
  return (
    <div className="cv-ripple-wrap" aria-hidden="true">
      <div className="cv-ripple cv-ripple-1" />
      <div className="cv-ripple cv-ripple-2" />
      <div className="cv-ripple cv-ripple-3" />
    </div>
  );
}

// ─── Saturn Ring (Understanding / Processing) ─────────────────────────────────
function SaturnRing() {
  return <div className="cv-saturn-ring" aria-hidden="true" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VoiceOrb({
  state,
  transcript,
  destination,
  audioLevel,
  isSpeaking,
  dismiss,
}) {
  const isVisible = state !== VA_STATE.IDLE;
  const isWake = state === VA_STATE.WAKE;
  const isListening = state === VA_STATE.LISTENING;
  const isProcessing = state === VA_STATE.PROCESSING;
  const isNavigating = state === VA_STATE.NAVIGATING;

  const prevVisibleRef = useRef(false);

  // Play gentle chime when activating from IDLE
  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) {
      playChime();
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible]);

  // Escape key to dismiss
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') dismiss?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dismiss]);

  const isTamil = (() => {
    try {
      return localStorage.getItem('lang') === 'ta';
    } catch {
      return false;
    }
  })();

  // Resolve bubble content based on state
  const renderBubbleContent = () => {
    if (isNavigating && destination) {
      const pageName = isTamil ? destination.labelTa : destination.labelEn;
      return (
        <>
          <p className="cv-bubble-sub">{isTamil ? 'செல்கிறேன்' : 'Going to'}</p>
          <p className="cv-bubble-title">{pageName}</p>
          <FiNavigation className="cv-bubble-nav-icon" />
        </>
      );
    }

    if (isProcessing) {
      return (
        <>
          <p className="cv-bubble-title">{isTamil ? 'புரிந்துகொள்கிறேன்…' : 'Understanding…'}</p>
          <BubbleDots />
        </>
      );
    }

    if (isListening) {
      return (
        <>
          <p className="cv-bubble-title">
            {transcript ? `"${transcript}"` : (isTamil ? 'கேட்கிறேன்…' : "I'm listening…")}
          </p>
          <BubbleWaveform audioLevel={audioLevel} active={true} />
        </>
      );
    }

    if (isWake) {
      return (
        <>
          <p className="cv-bubble-title">
            {isTamil ? 'வணக்கம்! நான் Connect.' : "Hello! I'm Connect."}
          </p>
          <p className="cv-bubble-sub">
            {isTamil ? 'எப்படி உதவட்டுமா?' : 'How can I help you?'}
          </p>
          <BubbleWaveform audioLevel={50} active={isSpeaking} />
        </>
      );
    }

    return null;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="cv-fixed-container"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          role="status"
          aria-live="polite"
          aria-label="SJDB Connect Voice Assistant"
        >
          <div className="cv-float">
            {/* Speech Bubble */}
            <AnimatePresence mode="wait">
              <motion.div
                key={state + (destination?.route || '')}
                className="cv-bubble"
                initial={{ opacity: 0, y: 12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.94 }}
                transition={{ duration: 0.2 }}
              >
                {/* Close button inside speech bubble */}
                <button
                  className="cv-bubble-close"
                  onClick={dismiss}
                  title="Close Connect (Esc)"
                  aria-label="Close Connect"
                >
                  ✕
                </button>

                {renderBubbleContent()}
                <div className="cv-bubble-tail" />
              </motion.div>
            </AnimatePresence>

            {/* Orb Row */}
            <div className="cv-orb-row">
              <div className="cv-orb-wrap">
                {/* Ripple concentric rings for listening */}
                <AnimatePresence>
                  {(isListening || (isWake && isSpeaking)) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <RippleRings />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Saturn ring for understanding/processing */}
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.25 }}
                    >
                      <SaturnRing />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Prismatic rainbow aura glow */}
                <div className="cv-orb-prismatic-aura" aria-hidden="true" />

                {/* Spherical iridescent 3D orb */}
                <motion.div
                  className={`cv-orb ${isNavigating ? 'cv-orb-nav' : ''} ${isProcessing ? 'cv-orb-proc' : ''}`}
                  onClick={dismiss}
                  title="Click or press Esc to close"
                  animate={
                    isSpeaking
                      ? { scale: [1, 1.09, 1], y: [0, -4, 0], transition: { repeat: Infinity, duration: 0.7 } }
                      : isListening
                      ? {
                          scale: audioLevel > 8 ? 1 + (audioLevel / 100) * 0.16 : [1, 1.04, 0.98, 1],
                          y: [0, -5, 0],
                          transition: audioLevel > 8 ? { duration: 0.15 } : { repeat: Infinity, duration: 1.8 }
                        }
                      : isProcessing
                      ? { scale: [1, 1.06, 1], transition: { repeat: Infinity, duration: 0.9 } }
                      : { y: [0, -4, 0], transition: { repeat: Infinity, duration: 2.2 } }
                  }
                >
                  {/* The 3D Liquid Crystal Swirl Sphere */}
                  <img
                    src={voiceOrbImg}
                    alt="SJDB Voice Assistant Orb"
                    className="cv-orb-img"
                    draggable={false}
                  />

                  {/* Dynamic liquid glass light sweep glare */}
                  <div className="cv-orb-sweep" aria-hidden="true" />

                  {/* Specular high-gloss rim reflection */}
                  <div className="cv-orb-rim" aria-hidden="true" />
                </motion.div>

                {/* Soft glow shadow under orb */}
                <div className="cv-orb-reflection" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
