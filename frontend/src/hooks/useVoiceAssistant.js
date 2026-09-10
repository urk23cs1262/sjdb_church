/**
 * useVoiceAssistant.js  v5 — Complete, Robust "Hey Connect" Voice Navigation Hook
 *
 * Requirements fulfilled:
 *   1. Wake word ("Hey Connect") or Navbar Mic button activation
 *   2. Instant, clean listening without overlapping speech synthesis
 *   3. Compact bottom-center UI (website completely visible behind)
 *   4. Soft audio chime on listening activation
 *   5. Real-time transcript display + responsive waveform
 *   6. Robust speech recognition with retry on brief pauses (no-speech)
 *   7. Centralized natural language intent resolver (voice_intent_map.js) for all 28+ routes
 *   8. Connect speaks: "Going to [Page Name]" fully and clearly without getting cut off
 *   9. Navigates smoothly to requested page via router
 *  10. Disappears and slides down smoothly after page opens and speech finishes
 *  11. Window testing helper `window.heyConnect("show mass timings")`
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/context_auth_context';
import {
  resolveIntent,
  resolveControl,
  isAffirmative,
  isNegative,
  CONFIDENCE_THRESHOLD,
  matchesRoute,
} from '../services/voice_intent_map';

// ─── Constants ────────────────────────────────────────────────────────────────

const WAKE_PHRASES = ['hey connect', 'hey, connect', 'hey connected', 'connect', 'ஹே கனெக்ட்'];
const COMMAND_TIMEOUT_MS = 8500;
const WAKE_DEBOUNCE_MS = 1500;

export const VA_STATE = {
  IDLE: 'idle',
  WAKE: 'wake',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  NAVIGATING: 'navigating',
};

// ─── Utilities ────────────────────────────────────────────────────────────────

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

/**
 * Select a crisp, energetic, loud, and pleasant lady/female voice.
 * Prioritizes modern neural voices (Jenny, Aria), followed by standard
 * high-quality female voices (Zira, Samantha, Google Female).
 */
