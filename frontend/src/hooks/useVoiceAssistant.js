/**
 * useVoiceAssistant.js — Production-Hardened Voice Assistant Hook (v6)
 *
 * Designed specifically to eliminate intermittent production failures:
 * 1. Single Authoritative State Machine (IDLE, ACTIVATING, WAKE, LISTENING, PROCESSING, CLARIFYING, NAVIGATING, CLOSING, ERROR)
 * 2. Session ID Stale-Callback Immunity (Every activation gets a new sessionId; stale callbacks are ignored)
 * 3. Safe, Idempotent Recognition Lifecycle (safeStartRecognition, safeStopRecognition, safeAbortRecognition)
 * 4. Zero TTS <-> Microphone Conflict (Mic is suspended during TTS; TTS is flushed and buffered before mic opens)
 * 5. Full Interruption Support (User speech or tap cancels TTS and transitions straight to LISTENING)
 * 6. One-Step & Two-Step Wake Handling ("Hey Connect" or "Hey Connect show mass timings")
 * 7. Atomic Navigation with Strict Route-Boundary Verification (matchesRoute)
 * 8. Same-Page Navigation Handling ("You are already on the [Page Name] page.")
 * 9. Idempotent Microphone, AudioContext & Timer Cleanup
 * 10. Structured Production Debug Logging ([Connect][session:N])
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

// ─── Authoritative States ──────────────────────────────────────────────────────

export const VA_STATE = {
  IDLE: 'idle',
  ACTIVATING: 'activating',
  WAKE: 'wake',
  GREETING: 'wake', // Backwards-compatible alias for common_voice_orb
  LISTENING: 'listening',
  PROCESSING: 'processing',
  CLARIFYING: 'clarifying',
  NAVIGATING: 'navigating',
  CLOSING: 'closing',
  ERROR: 'error'
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WAKE_PHRASES = ['hey connect', 'hey, connect', 'hey connected', 'connect', 'ஹே கனெக்ட்'];
const COMMAND_TIMEOUT_MS = 9000;
const WAKE_DEBOUNCE_MS = 1200;
const MAX_ONEND_RESTARTS = 4;

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
 * Select a crisp, energetic, pleasant female voice across all browsers/platforms.
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

  const enVoices = voices.filter(
    (v) =>
      v.lang.startsWith('en') ||
      v.lang.includes('US') ||
      v.lang.includes('GB') ||
      v.lang.includes('IN')
  );

  const preferredFemaleKeywords = [
    'jenny', 'aria', 'zira', 'samantha', 'victoria', 'karen',
    'neerja', 'heera', 'female', 'ava', 'emma', 'sara'
  ];

  for (const kw of preferredFemaleKeywords) {
    const found = enVoices.find((v) => v.name.toLowerCase().includes(kw));
    if (found) return found;
  }

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

  // ── Session & State Machine Refs ───────────────────────────────────────────
  const sessionIdRef = useRef(0);
  const stateRef = useRef(VA_STATE.IDLE);
  const isAuthRef = useRef(isAuthenticated);
  const isUnmountedRef = useRef(false);

  // Recognition state tracking (strictly prevents duplicate sessions)
  const recognitionRef = useRef(null);
  const isRecognitionActiveRef = useRef(false);
  const isStartingRecognitionRef = useRef(false);
  const isStoppingRecognitionRef = useRef(false);
  const restartCountRef = useRef(0);

  // Processing & Navigation locks
  const isProcessingRef = useRef(false);
  const isNavigatingRef = useRef(false);
  const speechFinishedRef = useRef(false);
  const routeVerifiedRef = useRef(false);
  const intendedRouteRef = useRef(null);
  const pendingClarificationRef = useRef(null);
  const latestTranscriptRef = useRef('');
  const wakeDebounceRef = useRef(false);

  // Timers
  const commandTimerRef = useRef(null);
  const navTimerRef = useRef(null);
  const interimTimerRef = useRef(null);
  const ttsSafetyTimerRef = useRef(null);

  // Audio Analyser & Mic
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafRef = useRef(null);
  const currentUtteranceRef = useRef(null);

  // Dynamic references to break circular dependencies
  const startCommandRecognitionRef = useRef(null);
  const processTranscriptRef = useRef(null);

  // Synchronize state and auth refs immediately
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    isAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // ── Production Logging Helper ──────────────────────────────────────────────
  const log = useCallback((event, data = '') => {
    if (process.env.NODE_ENV !== 'production' || window.__DEBUG_HEY_CONNECT__) {
      console.log(`[Connect][session:${sessionIdRef.current}] ${event}`, data);
    }
  }, []);

  // ── Safe State Transition Helper ───────────────────────────────────────────
  const transitionTo = useCallback((nextState, sessionId = null) => {
    if (sessionId !== null && sessionId !== sessionIdRef.current) return false;
    if (isUnmountedRef.current) return false;

    const current = stateRef.current;
    if (current === nextState) return true;

    // Disallow illegal transitions from closing/navigating back to listening
    if (current === VA_STATE.NAVIGATING && nextState === VA_STATE.LISTENING) return false;
    if (current === VA_STATE.CLOSING && nextState !== VA_STATE.IDLE) return false;

    log('STATE_TRANSITION', `${current} -> ${nextState}`);
    stateRef.current = nextState;
    setState(nextState);
    return true;
  }, [log]);

  // ── Audio Analyser & Mic Stream Management ─────────────────────────────────

  const stopAudioAnalyser = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
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

  const startAudioAnalyser = useCallback(async (sessionId) => {
    try {
      if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
      if (micStreamRef.current || !navigator.mediaDevices?.getUserMedia) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (sessionId !== sessionIdRef.current || isUnmountedRef.current) {
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
        if (sessionId !== sessionIdRef.current || isUnmountedRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const mid = dataArray.slice(4, 60);
        const avg = mid.reduce((s, v) => s + v, 0) / mid.length;
        setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext / Mic permission denied or unavailable
    }
  }, []);

  // ── Speech Synthesis (TTS) with Guaranteed Clean Release ───────────────────

  const cancelSpeech = useCallback(() => {
    clearTimeout(ttsSafetyTimerRef.current);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    currentUtteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback((text, sessionId, onEnd = null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.();
      return;
    }

    if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;

    cancelSpeech();

    const utt = new SpeechSynthesisUtterance(text);
    const lang = detectLang();
    utt.lang = lang;
    utt.volume = 1.0;
    utt.pitch = 1.15;
    utt.rate = 1.02;

    const ladyVoice = findCatchyLadyVoice(lang);
    if (ladyVoice) utt.voice = ladyVoice;

    currentUtteranceRef.current = utt;
    setIsSpeaking(true);
    log('TTS_START', text);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(ttsSafetyTimerRef.current);
      if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
        setIsSpeaking(false);
      }
      currentUtteranceRef.current = null;
      log('TTS_END', text);
      if (sessionId === sessionIdRef.current) {
        onEnd?.();
      }
    };

    utt.onend = finish;
    utt.onerror = finish;

    // Safety fallback timer so state machine never hangs waiting for onend
    const safetyMs = Math.max(1500, Math.min(6000, text.length * 85 + 700));
    ttsSafetyTimerRef.current = setTimeout(() => {
      if (!finished) finish();
    }, safetyMs);

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utt);
    } catch {
      finish();
    }
  }, [cancelSpeech, log]);

  // ── Safe, Idempotent Speech Recognition Lifecycle ──────────────────────────

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
    isStoppingRecognitionRef.current = false;
  }, [log]);

  const safeStopRecognition = useCallback(() => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      log('RECOGNITION_STOP');
      isStoppingRecognitionRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch {
        safeAbortRecognition();
      }
    }
  }, [log, safeAbortRecognition]);

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

  // ── Dismiss Voice Assistant Completely ─────────────────────────────────────

  const dismiss = useCallback(() => {
    log('CLEANUP_DISMISS');
    // Invalidate current session so any pending timers or callbacks die
    sessionIdRef.current++;

    clearTimeout(commandTimerRef.current);
    clearTimeout(navTimerRef.current);
    clearTimeout(interimTimerRef.current);
    clearTimeout(ttsSafetyTimerRef.current);

    cancelSpeech();
    safeAbortRecognition();
    stopAudioAnalyser();

    isProcessingRef.current = false;
    isNavigatingRef.current = false;
    speechFinishedRef.current = false;
    routeVerifiedRef.current = false;
    pendingClarificationRef.current = null;
    intendedRouteRef.current = null;
    latestTranscriptRef.current = '';
    restartCountRef.current = 0;

    if (!isUnmountedRef.current) {
      stateRef.current = VA_STATE.IDLE;
      setState(VA_STATE.IDLE);
      setTranscript('');
      setDestination(null);
    }
  }, [cancelSpeech, log, safeAbortRecognition, stopAudioAnalyser]);

  // ── Navigation Completion & Dismissal Check ────────────────────────────────

  const checkCompletionAndDismiss = useCallback((sessionId) => {
    if (sessionId !== sessionIdRef.current) return;
    if (
      stateRef.current === VA_STATE.NAVIGATING &&
      routeVerifiedRef.current &&
      speechFinishedRef.current
    ) {
      log('ROUTE_AND_SPEECH_COMPLETE_DISMISS');
      setTimeout(() => {
        if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
          dismiss();
        }
      }, 350);
    }
  }, [dismiss, log]);

  // ── Post-Navigation Route Verification (Route Change Listener) ─────────────

  useEffect(() => {
    if (stateRef.current === VA_STATE.NAVIGATING) {
      const intended = intendedRouteRef.current;
      const current = location.pathname;
      const isMatched = matchesRoute(current, intended);
      const sessionId = sessionIdRef.current;

      if (isMatched) {
        log('ROUTE_VERIFIED', `${current} matches ${intended}`);
        routeVerifiedRef.current = true;
        if (speechFinishedRef.current) {
          setTimeout(() => {
            if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
              dismiss();
            }
          }, 300);
        }
      }
    }
  }, [location.pathname, dismiss, log]);

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
    (raw, sessionId) => {
      if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
      if (isProcessingRef.current || isNavigatingRef.current) return;

      isProcessingRef.current = true;
      clearTimeout(commandTimerRef.current);
      clearTimeout(interimTimerRef.current);

      safeAbortRecognition();
      stopAudioAnalyser();

      const isTamil = isTamilLang();
      const cleanRaw = stripWakePhrase(raw);

      log('PROCESSING_COMMAND', { raw, cleanRaw });

      // ── Sub-routine: Execute Navigation with Spoken Confirmation & Verification
      const executeNavigation = (targetIntent) => {
        if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;

        isNavigatingRef.current = true;
        transitionTo(VA_STATE.NAVIGATING, sessionId);

        const destLabel = isTamil ? targetIntent.labelTa : targetIntent.labelEn;

        // 1. Check Protected Route for unauthenticated users
        if (targetIntent.requiresAuth && !isAuthRef.current) {
          const authText = isTamil
            ? `${destLabel} பக்கத்திற்கு உள்நுழைவு தேவை. உள்நுழைவு பக்கத்திற்கு செல்கிறேன்.`
            : `${destLabel} requires you to sign in. Going to Login.`;

          intendedRouteRef.current = '/login';
          setDestination({ id: 'LOGIN', route: '/login', labelEn: 'Login', labelTa: 'உள்நுழைவு' });

          speakText(authText, sessionId, () => {
            speechFinishedRef.current = true;
            checkCompletionAndDismiss(sessionId);
          });

          setTimeout(() => {
            if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
              navigate('/login');
            }
          }, 350);
          return;
        }

        // 2. Check Same-Page Navigation (User is already on the requested page)
        if (matchesRoute(location.pathname, targetIntent.route)) {
          log('SAME_PAGE_DETECTED', targetIntent.route);
          intendedRouteRef.current = targetIntent.route;
          setDestination(targetIntent);
          routeVerifiedRef.current = true;

          window.scrollTo({ top: 0, behavior: 'smooth' });

          const alreadyHereText = isTamil
            ? `நீங்கள் ஏற்கனவே ${destLabel} பக்கத்தில் உள்ளீர்கள்.`
            : `You are already on the ${destLabel} page.`;

          speakText(alreadyHereText, sessionId, () => {
            speechFinishedRef.current = true;
            setTimeout(() => {
              if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
                dismiss();
              }
            }, 400);
          });
          return;
        }

        // 3. Standard Navigation to requested page: "Going to [Page Name]."
        const navText = isTamil
          ? `${destLabel} பக்கத்திற்கு செல்கிறேன்.`
          : `Going to ${destLabel}.`;

        intendedRouteRef.current = targetIntent.route;
        setDestination(targetIntent);
        speechFinishedRef.current = false;
        routeVerifiedRef.current = false;

        log('NAVIGATION_START', { target: targetIntent.route, label: destLabel });

        // Speak destination confirmation
        speakText(navText, sessionId, () => {
          speechFinishedRef.current = true;
          log('NAVIGATION_SPEECH_FINISHED');
          if (routeVerifiedRef.current) {
            setTimeout(() => {
              if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
                dismiss();
              }
            }, 300);
          }
        });

        // Trigger route transition
        navTimerRef.current = setTimeout(() => {
          if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
          try {
            navigate(targetIntent.route);
          } catch {
            const failText = isTamil
              ? 'மன்னிக்கவும், அந்த பக்கத்தை திறக்க முடியவில்லை.'
              : "Sorry, I couldn't open that page.";
            speakText(failText, sessionId, () => dismiss());
            return;
          }

          // Safety timeout: dismiss if route navigation or confirmation gets stuck
          setTimeout(() => {
            if (sessionId === sessionIdRef.current && !isUnmountedRef.current && stateRef.current === VA_STATE.NAVIGATING) {
              const current = location.pathname;
              if (matchesRoute(current, intendedRouteRef.current)) {
                dismiss();
              } else {
                log('NAVIGATION_TIMEOUT_FALLBACK_DISMISS');
                dismiss();
              }
            }
          }, 3500);
        }, 150);
      };

      // ── Step A: Check for Pending Clarification Response ("Yes", "No", or page name)
      if (pendingClarificationRef.current) {
        const pending = pendingClarificationRef.current;
        if (isAffirmative(cleanRaw)) {
          pendingClarificationRef.current = null;
          executeNavigation(pending);
          return;
        }
        if (isNegative(cleanRaw)) {
          pendingClarificationRef.current = null;
          const cancelText = isTamil ? 'சரி.' : 'Alright.';
          speakText(cancelText, sessionId, () => dismiss());
          return;
        }
        pendingClarificationRef.current = null;
      }

      // ── Step B: Check for Control Command (back, home, scroll, close)
      const control = resolveControl(cleanRaw);
      if (control) {
        if (control.action === 'close') {
          dismiss();
          return;
        }

        const ctrlText = isTamil ? control.labelTa || control.labelEn : control.labelEn;
        transitionTo(VA_STATE.NAVIGATING, sessionId);

        speakText(ctrlText, sessionId, () => {
          setTimeout(() => {
            if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
              dismiss();
            }
          }, 300);
        });

        setTimeout(() => {
          if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
            executeControl(control.action, control.route);
          }
        }, 180);
        return;
      }

      // ── Step C: Resolve Navigation Intent with Confidence Check
      const intent = resolveIntent(cleanRaw);

      // Ambiguous / Low-Confidence Intent -> Clarify
      if (
        intent &&
        (intent.needsClarification ||
          intent.confidence < CONFIDENCE_THRESHOLD ||
          intent.isAmbiguous)
      ) {
        log('INTENT_NEEDS_CLARIFICATION', intent);
        if (intent.id && intent.id !== 'AMBIGUOUS') {
          pendingClarificationRef.current = intent;
        } else {
          pendingClarificationRef.current = null;
        }

        const clarifyText = isTamil
          ? intent.clarifyPromptTa || 'எந்த பக்கத்திற்கு செல்ல வேண்டும்?'
          : intent.clarifyPromptEn || 'Which page would you like me to open?';

        setTranscript(cleanRaw);
        isProcessingRef.current = false;
        transitionTo(VA_STATE.CLARIFYING, sessionId);

        speakText(clarifyText, sessionId, () => {
          if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
            startCommandRecognitionRef.current?.(sessionId);
          }
        });
        return;
      }

      // Confident Navigation Intent -> Execute
      if (intent && !intent.needsClarification && intent.confidence >= CONFIDENCE_THRESHOLD) {
        log('INTENT_RESOLVED_CONFIDENT', intent);
        pendingClarificationRef.current = null;
        executeNavigation(intent);
        return;
      }

      // Unrecognized Command -> Provide Helpful Prompt & Re-listen
      log('INTENT_UNRECOGNIZED', cleanRaw);
      const unknownText = isTamil
        ? 'மன்னிக்கவும், புரியவில்லை. திருப்பலி நேரம், நிகழ்வுகள், வாசகங்கள் அல்லது அறிவிப்புகள் என்று கேளுங்கள்.'
        : "I'm not sure which page you mean. Try asking for Mass Timings, Events, Daily Readings, or Announcements.";

      isProcessingRef.current = false;
      transitionTo(VA_STATE.CLARIFYING, sessionId);

      speakText(unknownText, sessionId, () => {
        if (sessionId === sessionIdRef.current && !isUnmountedRef.current) {
          startCommandRecognitionRef.current?.(sessionId);
        }
      });
    },
    [checkCompletionAndDismiss, dismiss, executeControl, location.pathname, log, navigate, safeAbortRecognition, speakText, stopAudioAnalyser, transitionTo]
  );

  processTranscriptRef.current = processTranscript;

  // ── Start Command Recognition (Listening State) ─────────────────────────────

  const startCommandRecognition = useCallback(
    (sessionId) => {
      if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
      if (isRecognitionActiveRef.current || isStartingRecognitionRef.current) {
        log('RECOGNITION_ALREADY_ACTIVE_OR_STARTING');
        return;
      }

      isStartingRecognitionRef.current = true;
      isProcessingRef.current = false;
      latestTranscriptRef.current = '';

      transitionTo(VA_STATE.LISTENING, sessionId);
      setTranscript('');
      startAudioAnalyser(sessionId);

      // Ensure any ongoing TTS is completely silent before listening
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        cancelSpeech();
      }

      const lang = detectLang();
      let r = null;
      try {
        safeAbortRecognition();
        r = buildRecognition(lang, false, true);
      } catch (err) {
        log('RECOGNITION_BUILD_FAILED', err.message);
        dismiss();
        return;
      }

      if (!r) {
        dismiss();
        return;
      }
      recognitionRef.current = r;

      // Command timeout: dismiss if user stays silent across full window
      clearTimeout(commandTimerRef.current);
      commandTimerRef.current = setTimeout(() => {
        if (sessionId === sessionIdRef.current && stateRef.current === VA_STATE.LISTENING) {
          if (latestTranscriptRef.current.trim()) {
            processTranscript(latestTranscriptRef.current, sessionId);
          } else {
            log('COMMAND_SILENCE_TIMEOUT_DISMISS');
            dismiss();
          }
        }
      }, COMMAND_TIMEOUT_MS);

      r.onstart = () => {
        if (sessionId !== sessionIdRef.current) {
          try { r.abort(); } catch {}
          return;
        }
        isRecognitionActiveRef.current = true;
        isStartingRecognitionRef.current = false;
        log('RECOGNITION_START');
      };

      r.onresult = (e) => {
        if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
        cancelSpeech();

        const results = Array.from(e.results);
        const raw = results.map((res) => res[0].transcript).join(' ');
        latestTranscriptRef.current = raw;
        setTranscript(raw);

        const isFinal = results[results.length - 1].isFinal;

        // Process immediately on final result
        if (isFinal && raw.trim()) {
          clearTimeout(interimTimerRef.current);
          clearTimeout(commandTimerRef.current);
          transitionTo(VA_STATE.PROCESSING, sessionId);
          setTimeout(() => {
            if (sessionId === sessionIdRef.current) {
              processTranscript(raw, sessionId);
            }
          }, 120);
          return;
        }

        // Fast-track: interim speech confidently matches an intent or control command
        clearTimeout(interimTimerRef.current);
        interimTimerRef.current = setTimeout(() => {
          if (sessionId === sessionIdRef.current && stateRef.current === VA_STATE.LISTENING && raw.trim()) {
            const clean = stripWakePhrase(raw);
            const matchedIntent = resolveIntent(clean);
            const matchedCtrl = resolveControl(clean);
            if (
              matchedCtrl ||
              (matchedIntent &&
                !matchedIntent.needsClarification &&
                matchedIntent.confidence >= CONFIDENCE_THRESHOLD)
            ) {
              log('FAST_TRACK_INTERIM_MATCH', clean);
              clearTimeout(commandTimerRef.current);
              safeStopRecognition();
              transitionTo(VA_STATE.PROCESSING, sessionId);
              setTimeout(() => {
                if (sessionId === sessionIdRef.current) {
                  processTranscript(raw, sessionId);
                }
              }, 120);
            }
          }
        }, 450);
      };

      r.onerror = (e) => {
        if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;
        log('RECOGNITION_ERROR', e.error);

        if (e.error === 'no-speech') {
          // Brief pause — let onend handle graceful restart if within command window
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
          // Intentionally aborted
          return;
        }
        dismiss();
      };

      r.onend = () => {
        isRecognitionActiveRef.current = false;
        isStartingRecognitionRef.current = false;
        isStoppingRecognitionRef.current = false;
        log('RECOGNITION_END');

        if (sessionId !== sessionIdRef.current || isUnmountedRef.current) return;

        // If user spoke something valid while listening, process it
        if (stateRef.current === VA_STATE.LISTENING) {
          if (latestTranscriptRef.current.trim() && !isProcessingRef.current) {
            transitionTo(VA_STATE.PROCESSING, sessionId);
            setTimeout(() => {
              if (sessionId === sessionIdRef.current) {
                processTranscript(latestTranscriptRef.current, sessionId);
              }
            }, 120);
          } else if (!isProcessingRef.current && restartCountRef.current < MAX_ONEND_RESTARTS) {
            // Graceful restart on silence/pause
            restartCountRef.current++;
            log('ONEND_GRACEFUL_RESTART', `attempt ${restartCountRef.current}`);
            setTimeout(() => {
              if (sessionId === sessionIdRef.current && stateRef.current === VA_STATE.LISTENING && !isProcessingRef.current) {
                startCommandRecognition(sessionId);
              }
            }, 180);
          }
        }
      };

      try {
        r.start();
      } catch (err) {
        log('RECOGNITION_START_EXCEPTION', err.message);
        isStartingRecognitionRef.current = false;
        if (err.name !== 'InvalidStateError') {
          dismiss();
        }
      }
    },
    [buildRecognition, cancelSpeech, dismiss, log, processTranscript, safeAbortRecognition, safeStopRecognition, startAudioAnalyser, transitionTo]
  );

  startCommandRecognitionRef.current = startCommandRecognition;

  // ── Enter Wake State ("Hey Connect" or Mic Button) ─────────────────────────

  const enterWake = useCallback(
    (immediateCommand = '') => {
      if (wakeDebounceRef.current) return;
      wakeDebounceRef.current = true;
      setTimeout(() => {
        wakeDebounceRef.current = false;
      }, WAKE_DEBOUNCE_MS);

      // Increment sessionId to invalidate any prior session callbacks
      const currentSessionId = ++sessionIdRef.current;
      log('NEW_SESSION_STARTED', { immediateCommand });

      cancelSpeech();
      safeAbortRecognition();
      stopAudioAnalyser();

      isProcessingRef.current = false;
      isNavigatingRef.current = false;
      speechFinishedRef.current = false;
      routeVerifiedRef.current = false;
      restartCountRef.current = 0;
      latestTranscriptRef.current = '';

      // Check if command was spoken directly with wake word (one-step: "Hey Connect show events")
      const cleanImmediate = stripWakePhrase(immediateCommand);
      if (cleanImmediate && cleanImmediate.trim()) {
        log('ONE_STEP_WAKE_DETECTED', cleanImmediate);
        setTranscript(cleanImmediate);
        transitionTo(VA_STATE.PROCESSING, currentSessionId);
        setTimeout(() => {
          if (currentSessionId === sessionIdRef.current) {
            processTranscriptRef.current?.(cleanImmediate, currentSessionId);
          }
        }, 180);
        return;
      }

      // Two-step flow: Greet in catchy lady voice, then start listening
      transitionTo(VA_STATE.WAKE, currentSessionId);
      setTranscript('');

      const greeting = isTamilLang()
        ? 'வணக்கம்! நான் Connect. எப்படி உதவட்டுமா?'
        : "Hello! I'm Connect. How can I help you?";

      let hasTransitioned = false;
      const proceedToListening = () => {
        if (hasTransitioned || isUnmountedRef.current || currentSessionId !== sessionIdRef.current) return;
        hasTransitioned = true;
        if (stateRef.current === VA_STATE.WAKE) {
          // Small safety buffer (120ms) before opening mic to avoid speaker echo
          setTimeout(() => {
            if (currentSessionId === sessionIdRef.current) {
              startCommandRecognitionRef.current?.(currentSessionId);
            }
          }, 120);
        }
      };

      speakText(greeting, currentSessionId, () => {
        proceedToListening();
      });

      // Safety fallback: if speech onend is delayed by browser, proceed after timeout
      setTimeout(() => {
        proceedToListening();
      }, 2600);
    },
    [cancelSpeech, log, safeAbortRecognition, speakText, stopAudioAnalyser, transitionTo]
  );

  // ── Manual Activate (Navbar Mic Button) ────────────────────────────────────

  const activate = useCallback(() => {
    enterWake();
  }, [enterWake]);

  // ── Mount / Unmount Lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    isUnmountedRef.current = false;

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
        const clean = stripWakePhrase(commandText);
        enterWake(clean || commandText);
      } else {
        activate();
      }
    };

    return () => {
      isUnmountedRef.current = true;
      sessionIdRef.current++;
      clearTimeout(commandTimerRef.current);
      clearTimeout(navTimerRef.current);
      clearTimeout(interimTimerRef.current);
      clearTimeout(ttsSafetyTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cancelSpeech();
      stopAudioAnalyser();
      safeAbortRecognition();
      window.removeEventListener('hey-connect-activate', handleActivate);
      delete window.heyConnect;
    };
  }, [activate, cancelSpeech, enterWake, safeAbortRecognition, stopAudioAnalyser]);

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
