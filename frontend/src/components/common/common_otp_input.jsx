import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiRefreshCw, FiClock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

/**
 * Modern 6-digit OTP input component with auto-focus, paste handling, backspace navigation,
 * a 5-minute expiry countdown timer, and a 60-second resend cooldown.
 */
export default function CommonOtpInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  isError = false,
  errorMessage = '',
  onResend,
  isResending = false,
  expirySeconds = 300, // 5 minutes default
  resendCooldownSeconds = 60, // 60 seconds cooldown default
}) {
  const [digits, setDigits] = useState(() => {
    const initial = value ? value.split('').slice(0, length) : [];
    while (initial.length < length) initial.push('');
    return initial;
  });

  const [timeLeft, setTimeLeft] = useState(expirySeconds);
  const [resendCooldown, setResendCooldown] = useState(resendCooldownSeconds);
  const inputRefs = useRef([]);

  // Sync internal digits if value prop changes from outside
  useEffect(() => {
    if (typeof value === 'string') {
      const chars = value.split('').slice(0, length);
      while (chars.length < length) chars.push('');
      setDigits(chars);
    }
  }, [value, length]);

  // Initial auto-focus on first box
  useEffect(() => {
    if (!disabled && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  // 5-Minute Expiry Countdown Timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // 60-Second Resend Cooldown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDigitChange = (index, val) => {
    if (disabled) return;

    // Filter to only digits
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      // Empty / cleared
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      const combined = newDigits.join('');
      if (onChange) onChange(combined);
      return;
    }

    // Take the last entered character if multiple typed
    const singleChar = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleChar;
    setDigits(newDigits);

    const combined = newDigits.join('');
    if (onChange) onChange(combined);

    if (combined.length === length && !newDigits.includes('')) {
      if (onComplete) onComplete(combined);
    }

    // Move to next input box
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current is already empty, move to previous and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
        if (onChange) onChange(newDigits.join(''));
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
        if (onChange) onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    if (disabled) return;
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();
    const cleanNumbers = pastedData.replace(/\D/g, '').slice(0, length);

    if (!cleanNumbers) return;

    const newDigits = [...digits];
    for (let i = 0; i < length; i++) {
      newDigits[i] = cleanNumbers[i] || '';
    }
    setDigits(newDigits);

    const combined = newDigits.join('');
    if (onChange) onChange(combined);

    // Focus on the next empty box or the last box
    const nextIndex = Math.min(cleanNumbers.length, length - 1);
    inputRefs.current[nextIndex]?.focus();

    if (cleanNumbers.length === length) {
      if (onComplete) onComplete(combined);
    }
  };

  const handleResendClick = async () => {
    if (resendCooldown > 0 || isResending || disabled) return;
    if (onResend) {
      try {
        await onResend();
        // Reset timers on successful resend
        setTimeLeft(expirySeconds);
        setResendCooldown(resendCooldownSeconds);
        // Clear digits
        const cleared = Array(length).fill('');
        setDigits(cleared);
        if (onChange) onChange('');
        inputRefs.current[0]?.focus();
      } catch (err) {
        console.error('Resend OTP error:', err);
      }
    }
  };

  const isExpired = timeLeft === 0;

  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      {/* 6-Box Grid */}
      <div
        className="flex items-center justify-between gap-1.5 sm:gap-2"
        onPaste={handlePaste}
      >
        {digits.map((digit, idx) => {
          const hasValue = Boolean(digit);
          return (
            <motion.input
              key={idx}
              ref={el => (inputRefs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete={idx === 0 ? 'one-time-code' : 'off'}
              value={digit}
              disabled={disabled || isExpired}
              onChange={e => handleDigitChange(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(idx, e)}
              whileFocus={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl transition-all duration-150 outline-none select-all ${
                isError
                  ? 'border-2 border-red-500 bg-red-50/50 text-red-900 focus:ring-4 focus:ring-red-100'
                  : hasValue
                  ? 'border-2 border-amber-500 bg-amber-50/30 text-slate-900 shadow-sm focus:ring-4 focus:ring-amber-200/50'
                  : 'border border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:bg-white'
              } ${disabled || isExpired ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
            />
          );
        })}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {isError && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-1.5 text-xs text-red-600 font-semibold text-center"
          >
            <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expiry Warning */}
      <AnimatePresence>
        {isExpired && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-1.5 text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 font-medium"
          >
            <FiAlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>This verification code has expired. Please request a new code.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info: Expiry Countdown & Resend Button */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 px-1">
        {/* Expiration Timer */}
        <div className="flex items-center gap-1.5 font-medium">
          <FiClock className={`w-3.5 h-3.5 ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
          <span>Expires in:</span>
          <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
            {formatTimer(timeLeft)}
          </span>
        </div>

        {/* Resend Action */}
        <div>
          {resendCooldown > 0 ? (
            <span className="text-slate-400 font-medium select-none">
              Resend in <span className="font-mono font-bold text-slate-600">{resendCooldown}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResendClick}
              disabled={isResending || disabled}
              className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-bold transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
              <span>{isResending ? 'Sending...' : 'Resend Code'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
