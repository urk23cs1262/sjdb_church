import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  FiX, FiUserPlus, FiEye, FiEyeOff, FiPlus, FiTrash2,
  FiChevronRight, FiChevronLeft, FiUsers, FiUserCheck,
  FiCheckCircle, FiXCircle, FiRefreshCw, FiKey, FiMail, FiShield
} from 'react-icons/fi';
import api from '../../services/api';
import PolicyModal from '../common/common_policy_modal';

const SUB_STATIONS = [
  "Kalayarkoil (Main Parish)",
  "Pallithammam",
  "Nedungulam",
  "Kalluvazhy",
  "Natarajapuram",
  "Susaiapparpattinam",
  "Maravamangalam",
  "Other"
];

const FAMILY_ROLES = [
  'Father', 'Mother', 'Elder Son', 'Younger Son',
  'Elder Daughter', 'Younger Daughter', 'Grandfather',
  'Grandmother', 'Other'
];

export default function AddUserModal({ isOpen, onClose, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1); // 1: Info, 2: Family & Consent, 3: OTP, 4: Success
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [createdUserId, setCreatedUserId] = useState(null);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [devOtp, setDevOtp] = useState(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);

  // Policy agreements
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeSecurity, setAgreeSecurity] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyTab, setPolicyTab] = useState('terms');

  // Family lookup state
  const [suggestedFamilies, setSuggestedFamilies] = useState([]);
  const [isFetchingFamilies, setIsFetchingFamilies] = useState(false);
  const [selectedMemberKey, setSelectedMemberKey] = useState(null);

  // Resend OTP timer
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    trigger,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      familyMembers: []
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "familyMembers"
  });

  // Watch fields for live UI feedback
  const watchedFamilyRole = watch('familyRole');
  const watchedMembers = watch('familyMembers');
  const watchedPassword = useWatch({ control, name: 'password' }) || '';
  const watchedConfirmPassword = useWatch({ control, name: 'confirmPassword' }) || '';

  const isConfirmTyped = watchedConfirmPassword.length > 0;
  const isPasswordMatched = isConfirmTyped && Boolean(watchedPassword) && watchedConfirmPassword === watchedPassword;
  const isPasswordMismatch = isConfirmTyped && Boolean(watchedPassword) &&
    watchedConfirmPassword.length >= watchedPassword.length &&
    watchedConfirmPassword !== watchedPassword;
  const isTypingMatch = isConfirmTyped && Boolean(watchedPassword) &&
    watchedPassword.startsWith(watchedConfirmPassword) && !isPasswordMatched;

  // Handle ESC key and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !policyModalOpen) {
        handleModalClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, policyModalOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Reset state on open/close
  const handleModalClose = () => {
    if (verifiedUser && onSuccess) {
      onSuccess(verifiedUser);
    }
    reset();
    setCurrentStep(1);
    setShowPass(false);
    setShowConfirmPass(false);
    setCreatedUserId(null);
    setVerifiedUser(null);
    setDevOtp(null);
    setAgreeTerms(false);
    setAgreePrivacy(false);
    setAgreeSecurity(false);
    setSuggestedFamilies([]);
    setSelectedMemberKey(null);
    onClose();
  };

  const openPolicyModal = (tab) => {
    setPolicyTab(tab);
    setPolicyModalOpen(true);
  };

  const fetchFamilyLookup = async (famName) => {
    if (!famName || !famName.trim()) {
      setSuggestedFamilies([]);
      return;
    }
    setIsFetchingFamilies(true);
    try {
      const res = await api.get(`/auth/family-lookup?familyName=${encodeURIComponent(famName.trim())}`);
      if (res.data.success) {
        setSuggestedFamilies(res.data.families || []);
      }
    } catch (e) {
      console.error('Family lookup failed', e);
    } finally {
      setIsFetchingFamilies(false);
    }
  };

  const handleNextStep = async () => {
    let fieldsToValidate = [];
    if (currentStep === 1) {
      fieldsToValidate = ['name', 'dob', 'gender', 'familyName', 'subStation', 'phone', 'address', 'password', 'confirmPassword'];
    } else if (currentStep === 2) {
      fieldsToValidate = ['familyRole'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      if (currentStep === 1) {
        const famName = getValues('familyName');
        fetchFamilyLookup(famName);
      }
      setCurrentStep(prev => prev + 1);
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  const handleSelectFamilyMember = (family, member, mIdx) => {
    const key = `${family.userId}-${mIdx}`;
    setSelectedMemberKey(key);

    if (FAMILY_ROLES.includes(member.role)) {
      setValue('familyRole', member.role);
    } else {
      setValue('familyRole', 'Other');
      setValue('familyRoleOther', member.role);
    }

    if (family.subStation) {
      setValue('subStation', family.subStation);
    }

    const otherMembers = family.allMembers
      .filter((_, idx) => idx !== mIdx)
      .map(m => ({
        name: m.name,
        role: FAMILY_ROLES.includes(m.role) ? m.role : 'Other',
        roleOther: FAMILY_ROLES.includes(m.role) ? '' : m.role
      }));

    replace(otherMembers);
    toast.success(`Role set to "${member.role}" and ${otherMembers.length} family member(s) auto-filled!`);
  };

  const handleClearAutoFill = () => {
    setSelectedMemberKey(null);
    setValue('familyRole', '');
    setValue('familyRoleOther', '');
    replace([]);
    toast.info('Cleared family auto-fill');
  };

  const prevStep = () => setCurrentStep(prev => prev - 1);

  // Submit registration to get OTP
  const onRegister = async (data) => {
    try {
      const payload = {
        ...data,
        familyRole: data.familyRole === 'Other' ? data.familyRoleOther : data.familyRole,
        familyMembers: data.familyMembers?.map(m => ({
          name: m.name,
          role: m.role === 'Other' ? m.roleOther : m.role
        })) || []
      };

      const res = await api.post('/auth/register', payload);
      setCreatedUserId(res.data.userId);
      setCurrentStep(3); // Advance to OTP verification
      setResendCooldown(60);
      toast.success('Registration details saved. Verification code sent to user email/phone.');

      if (res.data.devOtp) {
        setDevOtp(res.data.devOtp);
        setIsOtpLoading(true);
        setTimeout(() => setIsOtpLoading(false), 3000);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Registration failed');
    }
  };

  // Verify OTP and complete creation
  const onVerifyOtp = async (data) => {
    try {
      const res = await api.post('/auth/verify-otp', {
        userId: createdUserId,
        otp: data.otp
      });

      if (res.data.success) {
        setVerifiedUser(res.data.user);
        setCurrentStep(4); // Advance to Success step
        toast.success('User verified and added successfully!');
        if (onSuccess) {
          onSuccess(res.data.user);
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid or expired OTP');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      const res = await api.post('/auth/resend-otp', { userId: createdUserId });
      toast.success('A fresh OTP has been resent!');
      setResendCooldown(60);
      if (res.data.devOtp) {
        setDevOtp(res.data.devOtp);
        setIsOtpLoading(true);
        setTimeout(() => setIsOtpLoading(false), 3000);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to resend OTP');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleModalClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] shadow-2xl relative my-auto flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="p-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-church-royal-blue flex items-center gap-2">
                <FiUserPlus className="text-church-gold" /> Add New Parish Member
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Official Parish Registry & Account Verification</p>
            </div>
            <button
              type="button"
              onClick={handleModalClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          {currentStep < 4 && (
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
              <span className={currentStep >= 1 ? 'text-church-gold font-bold flex items-center gap-1.5' : 'flex items-center gap-1.5'}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 1 ? 'bg-church-gold text-white' : 'bg-gray-200 text-gray-600'}`}>1</span>
                Personal Info
              </span>
              <span>→</span>
              <span className={currentStep >= 2 ? 'text-church-gold font-bold flex items-center gap-1.5' : 'flex items-center gap-1.5'}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 2 ? 'bg-church-gold text-white' : 'bg-gray-200 text-gray-600'}`}>2</span>
                Family & Consent
              </span>
              <span>→</span>
              <span className={currentStep >= 3 ? 'text-church-gold font-bold flex items-center gap-1.5' : 'flex items-center gap-1.5'}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 3 ? 'bg-church-gold text-white' : 'bg-gray-200 text-gray-600'}`}>3</span>
                OTP Verification
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form onSubmit={handleSubmit(currentStep === 2 ? onRegister : handleNextStep)}>
            <AnimatePresence mode="wait">
              {/* STEP 1: Personal & Account Information */}
              {currentStep === 1 && (
                <motion.div
                  key="modal-step1"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="church-label">Full Name *</label>
                      <input
                        {...register('name', { required: 'Name is required' })}
                        className="church-input"
                        placeholder="Enter member's full name"
                        autoFocus
                      />
                      {errors.name && <p className="text-red-500 text-[10px] mt-1">{errors.name.message}</p>}
                    </div>

                    <div>
                      <label className="church-label">Date of Birth *</label>
                      <input
                        type="date"
                        {...register('dob', { required: 'DOB is required' })}
                        className="church-input"
                      />
                      {errors.dob && <p className="text-red-500 text-[10px] mt-1">{errors.dob.message}</p>}
                    </div>

                    <div>
                      <label className="church-label">Phone Number *</label>
                      <input
                        {...register('phone', { required: 'Phone is required' })}
                        className="church-input"
                        placeholder="e.g. 9876543210"
                      />
                      {errors.phone && <p className="text-red-500 text-[10px] mt-1">{errors.phone.message}</p>}
                    </div>

                    <div>
                      <label className="church-label">Email Address</label>
                      <input
                        {...register('email')}
                        type="email"
                        className="church-input"
                        placeholder="member@example.com"
                      />
                    </div>

                    <div>
                      <label className="church-label">Gender *</label>
                      <select
                        {...register('gender', { required: 'Gender is required' })}
                        className="church-input"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      {errors.gender && <p className="text-red-500 text-[10px] mt-1">{errors.gender.message}</p>}
                    </div>

                    <div>
                      <label className="church-label">Sub-Station *</label>
                      <select
                        {...register('subStation', { required: 'Sub-station is required' })}
                        className="church-input"
                      >
                        <option value="">Select Sub-station</option>
                        {SUB_STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {errors.subStation && <p className="text-red-500 text-[10px] mt-1">{errors.subStation.message}</p>}
                    </div>

                    <div className="md:col-span-2">
                      <label className="church-label">Family Name *</label>
                      <input
                        {...register('familyName', { required: 'Family name is required' })}
                        className="church-input"
                        placeholder="Enter household / family name"
                      />
                      {errors.familyName && <p className="text-red-500 text-[10px] mt-1">{errors.familyName.message}</p>}
                    </div>

                    <div className="md:col-span-2">
                      <label className="church-label">Residential Address *</label>
                      <textarea
                        {...register('address', { required: 'Address is required' })}
                        rows={2}
                        className="church-input py-2 resize-none"
                        placeholder="Enter full street & door address"
                      />
                      {errors.address && <p className="text-red-500 text-[10px] mt-1">{errors.address.message}</p>}
                    </div>

                    <div>
                      <label className="church-label">Password *</label>
                      <div className="relative">
                        <input
                          {...register('password', {
                            required: 'Password is required',
                            minLength: { value: 6, message: 'Minimum 6 characters' }
                          })}
                          type={showPass ? 'text' : 'password'}
                          className="church-input pr-10"
                          placeholder="Password (6+ characters)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showPass ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {errors.password && <p className="text-red-500 text-[10px] mt-1">{errors.password.message}</p>}
                    </div>

                    <div>
                      <label className="church-label">Confirm Password *</label>
                      <div className="relative">
                        <input
                          {...register('confirmPassword', {
                            required: 'Please confirm password',
                            validate: val => val === getValues('password') || 'Passwords do not match'
                          })}
                          type={showConfirmPass ? 'text' : 'password'}
                          className={`church-input pr-10 transition-all ${
                            isPasswordMatched
                              ? 'border-emerald-500 bg-emerald-50/20'
                              : isPasswordMismatch
                                ? 'border-red-500 bg-red-50/20'
                                : ''
                          }`}
                          placeholder="Re-enter password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showConfirmPass ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>

                      {/* Live Password Match Status */}
                      {isConfirmTyped ? (
                        <div className={`text-xs font-bold mt-1 flex items-center gap-1.5 ${
                          isPasswordMatched ? 'text-emerald-600' : isPasswordMismatch ? 'text-red-500' : 'text-amber-700 font-medium'
                        }`}>
                          {isPasswordMatched && <FiCheckCircle className="text-xs text-emerald-600" />}
                          {isPasswordMismatch && <FiXCircle className="text-xs text-red-500" />}
                          <span>
                            {isPasswordMatched ? 'Password matched' : isPasswordMismatch ? 'Passwords do not match' : 'Matching password...'}
                          </span>
                        </div>
                      ) : errors.confirmPassword ? (
                        <p className="text-red-500 text-[10px] font-bold mt-1">{errors.confirmPassword.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100 mt-5">
                    <button
                      type="button"
                      onClick={handleModalClose}
                      className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="btn-gold px-6 py-2.5 text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      Next: Family & Consent <FiChevronRight />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Family Details & Consent */}
              {currentStep === 2 && (
                <motion.div
                  key="modal-step2"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="space-y-5"
                >
                  {/* Family Lookup Suggestions if found */}
                  {isFetchingFamilies && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2.5 text-amber-800 text-xs">
                      <FiRefreshCw className="animate-spin text-amber-600 text-sm" />
                      <span>Searching for existing family members registered under "{watch('familyName')}"...</span>
                    </div>
                  )}

                  {!isFetchingFamilies && suggestedFamilies.length > 0 && (
                    <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FiUsers className="text-amber-700" />
                          <h4 className="font-bold text-amber-950 text-xs">
                            Registered Family Found: <span className="text-church-royal-blue">{suggestedFamilies[0].familyName}</span>
                          </h4>
                        </div>
                        {selectedMemberKey && (
                          <button
                            type="button"
                            onClick={handleClearAutoFill}
                            className="text-[10px] font-bold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {suggestedFamilies[0].allMembers?.map((m, mIdx) => {
                          const key = `${suggestedFamilies[0].userId}-${mIdx}`;
                          const isSelected = selectedMemberKey === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleSelectFamilyMember(suggestedFamilies[0], m, mIdx)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-white text-gray-800 border border-amber-200 hover:bg-amber-100/50'
                              }`}
                            >
                              {isSelected ? <FiCheckCircle /> : <FiUserCheck />}
                              <span>{m.name}</span>
                              <span className="text-[10px] opacity-80">({m.role})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="church-label">Role in Family *</label>
                    <select
                      {...register('familyRole', { required: 'Role is required' })}
                      className="church-input"
                    >
                      <option value="">Select role in household</option>
                      {FAMILY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {watchedFamilyRole === 'Other' && (
                      <input
                        {...register('familyRoleOther', { required: true })}
                        className="church-input mt-2"
                        placeholder="Please specify role"
                      />
                    )}
                    {errors.familyRole && <p className="text-red-500 text-[10px] mt-1">{errors.familyRole.message}</p>}
                  </div>

                  {/* Other Family Members Container */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-church-royal-blue">Other Family Members</h4>
                        <p className="text-[11px] text-gray-500">Add household members sharing the same Family ID</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => append({ name: '', role: '' })}
                        className="flex items-center gap-1.5 text-xs font-bold bg-church-gold text-white px-3 py-1.5 rounded-xl hover:bg-amber-600 transition-colors cursor-pointer"
                      >
                        <FiPlus /> Add Member
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {fields.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-gray-200 text-xs">
                          <div className="col-span-6">
                            <input
                              {...register(`familyMembers.${index}.name`, { required: true })}
                              className="church-input py-1.5 text-xs"
                              placeholder="Member Name"
                            />
                          </div>
                          <div className="col-span-5">
                            <select
                              {...register(`familyMembers.${index}.role`, { required: true })}
                              className="church-input py-1.5 text-xs"
                            >
                              <option value="">Role</option>
                              {FAMILY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {fields.length === 0 && (
                        <p className="text-center text-gray-400 text-xs py-3 italic">
                          No additional family members added
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mandatory Policies Checkboxes */}
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-2.5 text-xs text-gray-800">
                    <div className="font-bold text-church-royal-blue text-xs border-b border-amber-200/60 pb-1.5 flex items-center justify-between">
                      <span>Terms & Community Guidelines</span>
                      <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">Required</span>
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={e => setAgreeTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-church-gold border-gray-300 focus:ring-church-gold"
                      />
                      <span>
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={() => openPolicyModal('terms')}
                          className="text-church-gold font-bold hover:underline"
                        >
                          Terms & Conditions
                        </button>
                      </span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreePrivacy}
                        onChange={e => setAgreePrivacy(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-church-gold border-gray-300 focus:ring-church-gold"
                      />
                      <span>
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={() => openPolicyModal('privacy')}
                          className="text-church-gold font-bold hover:underline"
                        >
                          Privacy Policy
                        </button>
                      </span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeSecurity}
                        onChange={e => setAgreeSecurity(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-church-gold border-gray-300 focus:ring-church-gold"
                      />
                      <span>
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={() => openPolicyModal('security')}
                          className="text-church-gold font-bold hover:underline"
                        >
                          Security & Account Protection Policy
                        </button>
                      </span>
                    </label>
                  </div>

                  <div className="pt-4 flex items-center justify-between gap-3 border-t border-gray-100 mt-5">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 flex items-center gap-1 cursor-pointer"
                    >
                      <FiChevronLeft /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !agreeTerms || !agreePrivacy || !agreeSecurity}
                      className="btn-gold px-6 py-2.5 text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmitting ? 'Sending OTP...' : 'Send Verification OTP'} <FiMail />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: OTP Verification */}
              {currentStep === 3 && (
                <motion.div
                  key="modal-step3"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-5 max-w-md mx-auto py-2 text-center"
                >
                  <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
                    <FiKey size={26} />
                  </div>

                  <div>
                    <h3 className="font-display font-extrabold text-church-royal-blue text-lg">
                      Verify User Account
                    </h3>
                    <p className="text-gray-500 text-xs mt-1">
                      A 6-digit verification code has been sent to{' '}
                      <strong className="text-gray-900 font-semibold">{getValues('email') || getValues('phone')}</strong>
                    </p>
                  </div>

                  {/* Dev OTP Helper if available */}
                  {devOtp && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 flex items-center justify-between">
                      <span>Dev Auto-Fill OTP: <strong>{devOtp}</strong></span>
                      <button
                        type="button"
                        onClick={() => setValue('otp', devOtp)}
                        className="bg-amber-200 hover:bg-amber-300 text-amber-950 px-2.5 py-1 rounded font-bold cursor-pointer"
                      >
                        Auto Fill
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="church-label text-center block mb-1.5 font-bold text-church-royal-blue">
                      Enter 6-Digit OTP
                    </label>
                    <input
                      {...register('otp', { required: true, minLength: 6, maxLength: 6 })}
                      className="church-input text-center text-3xl tracking-[10px] font-mono font-extrabold h-14"
                      placeholder="••••••"
                      maxLength={6}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={handleSubmit(onVerifyOtp)}
                      disabled={isSubmitting || (watch('otp') || '').length !== 6}
                      className="btn-gold w-full justify-center py-3 text-sm font-bold shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? 'Verifying...' : 'Verify OTP & Create Account'}
                    </button>

                    <div className="flex items-center justify-between text-xs px-2 pt-1 text-gray-500">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendCooldown > 0}
                        className="text-amber-700 hover:text-amber-900 font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-gray-500 hover:text-gray-800 cursor-pointer"
                      >
                        Edit Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: Success Screen */}
              {currentStep === 4 && verifiedUser && (
                <motion.div
                  key="modal-step4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-5 text-center py-4"
                >
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-md">
                    <FiCheckCircle size={32} />
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      Active Member
                    </span>
                    <h3 className="font-display font-extrabold text-church-royal-blue text-2xl mt-2">
                      User Added Successfully!
                    </h3>
                    <p className="text-gray-600 text-xs mt-1 max-w-sm mx-auto">
                      <strong>{verifiedUser.name}</strong> is now registered as an active parish member and can sign in immediately.
                    </p>
                  </div>

                  {/* Member ID & Family ID Card */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl max-w-md mx-auto text-left text-xs">
                    <div>
                      <span className="text-gray-500 block text-[11px]">Member ID:</span>
                      <span className="font-mono font-extrabold text-amber-700 text-sm">
                        {verifiedUser.parishMemberId || 'SJDB_M04'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Family ID:</span>
                      <span className="font-mono font-extrabold text-purple-700 text-sm">
                        {verifiedUser.familyId || 'SJDB_FAM-04'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Contact:</span>
                      <span className="font-bold text-gray-800">{verifiedUser.phone}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Sub-Station:</span>
                      <span className="font-bold text-gray-800">{verifiedUser.subStation || 'Main Parish'}</span>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handleModalClose}
                      className="btn-gold px-8 py-3 text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
                    >
                      Done & View Members List
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </motion.div>

      {/* Reusable Policy Terms Modal */}
      <PolicyModal
        isOpen={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        initialTab={policyTab}
      />
    </div>
  );
}
