/**
 * Signal Session Recovery & Decryption Protection Layer — SJDB Connect
 * 
 * Protects WhatsApp Baileys bot from Signal session decryption errors:
 *  1. Classifies Signal/libsignal decryption errors (Bad MAC, No matching sessions, etc.)
 *  2. Drops undecryptable incoming messages immediately (0 bot replies, 0 notifications, 0 jobs)
 *  3. Tracks per-JID session health (consecutive failures, timestamps, recovery states)
 *  4. Rate-limits Render logs to stop repetitive multi-page stack trace storms
 *  5. Preserves existing multi-layer deduplication & idempotency guarantees
 */

const pino = require('pino');

// ─── 1. Error Classifier ────────────────────────────────────────────────────

/**
 * Classifies whether an error or string is a Signal/libsignal decryption failure.
 * @param {Error|string|object} error - The error or message string to test
 * @returns {boolean} True if the error is a Signal session/decryption error
 */
function isSignalDecryptionError(error) {
  if (!error) return false;
  const text = String(
    error?.message ||
    error?.stack ||
    (typeof error === 'string' ? error : '') ||
    JSON.stringify(error) ||
    ''
  ).toLowerCase();

  return (
    text.includes('bad mac') ||
    text.includes('no matching sessions found') ||
    text.includes('failed to decrypt message') ||
    text.includes('sessionerror') ||
    text.includes('session error') ||
    text.includes('session record') ||
    text.includes('ciphertext') ||
    text.includes('untrustedidentitykeyerror') ||
    text.includes('invalid mac') ||
    text.includes('missing session')
  );
}

/**
 * Canonical reason label generator
 * @param {Error|string|object} error
 * @returns {string} Clean uppercase reason string
 */
function classifySessionError(error) {
  const text = String(
    error?.message ||
    error?.stack ||
    (typeof error === 'string' ? error : '') ||
    ''
  ).toLowerCase();

  if (text.includes('bad mac')) return 'BAD_MAC';
  if (text.includes('no matching sessions')) return 'NO_MATCHING_SESSIONS';
  if (text.includes('failed to decrypt')) return 'FAILED_DECRYPT';
  if (text.includes('ciphertext')) return 'CIPHERTEXT_STUB';
  if (text.includes('sessionerror') || text.includes('session error')) return 'SESSION_ERROR';
  return 'DECRYPT_FAILURE';
}

// ─── 2. Message Event Inspectors ────────────────────────────────────────────

/**
 * Checks if a Baileys incoming message represents an undecryptable / ciphertext stub event.
 * @param {object} msg - Baileys proto.IWebMessageInfo
 * @returns {boolean}
 */
function isDecryptionFailureMessage(msg) {
  if (!msg) return false;

  // A. Check messageStubType (Baileys sets StubType.CIPHERTEXT = 2 on decryption failure)
  if (msg.messageStubType === 2 || msg.messageStubType === 'CIPHERTEXT') {
    return true;
  }

  // B. Check messageStubParameters for decryption error notices
  if (Array.isArray(msg.messageStubParameters) && msg.messageStubParameters.length > 0) {
    const hasDecryptError = msg.messageStubParameters.some(p => isSignalDecryptionError(p));
    if (hasDecryptError) return true;
  }

  // C. Explicit error object attached by Baileys decode pipeline
  if (msg.err || msg.error) {
    if (isSignalDecryptionError(msg.err || msg.error)) return true;
  }

  // D. Message object is completely empty while stub type is present
  if (msg.messageStubType && (!msg.message || Object.keys(msg.message).length === 0)) {
    return true;
  }

  return false;
}

/**
 * Checks if a message is an internal WhatsApp protocol or retry receipt event.
 * These should never be treated as conversational user inputs.
 * @param {object} msg - Baileys proto.IWebMessageInfo
 * @returns {boolean}
 */