function findCatchyLadyVoice(lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (voices.length === 0) return null;

  const isTamil = lang === 'ta-IN' || lang === 'ta';

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
    'sara'
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
  const { isAuthenticated } = useAuth();

  const [state, setState] = useState(VA_STATE.IDLE);
  const [transcript, setTranscript] = useState('');
  const [destination, setDestination] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(isSpeechAPISupported);

  // Stable references
  const stateRef = useRef(VA_STATE.IDLE);
  const isAuthRef = useRef(isAuthenticated);
  const recognitionRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const wakeDebounceRef = useRef(false);
  const isListeningLockRef = useRef(false);
  const isProcessingRef = useRef(false);
  const speechFinishedRef = useRef(false);
  const routeChangedRef = useRef(false);
  const commandTimerRef = useRef(null);
  const navTimerRef = useRef(null);
  const interimTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(null);
  const isUnmountedRef = useRef(false);
  const prevPathRef = useRef(location.pathname);
  const pendingClarificationRef = useRef(null);
  const intendedRouteRef = useRef(null);
  const latestTranscriptRef = useRef('');

  // Circular references
  const startCommandRecognitionRef = useRef(null);
  const processTranscriptRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // ── Dismiss Voice Assistant & Return Website to Normal ─────────────────────

  const cancelSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    currentUtteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const dismiss = useCallback(() => {
    isListeningLockRef.current = false;
    isProcessingRef.current = false;
    speechFinishedRef.current = false;
    routeChangedRef.current = false;
    pendingClarificationRef.current = null;
    intendedRouteRef.current = null;
    latestTranscriptRef.current = '';

    clearTimeout(commandTimerRef.current);
    clearTimeout(navTimerRef.current);
    clearTimeout(interimTimerRef.current);
    stopAudioAnalyser();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    if (!isUnmountedRef.current) {
      setState(VA_STATE.IDLE);
      setTranscript('');
      setDestination(null);
    }
  }, [stopAudioAnalyser]);

  // ── Auto-dismiss once route changed AND confirmation speech completed ──────

  const checkCompletionAndDismiss = useCallback(() => {
    // If navigation has completed and speech has finished, close the assistant
    if (stateRef.current === VA_STATE.NAVIGATING && routeChangedRef.current && speechFinishedRef.current) {
      const timer = setTimeout(() => {
        if (!isUnmountedRef.current) dismiss();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [dismiss]);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (stateRef.current === VA_STATE.NAVIGATING) {
        const intended = intendedRouteRef.current;
        const current = location.pathname;
        const isMatched = matchesRoute(current, intended);

        if (isMatched) {
          routeChangedRef.current = true;
          // IMPORTANT: Do NOT cancel speech synthesis here!
          // Allow "Going to [Page]" to be heard completely.
          // If speech already finished, dismiss now. Otherwise, speech onend will dismiss.
          if (speechFinishedRef.current) {
            const timer = setTimeout(() => {
              if (!isUnmountedRef.current) dismiss();
            }, 300);
            return () => clearTimeout(timer);
          }
        } else {
          // Route changed to unexpected or 404 destination
          const failText = isTamilLang()
            ? 'மன்னிக்கவும், அந்த பக்கத்தை திறக்க முடியவில்லை.'
            : "Sorry, I couldn't open that page.";
          speakText(failText, () => {
            if (!isUnmountedRef.current) dismiss();
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── Text-to-Speech (with Voice Matching & Queue Unfreeze) ───────────────────

  const speakText = useCallback((text, onEnd = null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.();
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch {}

    const utt = new SpeechSynthesisUtterance(text);
    const lang = detectLang();
    utt.lang = lang;
    utt.volume = 1.0; // Maximum loudness
    utt.pitch = 1.15; // Bright, pleasant, feminine pitch
    utt.rate = 1.02;  // Catchy, energetic, engaging delivery

    // Select nice catchy lady voice
    const ladyVoice = findCatchyLadyVoice(lang);
    if (ladyVoice) {
      utt.voice = ladyVoice;
    }

    currentUtteranceRef.current = utt; // Protect from Chrome GC bug
    setIsSpeaking(true);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (!isUnmountedRef.current) setIsSpeaking(false);
      currentUtteranceRef.current = null;
      onEnd?.();
    };

    utt.onend = finish;
    utt.onerror = finish;

    // Safety fallback timer so state machine never hangs waiting for onend
    const safetyMs = Math.max(1400, Math.min(5000, text.length * 85 + 600));
    setTimeout(() => {
      if (!finished) finish();
    }, safetyMs);

    try {
      window.speechSynthesis.speak(utt);
    } catch {
      finish();
    }
  }, []);

  // ── Audio Waveform Analyser ────────────────────────────────────────────────

  const startAudioAnalyser = useCallback(async () => {
    try {
      if (micStreamRef.current || !navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (isUnmountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (isUnmountedRef.current || !analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const mid = dataArray.slice(4, 60);
        const avg = mid.reduce((s, v) => s + v, 0) / mid.length;
        setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Mic permission not granted or stream unavailable
    }
  }, []);

  // ── Web Speech Recognition Factory ─────────────────────────────────────────

  const buildRecognition = useCallback((lang, continuous, interimResults) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = lang;
    r.continuous = continuous;
    r.interimResults = interimResults;
    r.maxAlternatives = 1;
    return r;
  }, []);

  // ── Control Command Actions ────────────────────────────────────────────────

  const executeControl = useCallback(
    (action, route) => {
      switch (action) {
        case 'back':
          window.history.back();
          break;
        case 'home':
          navigate('/');
          break;
        case 'scroll-down':
          window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
          break;
        case 'scroll-up':
          window.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' });
          break;
        default:
          if (route) navigate(route);
      }
    },
    [navigate]
  );

  // ── Process Spoken Command & Perform Navigation ────────────────────────────

  const processTranscript = useCallback(
    (raw) => {
      if (isUnmountedRef.current || isProcessingRef.current) return;
      isProcessingRef.current = true;
      isListeningLockRef.current = false;
      clearTimeout(commandTimerRef.current);
      clearTimeout(interimTimerRef.current);

      const isTamil = isTamilLang();

      // Stop recognition while processing
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      // ── Sub-routine: Execute Navigation with Spoken Confirmation & Clean Close
      const executeNavigation = (targetIntent) => {
        const destLabel = isTamil ? targetIntent.labelTa : targetIntent.labelEn;

        // Protected route when user is NOT logged in
        if (targetIntent.requiresAuth && !isAuthRef.current) {
          const authText = isTamil
            ? `${destLabel} பக்கத்திற்கு உள்நுழைவு தேவை. உள்நுழைவு பக்கத்திற்கு செல்கிறேன்.`
            : `${destLabel} requires you to sign in. Going to Login.`;

          intendedRouteRef.current = '/login';
          setDestination({ id: 'LOGIN', route: '/login', labelEn: 'Login', labelTa: 'உள்நுழைவு' });
          setState(VA_STATE.NAVIGATING);
          stopAudioAnalyser();

          speakText(authText, () => {
            speechFinishedRef.current = true;
            checkCompletionAndDismiss();
          });

          setTimeout(() => {
            if (!isUnmountedRef.current) navigate('/login');
          }, 400);
          return;
        }

        // Target navigation phrase: "Going to {users asked page}."
        const navText = isTamil
          ? `${destLabel} பக்கத்திற்கு செல்கிறேன்.`
          : `Going to ${destLabel}.`;

        intendedRouteRef.current = targetIntent.route;
        setDestination(targetIntent);
        setState(VA_STATE.NAVIGATING);
        stopAudioAnalyser();

        speechFinishedRef.current = false;
        routeChangedRef.current = false;

        // If user is already on destination page, smoothly scroll to top
        if (location.pathname === targetIntent.route) {
          routeChangedRef.current = true;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Speak the requested confirmation: "Going to [Page Name]."
        speakText(navText, () => {
          speechFinishedRef.current = true;
          // Once speech finishes, if route has already changed (or was current), dismiss smoothly
          if (routeChangedRef.current) {
            const timer = setTimeout(() => {
              if (!isUnmountedRef.current) dismiss();
            }, 350);
            return () => clearTimeout(timer);
          }
        });

        // Trigger router navigation smoothly while confirmation starts speaking
        navTimerRef.current = setTimeout(() => {
          if (isUnmountedRef.current) return;
          try {
            if (location.pathname !== targetIntent.route) {
              navigate(targetIntent.route);
            }
          } catch {
            const failText = isTamil
              ? 'மன்னிக்கவும், அந்த பக்கத்தை திறக்க முடியவில்லை.'
              : "Sorry, I couldn't open that page.";
            speakText(failText, () => dismiss());
            return;
          }

          // Safety fallback: ensure dismiss occurs within 3.5s even on slow devices
          setTimeout(() => {
            if (!isUnmountedRef.current && stateRef.current === VA_STATE.NAVIGATING) {
              dismiss();
            }
          }, 3500);
        }, 200);
      };

      // ── 1. Check for Pending Clarification Response ("Yes", "No", or new phrase)
      if (pendingClarificationRef.current) {
        const pending = pendingClarificationRef.current;
        if (isAffirmative(raw)) {
          pendingClarificationRef.current = null;
          executeNavigation(pending);
          return;
        }
        if (isNegative(raw)) {
          pendingClarificationRef.current = null;
          const cancelText = isTamil ? 'சரி.' : 'Alright.';
          speakText(cancelText, () => dismiss());
          return;
        }
        pendingClarificationRef.current = null;
      }

      // ── 2. Check for Control Command (back, home, scroll, close)
      const control = resolveControl(raw);
      if (control) {
        if (control.action === 'close') {
          dismiss();
          return;
        }

        const ctrlText = isTamil ? control.labelTa || control.labelEn : control.labelEn;
        setState(VA_STATE.NAVIGATING);
        stopAudioAnalyser();

        speakText(ctrlText, () => {
          speechFinishedRef.current = true;
          setTimeout(() => {
            if (!isUnmountedRef.current) dismiss();
          }, 300);
        });

        setTimeout(() => {
          if (isUnmountedRef.current) return;
          executeControl(control.action, control.route);
        }, 200);
        return;
      }

      // ── 3. Resolve Navigation Intent with Confidence Scoring
      const intent = resolveIntent(raw);

      // ── 3a. Ambiguous, Low-Confidence, or Informational Inquiries
      if (
        intent &&
        (intent.needsClarification ||
          intent.confidence < CONFIDENCE_THRESHOLD ||
          intent.isAmbiguous)
      ) {
        if (intent.id && intent.id !== 'AMBIGUOUS') {
          pendingClarificationRef.current = intent;
        } else {
          pendingClarificationRef.current = null;
        }

        const clarifyText = isTamil
          ? intent.clarifyPromptTa || 'எந்த பக்கத்திற்கு செல்ல வேண்டும்?'
          : intent.clarifyPromptEn || 'Which page would you like me to open?';

        setTranscript(raw);
        isProcessingRef.current = false;
        speakText(clarifyText, () => {
          if (isUnmountedRef.current) return;
          startCommandRecognitionRef.current?.();
        });
        return;
      }

      // ── 3b. Confident Navigation Intent
      if (intent && !intent.needsClarification && intent.confidence >= CONFIDENCE_THRESHOLD) {
        pendingClarificationRef.current = null;
        executeNavigation(intent);
        return;
      }

      // ── 3c. Unclear / Unknown request — guide user and re-listen
      const unknownText = isTamil
        ? 'மன்னிக்கவும், புரியவில்லை. திருப்பலி நேரம், நிகழ்வுகள், வாசகங்கள் அல்லது அறிவிப்புகள் என்று கேளுங்கள்.'
        : "I'm not sure which page you mean. Try asking for Mass Timings, Events, Daily Readings, or Announcements.";

      isProcessingRef.current = false;
      speakText(unknownText, () => {
        if (isUnmountedRef.current) return;
        startCommandRecognitionRef.current?.();
      });
    },
    [checkCompletionAndDismiss, dismiss, executeControl, navigate, speakText, stopAudioAnalyser]
  );

  processTranscriptRef.current = processTranscript;

  // ── Start Command Recognition (Listening State) ─────────────────────────────

  const startCommandRecognition = useCallback(() => {
    if (isUnmountedRef.current || isListeningLockRef.current) return;
    isListeningLockRef.current = true;
    isProcessingRef.current = false;
    latestTranscriptRef.current = '';

    setState(VA_STATE.LISTENING);
    setTranscript('');
    startAudioAnalyser();

    const lang = detectLang();
    let r = null;
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      r = buildRecognition(lang, false, true);
    } catch {
      dismiss();
      return;
    }

    if (!r) {
      dismiss();
      return;
    }
    recognitionRef.current = r;

    // Command timeout: dismiss if user stays silent across full period
    clearTimeout(commandTimerRef.current);
    commandTimerRef.current = setTimeout(() => {
      if (stateRef.current === VA_STATE.LISTENING) {
        if (latestTranscriptRef.current.trim()) {
          processTranscript(latestTranscriptRef.current);
        } else {
          dismiss();
        }
      }
    }, COMMAND_TIMEOUT_MS);

    r.onresult = (e) => {
      cancelSpeech();

      const results = Array.from(e.results);
      const raw = results.map((res) => res[0].transcript).join(' ');
      latestTranscriptRef.current = raw;
      setTranscript(raw);

      const isFinal = results[results.length - 1].isFinal;

      // When speech API marks final utterance, process immediately
      if (isFinal && raw.trim()) {
        clearTimeout(interimTimerRef.current);
        clearTimeout(commandTimerRef.current);
        setState(VA_STATE.PROCESSING);
        setTimeout(() => processTranscript(raw), 150);
        return;
      }

      // Fast-track: if user's interim speech confidently matches an intent or control command,
      // trigger processing after a short pause (500ms) without waiting for Chrome finalization
      clearTimeout(interimTimerRef.current);
      interimTimerRef.current = setTimeout(() => {
        if (stateRef.current === VA_STATE.LISTENING && raw.trim()) {
          const matchedIntent = resolveIntent(raw);
          const matchedCtrl = resolveControl(raw);
          if (
            matchedCtrl ||
            (matchedIntent &&
              !matchedIntent.needsClarification &&
              matchedIntent.confidence >= CONFIDENCE_THRESHOLD)
          ) {
            clearTimeout(commandTimerRef.current);
            try { r.stop(); } catch {}
            setState(VA_STATE.PROCESSING);
            setTimeout(() => processTranscript(raw), 150);
          }
        }
      }, 500);
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech') {
        // Do NOT immediately dismiss on brief pause.
        // If command timeout has not elapsed and assistant is still listening, allow user to continue speaking.
        return;
      }
      if (e.error === 'not-allowed') {
        setTranscript(
          isTamilLang()
            ? 'மைக் அனுமதி மறுக்கப்பட்டுள்ளது.'
            : 'Microphone permission blocked.'
        );
        setTimeout(() => dismiss(), 2500);
        return;
      }
      if (e.error === 'aborted') {
        // Intentionally aborted during state transition
        return;
      }
      dismiss();
    };

    r.onend = () => {
      isListeningLockRef.current = false;
      // If recognition ended and user spoke something valid, process it
      if (stateRef.current === VA_STATE.LISTENING) {
        if (latestTranscriptRef.current.trim() && !isProcessingRef.current) {
          setState(VA_STATE.PROCESSING);
          setTimeout(() => processTranscript(latestTranscriptRef.current), 150);
        } else if (!isProcessingRef.current) {
          // If silent and recognition ended, restart recognition until command timeout fires
          setTimeout(() => {
            if (stateRef.current === VA_STATE.LISTENING && !isProcessingRef.current) {
              startCommandRecognition();
            }
          }, 200);
        }
      }
    };

    try {
      r.start();
    } catch {
      isListeningLockRef.current = false;
      dismiss();
    }
  }, [buildRecognition, cancelSpeech, dismiss, processTranscript, startAudioAnalyser]);

  startCommandRecognitionRef.current = startCommandRecognition;

  // ── Enter Wake / Listening State ───────────────────────────────────────────

  const enterWake = useCallback(
    (immediateCommand = '') => {
      if (wakeDebounceRef.current) return;
      wakeDebounceRef.current = true;
      setTimeout(() => {
        wakeDebounceRef.current = false;
      }, WAKE_DEBOUNCE_MS);

      // Cancel any ongoing speech or recognition
      cancelSpeech();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }

      // Check if a command was spoken directly with wake word ("Hey Connect show mass timings")
      if (immediateCommand && immediateCommand.trim()) {
        setTranscript(immediateCommand);
        setState(VA_STATE.PROCESSING);
        setTimeout(() => processTranscriptRef.current?.(immediateCommand), 200);
        return;
      }

      // Step 1: Connect greets in WAKE state: "Hello! I'm Connect. How can I help you?"
      setState(VA_STATE.WAKE);
      setTranscript('');

      const greeting = isTamilLang()
        ? 'வணக்கம்! நான் Connect. எப்படி உதவட்டுமா?'
        : "Hello! I'm Connect. How can I help you?";

      let hasTransitioned = false;
      const proceedToListening = () => {
        if (hasTransitioned || isUnmountedRef.current) return;
        hasTransitioned = true;
        if (stateRef.current === VA_STATE.WAKE) {
          // Step 2: Transition to LISTENING and listen for user command
          startCommandRecognitionRef.current?.();
        }
      };

      // Speak greeting in catchy lady voice, then start listening on completion
      speakText(greeting, () => {
        proceedToListening();
      });

      // Safety fallback timer: automatically transition to listening if speech onend is delayed
      setTimeout(() => {
        proceedToListening();
      }, 2600);
    },
    [cancelSpeech, speakText]
  );

  // ── Manual Activate (Navbar Mic Button) ────────────────────────────────────

  const activate = useCallback(() => {
    if (stateRef.current !== VA_STATE.IDLE) return;
    enterWake();
  }, [enterWake]);

  // ── Mount / Unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    isUnmountedRef.current = false;

    // Preload and cache speech synthesis voices immediately
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices?.();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices?.();
      };
      window.speechSynthesis.addEventListener?.('voiceschanged', onVoicesChanged);
    }

    const handleActivate = () => activate();
    window.addEventListener('hey-connect-activate', handleActivate);

    // Global console testing helper: window.heyConnect("show mass timings")
    window.heyConnect = (commandText) => {
      if (commandText && typeof commandText === 'string') {
        activate();
        setTimeout(() => {
          setTranscript(commandText);
          setState(VA_STATE.PROCESSING);
          setTimeout(() => processTranscriptRef.current?.(commandText), 200);
        }, 300);
      } else {
        activate();
      }
    };

    return () => {
      isUnmountedRef.current = true;
      isListeningLockRef.current = false;
      isProcessingRef.current = false;
      clearTimeout(commandTimerRef.current);
      clearTimeout(navTimerRef.current);
      clearTimeout(interimTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cancelSpeech();
      stopAudioAnalyser();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
      window.removeEventListener('hey-connect-activate', handleActivate);
      delete window.heyConnect;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    transcript,
    destination,
    audioLevel,
    isSpeaking,
    isSupported,
    activate,
    dismiss,
  };
}
