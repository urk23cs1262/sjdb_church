import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiPlus, FiTrash2, FiChevronRight, FiChevronLeft, FiUsers, FiUserCheck, FiCheckCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi';
import api from '../../services/api';
import churchLogo from '../../assets/church_extirior.png';


import PolicyModal from '../../components/common/common_policy_modal';

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
const FAMILY_ROLES = ['Father', 'Mother', 'Elder Son', 'Younger Son', 'Elder Daughter', 'Younger Daughter', 'Grandfather', 'Grandmother', 'Other'];

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, handleSubmit, control, watch, trigger, setValue, getValues, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      familyMembers: []
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "familyMembers"
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1, 2, 3 (OTP)
  const [userId, setUserId] = useState(null);
  const [devOtp, setDevOtp] = useState(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);

  // Policy agreements state
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeSecurity, setAgreeSecurity] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyTab, setPolicyTab] = useState('terms');

  const openPolicyModal = (tab) => {
    setPolicyTab(tab);
    setPolicyModalOpen(true);
  };

  // Family lookup state
  const [suggestedFamilies, setSuggestedFamilies] = useState([]);
  const [isFetchingFamilies, setIsFetchingFamilies] = useState(false);
  const [selectedMemberKey, setSelectedMemberKey] = useState(null);

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

    // Auto-fill familyRole
    if (FAMILY_ROLES.includes(member.role)) {
      setValue('familyRole', member.role);
    } else {
      setValue('familyRole', 'Other');
      setValue('familyRoleOther', member.role);
    }

    // Auto-fill subStation if not already filled or matching
    if (family.subStation) {
      setValue('subStation', family.subStation);
    }

    // Filter out selected member and populate remaining family members
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

  const watchedFamilyRole = watch('familyRole');
  const watchedMembers = watch('familyMembers');
  const watchedPassword = useWatch({ control, name: 'password' }) || '';
  const watchedConfirmPassword = useWatch({ control, name: 'confirmPassword' }) || '';

  const isConfirmTyped = watchedConfirmPassword.length > 0;
  // Passwords match only when both are non-empty AND equal
  const isPasswordMatched = isConfirmTyped && Boolean(watchedPassword) && watchedConfirmPassword === watchedPassword;
  // Show mismatch only when the user has typed at least as many chars as the password
  // (avoids false-mismatch while still typing a longer password)
  const isPasswordMismatch = isConfirmTyped && Boolean(watchedPassword) &&
    watchedConfirmPassword.length >= watchedPassword.length &&
    watchedConfirmPassword !== watchedPassword;
  // Still typing — confirm is a prefix of password but not yet equal
  const isTypingMatch = isConfirmTyped && Boolean(watchedPassword) &&
    watchedPassword.startsWith(watchedConfirmPassword) && !isPasswordMatched;

  const onRegister = async (data) => {
    try {
      // Map custom roles if "Other" was selected
      const payload = {
        ...data,
        familyRole: data.familyRole === 'Other' ? data.familyRoleOther : data.familyRole,
        familyMembers: data.familyMembers?.map(m => ({
          name: m.name,
          role: m.role === 'Other' ? m.roleOther : m.role
        })) || []
      };

      const res = await api.post('/auth/register', payload);
      setUserId(res.data.userId);
      setCurrentStep(3); // Go to OTP step
      toast.success(t('auth.otpSent') || 'Registration successful! Please verify OTP.');
      if (res.data.devOtp) {
        setDevOtp(res.data.devOtp);
        setIsOtpLoading(true);
        setTimeout(() => setIsOtpLoading(false), 5000);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Registration failed');
    }
  };

  const onVerifyOtp = async (data) => {
    try {
      const res = await api.post('/auth/verify-otp', { userId, otp: data.otp });
      toast.success('Verified! You can now log in.');
      navigate('/login');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid OTP');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${churchLogo})` }}
    >
      <div className="absolute inset-0 bg-church-gradient opacity-80" />
      <div className="absolute inset-0 z-0">
        {[...Array(8)].map((_, i) => (
          <motion.div key={i} className="absolute text-white/5 font-display text-8xl select-none"
            style={{ left: `${i * 15}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [-20, 20, -20] }} transition={{ duration: 4 + i, repeat: Infinity }}></motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl relative z-10">
        <div className="glass-card p-6 md:p-10">
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-3 shadow-gold-lg animate-float overflow-hidden border border-gold-400/50">
              <img src={churchLogo} alt="Logo" className="w-full h-full object-cover object-[center_20%] transform" />
            </div>
            <h1 className="font-display text-2xl font-bold text-church-royal-blue ">{t('auth.register') || 'Register'}</h1>
            <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest font-bold">Step {currentStep}/3</p>
          </div>

          <form onSubmit={handleSubmit(currentStep === 2 ? onRegister : handleNextStep)}>
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="church-label">Full Name *</label>
                      <input {...register('name', { required: 'Name is required' })} className="church-input" placeholder="Enter your name" />
                      {errors.name && <p className="text-red-500 text-[10px] mt-1">{errors.name.message}</p>}
                    </div>

                    


                    <div>
                      <label className="church-label">Date of Birth *</label>
                      <input type="date" {...register('dob', { required: 'DOB is required' })} className="church-input" />
                      {errors.dob && <p className="text-red-500 text-[10px] mt-1">{errors.dob.message}</p>}
                    </div>

                    <div>
                      <label className="church-label">Phone Number *</label>
                      <input {...register('phone', { required: 'Phone is required' })} className="church-input" placeholder="Enter your phone number" />
                      {errors.phone && <p className="text-red-500 text-[10px] mt-1">{errors.phone.message}</p>}
                    </div>

                    <div>
                      <label className="church-label">Email Address</label>
                      <input {...register('email')} type="email" className="church-input" placeholder="Enter your email address" />
                    </div>


                    <div>
                      <label className="church-label">Gender *</label>
                      <select {...register('gender', { required: 'Gender is required' })} className="church-input">
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      {errors.gender && <p className="text-red-500 text-[10px] mt-1">{errors.gender.message}</p>}
                    </div>
                    <div>
                      <label className="church-label">Sub-Station *</label>
                      <select {...register('subStation', { required: 'Sub-station is required' })} className="church-input">
                        <option value="">Select Sub-station</option>
                        {SUB_STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {errors.subStation && <p className="text-red-500 text-[10px] mt-1">{errors.subStation.message}</p>}
                    </div>
                    <div>
                      <label className="church-label">Family Name *</label>
                      <input {...register('familyName', { required: 'Family name is required' })} className="church-input" placeholder="Enter your family name" />
                      {errors.familyName && <p className="text-red-500 text-[10px] mt-1">{errors.familyName.message}</p>}
                    </div>
                    

                    <div>
                      <label className="church-label">Address *</label>
                      <textarea {...register('address', { required: 'Address is required' })} rows={3} className="church-input py-2.5 min-h-[85px] resize-y" placeholder="Enter your full address" />
                      {errors.address && <p className="text-red-500 text-[10px] mt-1">{errors.address.message}</p>}
                    </div>
                    <div>
                      <label className="church-label">Password *</label>
                      <div className="relative">
                        <input {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })} type={showPass ? 'text' : 'password'} className="church-input pr-10" placeholder="Enter your password (6+ Characters)" />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
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
                              ? 'border-emerald-500 bg-emerald-50/20 focus:border-emerald-600 focus:ring-emerald-500/20' 
                              : isPasswordMismatch 
                                ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-red-500/20' 
                                : isTypingMatch
                                  ? 'border-amber-400 bg-amber-50/10 focus:border-amber-500'
                                  : ''
                          }`}
                          placeholder="Re-enter your password"
                        />
                        <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {showConfirmPass ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>

                      {/* Real-time live password match status indicator while typing */}
                      {isConfirmTyped ? (
                        <div className={`text-xs font-bold mt-1.5 flex items-center gap-1.5 transition-colors ${
                          isPasswordMatched ? 'text-emerald-600' : isPasswordMismatch ? 'text-red-500' : 'text-amber-700 font-medium'
                        }`}>
                          {isPasswordMatched && <FiCheckCircle className="text-sm text-emerald-600 flex-shrink-0" />}
                          {isPasswordMismatch && <FiXCircle className="text-sm text-red-500 flex-shrink-0" />}
                          {isTypingMatch && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />}
                          <span>
                            {isPasswordMatched ? 'Password matched' : isPasswordMismatch ? 'Passwords do not match' : 'Matching password...'}
                          </span>
                        </div>
                      ) : errors.confirmPassword ? (
                        <p className="text-red-500 text-xs font-bold mt-1.5">{errors.confirmPassword.message}</p>
                      ) : null}
                    </div>
                  </div>
                  <button type="button" onClick={handleNextStep} className="btn-gold w-full justify-center py-3.5 mt-6 group">
                    Next: Family Details <FiChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="space-y-6"
                >
                  {isFetchingFamilies && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800 text-xs">
                      <FiRefreshCw className="animate-spin text-amber-600 text-base" />
                      <span>Searching for existing family members registered under "{watch('familyName')}"...</span>
                    </div>
                  )}

                  {!isFetchingFamilies && suggestedFamilies.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50/90 to-amber-100/50 rounded-2xl p-5 border border-amber-300/60 shadow-sm space-y-4">
                      <div className="flex items-start justify-between gap-2 border-b border-amber-200/60 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                            <FiUsers className="text-lg" />
                          </div>
                          <div>
                            <h3 className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
                              Registered Family Found: <span className="text-church-royal-blue">{suggestedFamilies[0].familyName}</span>
                            </h3>
                            <p className="text-amber-800/80 text-[11px] mt-0.5">
                              Click your profile below to auto-fill your role and existing family members
                            </p>
                          </div>
                        </div>
                        {selectedMemberKey && (
                          <button
                            type="button"
                            onClick={handleClearAutoFill}
                            className="text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-200/60 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <FiRefreshCw className="text-xs" /> Reset
                          </button>
                        )}
                      </div>

                      {suggestedFamilies.map((fam, fIdx) => (
                        <div key={fam.userId || fIdx} className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-amber-800/90 font-medium">
                            <span>Sub-Station: <strong className="text-amber-900">{fam.subStation || 'Main Parish'}</strong></span>
                            {fam.familyId && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-purple-100 text-purple-950 border border-purple-300">
                                Family ID: {fam.familyId}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {fam.allMembers.map((m, mIdx) => {
                              const key = `${fam.userId}-${mIdx}`;
                              const isSelected = selectedMemberKey === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => handleSelectFamilyMember(fam, m, mIdx)}
                                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${isSelected
                                      ? 'bg-amber-600 text-white shadow-amber-600/30 ring-2 ring-amber-600 ring-offset-1 scale-[1.02]'
                                      : 'bg-white hover:bg-amber-50 text-gray-800 border border-amber-200/80 hover:border-amber-400'
                                    }`}
                                >
                                  {isSelected ? <FiCheckCircle className="text-white text-sm" /> : <FiUserCheck className="text-amber-600 text-sm" />}
                                  <span>{m.name}</span>
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isSelected ? 'bg-amber-700 text-amber-100' : 'bg-amber-100 text-amber-900'}`}>
                                    {m.role}
                                  </span>
                                  {m.parishMemberId && m.parishMemberId !== '—' && (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${isSelected ? 'bg-amber-800 text-white' : 'bg-purple-100 text-purple-900 border border-purple-300'}`}>
                                      {m.parishMemberId}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="church-label">Your Role in Family *</label>

                    <select {...register('familyRole', { required: 'Role is required' })} className="church-input">
                      <option value="">Select your role</option>
                      {FAMILY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {watchedFamilyRole === 'Other' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
                        <input {...register('familyRoleOther', { required: true })} className="church-input" placeholder="Please specify your role" />
                      </motion.div>
                    )}
                  </div>

                  <div className="bg-church-royal-blue/5 rounded-2xl p-6 border border-church-royal-blue/10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-church-royal-blue font-bold text-lg">Other Family Members</h3>
                        <p className="text-gray-500 text-xs">Add details for other people in your household</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => append({ name: '', role: '' })}
                        className="flex items-center gap-2 text-xs font-bold bg-church-gold text-white px-4 py-2 rounded-xl shadow-gold hover:shadow-gold-lg transition-all active:scale-95"
                      >
                        <FiPlus /> ADD MEMBER
                      </button>
                    </div>

                    {/* Family & Member ID Auto-Assignment Indicator */}
                    <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-900 flex items-center justify-between font-mono shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base"></span>
                        <div>
                          <span className="font-bold block text-[11px] font-sans text-blue-950">Auto-Assigned Family & Member IDs:</span>
                          <span className="text-[10px] text-blue-800 font-medium font-sans block">
                            All members in family <strong>"{watch('familyName') || 'Household'}"</strong> will share the same Family ID.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-purple-100 text-purple-950 border border-purple-300">
                          Shared Family ID
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                      {fields.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-12 gap-3 items-start bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-white shadow-sm hover:shadow-md transition-all">
                          <div className="col-span-6">
                            <label className="text-[11px] text-church-royal-blue font-bold mb-1.5 flex items-center justify-between uppercase tracking-wider">
                              <span>Member Name</span>
                              <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                Member #{index + 2}
                              </span>
                            </label>
                            <input {...register(`familyMembers.${index}.name`, { required: true })} className="church-input py-2 text-sm border-church-royal-blue/10 shadow-inner" placeholder="Enter name" />
                          </div>
                          <div className="col-span-5">
                            <label className="text-[11px] text-church-royal-blue font-bold mb-1.5 flex items-center justify-between uppercase tracking-wider">
                              <span>Role</span>
                              <span className="text-[9px] font-mono font-bold text-purple-900 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-300">
                                Same Family ID
                              </span>
                            </label>
                            <select {...register(`familyMembers.${index}.role`, { required: true })} className="church-input py-2 text-sm border-church-royal-blue/10 shadow-inner">
                              <option value="">Select Role</option>
                              {FAMILY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {watchedMembers[index]?.role === 'Other' && (
                              <input {...register(`familyMembers.${index}.roleOther`, { required: true })} className="church-input mt-2 py-1.5 text-xs" placeholder="Specify role" />
                            )}
                          </div>
                          <div className="col-span-1 pt-6 flex justify-center">
                            <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                              <FiTrash2 className="text-lg" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {fields.length === 0 && (
                        <div className="text-center py-8 bg-white/40 rounded-2xl border border-dashed border-gray-300">
                          <p className="text-gray-500 text-sm">No other members added yet</p>
                          <p className="text-gray-400 text-[10px] mt-1">Click the "+ ADD MEMBER" button to add household members</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Policy Checkboxes */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs text-gray-700">
                    <div className="font-bold text-church-royal-blue text-sm border-b border-slate-200 pb-2 flex items-center justify-between">
                      <span> Terms & Policy Agreements</span>
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">Required</span>
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={e => setAgreeTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-church-gold border-gray-300 focus:ring-church-gold"
                      />
                      <span>
                        I have read and agree to the{' '}
                        <button
                          type="button"
                          onClick={() => openPolicyModal('terms')}
                          className="text-church-gold font-bold hover:underline"
                        >
                          Terms & Conditions
                        </button>
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreePrivacy}
                        onChange={e => setAgreePrivacy(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-church-gold border-gray-300 focus:ring-church-gold"
                      />
                      <span>
                        I have read and understand the{' '}
                        <button
                          type="button"
                          onClick={() => openPolicyModal('privacy')}
                          className="text-church-gold font-bold hover:underline"
                        >
                          Privacy Policy
                        </button>
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeSecurity}
                        onChange={e => setAgreeSecurity(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-church-gold border-gray-300 focus:ring-church-gold"
                      />
                      <span>
                        I understand and agree to the{' '}
                        <button
                          type="button"
                          onClick={() => openPolicyModal('security')}
                          className="text-church-gold font-bold hover:underline"
                        >
                          Security & Account Protection Policy
                        </button>
                      </span>
                    </label>

                    <p className="text-[11px] text-gray-500 pt-2 border-t border-slate-200/80">
                      By creating an account, you agree to follow our community guidelines and use this platform responsibly.
                    </p>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button type="button" onClick={prevStep} className="flex-1 btn-ghost justify-center py-3.5">
                      <FiChevronLeft className="mr-2" /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !agreeTerms || !agreePrivacy || !agreeSecurity}
                      className="flex-[2] btn-gold justify-center py-3.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {isSubmitting ? ' Processing...' : 'Create Account & Verify OTP'}
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                >
                  <div className="space-y-6 max-w-sm mx-auto">
                    <div className="text-center space-y-2">
                      <p className="text-black font-bold">OTP Verification</p>
                      <p className="text-black-400 text-xs">An OTP has been sent to your email for verification.</p>
                    </div>

                    {devOtp && (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex flex-col items-center justify-center gap-2 mb-4 min-h-[76px]">
                        {isOtpLoading ? (
                          <div className="flex flex-col items-center gap-2 w-full px-4 py-1">
                            <p className="text-amber-800 text-xs font-semibold">Sending...</p>
                            <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden">
                              <motion.div
                                className="bg-amber-500 h-full"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 5, ease: "linear" }}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-amber-800 text-xs font-semibold text-center">OTP sent to your email/phone</p>
                            <div className="flex items-center gap-3">
                              <span className="text-amber-900 font-mono font-bold text-xl tracking-widest">{devOtp.slice(0, 2)}xxxx</span>
                              <button
                                type="button"
                                onClick={() => setValue('otp', devOtp)}
                                className="bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
                              >
                                Auto Fill
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="church-label text-center block mb-2 font-bold text-church-gold">Enter 6-Digit OTP</label>
                      <input
                        {...register('otp', { required: true, minLength: 6, maxLength: 6 })}
                        className="church-input text-center text-3xl tracking-[12px] font-bold h-16"
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                    <button onClick={handleSubmit(onVerifyOtp)} type="button" disabled={isSubmitting} className="btn-gold w-full justify-center py-4 text-lg font-bold">
                      {isSubmitting ? ' Verifying...' : 'Verify & Login'}
                    </button>
                    <button type="button" onClick={async () => {
                      const res = await api.post('/auth/resend-otp', { userId });
                      toast.success('OTP resent!');
                      if (res.data.devOtp) {
                        setDevOtp(res.data.devOtp);
                        setIsOtpLoading(true);
                        setTimeout(() => setIsOtpLoading(false), 5000);
                      }
                    }} className="btn-ghost w-full justify-center text-xs mt-2">
                      Didn't receive OTP? Resend
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {currentStep === 1 && (
            <p className="text-center text-gray-500 text-xs mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-church-gold font-bold hover:underline">Login</Link>
            </p>
          )}
        </div>
      </motion.div>

      <PolicyModal
        isOpen={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        initialTab={policyTab}
      />
    </div>
  );
}
