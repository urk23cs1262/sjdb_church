/**
 * useVoiceAssistant.js — Production Voice Assistant Hook for SJDB Church
 *
 * Full Feature Set:
 * 1. Global voice accessibility across every navigable page, action, modal, and button
 * 2. Multi-turn continuous conversation (LISTEN -> UNDERSTAND -> ACTION/NAVIGATE -> SPEAK -> RETURN TO LISTEN)
 * 3. Dashboard actions: Book a Mass, Request Document, Raise a Ticket, Prayer Request, My Bookings, My Documents, etc.
 * 4. Safe modal closing ("Close" closes open modals before closing assistant)
 * 5. Safe form submission ("Submit this booking", "Submit ticket") with validation guard
 * 6. Document downloading ("Download document", "Get file", "Download receipt")
 * 7. Ambiguity handling & clarification ("Open documents" -> Ask "Do you want to request a new document or view your existing documents?")
 * 8. Context-aware help suggestions for unrecognized commands
 * 9. Anti-truncation SpeechSynthesis (sentence chunking + watchdog)
 * 10. Robust SpeechRecognition lifecycle & cleanup
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/context_auth_context';
import {
  resolveVoiceCommand,
  resolveClarificationResponse,
  getContextAwareHelp,
  matchesRoute,
  isReadCommand,
  detectSpokenLanguage,
  getPageDescription,
  getPageCapabilities,
  getArrivalConfirmation,
  toPronounceableName,
  sanitizeForSpeechSynthesis,
  isWakeWord,
  extractWakeCommand,
  WAKE_WORD_REGEX,
} from '../services/voice_intent_map';
export { toPronounceableName, sanitizeForSpeechSynthesis };
import { readTargetContent } from '../services/page_content_reader';
import {
  closeOpenModal,
  submitActiveForm,
  triggerDocumentDownload,
  toggleNewItemForm,
  focusFormField,
  getFormFieldsGuidance,
  controlAudioPlayer,
  getPendingItemDetails,
  openPendingItem,
} from '../services/voice_action_handler';

// ─── Authoritative States ──────────────────────────────────────────────────────
export const VA_STATE = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  NAVIGATING: 'speaking',
  WAKE: 'speaking',
  ERROR: 'error',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectLang() {
  try {
    return localStorage.getItem('lang') === 'ta' ? 'ta-IN' : 'en-IN';
  } catch {
    return 'en-IN';
  }
}

function isTamilLang() {
  return detectLang() === 'ta-IN';
}

function isSpeechAPISupported() {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

function stripWakePhrase(text) {
  if (!text) return '';
  return text
    .replace(/^(hey\s+connect|hey,\s+connect|hey\s+connected|ஹே\s+கனெக்ட்|connect)\s*[,.:-]?\s*/i, '')
    .trim();
}

/**
 * Split text into full sentences to prevent browser speech truncation on long responses
 */