function isProtocolOrRetryMessage(msg) {
  if (!msg) return false;

  // Protocol messages (revokes, history sync, ephemeral timer changes, etc.)
  if (msg.message?.protocolMessage) return true;

  // Sender key distribution messages (group Signal encryption setups)
  if (msg.message?.senderKeyDistributionMessage) return true;

  // Reaction messages (emoji reactions)
  if (msg.message?.reactionMessage) return true;

  // Keep-in-chat or pin messages
  if (msg.message?.keepInChatMessage || msg.message?.pinInChatMessage) return true;

  return false;
}

// ─── 3. Session Health Tracking & State Machine ─────────────────────────────

class SignalSessionTracker {
  constructor() {
    // jid -> { consecutiveDecryptFailures, lastDecryptFailureAt, lastSuccessfulDecryptAt, recoveryState }
    this.sessionHealth = new Map();
    // rate-limiting cache: "jid:reason" -> timestamp
    this.lastLogTimes = new Map();
    // Global summary counter
    this.totalDecryptFailures = 0;
    this.totalDroppedEvents = 0;
  }

  /**
   * Record a decryption failure for a given JID
   */
  recordDecryptFailure(jid = 'unknown', error = 'BAD_MAC') {
    const cleanJid = String(jid || 'unknown');
    const now = Date.now();
    const reason = classifySessionError(error);

    this.totalDecryptFailures += 1;
    this.totalDroppedEvents += 1;

    const current = this.sessionHealth.get(cleanJid) || {
      consecutiveDecryptFailures: 0,
      lastDecryptFailureAt: null,
      lastSuccessfulDecryptAt: null,
      recoveryState: 'healthy'
    };

    current.consecutiveDecryptFailures += 1;
    current.lastDecryptFailureAt = new Date(now);

    // State machine:
    // 1-2 failures: 'recovering' (Baileys sends retry receipt and renegotiates prekeys)
    // >=3 failures: 'degraded' (repeated failure, requires monitoring)
    if (current.consecutiveDecryptFailures >= 3) {
      current.recoveryState = 'degraded';
    } else {
      current.recoveryState = 'recovering';
    }

    this.sessionHealth.set(cleanJid, current);

    this.logRateLimitedSessionError({
      jid: cleanJid,
      reason,
      consecutiveFailures: current.consecutiveDecryptFailures,
      recoveryState: current.recoveryState
    });

    return current;
  }

  /**
   * Record a successful message decryption for a given JID
   */
  recordSuccessfulDecrypt(jid = 'unknown') {
    const cleanJid = String(jid || 'unknown');
    const current = this.sessionHealth.get(cleanJid);
    if (current) {
      const wasDegraded = current.recoveryState === 'degraded' || current.consecutiveDecryptFailures > 0;
      current.consecutiveDecryptFailures = 0;
      current.lastSuccessfulDecryptAt = new Date();
      current.recoveryState = 'healthy';

      if (wasDegraded) {
        console.log(`[WHATSAPP-SESSION] ✅ Session recovered successfully for ${cleanJid}. State reset to HEALTHY.`);
      }
    }
  }

  /**
   * Get health metrics for a specific JID
   */
  getSessionHealth(jid) {
    return this.sessionHealth.get(String(jid || 'unknown')) || {
      consecutiveDecryptFailures: 0,
      lastDecryptFailureAt: null,
      lastSuccessfulDecryptAt: null,
      recoveryState: 'healthy'
    };
  }

  /**
   * Rate-limited, structured log output for Render console
   */
  logRateLimitedSessionError({ jid, reason, consecutiveFailures, recoveryState }) {
    const now = Date.now();
    const rateLimitKey = `${jid}:${reason}`;
    const lastLogged = this.lastLogTimes.get(rateLimitKey) || 0;

    // Rate-limit: Only log once every 8 seconds per (jid, reason) unless transitioning to degraded
    if (now - lastLogged < 8000 && consecutiveFailures < 3) {
      return;
    }
    this.lastLogTimes.set(rateLimitKey, now);

    // Clean stale keys
    if (this.lastLogTimes.size > 1000) {
      for (const [k, ts] of this.lastLogTimes.entries()) {
        if (now - ts > 60000) this.lastLogTimes.delete(k);
      }
    }

    console.warn(`[WHATSAPP-SESSION] Signal decryption failure:
  reason=${reason}
  jid=${jid}
  consecutiveFailures=${consecutiveFailures}
  recoveryState=${recoveryState.toUpperCase()}
  action=DROP_MESSAGE
  botReply=SKIPPED
  notification=SKIPPED`);
  }

