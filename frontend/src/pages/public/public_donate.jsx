import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiUser, FiMail, FiPhone, FiCreditCard, FiArrowRight, FiCheckCircle, FiDownload, FiLock, FiAlertCircle } from 'react-icons/fi';
import { GiChurch, GiDove, GiCandleLight, GiGreekTemple } from 'react-icons/gi';
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../../services/api';
import { useAuth } from '../../context/context_auth_context';
import PageHero from '../../components/common/common_page_hero';
import churchLogo from '../../assets/church_extirior.png';

const DONATION_TYPES = [
  { id: 'general', label: 'General Offering', icon: <GiDove />, desc: 'Support parish ministries, maintenance & church services' },
  { id: 'feast', label: 'Feast Donation', icon: <GiChurch />, desc: 'Annual patron feast & liturgical celebrations' },
  { id: 'building', label: 'Building Fund', icon: <GiGreekTemple />, desc: 'Parish infrastructure development & renovations' },
  { id: 'candle', label: 'Candle Offering', icon: <GiCandleLight />, desc: 'Light candles for special family prayer intentions' },
];

const PRESET_AMOUNTS = [100, 250, 500, 1000];

// Dynamic loader for Razorpay Checkout script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Donate() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState('general');
  const [selectedAmount, setSelectedAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalDonation, setFinalDonation] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const receiptRef = useRef(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      donorName: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      note: ''
    }
  });

  useEffect(() => {
    if (user) {
      if (user.name) setValue('donorName', user.name);
      if (user.email) setValue('email', user.email);
      if (user.phone) setValue('phone', user.phone);
    }
  }, [user, setValue]);

  // Pre-load Razorpay checkout script
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const effectiveAmount = customAmount ? Number(customAmount) : selectedAmount;

  const handlePresetClick = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (e) => {
    const val = e.target.value;
    setCustomAmount(val);
    if (val) {
      setSelectedAmount(0);
    }
  };

  // Trigger Razorpay Standard Checkout Flow
  const onProceedToPayment = async (data) => {
    if (!effectiveAmount || effectiveAmount < 1) {
      toast.error('Please select or enter a valid donation amount (minimum ₹1)');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Ensure Razorpay Checkout SDK is loaded
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded && !window.Razorpay) {
        toast.error('Unable to load payment gateway. Please check your internet connection.');
        setIsProcessing(false);
        return;
      }

      // 2. Call backend to create Razorpay Order
      const orderRes = await api.post('/donations/create-order', {
        donorName: data.donorName?.trim() || user?.name || 'Devotee',
        email: data.email?.trim() || user?.email || '',
        phone: data.phone?.trim() || user?.phone || '',
        amount: effectiveAmount,
        type: selectedType,
        message: data.note?.trim() || '',
        isAnonymous: false
      });

      if (!orderRes.data?.success) {
        throw new Error(orderRes.data?.message || 'Failed to initialize donation order');
      }

      const orderId = orderRes.data?.orderId || orderRes.data?.order?.id;
      const donationId = orderRes.data?.donationId;
      const keyId = orderRes.data?.keyId;
      const amount = orderRes.data?.amount || orderRes.data?.order?.amount;
      const currency = orderRes.data?.currency || orderRes.data?.order?.currency || 'INR';

      const typeObj = DONATION_TYPES.find(t => t.id === selectedType);
      const purposeTitle = typeObj ? typeObj.label : 'General Offering';

      // 3. Configure Razorpay Standard Checkout Modal
      if (!orderId || !donationId || !keyId || !String(keyId).startsWith('rzp_')) {
        throw new Error('Payment gateway is not configured correctly. Please contact the church office.');
      }
      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: "St. John de Britto's Church",
        description: `${purposeTitle} - ₹${effectiveAmount}`,
        order_id: orderId,
        prefill: {
          name: data.donorName || user?.name || '',
          email: data.email || user?.email || '',
          contact: data.phone || user?.phone || ''
        },
        notes: {
          donationType: selectedType,
          donationId: donationId
        },
        theme: {
          color: '#1e3a8a'
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'UPI / QR Code',
                instruments: [
                  {
                    method: 'upi'
                  }
                ]
              },
              other: {
                name: 'Cards & Other Payment Methods',
                instruments: [
                  {
                    method: 'card'
                  },
                  {
                    method: 'netbanking'
                  },
                  {
                    method: 'wallet'
                  }
                ]
              }
            },
            sequence: ['block.upi', 'block.other'],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        retry: {
          enabled: true,
          max_count: 3
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            toast('Payment checkout closed.');
          }
        },
        handler: async function (paymentResponse) {
          try {
            // 5. Send payment result to backend for signature verification
            const verifyRes = await api.post('/donations/verify', {
              razorpay_order_id: paymentResponse.razorpay_order_id || orderId,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              donationId
            });

            if (verifyRes.data?.success && verifyRes.data?.donation?.status === 'paid') {
              setFinalDonation(verifyRes.data.donation);
              setStep(3);
              toast.success('Payment verified! Donation recorded.');
            } else if (verifyRes.data?.success) {
              toast('Payment received and is being confirmed. Your receipt will be available once the payment is captured.');
            } else {
              toast.error(verifyRes.data?.message || 'Payment verification failed.');
            }
          } catch (verifyErr) {
            console.error('Payment verification error:', verifyErr);
            toast.error('Payment verification failed. Please contact the church office.');
          } finally {
            setIsProcessing(false);
          }
        }
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', function (response) {
        console.error('Razorpay payment failed:', response.error);
        toast.error(response.error?.description || 'Payment was declined or failed.');
        setIsProcessing(false);
      });

      razorpayInstance.open();
    } catch (err) {
      console.error('Donation order initiation error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to initiate donation. Please try again.');
      setIsProcessing(false);
    }
  };

  const downloadReceipt = async () => {
    if (!finalDonation || !receiptRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const element = receiptRef.current;
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollY: -window.scrollY,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`Donation_Receipt_${finalDonation._id.slice(-6).toUpperCase()}.pdf`);
      toast.success("Receipt downloaded!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF receipt");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-140px)] pt-10 bg-[#fffdfa] flex flex-col justify-between">
        <div>
          <PageHero title={<>{t('donate.title', 'DONATE & OFFERINGS')}</>} subtitle={<>{t('donate.subtitle', 'Support our mission and ministry')}</>} />
          <div className="max-w-md mx-auto px-4 py-16 text-center">
            <div className="w-16 h-16 bg-gold-100 text-church-gold rounded-full flex items-center justify-center text-3xl mx-auto mb-5 shadow-xs">
              <FiLock />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-church-royal-blue mb-3 font-display">Login Required</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Please login or register with your account to make an offering and download your official receipt.
            </p>
            <Link to={`/login?redirect=/donate`} className="w-full py-3.5 px-6 rounded-xl bg-church-gold hover:bg-gold-600 text-white font-bold text-sm shadow-gold flex items-center justify-center gap-2 transition-all">
              <FiUser /> Login to Continue
            </Link>
            <p className="mt-4 text-xs text-gray-400">
              Do not have an account? <Link to="/register" className="text-church-gold font-bold hover:underline">Register Now</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] pt-10 bg-[#fffdfa]">
      <PageHero title={<>{t('donate.title', 'DONATE & OFFERINGS')}</>} subtitle={<>{t('donate.subtitle', 'Support our mission and ministry')}</>} />

      <section className="py-10 sm:py-14">
        <div className="max-w-3xl mx-auto px-4">
          
          {/* Centered Step Indicator */}
          {step <= 2 && (
            <div className="max-w-md mx-auto mb-10 px-4">
              <div className="relative flex items-center justify-between">
                {/* Background Line */}
                <div className="absolute left-6 right-6 top-5 -translate-y-1/2 h-1 bg-gray-200 -z-0 rounded-full" />
                <div 
                  className="absolute left-6 top-5 -translate-y-1/2 h-1 bg-church-gold transition-all duration-300 -z-0 rounded-full"
                  style={{ width: step === 1 ? '0%' : '100%' }}
                />

                {[
                  { num: 1, label: 'Purpose & Amount' },
                  { num: 2, label: 'Donor Details' }
                ].map((s) => {
                  const isCompleted = step > s.num;
                  const isActive = step === s.num;
                  return (
                    <div key={s.num} className="flex flex-col items-center relative z-10">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 shadow-xs ${
                          isCompleted
                            ? 'bg-church-gold text-white shadow-gold'
                            : isActive
                            ? 'bg-church-royal-blue text-white ring-4 ring-gold-100'
                            : 'bg-white text-gray-400 border-2 border-gray-200'
                        }`}
                      >
                        {isCompleted ? <FiCheckCircle className="text-base" /> : s.num}
                      </div>
                      <span className={`text-[11px] font-semibold mt-1.5 ${isActive ? 'text-church-royal-blue font-bold' : isCompleted ? 'text-church-gold' : 'text-gray-400'}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 1: PURPOSE & AMOUNT */}
            {step === 1 && (
              <motion.div 
                key="step1" 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                {/* 1. Purpose Options */}
                <div>
                  <div className="text-center mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-church-royal-blue font-display">Select Offering Purpose</h2>
                    <p className="text-gray-500 text-xs sm:text-sm mt-1">Choose the category for your contribution</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {DONATION_TYPES.map((dt) => {
                      const isSelected = selectedType === dt.id;
                      return (
                        <button
                          key={dt.id}
                          type="button"
                          onClick={() => setSelectedType(dt.id)}
                          className={`p-4 sm:p-5 rounded-2xl border-2 bg-white text-left transition-all duration-200 hover:shadow-md flex items-center gap-3.5 cursor-pointer ${
                            isSelected ? 'border-church-gold bg-gold-50/20 ring-2 ring-church-gold/20 shadow-xs' : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors shrink-0 ${
                              isSelected
                                ? 'bg-church-gold text-white shadow-xs'
                                : 'bg-gold-50 text-church-gold'
                            }`}
                          >
                            {dt.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm sm:text-base text-gray-900 leading-snug">{dt.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{dt.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Amount Options */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-church-royal-blue font-display">Donation Amount</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Select a preset amount or enter a custom amount</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PRESET_AMOUNTS.map((amt) => {
                      const isSelected = selectedAmount === amt && !customAmount;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handlePresetClick(amt)}
                          className={`py-3.5 px-4 rounded-xl font-bold text-sm transition-all border-2 cursor-pointer ${
                            isSelected
                              ? 'bg-church-royal-blue text-white border-church-royal-blue shadow-sm ring-2 ring-blue-100'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          ₹{amt.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Amount Input */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Or Enter Custom Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500 text-sm">₹</span>
                      <input 
                        type="number"
                        min="1"
                        value={customAmount}
                        onChange={handleCustomAmountChange}
                        placeholder="e.g. 2500"
                        className={`w-full pl-8 pr-4 py-3 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 bg-gray-50/50 transition-all ${
                          customAmount 
                            ? 'border-church-gold ring-2 ring-church-gold/30 text-gray-900' 
                            : 'border-gray-200 text-gray-700 focus:border-church-gold focus:ring-church-gold/30'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!effectiveAmount || effectiveAmount < 1) {
                        toast.error('Please select or enter an amount');
                        return;
                      }
                      setStep(2);
                    }}
                    className="w-full mt-2 py-3.5 px-6 rounded-xl bg-church-gold hover:bg-gold-600 text-white font-bold text-sm shadow-gold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <span>Continue to Details (₹{effectiveAmount || 0})</span> <FiArrowRight />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DONOR DETAILS & RAZORPAY CHECKOUT */}
            {step === 2 && (
              <motion.div 
                key="step2" 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="max-w-md mx-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <button 
                    type="button"
                    onClick={() => setStep(1)} 
                    className="text-church-gold hover:text-gold-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    ← Change Amount & Purpose
                  </button>
                  <span className="text-xs bg-gold-50 text-church-gold font-bold px-3 py-1 rounded-full border border-gold-200">
                    ₹{effectiveAmount} • {DONATION_TYPES.find(t => t.id === selectedType)?.label}
                  </span>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-md">
                  <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-gold-50 text-church-gold flex items-center justify-center text-xl shrink-0">
                      <FiUser />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-church-royal-blue font-display">Donor Details</h2>
                      <p className="text-xs text-gray-500">Provide contact information for official receipt</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit(onProceedToPayment)} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                        <FiUser className="text-gray-400" /> Donor Name *
                      </label>
                      <input 
                        {...register('donorName', { required: 'Donor name is required' })} 
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-church-gold/40 focus:border-church-gold bg-gray-50/50" 
                        placeholder="Your full name" 
                      />
                      {errors.donorName && <p className="text-red-500 text-xs mt-1">{errors.donorName.message}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                        <FiMail className="text-gray-400" /> Email Address (For Receipt)
                      </label>
                      <input 
                        {...register('email')} 
                        type="email"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-church-gold/40 focus:border-church-gold bg-gray-50/50" 
                        placeholder="you@example.com" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                        <FiPhone className="text-gray-400" /> Mobile Number
                      </label>
                      <input 
                        {...register('phone')} 
                        type="tel"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-church-gold/40 focus:border-church-gold bg-gray-50/50" 
                        placeholder="e.g. 9876543210" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Special Intention / Message (Optional)</label>
                      <textarea 
                        {...register('note')} 
                        rows={3} 
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-church-gold/40 focus:border-church-gold bg-gray-50/50 resize-none" 
                        placeholder="Any prayer intention or message for the parish priest..." 
                      />
                    </div>

                    <div className="pt-2">
                      <button 
                        type="submit" 
                        disabled={isProcessing}
                        className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-church-royal-blue to-indigo-900 hover:from-blue-900 hover:to-indigo-950 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Opening Payment Gateway...</span>
                          </>
                        ) : (
                          <>
                            <FiCreditCard className="text-lg" />
                            <span>Donate ₹{effectiveAmount} Now</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 text-center pt-2">
                      <FiLock className="text-green-600" />
                      <span>Secured with 256-bit encryption via Razorpay (UPI, Cards, Net Banking)</span>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* STEP 3: SUCCESS & OFFICIAL RECEIPT */}
            {step === 3 && finalDonation && (
              <motion.div 
                key="step3" 
                initial={{ opacity: 0, scale: 0.92 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="text-center py-6 max-w-lg mx-auto"
              >
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-6">
                  <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-xs">
                    <FiCheckCircle />
                  </div>
                  
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-church-royal-blue font-display">God Bless You!</h2>
                    <p className="text-gray-500 text-xs sm:text-sm mt-1">
                      Thank you for your generous contribution towards St. John de Britto's Church.
                    </p>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-left space-y-2.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-gray-200">
                      <span className="text-gray-500">Donation Amount:</span>
                      <span className="font-bold text-church-royal-blue text-sm">₹{finalDonation.amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-200">
                      <span className="text-gray-500">Payment ID:</span>
                      <span className="font-mono font-bold text-gray-800">{finalDonation.razorpayPaymentId || finalDonation.transactionId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-200">
                      <span className="text-gray-500">Receipt No:</span>
                      <span className="font-mono font-bold text-church-gold">SJBC-{finalDonation._id?.slice(-6).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-500">Category:</span>
                      <span className="capitalize font-bold text-gray-800">{DONATION_TYPES.find(t => t.id === finalDonation.type)?.label || finalDonation.type}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <button 
                      onClick={downloadReceipt} 
                      disabled={isGeneratingPDF}
                      className="py-3.5 px-6 rounded-xl bg-church-gold hover:bg-gold-600 text-white font-bold text-xs sm:text-sm shadow-gold flex items-center gap-2 justify-center cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isGeneratingPDF ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiDownload />}
                      Download Official Receipt
                    </button>
                    <button 
                      onClick={() => { 
                        setStep(1); 
                        setFinalDonation(null); 
                      }} 
                      className="py-3.5 px-6 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      Donate Again
                    </button>
                  </div>

                  {/* Hidden Printable Receipt for PDF Canvas */}
                  <div className="fixed left-[-9999px] top-0">
                    <div ref={receiptRef} style={{ width: '800px', margin: 'auto', background: '#ffffff', padding: '35px', fontFamily: 'Arial, sans-serif', color: '#222' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '20px' }}>
                        <div>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}, {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                        <div>SJBC-{finalDonation._id?.slice(-6).toUpperCase()}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e5e5', paddingBottom: '15px' }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                          <img src={churchLogo} style={{ width: '70px', height: '70px', objectFit: 'contain' }} alt="Logo" />
                          <div style={{ textAlign: 'left' }}>
                            <h1 style={{ margin: 0, fontSize: '30px', color: '#1e3a8a' }}>ST. JOHN DE BRITTO'S CHURCH</h1>
                            <h2 style={{ margin: '5px 0', fontSize: '18px', color: '#b8860b', fontWeight: 'normal' }}>புனித அருளானந்தர் தேவாலயம்</h2>
                            <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>Murthi Nagar, Kalayarkoil, Tamil Nadu 630551, India.</p>
                          </div>
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>Receipt</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', fontSize: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', marginBottom: '10px' }}><div style={{ width: '150px', fontWeight: 'bold' }}>Receipt No :</div><div>SJBC-{new Date().getFullYear()}-{finalDonation._id?.slice(-6).toUpperCase()}</div></div>
                          <div style={{ display: 'flex', marginBottom: '10px' }}><div style={{ width: '150px', fontWeight: 'bold' }}>Name :</div><div>{finalDonation.donorName || user?.name || 'N/A'}</div></div>
                          <div style={{ display: 'flex', marginBottom: '10px' }}><div style={{ width: '150px', fontWeight: 'bold' }}>Donation Type :</div><div>{DONATION_TYPES.find(t => t.id === finalDonation.type)?.label || 'Donation'}</div></div>
                          <div style={{ display: 'flex', marginBottom: '10px' }}><div style={{ width: '150px', fontWeight: 'bold' }}>Purpose :</div><div>{DONATION_TYPES.find(t => t.id === finalDonation.type)?.label || 'Donation'} Offering</div></div>
                        </div>
                        <div style={{ flex: 1, paddingLeft: '20px' }}>
                          <div style={{ display: 'flex', marginBottom: '10px' }}><div style={{ width: '150px', fontWeight: 'bold' }}>Receipt Date :</div><div>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div></div>
                          <div style={{ display: 'flex', marginBottom: '10px' }}><div style={{ width: '150px', fontWeight: 'bold' }}>Total Paid :</div><div>INR. {(finalDonation.amount || 0).toFixed(2)}</div></div>
                          <div style={{ display: 'flex', marginBottom: '10px' }}><div style={{ width: '150px', fontWeight: 'bold' }}>Payment Method :</div><div>Razorpay (Online)</div></div>
                          <div style={{ display: 'flex', marginBottom: '10px' }}><div style={{ width: '150px', fontWeight: 'bold' }}>Payment ID :</div><div>{finalDonation.razorpayPaymentId || finalDonation.transactionId || 'N/A'}</div></div>
                        </div>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '30px', fontSize: '15px' }}>
                        <thead>
                          <tr>
                            <th style={{ background: '#f3f4f6', textAlign: 'left', padding: '14px', border: '1px solid #ddd' }}>Donation Description</th>
                            <th style={{ background: '#f3f4f6', textAlign: 'left', padding: '14px', border: '1px solid #ddd' }}>Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: '14px', border: '1px solid #ddd' }}>{DONATION_TYPES.find(t => t.id === finalDonation.type)?.label || 'Donation'} Offering</td>
                            <td style={{ padding: '14px', border: '1px solid #ddd' }}>₹{(finalDonation.amount || 0).toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ marginTop: '30px', border: '1px solid #ddd', padding: '18px', background: '#fafafa', lineHeight: '1.8' }}>
                        <strong style={{ display: 'block', marginBottom: '10px' }}>Message / Intention :</strong>
                        "{finalDonation.note || finalDonation.message || 'Prayers for parish and family blessings'}"
                      </div>
                      <div style={{ marginTop: '40px', textAlign: 'center', lineHeight: '1.9', fontSize: '15px' }}>
                        Thank you for your generous contribution<br />towards the ministry and mission of<br /><strong>St. John de Britto's Church.</strong><br /><br />May God bless you abundantly.
                      </div>
                      <div style={{ marginTop: '45px', textAlign: 'center', fontSize: '14px', lineHeight: '1.8', color: '#555' }}>
                        Contact Details :<br />Parish Office Phone : +91 96291 95484 <br />Parish Office Email : arndas777@gmail.com <br />Parish Office Website : www.stjohnchurch.com
                      </div>
                      <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}>
                        Computer Generated Receipt. <span style={{ color: 'red' }}>SIGNATURE NOT REQUIRED</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}