function splitIntoSentences(text) {
  if (!text) return [];
  const sentences = text
    .split(/(?<=[.?!;:\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0 && text.trim().length > 0) {
    return [text.trim()];
  }
  return sentences;
}

/**
 * Select a crisp, energetic, loud, and pleasant lady/female voice.
 * Prioritizes modern neural voices (Jenny, Aria), followed by standard
 * high-quality female voices (Zira, Samantha, Google Female).
 */
function findCatchyLadyVoice(lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (voices.length === 0) return null;

  const isTamil = lang === 'ta-IN' || lang === 'ta' || lang.startsWith('ta');

  if (isTamil) {
    const taFemale = voices.find(
      (v) =>
        (v.lang.startsWith('ta') || v.name.toLowerCase().includes('tamil')) &&
        (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('pallavi'))
    );
    if (taFemale) return taFemale;
    const taVoice = voices.find(
      (v) => v.lang.startsWith('ta') || v.name.toLowerCase().includes('tamil')
    );
    if (taVoice) return taVoice;
  }

  // Filter English-capable voices
  const enVoices = voices.filter(
    (v) =>
      v.lang.startsWith('en') ||
      v.lang.includes('US') ||
      v.lang.includes('GB') ||
      v.lang.includes('IN')
  );

  // Ranked high-fidelity catchy lady voices
  const preferredFemaleKeywords = [
    'jenny',     // Microsoft Jenny Online (Natural) - ultra catchy and upbeat
    'aria',      // Microsoft Aria Online (Natural) - vibrant and expressive
    'zira',      // Microsoft Zira - universal clear Windows female voice
    'samantha',  // Apple Samantha - clean natural female
    'victoria',  // Apple Victoria
    'karen',     // Australian / Global female
    'neerja',    // Indian English female natural
    'heera',     // Indian English female
    'female',    // Explicitly labeled female (Google UK English Female, etc.)
    'ava',
    'emma',
    'sara',
  ];

  for (const kw of preferredFemaleKeywords) {
    const found = enVoices.find((v) => v.name.toLowerCase().includes(kw));
    if (found) return found;
  }

  // Pick any non-male English voice
  const nonMale = enVoices.find((v) => {
    const n = v.name.toLowerCase();
    return (
      !n.includes('david') &&
      !n.includes('mark') &&
      !n.includes('male') &&
      !n.includes('george') &&
      !n.includes('ravi') &&
      !n.includes('guy') &&
      !n.includes('stefan')
    );
  });
  if (nonMale) return nonMale;

  return enVoices[0] || voices[0] || null;
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

export default function useVoiceAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const [state, setState] = useState(VA_STATE.IDLE);
  const [transcript, setTranscript] = useState('');
  const [spokenText, setSpokenText] = useState('');
  const [destination, setDestination] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSupported] = useState(isSpeechAPISupported);

  // ── Session & State Machine Refs ───────────────────────────────────────────
  const sessionIdRef = useRef(0);
  const stateRef = useRef(VA_STATE.IDLE);
  const isAuthRef = useRef(isAuthenticated);
  const userRef = useRef(user);
  const isUnmountedRef = useRef(false);
  const isContinuousActiveRef = useRef(false);
  const pendingClarificationRef = useRef(null); // 'DOCUMENTS' | 'BOOKINGS'
  const pendingActionConfirmationRef = useRef(null); // { action: 'submit-form' }
  const currentSpeechLangRef = useRef(detectLang()); // Dynamic per turn: 'en-IN' or 'ta-IN'

  // Recognition tracking
  const recognitionRef = useRef(null);
  const isRecognitionActiveRef = useRef(false);
  const isStartingRecognitionRef = useRef(false);

  // Background Wake Word Recognition (Passive "Hey Connect" Listener)
  const wakeWordRecognitionRef = useRef(null);
  const isWakeWordActiveRef = useRef(false);
  const wakeWordRestartTimerRef = useRef(null);
  const hasMicPermissionRef = useRef(true);

  // Locks & Timers
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const activeUtterancesRef = useRef([]);
  const ttsWatchdogTimerRef = useRef(null);
  const recognitionRestartTimerRef = useRef(null);
  const locationRef = useRef(location.pathname);

  // Synthetic Waveform Animation Ref (Eliminates getUserMedia microphone hardware contention)
  const waveRafRef = useRef(null);

  // Dynamic References
  const startListeningRef = useRef(null);
  const processTranscriptRef = useRef(null);
  const activateRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  const getUserDisplayName = useCallback(() => {
    let u = userRef.current || user;
    if (!u) {
      try {
        const saved = localStorage.getItem('user');
        if (saved) u = JSON.parse(saved);
      } catch {}
    }
    if (!u) return '';
    const raw = u.name || u.fullName || u.displayName || u.username || '';
    // Ignore generic placeholder roles (e.g. "Parish Admin", "Admin", "Administrator", "User", "Guest")
    if (!raw || /^(parish\s*(admin|administrator)|admin|administrator|user|guest)$/i.test(raw.trim())) {
      if ((u.email || '').toLowerCase() === 'arndas777@gmail.com') return 'Nivesh Arn';
      return '';
    }
    return toPronounceableName(raw);
  }, [user]);

  // ── Log Helper ─────────────────────────────────────────────────────────────
  const log = useCallback((event, data = '') => {
    if (process.env.NODE_ENV !== 'production' || window.__DEBUG_HEY_CONNECT__) {
      console.log(`[HeyConnect][session:${sessionIdRef.current}] ${event}`, data);
    }
  }, []);

  // ── Safe State Transition ──────────────────────────────────────────────────
  const transitionTo = useCallback((nextState, sessionId = null) => {
    if (sessionId !== null && sessionId !== sessionIdRef.current) return false;
    if (isUnmountedRef.current) return false;

    stateRef.current = nextState;
    setState(nextState);
    return true;
  }, []);

  // ── Speech Recognition Lifecycle (Defined first so TTS and helpers can abort safely) ──

  const safeAbortRecognition = useCallback(() => {
    if (recognitionRef.current) {
      log('RECOGNITION_ABORT');
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    isRecognitionActiveRef.current = false;
    isStartingRecognitionRef.current = false;
  }, [log]);

  const safeStopRecognition = useCallback(() => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      log('RECOGNITION_STOP');
      try {
        recognitionRef.current.stop();
      } catch {
        safeAbortRecognition();
      }
    }
  }, [log, safeAbortRecognition]);

  // ── Audio Waveform Visualizer (Hardware-Safe, No getUserMedia mic contention) ──

  const stopAudioAnalyser = useCallback(() => {
    if (waveRafRef.current) {
      cancelAnimationFrame(waveRafRef.current);
      waveRafRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startAudioAnalyser = useCallback((sessionId) => {
    if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
    if (waveRafRef.current) return;

    let step = 0;
    const tick = () => {
      if (
        sessionId !== sessionIdRef.current ||
        isUnmountedRef.current ||
        stateRef.current !== VA_STATE.LISTENING
      ) {
        waveRafRef.current = null;
        return;
      }
      step += 0.08;
      // Gentle breathing wave between 28 and 65 for smooth visual feedback without capturing hardware mic
      const level = Math.round(44 + Math.sin(step) * 16 + Math.sin(step * 2.2) * 5);
      setAudioLevel(level);
      waveRafRef.current = requestAnimationFrame(tick);
    };
    waveRafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Speech Synthesis (TTS) with Guaranteed Clean Completion & Safety Timeout ──

  const cancelSpeech = useCallback(() => {
    clearInterval(ttsWatchdogTimerRef.current);
    ttsWatchdogTimerRef.current = null;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    activeUtterancesRef.current = [];
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  /**
   * Speak complete text sequentially across sentences with guaranteed completion
   * PRESERVES: Catchy lady voice (findCatchyLadyVoice, pitch: 1.15, rate: 1.02)
   */
  const speakText = useCallback(
    (fullText, sessionId, onEnd = null, langOverride = null) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        onEnd?.();
        return;
      }

      if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;

      // CRITICAL: Stop speech recognition while speaking so microphone doesn't hear assistant's own voice
      safeAbortRecognition();
      cancelSpeech();

      const sentences = splitIntoSentences(fullText);
      if (!sentences.length) {
        onEnd?.();
        return;
      }

      const isTamilText = /[\u0B80-\u0BFF]/.test(fullText) || (langOverride && langOverride.startsWith('ta'));
      const defaultLang = isTamilText ? 'ta-IN' : 'en-IN';
      const ladyVoice = findCatchyLadyVoice(defaultLang);

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setSpokenText(fullText);
      transitionTo(VA_STATE.SPEAKING, sessionId);
      log('TTS_START', { sentenceCount: sentences.length, fullText, defaultLang });

      let currentIndex = 0;

      const speakNextChunk = () => {
        if (sessionId !== sessionIdRef.current || isUnmountedRef.current) {
          cancelSpeech();
          return;
        }

        if (currentIndex >= sentences.length) {
          cancelSpeech();
          log('TTS_FINISHED_ALL');
          if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
            onEnd?.();
          }
          return;
        }

        const chunkText = sentences[currentIndex];
        currentIndex++;

        const isChunkTamil = /[\u0B80-\u0BFF]/.test(chunkText) || isTamilText;
        const chunkLang = isChunkTamil ? 'ta-IN' : 'en-IN';
        const chunkLadyVoice = findCatchyLadyVoice(chunkLang);

        const spokenChunk = sanitizeForSpeechSynthesis(chunkText);
        const utt = new SpeechSynthesisUtterance(spokenChunk);
        utt.lang = chunkLang;
        utt.volume = 1.0; // Maximum loudness
        utt.pitch = 1.15; // Bright, pleasant, feminine pitch (STRICTLY PRESERVED)
        utt.rate = 1.02;  // Catchy, energetic, engaging delivery (STRICTLY PRESERVED)
        if (chunkLadyVoice) utt.voice = chunkLadyVoice;
        else if (ladyVoice) utt.voice = ladyVoice;

        activeUtterancesRef.current.push(utt);

        let chunkHandled = false;
        let safetyTimer = null;

        const finishChunk = () => {
          if (chunkHandled) return;
          chunkHandled = true;
          if (safetyTimer) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
          }
          activeUtterancesRef.current = activeUtterancesRef.current.filter((u) => u !== utt);
          speakNextChunk();
        };

        // Guaranteed safety timeout to recover if mobile Chrome / WebView drops utt.onend
        const safeDurationMs = Math.max(2200, Math.round((spokenChunk.length / 11) * 1000) + 1800);
        safetyTimer = setTimeout(() => {
          log('TTS_CHUNK_SAFETY_RECOVERY', { spokenChunk, safeDurationMs });
          finishChunk();
        }, safeDurationMs);

        utt.onend = () => {
          finishChunk();
        };

        utt.onerror = (e) => {
          log('TTS_CHUNK_ERROR', e);
          finishChunk();
        };

        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utt);
        } catch (err) {
          log('TTS_SPEAK_EXCEPTION', err);
          finishChunk();
        }
      };

      speakNextChunk();
    },
    [cancelSpeech, log, safeAbortRecognition, transitionTo]
  );

  // ── Background Wake-Word Recognition (Desktop only, never run on mobile) ────

  const safeAbortWakeWord = useCallback(() => {
    if (wakeWordRestartTimerRef.current) {
      clearTimeout(wakeWordRestartTimerRef.current);
      wakeWordRestartTimerRef.current = null;
    }
    if (wakeWordRecognitionRef.current) {
      try {
        wakeWordRecognitionRef.current.onstart = null;
        wakeWordRecognitionRef.current.onresult = null;
        wakeWordRecognitionRef.current.onerror = null;
        wakeWordRecognitionRef.current.onend = null;
        wakeWordRecognitionRef.current.abort();
      } catch {}
      wakeWordRecognitionRef.current = null;
    }
    isWakeWordActiveRef.current = false;
  }, []);

  const startWakeWordListening = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (stateRef.current !== VA_STATE.IDLE) return;
    if (isContinuousActiveRef.current) return;
    if (isWakeWordActiveRef.current || wakeWordRecognitionRef.current) return;
    if (!hasMicPermissionRef.current) return;

    // Do NOT run passive background recognition on mobile devices to prevent OS audio locks
    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    try {
      const wr = new SR();
      wr.continuous = true;
      wr.interimResults = true;
      wr.maxAlternatives = 3;
      wr.lang = isTamilLang() ? 'ta-IN' : 'en-IN';

      wr.onstart = () => {
        isWakeWordActiveRef.current = true;
        log('WAKE_WORD_LISTENER_STARTED');
      };

      wr.onresult = (e) => {
        if (stateRef.current !== VA_STATE.IDLE || isContinuousActiveRef.current) {
          safeAbortWakeWord();
          return;
        }

        const results = Array.from(e.results);
        for (let i = e.resultIndex || 0; i < results.length; i++) {
          const res = results[i];
          for (let a = 0; a < res.length; a++) {
            const transcript = res[a]?.transcript || '';
            const wakeCheck = extractWakeCommand(transcript);
            if (wakeCheck.hasWakeWord) {
              log('WAKE_WORD_DETECTED_BACKGROUND', { transcript, command: wakeCheck.command });
              safeAbortWakeWord();
              activateRef.current?.(wakeCheck.command);
              return;
            }
          }
        }
      };

      wr.onerror = (e) => {
        log('WAKE_WORD_ERROR', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          hasMicPermissionRef.current = false;
          safeAbortWakeWord();
          return;
        }
      };

      wr.onend = () => {
        isWakeWordActiveRef.current = false;
        wakeWordRecognitionRef.current = null;
        log('WAKE_WORD_LISTENER_ENDED');

        if (
          stateRef.current === VA_STATE.IDLE &&
          !isContinuousActiveRef.current &&
          !isUnmountedRef.current &&
          hasMicPermissionRef.current
        ) {
          clearTimeout(wakeWordRestartTimerRef.current);
          wakeWordRestartTimerRef.current = setTimeout(() => {
            if (stateRef.current === VA_STATE.IDLE && !isContinuousActiveRef.current) {
              startWakeWordListening();
            }
          }, 600);
        }
      };

      wakeWordRecognitionRef.current = wr;
      wr.start();
    } catch (err) {
      log('WAKE_WORD_START_EXCEPTION', err);
      isWakeWordActiveRef.current = false;
      wakeWordRecognitionRef.current = null;
    }
  }, [log, safeAbortWakeWord]);

  // ── Dismiss Voice Assistant (Supports Immediate Close or Polite Farewell) ──

  const finaliseDismiss = useCallback(() => {
    if (isUnmountedRef.current) return;
    stateRef.current = VA_STATE.IDLE;
    setState(VA_STATE.IDLE);
    setTranscript('');
    setSpokenText('');
    setDestination(null);
    setErrorMessage('');

    // Restart background wake-word listener on desktop
    if (hasMicPermissionRef.current) {
      clearTimeout(wakeWordRestartTimerRef.current);
      wakeWordRestartTimerRef.current = setTimeout(() => {
        if (stateRef.current === VA_STATE.IDLE && !isContinuousActiveRef.current) {
          startWakeWordListening();
        }
      }, 500);
    }
  }, [startWakeWordListening]);

  const dismiss = useCallback(
    (immediate = false) => {
      log('DISMISS', { immediate });
      isContinuousActiveRef.current = false;
      pendingClarificationRef.current = null;
      pendingActionConfirmationRef.current = null;
      sessionIdRef.current++;

      clearTimeout(recognitionRestartTimerRef.current);
      safeAbortRecognition();
      stopAudioAnalyser();
      cancelSpeech();
      isProcessingRef.current = false;

      // Immediate close (e.g. clicking ✕ or pressing Escape)
      if (immediate || isUnmountedRef.current) {
        finaliseDismiss();
        return;
      }

      // Spoken stop command farewell
      const isTamil = isTamilLang();
      const FAREWELL = isTamil
        ? 'கனெக்ட்டை மூடுகிறேன். நன்றி. கடவுள் உங்களை ஆசீர்வதிப்பாராக!'
        : "I'm closing Connect. Thank you. God bless you.";
      const farewell_utt = new SpeechSynthesisUtterance(FAREWELL);
      farewell_utt.lang = isTamil ? 'ta-IN' : 'en-IN';
      farewell_utt.volume = 1.0;
      farewell_utt.pitch = 1.15;
      farewell_utt.rate = 1.02;
      const ladyVoice = findCatchyLadyVoice(farewell_utt.lang);
      if (ladyVoice) farewell_utt.voice = ladyVoice;

      let cleanupDone = false;
      const doCleanup = () => {
        if (cleanupDone) return;
        cleanupDone = true;
        clearTimeout(fallbackTimer);
        finaliseDismiss();
      };
      const fallbackTimer = setTimeout(doCleanup, 2500);

      farewell_utt.onend = doCleanup;
      farewell_utt.onerror = doCleanup;

      try {
        window.speechSynthesis.speak(farewell_utt);
      } catch {
        doCleanup();
      }

      if (!isUnmountedRef.current) {
        stateRef.current = VA_STATE.SPEAKING;
        setState(VA_STATE.SPEAKING);
        setTranscript('');
        setSpokenText(FAREWELL);
        setDestination(null);
        setErrorMessage('');
      }
    },
    [cancelSpeech, finaliseDismiss, log, safeAbortRecognition, stopAudioAnalyser]
  );

  // ── Start Listening (Continuous Conversation Loop with Exclusive Mic Access) ─

  const startListening = useCallback(
    (sessionId) => {
      if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
      if (!isContinuousActiveRef.current) return;

      if (isRecognitionActiveRef.current || isStartingRecognitionRef.current) {
        log('RECOGNITION_ALREADY_ACTIVE');
        return;
      }

      isStartingRecognitionRef.current = true;
      isProcessingRef.current = false;

      transitionTo(VA_STATE.LISTENING, sessionId);
      setTranscript('');
      startAudioAnalyser(sessionId);

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        const errText = isTamilLang()
          ? 'மன்னிக்கவும், இந்த உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை. தயவுசெய்து ஆதரிக்கப்படும் உலாவியைப் பயன்படுத்தவும் அல்லது உங்கள் கோரிக்கையை தட்டச்சு செய்யவும்.'
          : 'Sorry, voice recognition is not supported in this browser. Please use a supported browser or type your request.';
        setErrorMessage(errText);
        transitionTo(VA_STATE.ERROR, sessionId);
        return;
      }

      const lang = currentSpeechLangRef.current || detectLang();
      let r = null;
      try {
        safeAbortRecognition();
        safeAbortWakeWord();
        r = new SR();
        try {
          r.lang = lang;
        } catch {
          r.lang = 'en-IN';
        }
        r.continuous = false;
        r.interimResults = true;
        r.maxAlternatives = 1;
      } catch (err) {
        log('RECOGNITION_INIT_ERROR', err);
        isStartingRecognitionRef.current = false;
        return;
      }

      recognitionRef.current = r;

      r.onstart = () => {
        if (sessionId !== sessionIdRef.current) {
          try {
            r.abort();
          } catch {}
          return;
        }
        isRecognitionActiveRef.current = true;
        isStartingRecognitionRef.current = false;
        log('RECOGNITION_STARTED');
      };

      r.onaudiostart = () => {
        if (sessionId === sessionIdRef.current) {
          setAudioLevel(50);
        }
      };

      r.onspeechstart = () => {
        if (sessionId === sessionIdRef.current) {
          setAudioLevel(75);
        }
      };

      r.onresult = (e) => {
        if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;

        // Interruption: cancel speech immediately if user speaks
        if (isSpeakingRef.current) {
          cancelSpeech();
        }

        const results = Array.from(e.results);
        const raw = results.map((res) => res[0].transcript).join(' ');
        setTranscript(raw);
        setAudioLevel(Math.min(95, 50 + raw.length * 2));

        const isFinal = results[results.length - 1].isFinal;

        // Handle "stop speaking" command instantly
        if (/\b(stop speaking|be quiet|silence)\b/i.test(raw)) {
          cancelSpeech();
          return;
        }

        // Handle "cancel" / "close" command instantly to close voice navigation
        if (
          /^(cancel|close|dismiss|exit|ரத்து)$/i.test(raw.trim()) ||
          /\b(cancel voice|close voice|cancel navigation|stop voice)\b/i.test(raw)
        ) {
          log('INSTANT_CANCEL_TRIGGERED', raw);
          dismiss(false);
          return;
        }

        if (isFinal && raw.trim() && !isProcessingRef.current) {
          isProcessingRef.current = true;
          safeStopRecognition();
          stopAudioAnalyser();
          transitionTo(VA_STATE.PROCESSING, sessionId);

          setTimeout(() => {
            if (sessionId === sessionIdRef.current) {
              processTranscriptRef.current?.(raw, sessionId);
            }
          }, 100);
        }
      };

      r.onerror = (e) => {
        if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
        log('RECOGNITION_ERROR', e.error);

        if (e.error === 'no-speech') {
          return; // Handled smoothly in onend
        }

        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          hasMicPermissionRef.current = false;
          safeAbortWakeWord();
          stopAudioAnalyser();
          const permError = isTamilLang()
            ? 'மைக்ரோஃபோன் அணுகல் தடுக்கப்பட்டுள்ளது. உங்கள் உலாவி அமைப்புகளில் மைக்ரோஃபோன் அனுமதியை வழங்கி மீண்டும் முயற்சிக்கவும்.'
            : 'Microphone access is blocked. Please allow microphone permission in your browser settings and try again.';
          setErrorMessage(permError);
          transitionTo(VA_STATE.ERROR, sessionId);
          speakText(permError, sessionId, () => {
            setTimeout(() => {
              if (sessionId === sessionIdRef.current) dismiss(true);
            }, 3500);
          });
          return;
        }
      };

      r.onend = () => {
        isRecognitionActiveRef.current = false;
        isStartingRecognitionRef.current = false;
        log('RECOGNITION_ENDED');

        if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;

        // Gracefully resume listening if session is still active
        if (
          isContinuousActiveRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current &&
          stateRef.current === VA_STATE.LISTENING
        ) {
          clearTimeout(recognitionRestartTimerRef.current);
          recognitionRestartTimerRef.current = setTimeout(() => {
            if (
              sessionId === sessionIdRef.current &&
              isContinuousActiveRef.current &&
              !isProcessingRef.current &&
              !isSpeakingRef.current
            ) {
              startListening(sessionId);
            }
          }, 180);
        }
      };

      try {
        r.start();
      } catch (err) {
        log('RECOGNITION_START_EXCEPTION', err);
        isStartingRecognitionRef.current = false;
      }
    },
    [
      cancelSpeech,
      dismiss,
      log,
      safeAbortRecognition,
      safeAbortWakeWord,
      safeStopRecognition,
      speakText,
      startAudioAnalyser,
      stopAudioAnalyser,
      transitionTo,
    ]
  );

  startListeningRef.current = startListening;

  // ── Universal Process Spoken Transcript ───────────────────────────────────

  const processTranscript = useCallback(
    async (raw, sessionId) => {
      if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;

      const clean = stripWakePhrase(raw);
      log('PROCESSING_COMMAND', { raw, clean });

      const spokenLang = detectSpokenLanguage(clean);

      // ── Step A: Check if answering a pending clarification question ────────
      if (pendingClarificationRef.current) {
        const clarificationType = pendingClarificationRef.current;
        const clarifiedIntent = resolveClarificationResponse(clean, clarificationType);

        if (clarifiedIntent) {
          log('CLARIFICATION_RESOLVED', clarifiedIntent);
          pendingClarificationRef.current = null;

          const isTamil = spokenLang === 'ta';
          currentSpeechLangRef.current = isTamil ? 'ta-IN' : 'en-IN';

          // Proceed with the chosen intent
          executeNavigationIntent(clarifiedIntent, sessionId, isTamil);
          return;
        }

        // If reply wasn't an answer to the clarification, clear and proceed as normal
        pendingClarificationRef.current = null;
      }

      // ── Step B: Check if answering an action confirmation question ────────
      const isAwaitingActionConfirmation = Boolean(pendingActionConfirmationRef.current);
      const cmd = resolveVoiceCommand(clean, { awaitingConfirmation: isAwaitingActionConfirmation });
      const isTamil = cmd?.detectedLang === 'ta' || spokenLang === 'ta';
      currentSpeechLangRef.current = isTamil ? 'ta-IN' : 'en-IN';

      if (isAwaitingActionConfirmation) {
        if (cmd?.type === 'CONFIRM_YES') {
          log('ACTION_CONFIRMED_YES');
          const pendingAction = pendingActionConfirmationRef.current.action;
          pendingActionConfirmationRef.current = null;

          if (pendingAction === 'submit-form') {
            const confirmSubmitText = isTamil ? 'இப்போது சமர்ப்பிக்கிறேன்.' : 'Submitting now.';
            speakText(confirmSubmitText, sessionId, () => {
              const res = submitActiveForm();
              const resultText = isTamil ? res.messageTa : res.messageEn;
              speakText(resultText, sessionId, () => {
                isProcessingRef.current = false;
                if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
                  startListeningRef.current?.(sessionId);
                }
              });
            });
            return;
          }
        } else if (cmd?.type === 'CONFIRM_NO') {
          log('ACTION_CONFIRMED_NO');
          pendingActionConfirmationRef.current = null;
          if (/\b(cancel|ரத்து)\b/i.test(clean)) {
            dismiss();
            return;
          }
          const cancelMsg = isTamil ? 'சரி, நான் சமர்ப்பிக்கவில்லை.' : "Okay, I won't submit it.";
          speakText(cancelMsg, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
          return;
        } else {
          // If user gave another command, reset confirmation and proceed
          pendingActionConfirmationRef.current = null;
        }
      }

      // 0. Priority 0: Bad / Inappropriate speech (Section 24 & 26)
      if (cmd && cmd.type === 'INAPPROPRIATE') {
        log('INAPPROPRIATE_SPEECH_DETECTED');
        // Do NOT store raw transcript or save anywhere (Section 29)
        setTranscript('');
        const warningMsg = isTamil ? cmd.warningTa : cmd.warningEn;

        speakText(warningMsg, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      // 1. Control Commands (Priority 1 & 2: stop, close, back, forward, scroll)
      if (cmd && cmd.type === 'CONTROL') {
        log('CONTROL_COMMAND_RESOLVED', cmd.action);

        if (cmd.action === 'stop-speaking') {
          cancelSpeech();
          isProcessingRef.current = false;
          startListeningRef.current?.(sessionId);
          return;
        }

        // Cancel command: Closes voice navigation immediately
        if (cmd.action === 'cancel') {
          log('VOICE_NAVIGATION_CANCELLED');
          dismiss();
          return;
        }

        // Stop Listening: Closes voice navigation immediately
        if (cmd.action === 'stop-listening') {
          log('VOICE_NAVIGATION_STOPPED');
          dismiss();
          return;
        }

        // Close command: Check if an on-screen modal is open first!
        if (cmd.action === 'close') {
          // If explicitly refers to assistant or navigation, close assistant directly
          if (/\b(voice|assistant|navigation|orb)\b/i.test(clean)) {
            dismiss();
            return;
          }

          const modalWasClosed = closeOpenModal();
          if (modalWasClosed) {
            log('MODAL_CLOSED_BY_VOICE');
            const closeConfirm = isTamil ? 'மூடப்பட்டது.' : 'Closing.';
            speakText(closeConfirm, sessionId, () => {
              isProcessingRef.current = false;
              if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
                startListeningRef.current?.(sessionId);
              }
            });
            return;
          }

          // If no modal was open, close the voice assistant
          dismiss();
          return;
        }

        if (cmd.action === 'back') {
          const backMsg = isTamil ? 'சரி, முந்தைய பக்கத்திற்கு செல்கிறேன்.' : "Okay, I'm going back.";
          speakText(backMsg, sessionId, () => {
            window.history.back();
            isProcessingRef.current = false;
            setTimeout(() => {
              if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
                const arrivedMsg = isTamil
                  ? 'நாம் முந்தைய பக்கத்திற்கு திரும்பிவிட்டோம். நான் உங்களுக்கு எப்படி உதவ முடியும்?'
                  : "We're back on the previous page. How can I help you?";
                speakText(arrivedMsg, sessionId, () => {
                  if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
                    startListeningRef.current?.(sessionId);
                  }
                });
              }
            }, 600);
          });
          return;
        }

        if (cmd.action === 'forward') {
          const fwdMsg = isTamil ? cmd.confirmTa : cmd.confirmEn;
          speakText(fwdMsg, sessionId, () => {
            window.history.forward();
            isProcessingRef.current = false;
            setTimeout(() => {
              if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
                startListeningRef.current?.(sessionId);
              }
            }, 600);
          });
          return;
        }

        if (cmd.action === 'refresh') {
          const refreshMsg = isTamil ? cmd.confirmTa : cmd.confirmEn;
          speakText(refreshMsg, sessionId, () => {
            window.location.reload();
          });
          return;
        }

        if (cmd.action === 'scroll-down') {
          const scrollMsg = isTamil ? cmd.confirmTa : cmd.confirmEn;
          window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
          speakText(scrollMsg, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
          return;
        }

        if (cmd.action === 'scroll-up') {
          const scrollMsg = isTamil ? cmd.confirmTa : cmd.confirmEn;
          window.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' });
          speakText(scrollMsg, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
          return;
        }

        if (cmd.action === 'scroll-top') {
          const scrollMsg = isTamil ? cmd.confirmTa : cmd.confirmEn;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          speakText(scrollMsg, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
          return;
        }

        if (cmd.action === 'scroll-bottom') {
          const scrollMsg = isTamil ? cmd.confirmTa : cmd.confirmEn;
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          speakText(scrollMsg, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
          return;
        }
      }

      // 1.5. Conversational Assistance Queries
      if (cmd && cmd.type === 'WHAT_CAN_YOU_DO') {
        log('CONVERSATIONAL_WHAT_CAN_YOU_DO');
        const resp = isTamil ? cmd.responseTa : cmd.responseEn;
        speakText(resp, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      if (cmd && cmd.type === 'WHAT_IS_THIS_PAGE') {
        log('CONVERSATIONAL_WHAT_IS_THIS_PAGE');
        const pageDesc = getPageDescription(locationRef.current, isTamil);
        speakText(pageDesc, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      if (cmd && cmd.type === 'WHAT_CAN_I_DO_HERE') {
        log('CONVERSATIONAL_WHAT_CAN_I_DO_HERE');
        const caps = getPageCapabilities(locationRef.current, isTamil);
        speakText(caps, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      if (cmd && cmd.type === 'FORM_WHAT_TO_FILL') {
        log('CONVERSATIONAL_FORM_WHAT_TO_FILL');
        const guidance = getFormFieldsGuidance(locationRef.current, isTamil);
        speakText(guidance, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      if (cmd && cmd.type === 'FORM_FOCUS_FIELD') {
        log('CONVERSATIONAL_FORM_FOCUS_FIELD', cmd.fieldName);
        const res = focusFormField(cmd.fieldName);
        const focusMsg = isTamil
          ? (res.success ? `${cmd.fieldName} கட்டத்திற்கு நகர்த்தியுள்ளேன்.` : `${cmd.fieldName} கட்டம் இந்தப் பக்கத்தில் காணப்படவில்லை.`)
          : (res.success ? `Focused on the ${cmd.fieldName} field.` : `Could not find the ${cmd.fieldName} field on this page.`);
        speakText(focusMsg, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      if (cmd && cmd.type === 'AUDIO_CONTROL') {
        log('CONVERSATIONAL_AUDIO_CONTROL', cmd.action);
        const res = controlAudioPlayer(cmd.action);
        const audioMsg = isTamil ? res.messageTa : res.messageEn;
        speakText(audioMsg, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      if (cmd && cmd.type === 'PENDING_QUERY') {
        log('CONVERSATIONAL_PENDING_QUERY');
        const res = getPendingItemDetails(isTamil);
        speakText(res.description, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      if (cmd && cmd.type === 'OPEN_THAT_ITEM') {
        log('CONVERSATIONAL_OPEN_THAT_ITEM');
        const opened = openPendingItem();
        const openMsg = isTamil
          ? (opened ? 'பதிவு விவரங்களை திறக்கிறேன்.' : 'திறப்பதற்கு நிலுவை பதிவுகள் எதுவும் இல்லை.')
          : (opened ? 'Opening the item details.' : 'No pending items found to open.');
        speakText(openMsg, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      // 2. Action Commands (Buttons, Form Submits, Downloads)
      if (cmd && cmd.type === 'ACTION') {
        log('ACTION_COMMAND_RESOLVED', cmd.action);

        if (cmd.action === 'submit-form') {
          // Explicit Consequential Action Confirmation
          pendingActionConfirmationRef.current = { action: 'submit-form' };
          const confirmPrompt = isTamil
            ? 'உங்கள் பதிவு சமர்ப்பிக்க தயாராக உள்ளது. இதை நான் சமர்ப்பிக்கட்டுமா?'
            : 'Your request is ready to be submitted. Would you like me to submit it?';
          speakText(confirmPrompt, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
          return;
        }

        if (cmd.action === 'download-document') {
          const res = triggerDocumentDownload();
          const dlText = isTamil ? res.messageTa : res.messageEn;
          speakText(dlText, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
          return;
        }

        if (cmd.action === 'toggle-new') {
          const toggled = toggleNewItemForm();
          if (toggled) {
            const toggleText = isTamil ? 'படிவம் திறக்கப்படுகிறது.' : 'Opening form.';
            speakText(toggleText, sessionId, () => {
              isProcessingRef.current = false;
              if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
                startListeningRef.current?.(sessionId);
              }
            });
            return;
          }
          // Fallback: if not already on form page, navigate to dashboard booking
          navigate('/dashboard/booking');
          const navText = isTamil ? 'திருப்பலி முன்பதிவு பக்கத்தை திறக்கிறேன்.' : 'Opening Book a Mass.';
          speakText(navText, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
          return;
        }
      }

      // 3. Ambiguity Check (Asks clarifying question e.g. "Open documents")
      if (cmd && cmd.type === 'AMBIGUOUS') {
        log('AMBIGUITY_DETECTED', cmd.clarificationType);
        pendingClarificationRef.current = cmd.clarificationType;
        const clarifyMsg = isTamil ? cmd.clarifyPromptTa : cmd.clarifyPromptEn;

        speakText(clarifyMsg, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      // 4. Specific Navigation & Reading Intent
      if (cmd && (cmd.type === 'NAVIGATION' || cmd.type === 'READ_CURRENT')) {
        executeNavigationIntent(cmd, sessionId, isTamil);
        return;
      }

      // 5. Unclear Speech (Section 25)
      if (cmd && cmd.type === 'UNCLEAR') {
        log('UNCLEAR_SPEECH_DETECTED', clean);
        const msg = isTamil ? cmd.messageTa : cmd.messageEn;
        speakText(msg, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      // 6. Irrelevant / Unsupported Speech (Section 24)
      if (cmd && cmd.type === 'UNSUPPORTED') {
        log('UNSUPPORTED_SPEECH_DETECTED', clean);
        const msg = isTamil ? cmd.messageTa : cmd.messageEn;
        speakText(msg, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      // 7. Generic Unrecognized Fallback
      log('UNRECOGNIZED_COMMAND', clean);
      const helpMsg = getContextAwareHelp(locationRef.current, isTamil);

      speakText(helpMsg, sessionId, () => {
        isProcessingRef.current = false;
        if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
          startListeningRef.current?.(sessionId);
        }
      });
    },
    [cancelSpeech, dismiss, log, navigate, speakText]
  );

  /**
   * Subroutine: Execute Navigation or Read Intent
   */
  const executeNavigationIntent = useCallback(
    async (intent, sessionId, isTamil) => {
      if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;

      log('EXECUTE_NAVIGATION_INTENT', intent);
      setDestination(intent);

      // Generic read current page command
      if (intent.type === 'READ_CURRENT') {
        const content = await readTargetContent('current', isTamil);
        speakText(content, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      // Check Protected Route for unauthenticated user
      if (intent.requiresAuth && !isAuthRef.current) {
        const authNotice = isTamil
          ? `${intent.labelTa} பக்கத்திற்கு உள்நுழைவு தேவை. உள்நுழைவு பக்கத்தை திறக்கிறேன்.`
          : `${intent.labelEn} requires you to sign in. Opening the Login page.`;

        speakText(authNotice, sessionId, () => {
          navigate('/login');
          isProcessingRef.current = false;
          setTimeout(() => {
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          }, 500);
        });
        return;
      }

      const isCurrentlyHere = matchesRoute(locationRef.current, intent.route);
      const shouldRead = intent.shouldRead || (intent.readTarget && isReadCommand(transcript));

      const performRead = async (target) => {
        log('PERFORMING_PAGE_READ', target);
        const content = await readTargetContent(target, isTamil);
        if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
          speakText(content, sessionId, () => {
            isProcessingRef.current = false;
            if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
              startListeningRef.current?.(sessionId);
            }
          });
        }
      };

      // If user is already on the requested page:
      if (isCurrentlyHere) {
        if (shouldRead && intent.readTarget) {
          await performRead(intent.readTarget);
          return;
        }

        // Same-page confirmation
        const alreadyHere = isTamil
          ? `நீங்கள் ஏற்கனவே ${intent.labelTa} பக்கத்தில் உள்ளீர்கள்.`
          : `You are already on the ${intent.labelEn} page.`;

        speakText(alreadyHere, sessionId, () => {
          isProcessingRef.current = false;
          if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
            startListeningRef.current?.(sessionId);
          }
        });
        return;
      }

      // Standard navigation: speak natural confirmation, navigate, then arrival message
      const confirmPhrase = isTamil
        ? intent.confirmTa || `${intent.labelTa} பக்கத்தை திறக்கிறேன்.`
        : intent.confirmEn || `Opening the ${intent.labelEn} page.`;

      speakText(confirmPhrase, sessionId, async () => {
        if (sessionId !== sessionIdRef.current || !isContinuousActiveRef.current) return;

        try {
          navigate(intent.route);
        } catch (e) {
          log('NAVIGATION_ERROR', e);
        }

        if (shouldRead && intent.readTarget) {
          setTimeout(async () => {
            await performRead(intent.readTarget);
          }, 400);
        } else {
          // Two-Phase Spoken Navigation: Arrival confirmation message once page mounted
          setTimeout(() => {
            if (sessionId !== sessionIdRef.current || !isContinuousActiveRef.current) return;
            const arrivalMsg = getArrivalConfirmation(intent.id || intent.intentId, isTamil);
            speakText(arrivalMsg, sessionId, () => {
              isProcessingRef.current = false;
              if (sessionId === sessionIdRef.current && isContinuousActiveRef.current) {
                startListeningRef.current?.(sessionId);
              }
            });
          }, 500);
        }
      });
    },
    [log, navigate, speakText, transcript]
  );

  processTranscriptRef.current = processTranscript;

  // ── Enter Wake / Activate Assistant ────────────────────────────────────────

  const activate = useCallback(
    async (initialCommand = '', explicitUserName = '') => {
      safeAbortWakeWord();
      hasMicPermissionRef.current = true;
      const currentSessionId = ++sessionIdRef.current;
      isContinuousActiveRef.current = true;
      pendingClarificationRef.current = null;
      log('HEY_CONNECT_ACTIVATED', { initialCommand, explicitUserName });

      // Unlock mobile browser speech synthesis on direct user interaction
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch {}
      }

      cancelSpeech();
      safeAbortRecognition();
      stopAudioAnalyser();

      isProcessingRef.current = false;
      setErrorMessage('');
      setDestination(null);

      // Verify browser speech recognition support
      if (!isSpeechAPISupported()) {
        const unsupportedMsg = isTamilLang()
          ? 'மன்னிக்கவும், இந்த உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை. தயவுசெய்து ஆதரிக்கப்படும் உலாவியைப் பயன்படுத்தவும் அல்லது உங்கள் கோரிக்கையை தட்டச்சு செய்யவும்.'
          : 'Sorry, voice recognition is not supported in this browser. Please use a supported browser or type your request.';
        setErrorMessage(unsupportedMsg);
        transitionTo(VA_STATE.ERROR, currentSessionId);
        speakText(unsupportedMsg, currentSessionId, () => {
          setTimeout(() => {
            if (currentSessionId === sessionIdRef.current) dismiss(true);
          }, 4500);
        });
        return;
      }

      // If an initial direct command was passed
      const cleanCmd = stripWakePhrase(initialCommand);
      if (cleanCmd) {
        setTranscript(cleanCmd);
        transitionTo(VA_STATE.PROCESSING, currentSessionId);
        setTimeout(() => {
          if (currentSessionId === sessionIdRef.current) {
            processTranscriptRef.current?.(cleanCmd, currentSessionId);
          }
        }, 150);
        return;
      }

      // Standard activation greeting with personalized user name
      const candidateName = explicitUserName ? toPronounceableName(explicitUserName) : getUserDisplayName();
      const isGeneric = /^(parish\s*(admin|administrator)|admin|administrator|user|guest)$/i.test(candidateName.trim());
      const userName = !isGeneric && candidateName ? candidateName : getUserDisplayName();
      const isTamil = isTamilLang();
      let greeting = '';
      if (userName) {
        greeting = isTamil
          ? `வணக்கம், ${userName}. நான் Connect. எப்படி உதவட்டுமா?`
          : `Hello, ${userName}. I'm Connect. How can I help you?`;
      } else {
        greeting = isTamil
          ? 'வணக்கம். நான் Connect. எப்படி உதவட்டுமா?'
          : "Hello. I'm Connect. How can I help you?";
      }

      speakText(greeting, currentSessionId, () => {
        if (currentSessionId === sessionIdRef.current && isContinuousActiveRef.current) {
          startListeningRef.current?.(currentSessionId);
        }
      });
    },
    [cancelSpeech, dismiss, getUserDisplayName, log, safeAbortRecognition, safeAbortWakeWord, speakText, stopAudioAnalyser, transitionTo]
  );

  activateRef.current = activate;

  // ── Mount & Global Window Binding ──────────────────────────────────────────

  useEffect(() => {
    isUnmountedRef.current = false;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices?.();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices?.();
      };
      window.speechSynthesis.addEventListener?.('voiceschanged', onVoicesChanged);
    }

    const handleActivateEvent = (e) => {
      const initialText = e?.detail?.command || '';
      const explicitName = e?.detail?.userName || '';
      activate(initialText, explicitName);
    };
    window.addEventListener('hey-connect-activate', handleActivateEvent);

    // Global testing helper: window.heyConnect("book a mass")
    window.heyConnect = (cmd, explicitName) => {
      if (cmd && typeof cmd === 'string') {
        activate(cmd, explicitName || '');
      } else {
        activate('', explicitName || '');
      }
    };

    // Check microphone permission and start passive wake-word listener (desktop only)
    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobileDevice && typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' })
        .then((status) => {
          if (status.state === 'granted') {
            hasMicPermissionRef.current = true;
            startWakeWordListening();
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              hasMicPermissionRef.current = true;
              if (stateRef.current === VA_STATE.IDLE) {
                startWakeWordListening();
              }
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      isUnmountedRef.current = true;
      isContinuousActiveRef.current = false;
      sessionIdRef.current++;
      clearTimeout(recognitionRestartTimerRef.current);
      safeAbortWakeWord();
      cancelSpeech();
      stopAudioAnalyser();
      safeAbortRecognition();
      window.removeEventListener('hey-connect-activate', handleActivateEvent);
      delete window.heyConnect;
    };
  }, [activate, cancelSpeech, safeAbortRecognition, safeAbortWakeWord, startWakeWordListening, stopAudioAnalyser]);

  return {
    state,
    transcript,
    spokenText,
    destination,
    audioLevel,
    isSpeaking,
    errorMessage,
    isSupported,
    activate,
    dismiss,
  };
}
