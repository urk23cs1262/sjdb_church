import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiShield, FiKey, FiLock, FiCheckCircle, FiLogOut, FiArrowRight, FiRefreshCw } from 'react-icons/fi';
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
  const emailParam = params.get('email') || params.get('username') || params.get('identifier') || '';

  const initialIdentifier = user?.email || user?.phone || user?.parishMemberId || emailParam || localStorage.getItem('last_login_identifier') || '';

  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [step, setStep] = useState(initialIdentifier ? 'send' : 'identifier'); // 'identifier' | 'send' | 'otp' | 'success'
  const [otpVal, setOtpVal] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [maskedContact, setMaskedContact] = useState('');
  const [targetUserId, setTargetUserId] = useState(user?._id || null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [alreadyVerified, setAlreadyVerified] = useState(false);

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

  // Auto-dispatch OTP if user is logged in and needs verification
  useEffect(() => {
    if (user && user.requiresReverification && step === 'send' && !devOtp) {
      handleSendOtp();
    }
  }, [user, step]);

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const contact = (identifier || user?.email || user?.phone || '').trim();
    if (!contact && !user?._id) {
      return toast.error('Please enter your email, username, or registered phone number');
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-account/send-otp', {
        userId: user?._id || targetUserId,
        emailOrUsername: contact
      });

      if (res.data.alreadyVerified) {
        setAlreadyVerified(true);
        toast.success(res.data.message || 'Account already verified!');
        return;
      }

      setTargetUserId(res.data.userId);
      setMaskedContact(res.data.emailMasked || res.data.phoneMasked || contact);
      setStep('otp');
      setCooldown(60);
      toast.success(res.data.message || 'Verification code dispatched!');

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

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otpVal || otpVal.trim().length !== 6) {
      return toast.error('Please enter the full 6-digit verification code');
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-account/verify-otp', {
        userId: targetUserId || user?._id,
        emailOrUsername: identifier.trim(),
        otp: otpVal.trim()
      });

      if (res.data.token && res.data.user) {
        login(res.data.user, res.data.token);
      } else if (res.data.user) {
        markReverified(res.data.user);
      }

      setStep('success');
      toast.success(res.data.message || 'Account re-verified successfully!');

      // Smooth auto-redirect after celebration
      setTimeout(() => {
        const dest = sessionStorage.getItem('redirectAfterLogin') || '/dashboard';
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(dest);
      }, 2400);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-church-navy via-church-royal-blue to-church-burgundy flex items-center justify-center p-4 sm:p-6 py-12 relative overflow-hidden">
      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-church-gold/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/40 overflow-hidden relative z-10"
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 py-2.5 px-6 text-center text-white flex items-center justify-center gap-2 shadow-xs">
          <FiShield className="text-base animate-pulse" />
          <span className="text-xs font-black tracking-wider uppercase">Mandatory Security Verification</span>
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
              Kalayarkoil • Parish Security Portal
            </p>
          </div>

          {/* Already Verified Screen */}
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
                  Your Account is Up to Date!
                </h2>
                <p className="text-gray-600 text-xs leading-relaxed max-w-xs mx-auto">
                  Your parishioner account re-verification is already complete. All church features, mass bookings, and notifications are active.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-gold w-full justify-center py-3.5 text-sm font-bold shadow-md flex items-center gap-2"
                >
                  Continue to Dashboard <FiArrowRight />
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
            /* Success Completion Screen */
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-md animate-bounce">
                <FiCheckCircle size={32} />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Re-Verification Complete
                </span>
                <h2 className="text-2xl font-display font-extrabold text-church-royal-blue">
                  Account Verified Successfully!
                </h2>
                <p className="text-gray-600 text-xs leading-relaxed max-w-xs mx-auto">
                  Your account has been securely renewed for another 30 days. You will now receive all parish notifications across Web Push, Email, and WhatsApp.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-gold w-full justify-center py-3.5 text-sm font-bold shadow-md flex items-center gap-2"
                >
                  Enter Parish Dashboard <FiArrowRight />
                </button>
              </div>
            </div>
          ) : step === 'otp' ? (
            /* OTP Entry & Auto-Fill Screen */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs mb-2">
                  <FiKey className="text-xl" />
                </div>
                <h2 className="text-lg font-display font-black text-church-royal-blue">
                  Enter 6-Digit Code
                </h2>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Verification code sent to <strong className="text-amber-900 font-bold">{maskedContact}</strong>
                </p>
              </div>

              {/* Auto-Fill Banner with Real-Time 5-Second Sending Progress Animation */}
              {devOtp && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col items-center justify-center gap-2 my-2 min-h-[76px] shadow-xs">
                  {isOtpLoading ? (
                    <div className="flex flex-col items-center gap-2 w-full px-4 py-1">
                      <p className="text-amber-800 text-xs font-bold animate-pulse">Sending OTP...</p>
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
                        OTP sent to your number/email
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-900 font-mono font-black text-xl tracking-widest">
                          {devOtp.slice(0, 2)}xxxx
                        </span>
                        <button
                          type="button"
                          onClick={() => setOtpVal(devOtp)}
                          className="bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-white text-xs font-black px-3.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          Auto Fill
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="church-label text-center mb-1">Enter Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpVal}
                  onChange={(e) => setOtpVal(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="church-input text-center text-3xl tracking-widest font-mono font-bold py-3.5"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpVal.length !== 6}
                className="btn-gold w-full justify-center py-3.5 text-base font-bold disabled:opacity-50 shadow-md flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Continue <FiArrowRight />
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
                    setStep('send');
                    setOtpVal('');
                    setDevOtp(null);
                  }}
                  className="text-gray-500 hover:text-gray-800 font-semibold"
                >
                  Change Contact
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
            /* Send OTP Confirmation Screen */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="text-center space-y-1 mb-2">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs mb-2">
                  <FiShield className="text-xl" />
                </div>
                <h2 className="text-lg font-display font-black text-church-royal-blue">
                  Account Re-Verification
                </h2>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Please re-verify your parishioner credentials to renew your 30-day active security status.
                </p>
              </div>

              <div>
                <label className="church-label mb-1">Email / Phone / Username</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter registered Email or Phone"
                  className="church-input"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="btn-gold w-full justify-center py-3.5 text-base font-bold disabled:opacity-50 shadow-md flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending OTP...
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