  /**
   * Diagnostic snapshot for health-check / admin monitor
   */
  getDiagnostics() {
    const healthyCount = Array.from(this.sessionHealth.values()).filter(s => s.recoveryState === 'healthy').length;
    const recoveringCount = Array.from(this.sessionHealth.values()).filter(s => s.recoveryState === 'recovering').length;
    const degradedCount = Array.from(this.sessionHealth.values()).filter(s => s.recoveryState === 'degraded').length;

    return {
      totalTrackedSessions: this.sessionHealth.size,
      totalDecryptFailures: this.totalDecryptFailures,
      totalDroppedEvents: this.totalDroppedEvents,
      statusCounts: {
        healthy: healthyCount,
        recovering: recoveringCount,
        degraded: degradedCount
      }
    };
  }

  resetForTesting() {
    this.sessionHealth.clear();
    this.lastLogTimes.clear();
    this.totalDecryptFailures = 0;
    this.totalDroppedEvents = 0;
  }
}

const signalSessionTracker = new SignalSessionTracker();

// ─── 4. Libsignal Direct console.error Interceptor ──────────────────────────

let filterInstalled = false;
const originalConsoleError = console.error;

/**
 * Intercepts libsignal's hardcoded console.error("Session error:" + e, e.stack)
 * to suppress multi-page repeated stack trace storms in Render logs.
 */
function installLibsignalErrorFilter(tracker = signalSessionTracker) {
  if (filterInstalled) return;
  filterInstalled = true;

  console.error = function (...args) {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';

    if (
      firstArg.startsWith('Session error:') ||
      firstArg.startsWith('Failed to decrypt message with any known session') ||
      firstArg.includes('Bad MAC') ||
      firstArg.includes('No matching sessions found for message')
    ) {
      // Extract reason cleanly
      const reason = classifySessionError(firstArg);
      tracker.recordDecryptFailure('libsignal_internal', reason);
      // Suppress the 30-line repetitive stack dump from libsignal
      return;
    }

    originalConsoleError.apply(console, args);
  };
}

// ─── 5. Custom Baileys Logger ───────────────────────────────────────────────

/**
 * Creates a lightweight pino logger for Baileys that intercepts level 50 decryption
 * errors and funnels them cleanly through the rate-limiting session tracker.
 */
function createCustomBaileysLogger(tracker = signalSessionTracker) {
  // Use custom write destination to catch JSON log events
  const customDestination = {
    write(chunk) {
      try {
        const line = String(chunk);
        if (line.includes('failed to decrypt message') || line.includes('SessionError') || line.includes('Bad MAC')) {
          let parsed;
          try { parsed = JSON.parse(line); } catch (e) { parsed = null; }

          const jid = parsed?.key?.remoteJid || parsed?.sender || 'unknown';
          const reason = classifySessionError(parsed?.err?.message || parsed?.msg || line);
          tracker.recordDecryptFailure(jid, reason);
          return; // Suppress raw JSON stack trace dump
        }
        process.stdout.write(chunk);
      } catch (err) {
        process.stdout.write(chunk);
      }
    }
  };

  return pino({
    level: 'warn', // Suppress noisy level 30 info logs (e.g. heartbeat ping/pong, retry receipts)
    timestamp: () => `,"time":"${new Date().toJSON()}"`
  }, customDestination);
}

module.exports = {
  isSignalDecryptionError,
  classifySessionError,
  isDecryptionFailureMessage,
  isProtocolOrRetryMessage,
  SignalSessionTracker,
  signalSessionTracker,
  installLibsignalErrorFilter,
  createCustomBaileysLogger
};
