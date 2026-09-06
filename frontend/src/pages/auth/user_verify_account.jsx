import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiShield, FiKey, FiCheckCircle, FiLogOut, FiArrowRight, FiRefreshCw, FiMail, FiPhone, FiUserCheck } from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../context/context_auth_context';
import churchLogo from '../../assets/church_extirior.png';

export default function UserVerifyAccount() {
  const { t } = useTranslation();
  const { user, login, logout, markReverified } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // URL query parameters
  const params = new URLSearchParams(location.search);
  const emailParam = params.get('email') || params.get('username') || params.get('identifier') || params.get('phone') || '';
  const redirectParam = params.get('redirect') || sessionStorage.getItem('redirectAfterLogin') || '';

  const initialIdentifier = user?.email || user?.phone || emailParam || localStorage.getItem('last_login_identifier') || '';

  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [step, setStep] = useState(initialIdentifier ? 'send' : 'identifier'); // 'identifier' | 'send' | 'otp' | 'success'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [maskedContact, setMaskedContact] = useState('');
  const [targetUserId, setTargetUserId] = useState(user?._id || params.get('userId') || null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Your account has been successfully verified. You can now continue using your account.');

  const inputRefs = useRef([]);

  // Check if current user is already verified
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setAlreadyVerified(true);
        return;
      }
      if (user.requiresReverification === false && user.account_verified === true) {
        setAlreadyVerified(true);
        return;
      }
    }
  }, [user]);

  // Handle countdown timer for Resend OTP
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // WebOTP API: Automatic SMS OTP detection on supported mobile browsers
  useEffect(() => {
    if (step !== 'otp') return;
    if (typeof window !== 'undefined' && 'OTPCredential' in window) {
      const ac = new AbortController();
      navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: ac.signal
      }).then(otp => {
        if (otp && otp.code) {
          const codeStr = String(otp.code).slice(0, 6);
          setOtpDigits(codeStr.split(''));
          toast.success('OTP auto-filled from SMS!');
        }
      }).catch(() => {
        // WebOTP timed out or was cancelled by user; fallback to manual input silently
      });
      return () => ac.abort();
    }
  }, [step]);

  // Focus first digit box when transitioning to OTP step
  useEffect(() => {
    if (step === 'otp' && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    }
  }, [step]);

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const contact = (identifier || user?.email || user?.phone || '').trim();
    if (!contact && !user?._id) {
      return toast.error('Please enter your registered email address or phone number');
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-account/send-otp', {
        userId: user?._id || targetUserId,
        emailOrUsername: contact
      });

      if (res.data.alreadyVerified) {
        setAlreadyVerified(true);
        toast.success(res.data.message || 'Account is already verified!');
        return;
      }

      setTargetUserId(res.data.userId);
      const displayMask = [res.data.emailMasked, res.data.phoneMasked].filter(Boolean).join(' & ') || contact;
      setMaskedContact(displayMask);
      setStep('otp');
      setCooldown(60);
      toast.success(res.data.message || 'Verification code dispatched to your registered contact!');

      if (res.data.devOtp) {
        setDevOtp(res.data.devOtp);
        setIsOtpLoading(true);
        setTimeout(() => setIsOtpLoading(false), 5000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (cleanVal.length > 1) {
      // User pasted full OTP
      const pasted = cleanVal.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto-advance focus
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const fullOtp = otpDigits.join('').trim();
    if (fullOtp.length !== 6) {
      return toast.error('Please enter the complete 6-digit verification code');
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-account/verify-otp', {
        userId: targetUserId || user?._id,
        emailOrUsername: identifier.trim(),
        otp: fullOtp
      });

      if (res.data.token && res.data.user) {
        login(res.data.user, res.data.token);
      } else if (res.data.user) {
        markReverified(res.data.user);
      }

      const msg = res.data.message || 'Your account has been successfully verified. You can now continue using your account.';
      setSuccessMessage(msg);
      setStep('success');
      toast.success(msg);

      // Determine clean redirect destination
      const targetDestination = redirectParam || sessionStorage.getItem('redirectAfterLogin') || '/dashboard';
      sessionStorage.removeItem('redirectAfterLogin');

      // Auto-redirect user to preserved destination
      setTimeout(() => {
        navigate(targetDestination.startsWith('/') ? targetDestination : `/${targetDestination}`, { replace: true });
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFillDevOtp = () => {
    if (!devOtp) return;
    const splitOtp = devOtp.slice(0, 6).split('');
    setOtpDigits(splitOtp);
    if (inputRefs.current[5]) {
      inputRefs.current[5].focus();
    }
  };

  const handleAutoFillUserContact = () => {
    const contact = user?.email || user?.phone || '';
    if (contact) {
      setIdentifier(contact);
      toast.success('Contact info auto-filled from your account profile!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-church-navy via-church-royal-blue to-church-burgundy flex items-center justify-center p-4 sm:p-6 py-12 relative overflow-hidden">
      {/* Decorative Background Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-church-gold/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/40 overflow-hidden relative z-10"
      >
        {/* Security Banner Ribbon */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 py-2.5 px-6 text-center text-white flex items-center justify-center gap-2 shadow-xs">
          <FiShield className="text-base animate-pulse" />
          <span className="text-xs font-black tracking-wider uppercase">Account Re-Verification &amp; Security</span>
        </div>

        <div className="p-6 sm:p-8">
          {/* Church Branding Header */}
          <div className="text-center mb-6">
            <img
              src={churchLogo}
              alt="St. John de britto Church"
              className="w-20 h-20 rounded-full mx-auto mb-3 shadow-lg border-2 border-amber-300 object-cover"
            />
            <h1 className="text-2xl font-display font-black text-church-royal-blue tracking-tight">
              St. John de britto Church
            </h1>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">
              Kalayarkoil • 30-Day Account Verification Portal
            </p>
          </div>

          {/* 1. Already Verified Screen */}
          {alreadyVerified ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-md">
                <FiCheckCircle size={32} />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Fully Verified
                </span>
                <h2 className="text-xl font-display font-extrabold text-gray-900">
                  Your Account is Verified!
                </h2>
                <p className="text-gray-600 text-xs leading-relaxed max-w-xs mx-auto">
                  Your account verification is currently active. All church services, mass bookings, and notifications are ready to use freely.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(redirectParam || '/dashboard')}
                  className="btn-gold w-full justify-center py-3.5 text-sm font-bold shadow-md flex items-center gap-2"
                >
                  Continue to Destination <FiArrowRight />
                </button>
                <Link
                  to="/"
                  className="btn-ghost w-full justify-center text-xs text-gray-500"
                >
                  Back to Home Page
                </Link>
              </div>
            </div>
          ) : step === 'success' ? (
            /* 2. Success Screen */
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-md animate-bounce">
                <FiCheckCircle size={32} />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Verified Successfully
                </span>
                <h2 className="text-xl font-display font-extrabold text-church-royal-blue leading-snug">
                  {successMessage}
                </h2>
                <p className="text-gray-600 text-xs leading-relaxed max-w-xs mx-auto">
                  A new 30-day verification period has begun. Redirecting you to your destination...
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate(redirectParam || '/dashboard')}
                  className="btn-gold w-full justify-center py-3.5 text-sm font-bold shadow-md flex items-center gap-2"
                >
                  Continue Now <FiArrowRight />
                </button>
              </div>
            </div>
          ) : step === 'otp' ? (
            /* 3. OTP Verification Screen */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs mb-2">
                  <FiKey className="text-xl" />
                </div>
                <h2 className="text-lg font-display font-black text-church-royal-blue">
                  Enter 6-Digit OTP Code
                </h2>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Verification code dispatched to <strong className="text-amber-900 font-bold">{maskedContact}</strong> via <strong>Email &amp; SMS</strong>
                </p>
              </div>

              {/* Dev OTP Progress/Auto-fill Banner */}
              {devOtp && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2 my-2 min-h-[76px] shadow-xs">
                  {isOtpLoading ? (
                    <div className="flex flex-col items-center gap-2 w-full px-4 py-1">
                      <p className="text-amber-800 text-xs font-bold animate-pulse">Dispatching OTP via Email &amp; SMS...</p>
                      <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden">
                        <motion.div
                          className="bg-amber-500 h-full"
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 5, ease: 'linear' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-amber-800 text-xs font-semibold text-center">
                        Simulated SMS/Email OTP (Test Mode)
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-900 font-mono font-black text-xl tracking-widest">
                          {devOtp.slice(0, 2)}xxxx
                        </span>
                        <button
                          type="button"
                          onClick={handleAutoFillDevOtp}
                          className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-black px-3.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          Auto Fill
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 6-Digit OTP Input Fields */}
              <div className="space-y-1.5">
                <label className="church-label text-center mb-1 block">One-Time Password (OTP)</label>
                <div className="flex items-center justify-between gap-2 sm:gap-2.5">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete={idx === 0 ? "one-time-code" : "off"}
                      maxLength={idx === 0 ? 6 : 1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 sm:w-12 h-13 sm:h-14 text-center text-2xl font-mono font-black rounded-xl border-2 border-amber-300 focus:border-amber-600 focus:ring-2 focus:ring-amber-400/30 outline-hidden bg-amber-50/50 text-gray-900 transition-all"
                      required
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 text-center mt-1">
                  Supports browser SMS auto-fill and direct paste
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || otpDigits.join('').length !== 6}
                className="btn-gold w-full justify-center py-3.5 text-base font-bold disabled:opacity-50 shadow-md flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying OTP...
                  </>
                ) : (
                  <>
                    Verify &amp; Continue <FiArrowRight />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleSendOtp}
                  className="text-amber-700 font-bold hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('identifier');
                    setOtpDigits(['', '', '', '', '', '']);
                    setDevOtp(null);
                  }}
                  className="text-gray-500 hover:text-gray-800 font-semibold"
                >
                  Change Email / Phone
                </button>
              </div>

              {user && (
                <div className="pt-3 border-t border-gray-100 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1 font-semibold transition-colors"
                  >
                    <FiLogOut /> Log out and switch account
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* 4. Contact Input & OTP Request Screen */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="text-center space-y-1 mb-2">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs mb-2">
                  <FiShield className="text-xl" />
                </div>
                <h2 className="text-lg font-display font-black text-church-royal-blue">
                  Account Re-Verification
                </h2>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Enter your registered contact details to receive a 6-digit verification code via Email &amp; SMS.
                </p>
              </div>

              {/* Option to automatically fill registered contact for authenticated user */}
              {user && (user.email || user.phone) && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="min-w-0">
                    <span className="font-bold block text-gray-900 truncate flex items-center gap-1.5">
                      <FiUserCheck className="text-emerald-600 flex-shrink-0" />
                      {user.name}
                    </span>
                    <span className="text-[11px] text-gray-500 truncate block mt-0.5">
                      {user.email || user.phone}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillUserContact}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl text-xs transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              <div>
                <label className="church-label mb-1">Registered Email or Phone Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. user@example.com or 9876543210"
                    className="church-input pl-10"
                    required
                    autoFocus
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    {identifier.includes('@') ? <FiMail /> : <FiPhone />}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  OTP will be delivered across your registered <strong>Email</strong> and <strong>SMS</strong>.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="btn-gold w-full justify-center py-3.5 text-base font-bold disabled:opacity-50 shadow-md flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Dispatching Code...
                  </>
                ) : (
                  <>
                    Send Verification Code <FiArrowRight />
                  </>
                )}
              </button>

              {user && (
                <div className="pt-3 border-t border-gray-100 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1 font-semibold transition-colors"
                  >
                    <FiLogOut /> Log out and switch account
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
