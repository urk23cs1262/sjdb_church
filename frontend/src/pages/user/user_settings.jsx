import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiUser, FiArrowLeft, FiSave, FiPlus, FiTrash2, FiBell, FiGlobe,
  FiMoon, FiEye, FiUsers, FiHeart, FiCalendar, FiDollarSign, FiShield,
  FiSmartphone, FiDatabase, FiGrid, FiMapPin, FiPhoneCall, FiCrosshair,
  FiMessageSquare, FiInfo, FiCpu, FiRadio, FiKey, FiLock, FiLogOut, FiDownload,
  FiMail, FiVolume2, FiGift, FiBookOpen
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { GiPrayer, GiChurch, GiCrucifix } from 'react-icons/gi';
import api, { UPLOADS_URL, getMediaUrl } from '../../services/api';

import { useAuth } from '../../context/context_auth_context';
import { applyUserSettings } from '../../utils/applySettings';
import PendingApprovalModal from '../../components/user/PendingApprovalModal';
import { requestNotificationPermission, showNativeNotification } from '../../services/service_web_push';

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

const MASS_SCHEDULE_OPTIONS = [
  { id: 'sunday', label: 'Sunday: 6:30 AM & 8:30 AM (Tamil)' },
  { id: 'weekday', label: 'Wednesday – Saturday: 5:00 PM (Tamil)' }
];


const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Account & Profile', icon: <FiUser /> },
  { id: 'notifications', label: 'Notifications', icon: <FiBell /> },
  { id: 'language_theme', label: 'Language & Accessibility', icon: <FiGlobe /> },

  { id: 'privacy_data', label: 'Privacy & Data', icon: <FiEye /> },
  { id: 'family', label: 'Family Settings', icon: <FiUsers /> },
  { id: 'ministries_volunteer', label: 'Ministries & Volunteering', icon: <FiHeart /> },
  { id: 'prayer', label: 'Prayer Preferences', icon: <FiCalendar /> },
  // { id: 'donations', label: 'Donation Settings', icon: <FiDollarSign /> },
  { id: 'security', label: 'Security & Connected Accounts', icon: <FiShield /> },
  // { id: 'app_location', label: 'App & Location Preferences', icon: <FiGrid /> },
  { id: 'church_emergency', label: 'Church & Emergency Contact', icon: <FiCrosshair /> },
  // { id: 'ai_preferences', label: 'AI-Based Settings', icon: <FiCpu /> },
  // { id: 'admin_comm', label: 'Admin-Configurable Preferences', icon: <FiRadio /> },
  { id: 'feedback_about', label: 'Feedback & About', icon: <FiInfo /> },
];

export default function UserSettings() {
  const { user, fetchMe, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const [photo, setPhoto] = useState(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedPendingRequest, setSelectedPendingRequest] = useState(null);

  const { register, handleSubmit, control, watch, reset, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      dob: '',
      gender: '',
      subStation: '',
      familyName: '',
      address: '',
      familyRole: '',
      familyRoleOther: '',
      familyMembers: [],
      mass_reflection_language: 'ta',
      // Deep settings structure
      settings: {
        notifications: {
          eventReminders: true,
          massSchedule: true,
          prayerMeetings: true,
          feastDays: true,
          saintOfTheDay: true,
          donationReceipts: true,
          birthdayWishes: true,
          anniversaryWishes: true,
          whatsapp: true,
          email: true,
          inApp: true,
          push: true
        },
        language: 'en',
        theme: 'light',
        accessibility: {
          fontSize: 'normal',
          highContrast: false,
          reduceAnimations: false,
          screenReader: false
        },
        privacy: {
          visibility: 'members',
          showPhone: true,
          showEmail: true,
          showDob: false,
          showAddress: false
        },
        family: {
          familyHead: '',
          relationship: '',
          requestJoin: ''
        },
        ministries: ['Prayer Group'],
        volunteering: {
          availableDays: ['Sunday'],
          timeOfDay: ['Morning'],
          emergencyVolunteer: false,
          preferredMinistries: []
        },
        prayer: {
          dailyBibleVerse: true,
          saintOfTheDay: true,
          prayerReminder: true,
          rosaryReminder: true,
          massReminder: true
        },
        donations: {
          defaultAmount: 100,
          preferredPaymentMethod: 'UPI',
          recurringDonation: false
        },
        security: {
          twoFactorEnabled: false
        },
        appPreferences: {
          defaultHomePage: 'Dashboard',
          calendarView: 'Month',
          compactMode: false,
          animationsOn: true
        },
        location: {
          enableLocation: true,
          nearestParishSuggestions: true,
          locationBasedEvents: true
        },
        emergencyContact: {
          name: '',
          relationship: '',
          phone: ''
        },
        churchPreferences: {
          preferredParish: 'St. John de Britto Church (Kalayarkoil)',
          preferredMassTiming: ['Sunday: 6:30 AM & 8:30 AM (Tamil)'],
          preferredLanguage: 'Tamil',
          preferredPriest: ''
        },
        aiSettings: {
          notificationRecommendations: true,
          careerGuidance: false,
          spiritualGrowth: true,
          eventRecommendations: true,
          familyInsights: true,
          prayerSuggestions: true
        },
        adminCommPreferences: {
          receiveAnnouncements: true,
          receiveEmergencyAlerts: true,
          joinBetaFeatures: false,
          autoSyncFamily: true,
          allowStaffContact: true,
          receiveVolunteerRequests: true
        }
      }
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "familyMembers"
  });

  const [pushStatus, setPushStatus] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const pushChannelEnabled = watch('settings.notifications.push');

  const handleTogglePush = async () => {
    if (pushStatus === 'granted' && pushChannelEnabled) {
      // Disable Push
      setValue('settings.notifications.push', false, { shouldDirty: true });
      toast.success('Browser push pop-ups disabled');
    } else {
      // Enable Push
      const res = await requestNotificationPermission();
      setPushStatus(res);
      if (res === 'granted') {
        setValue('settings.notifications.push', true, { shouldDirty: true });
        toast.success('Browser push pop-ups enabled!');
        showNativeNotification({
          title: "St. John de Britto's Church ",
          body: " Push Alert Enabled! Real-time browser notifications active.",
          url: "/dashboard/settings"
        });
      } else if (res === 'denied') {
        toast.error('Notifications are blocked in your browser settings. See unblock instructions below.');
      }
    }
  };

  const handleTestPush = () => {
    showNativeNotification({
      title: "St. John de Britto's Church ",
      body: " Test Push Alert: Real-time browser notifications are working perfectly!",
      url: "/dashboard/settings"
    });
    toast.success('Test Push Alert sent!');
  };

  useEffect(() => {
    api.get('/permission-requests/user/pending').then(r => setPendingRequests(r.data.requests || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchMe();
  }, []);

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
        gender: user.gender || '',
        subStation: user.subStation || '',
        familyName: user.familyName || '',
        familyId: user.familyId || '',
        parishMemberId: user.parishMemberId || '',
        anbiyam: user.anbiyam || user.sccGroup || '',
        bloodGroup: user.bloodGroup || '',
        memberStatus: user.memberStatus || 'Active',
        weddingDate: user.weddingDate ? new Date(user.weddingDate).toISOString().split('T')[0] : '',
        role: user.role || 'user',
        address: user.address || '',
        sacraments: {
          baptismDate: user.sacraments?.baptismDate ? new Date(user.sacraments.baptismDate).toISOString().split('T')[0] : '',
          baptismParish: user.sacraments?.baptismParish || '',
          baptismCertificateNo: user.sacraments?.baptismCertificateNo || '',
          firstCommunionDate: user.sacraments?.firstCommunionDate ? new Date(user.sacraments.firstCommunionDate).toISOString().split('T')[0] : '',
          confirmationDate: user.sacraments?.confirmationDate ? new Date(user.sacraments.confirmationDate).toISOString().split('T')[0] : '',
          matrimonyDate: user.sacraments?.matrimonyDate ? new Date(user.sacraments.matrimonyDate).toISOString().split('T')[0] : '',
          spouseName: user.sacraments?.spouseName || ''
        },
        familyRole: FAMILY_ROLES.includes(user.familyRole) ? (user.familyRole || '') : (user.familyRole ? 'Other' : ''),
        familyRoleOther: FAMILY_ROLES.includes(user.familyRole) ? '' : (user.familyRole || ''),
        familyMembers: user.familyMembers?.map(m => {
          const isStd = FAMILY_ROLES.includes(m.role);
          return {
            name: m.name,
            role: isStd ? (m.role || '') : (m.role ? 'Other' : ''),
            roleOther: isStd ? '' : (m.role || '')
          };
        }) || [],
        mass_reflection_language: user.mass_reflection_language || user.settings?.notifications?.mass_reflection_language || 'ta',

        settings: {
          notifications: {
            eventReminders: true,
            massSchedule: true,
            prayerMeetings: true,
            feastDays: true,
            saintOfTheDay: true,
            donationReceipts: true,
            birthdayWishes: true,
            anniversaryWishes: true,
            whatsapp: true,
            email: true,
            inApp: true,
            push: true,
            ...(user.settings?.notifications || {})
          },
          language: user.settings?.language || user.preferredLanguage || 'en',
          theme: user.settings?.theme || 'light',
          accessibility: {
            fontSize: 'normal',
            highContrast: false,
            reduceAnimations: false,
            screenReader: false,
            ...(user.settings?.accessibility || {})
          },
          privacy: {
            visibility: 'members',
            showPhone: true,
            showEmail: true,
            showDob: false,
            showAddress: false,
            ...(user.settings?.privacy || {})
          },
          family: {
            familyHead: user.familyName ? `${user.familyName} Head` : '',
            relationship: user.familyRole || '',
            requestJoin: '',
            ...(user.settings?.family || {})
          },
          ministries: user.settings?.ministries || ['Prayer Group'],
          volunteering: {
            availableDays: ['Sunday'],
            timeOfDay: ['Morning'],
            emergencyVolunteer: false,
            preferredMinistries: [],
            ...(user.settings?.volunteering || {})
          },
          prayer: {
            dailyBibleVerse: true,
            saintOfTheDay: true,
            prayerReminder: true,
            rosaryReminder: true,
            massReminder: true,
            ...(user.settings?.prayer || {})
          },
          donations: {
            defaultAmount: 100,
            preferredPaymentMethod: 'UPI',
            recurringDonation: false,
            ...(user.settings?.donations || {})
          },
          security: {
            twoFactorEnabled: false,
            ...(user.settings?.security || {})
          },
          appPreferences: {
            defaultHomePage: 'Dashboard',
            calendarView: 'Month',
            compactMode: false,
            animationsOn: true,
            ...(user.settings?.appPreferences || {})
          },
          location: {
            enableLocation: true,
            nearestParishSuggestions: true,
            locationBasedEvents: true,
            ...(user.settings?.location || {})
          },
          emergencyContact: {
            name: '',
            relationship: '',
            phone: '',
            ...(user.settings?.emergencyContact || {})
          },
          churchPreferences: {
            preferredParish: 'St. John de Britto Church (Kalayarkoil)',
            preferredLanguage: 'Tamil',
            preferredPriest: '',
            ...(user.settings?.churchPreferences || {}),
            preferredMassTiming: Array.isArray(user.settings?.churchPreferences?.preferredMassTiming)
              ? user.settings.churchPreferences.preferredMassTiming
              : (user.settings?.churchPreferences?.preferredMassTiming ? [user.settings.churchPreferences.preferredMassTiming] : ['Sunday: 6:30 AM & 8:30 AM (Tamil)'])
          },

          aiSettings: {
            notificationRecommendations: true,
            careerGuidance: false,
            spiritualGrowth: true,
            eventRecommendations: true,
            familyInsights: true,
            prayerSuggestions: true,
            ...(user.settings?.aiSettings || {})
          },
          adminCommPreferences: {
            receiveAnnouncements: true,
            receiveEmergencyAlerts: true,
            joinBetaFeatures: false,
            autoSyncFamily: true,
            allowStaffContact: true,
            receiveVolunteerRequests: true,
            ...(user.settings?.adminCommPreferences || {})
          }
        }
      });
    }
  }, [user, reset]);

  const watchedFamilyRole = watch('familyRole');
  const watchedMembers = watch('familyMembers');
  const watchedSettings = watch('settings');

  const onSaveProfile = async (formDataRaw) => {
    try {
      const formData = new FormData();
      const processedData = {
        ...formDataRaw,
        familyRole: formDataRaw.familyRole === 'Other' ? formDataRaw.familyRoleOther : formDataRaw.familyRole,
        familyMembers: formDataRaw.familyMembers?.map(m => ({
          name: m.name,
          role: m.role === 'Other' ? m.roleOther : m.role
        })) || []
      };

      Object.entries(processedData).forEach(([k, v]) => {
        if (k === 'familyMembers' || k === 'settings' || k === 'sacraments') {
          formData.append(k, JSON.stringify(v));
        } else if (v !== undefined && v !== null) {
          formData.append(k, v);
        }
      });
      if (isPhotoRemoved && !photo) {
        formData.append('removeProfilePhoto', 'true');
      } else if (photo) {
        formData.append('photo', photo);
      }

      await api.put('/users/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Also sync settings sub-document
      await api.put('/users/settings', { settings: formDataRaw.settings });

      // Apply settings immediately across the website
      applyUserSettings(formDataRaw.settings);

      setPhoto(null);
      setIsPhotoRemoved(false);
      await fetchMe();
      toast.success('Settings saved successfully!');


    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save settings');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      return toast.error('Please enter current and new password');
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    setIsChangingPassword(true);
    try {
      await api.put('/users/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password update failed');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDownloadData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `user_data_${user?.name || 'profile'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('User data exported successfully!');
  };

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast.success('Local cache cleared! Refreshing page...');
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <div className="min-h-screen pt-24 bg-church-cream pb-16">
      {/* Header Banner */}
      <div className="bg-gray-600 py-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link to="/dashboard" className="text-gold-400 text-sm hover:underline flex items-center gap-1 mb-2 ml-8">
              <FiArrowLeft /> Back to Dashboard
            </Link>
            <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3 ml-8">
              Settings
            </h1>
            {/* <p className="text-gray-300 text-xs mt-1">
              Personalize your account, notifications, privacy, family preferences, and app experience
            </p> */}
          </div>
          {/* <button
            onClick={handleSubmit(onSaveProfile)}
            disabled={isSubmitting}
            className="btn-gold py-3 px-8 text-sm font-bold shadow-gold-lg self-start md:self-auto flex items-center gap-2 mr-8"
          >
            <FiSave className="text-lg" /> {isSubmitting ? 'Saving...' : 'Save All Settings'}
          </button> */}
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Pending Settings Change Request Banner */}
        {pendingRequests.length > 0 && (
          <div className="space-y-4 mb-8">
            {pendingRequests.map(req => (
              <motion.div key={req._id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 border-2 border-church-gold rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-church-gold text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
                    <FiShield className="text-xl" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base">Administrator Settings Change Request</h3>
                      <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Approval Required</span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 mt-0.5">
                      <span className="font-bold">{req.adminId?.name || 'Administrator'}</span> requested changes to your account settings.
                    </p>
                    {req.reason && <p className="text-xs text-amber-800 italic mt-1">"{req.reason}"</p>}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPendingRequest(req)}
                  className="btn-gold px-4 py-2 text-xs sm:text-sm whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5 shadow-gold"
                >
                  <FiShield /> Review & Respond
                </button>
              </motion.div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">


          {/* Sidebar Tabs */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-2">
            <div className="church-card p-3 sticky top-28 shadow-sm">
              <p className="text-[11px] font-bold text-church-royal-blue uppercase tracking-wider px-3 py-2 border-b border-gray-100 mb-2">
                Settings Menu
              </p>
              <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                {SETTINGS_SECTIONS.map((sec) => {
                  const isActive = activeTab === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActiveTab(sec.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${isActive
                          ? 'bg-church-gold text-white shadow-gold font-bold scale-[1.01]'
                          : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <span className={`text-sm ${isActive ? 'text-white' : 'text-church-gold'}`}>{sec.icon}</span>
                      <span className="truncate">{sec.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="lg:col-span-8 xl:col-span-9">
            <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-6">

              {/* 1. Account & Profile */}
              {activeTab === 'account' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiUser className="text-church-gold" />Profile
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Manage your basic personal profile details and credentials</p>
                  </div>

                  <div className="flex items-center gap-5 pb-6 border-b border-gray-100">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-church-gradient flex items-center justify-center overflow-hidden shadow-gold">
                        {photo ? (
                          <img src={URL.createObjectURL(photo)} className="w-full h-full object-cover" />
                        ) : (user?.profilePhoto && !isPhotoRemoved) ? (
                          <img src={getMediaUrl(user.profilePhoto)} className="w-full h-full object-cover" />
                        ) : (
                          <FiUser className="text-white text-3xl" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 w-7 h-7 bg-church-gold rounded-full flex items-center justify-center cursor-pointer hover:bg-church-gold-light transition-colors shadow border-2 border-white text-white" title="Upload Photo">
                        <FiPlus className="text-white text-sm" />
                        <input type="file" accept="image/*" className="hidden" onChange={e => { setPhoto(e.target.files[0]); setIsPhotoRemoved(false); }} />
                      </label>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-800 text-lg">{user?.name}</h3>
                        {user?.parishMemberId && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-mono font-bold px-2 py-0.5 rounded-full shadow-sm">
                            {user.parishMemberId}
                          </span>
                        )}
                        {user?.familyId && (
                          <span className="bg-blue-100 text-blue-900 border border-blue-300 text-xs font-mono font-bold px-2 py-0.5 rounded-full shadow-sm">
                            {user.familyId}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mb-1.5 flex flex-wrap items-center gap-1.5">
                        {user?.email && <span>{user.email}</span>}
                        {user?.email && user?.phone && <span>•</span>}
                        {user?.phone && <span>{user.phone}</span>}
                      </p>
                      {(photo || (user?.profilePhoto && !isPhotoRemoved)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhoto(null);
                            setIsPhotoRemoved(true);
                          }}
                          className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 font-bold px-2 py-1 rounded-md transition-colors border border-red-200"
                        >
                          <FiTrash2 size={12} /> Remove Profile Photo
                        </button>
                      )}
                      {isPhotoRemoved && !photo && (
                        <p className="text-[11px] text-red-600 font-semibold mt-1">Photo will be removed on Save</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="church-label">Full Name *</label>
                      <input {...register('name', { required: true })} className="church-input" />
                    </div>
                    <div>
                      <label className="church-label">Gender</label>
                      <select {...register('gender')} className="church-select">
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="church-label">Date of Birth</label>
                      <input {...register('dob')} type="date" className="church-input" />
                    </div>
                    <div>
                      <label className="church-label">Phone Number *</label>
                      <input {...register('phone', { required: true })} className="church-input" placeholder="Enter phone number" />
                    </div>
                    <div>
                      <label className="church-label">Email Address</label>
                      <input {...register('email')} type="email" className="church-input" />
                    </div>
                    <div>
                      <label className="church-label">Parish Member ID</label>
                      <input value={user?.parishMemberId || ''} disabled className="church-input bg-amber-50/50 font-mono font-bold text-church-royal-blue cursor-not-allowed border-amber-300/60" placeholder="Auto-assigned" />
                    </div>
                    <div>
                      <label className="church-label">Family ID</label>
                      <input value={user?.familyId || ''} disabled className="church-input bg-purple-50/50 font-mono font-bold text-purple-700 cursor-not-allowed border-purple-200" placeholder="Auto-assigned" />
                    </div>
                    <div>
                      <label className="church-label">Family Name</label>
                      <input {...register('familyName')} className="church-input" placeholder="Enter your family name" />
                    </div>
                    <div>
                      <label className="church-label">Anbiyam Name</label>
                      <input {...register('anbiyam')} className="church-input" placeholder="e.g. Enter Your's Anbiyam" />
                    </div>
                    <div>
                      <label className="church-label">Sub-Station</label>
                      <select {...register('subStation')} className="church-select">
                        <option value="">Select Sub-station</option>
                        {SUB_STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="church-label">Blood Group</label>
                      <input
                        {...register('bloodGroup')}
                        list="blood-group-options"
                        className="church-input"
                        placeholder="e.g. A+, B-, O+, AB+"
                        autoComplete="off"
                      />
                      <datalist id="blood-group-options">
                        <option value="A+" />
                        <option value="A-" />
                        <option value="B+" />
                        <option value="B-" />
                        <option value="O+" />
                        <option value="O-" />
                        <option value="AB+" />
                        <option value="AB-" />
                      </datalist>
                    </div>
                    {/* <div>
                      <label className="church-label">Member Status</label>
                      <select {...register('memberStatus')} className="church-select">
                        <option value="Active"> Active</option>
                        <option value="Inactive"> Inactive</option>
                        <option value="Transferred"> Transferred</option>
                        <option value="Deceased"> Deceased</option>
                      </select>
                    </div> */}
                    <div>
                      <label className="church-label">Wedding Date (Anniversary)</label>
                      <input {...register('weddingDate')} type="date" className="church-input" />
                    </div>
                    {/* <div>
                      <label className="church-label">User Role *</label>
                      <select {...register('role')} className="church-select font-semibold" disabled={user?.role !== 'admin'}>
                        <option value="user">User (Parish Member)</option>
                        <option value="admin">Admin</option>
                        <option value="content_editor">Content Editor</option>
                        <option value="tech_team">Tech Team</option>
                      </select>
                    </div> */}
                    <div className="md:col-span-2">
                      <label className="church-label">Residential Address</label>
                      <textarea {...register('address')} rows={2} className="church-input py-2.5 resize-none" placeholder="Enter your full residential address" />
                    </div>
                  </div>

                  {/* Sacramental Milestones & Certificates */}
                  <div className="bg-amber-50/50 border border-amber-200 p-5 rounded-2xl space-y-4">
                    <h3 className="font-bold text-church-royal-blue text-sm flex items-center gap-2">
                      <span></span> SACRAMENTAL MILESTONES & CERTIFICATES
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="church-label">Baptism Date</label>
                        <input {...register('sacraments.baptismDate')} type="date" className="church-input bg-white" />
                      </div>
                      <div>
                        <label className="church-label">Baptism Parish</label>
                        <input {...register('sacraments.baptismParish')} className="church-input bg-white" placeholder="Parish name" />
                      </div>
                      <div>
                        <label className="church-label">Baptism Certificate No.</label>
                        <input {...register('sacraments.baptismCertificateNo')} className="church-input bg-white" placeholder="Certificate #" />
                      </div>
                      <div>
                        <label className="church-label">First Holy Communion Date</label>
                        <input {...register('sacraments.firstCommunionDate')} type="date" className="church-input bg-white" />
                      </div>
                      <div>
                        <label className="church-label">Confirmation Date</label>
                        <input {...register('sacraments.confirmationDate')} type="date" className="church-input bg-white" />
                      </div>
                      <div>
                        <label className="church-label">Holy Matrimony Date</label>
                        <input {...register('sacraments.matrimonyDate')} type="date" className="church-input bg-white" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="church-label">Spouse Name</label>
                        <input {...register('sacraments.spouseName')} className="church-input bg-white" placeholder="Spouse full name" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 space-y-4">
                    <h3 className="font-bold text-church-royal-blue text-sm flex items-center gap-2">
                      <FiLock className="text-church-gold" /> Change Password
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="password"
                        placeholder="Current Password"
                        value={passwordData.currentPassword}
                        onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="church-input text-xs"
                      />
                      <input
                        type="password"
                        placeholder="New Password"
                        value={passwordData.newPassword}
                        onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className="church-input text-xs"
                      />
                      <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={passwordData.confirmPassword}
                        onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className="church-input text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="btn-outline-gold text-xs py-2 px-4"
                    >
                      {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>

                  <div className="pt-6 border-t border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-red-600">Danger Zone</p>
                      <p className="text-gray-500 text-[11px]">Logout from active sessions or terminate account</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={logout} className="btn-ghost text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 py-2 px-3">
                        <FiLogOut /> Logout All Devices
                      </button>
                      <button type="button" onClick={() => toast.error('Please contact Church Admin to request permanent account deletion.')} className="btn-ghost text-xs text-red-600 bg-red-50 hover:bg-red-100 py-2 px-3">
                        <FiTrash2 /> Delete Account
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 2. Notifications */}
              {activeTab === 'notifications' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                        <FiBell className="text-church-gold" /> Notification Settings & Channels
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">Choose what alerts you receive and enable real-time browser push pop-ups</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {pushStatus === 'granted' && pushChannelEnabled ? (
                        <>
                          <button
                            type="button"
                            onClick={handleTestPush}
                            className="px-3.5 py-2.5 rounded-xl bg-blue-50 text-church-royal-blue border border-blue-200 hover:bg-blue-100 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                            title="Send a test browser push alert"
                          >
                            <FiBell /> Test Alert
                          </button>
                          <button
                            type="button"
                            onClick={handleTogglePush}
                            className="px-4 py-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
                          >
                            <FiSmartphone /> Disable Browser Push
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleTogglePush}
                          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm ${
                            pushStatus === 'denied'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-church-royal-blue text-white hover:bg-church-royal-blue/90'
                          }`}
                        >
                          <FiSmartphone />
                          {pushStatus === 'denied'
                            ? ' Notifications Blocked in Browser'
                            : ' Enable Browser Push Pop-ups'}
                        </button>
                      )}
                    </div>
                  </div>

                  {pushStatus === 'denied' && (
                    <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
                      <FiInfo className="text-amber-600 flex-shrink-0 text-base mt-0.5" />
                      <div className="space-y-1">
                        <strong className="block font-bold text-amber-950">How to Unblock Browser Push Notifications:</strong>
                        <ol className="list-decimal list-inside space-y-1 text-amber-800">
                          <li>Click the <strong>tune/lock icon</strong> next to the web address URL in your browser top bar.</li>
                          <li>Find <strong>Notifications</strong> and change setting to <strong>Allow</strong>.</li>
                          <li>Refresh this page and tap <strong>Enable Browser Push Pop-ups</strong>.</li>
                        </ol>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delivery Channels (4 Channels)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'email', label: 'Email Notifications', icon: <FiMail className="text-church-royal-blue" /> },
                        { key: 'inApp', label: 'In-App / Website', icon: <FiBell className="text-amber-600" /> },
                        { key: 'push', label: 'Browser Push Pop-ups', icon: <FiGlobe className="text-church-royal-blue" /> },
                        { key: 'whatsapp', label: 'WhatsApp Bot', icon: <FaWhatsapp className="text-emerald-600" /> }
                      ].map(ch => (
                        <label key={ch.key} className="flex items-center gap-3 p-3.5 bg-blue-50/50 rounded-xl hover:bg-blue-50 cursor-pointer border border-blue-100 transition-colors">
                          <input
                            type="checkbox"
                            {...register(`settings.notifications.${ch.key}`)}
                            className="w-4 h-4 text-church-gold rounded focus:ring-church-gold"
                          />
                          <span className="text-sm">{ch.icon}</span>
                          <span className="text-xs font-bold text-church-royal-blue">{ch.label}</span>
                        </label>
                      ))}
                    </div>

                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-2">Notification Categories</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: 'eventReminders', label: 'Event Updates & Feasts', icon: <FiCalendar className="text-blue-500" /> },
                        { key: 'announcements', label: 'Parish Announcements', icon: <FiVolume2 className="text-orange-500" /> },
                        { key: 'donationReceipts', label: 'Donation Campaigns & Receipts', icon: <FiDollarSign className="text-yellow-600" /> },
                        { key: 'prayerMeetings', label: 'Prayer Requests & Meetings', icon: <GiPrayer className="text-purple-600" /> },
                        { key: 'massSchedule', label: 'Mass Schedule Changes', icon: <GiChurch className="text-indigo-600" /> },
                        { key: 'securityAlerts', label: 'Security Alerts & Logins', icon: <FiShield className="text-red-500" /> },
                        { key: 'saintOfTheDay', label: 'Saint of the Day', icon: <GiCrucifix className="text-church-gold" /> },
                        { key: 'birthdayWishes', label: 'Birthday & Anniversary Wishes', icon: <FiGift className="text-pink-500" /> }
                      ].map(item => (
                        <label key={item.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-100 transition-colors">
                          <input
                            type="checkbox"
                            {...register(`settings.notifications.${item.key}`)}
                            className="w-4 h-4 text-church-gold rounded focus:ring-church-gold"
                          />
                          <span className="text-sm">{item.icon}</span>
                          <span className="text-xs font-semibold text-gray-800">{item.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Daily Notification Language Preference */}
                    <div className="pt-5 border-t border-gray-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Mass Readings & Reflection Language</h3>
                          <p className="text-gray-500 text-xs mt-0.5">Select the language for your daily Mass Readings and Reflection across Email, In-App & WhatsApp</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { value: 'ta', label: 'தமிழ் (Tamil — Default)', sub: 'Tamil readings & reflection' },
                          { value: 'en', label: 'English', sub: 'English readings & reflection' },
                          { value: 'both', label: 'தமிழ் + English', sub: 'Both Tamil & English' }
                        ].map(opt => (
                          <label key={opt.value} className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-200 transition-colors">
                            <input
                              type="radio"
                              value={opt.value}
                              {...register('mass_reflection_language')}
                              className="mt-0.5 w-4 h-4 text-church-gold focus:ring-church-gold"
                            />
                            <div>
                              <div className="text-xs font-bold text-church-royal-blue">{opt.label}</div>
                              <div className="text-[11px] text-gray-500">{opt.sub}</div>
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                        <FiBookOpen className="text-church-gold text-sm flex-shrink-0" />
                        <span>Daily Bible Verses and Saint of the Day are always delivered bilingually (Tamil + English) for all members.</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Language & Accessibility */}
              {activeTab === 'language_theme' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiGlobe className="text-church-gold" /> Language & Accessibility
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Customize language and accessibility options</p>
                  </div>

                  <div>
                    <label className="church-label">Preferred Language</label>
                    <select {...register('settings.language')} className="church-select max-w-md">
                      <option value="en">English</option>
                      <option value="ta">தமிழ் (Tamil)</option>
                      {/* <option value="ml">மலையாளம் (Malayalam)</option>
                      <option value="hi">हिन्दी (Hindi)</option> */}
                    </select>
                  </div>


                  <div className="pt-6 border-t border-gray-100 space-y-4">
                    <h3 className="font-bold text-church-royal-blue text-sm">Accessibility Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="church-label">Font Size</label>
                        <select {...register('settings.accessibility.fontSize')} className="church-select">
                          <option value="normal">Normal</option>
                          <option value="large">Large</option>
                          <option value="xlarge">Extra Large</option>
                        </select>
                      </div>
                      {[
                        { key: 'highContrast', label: 'High Contrast Mode' },
                        { key: 'reduceAnimations', label: 'Reduce Animations' },
                        { key: 'screenReader', label: 'Screen Reader Support' }
                      ].map(acc => (
                        <label key={acc.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-100">
                          <input type="checkbox" {...register(`settings.accessibility.${acc.key}`)} className="w-4 h-4 text-church-gold rounded" />
                          <span className="text-xs font-semibold text-gray-800">{acc.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 5 & 6. Privacy & Data */}
              {activeTab === 'privacy_data' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiEye className="text-church-gold" />Privacy & Data Settings
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Control profile visibility and personal data exports</p>
                  </div>

                  <div>
                    <label className="church-label">Allow Profile Visible to</label>
                    <select {...register('settings.privacy.visibility')} className="church-select max-w-md">
                      <option value="everyone">Everyone</option>
                      <option value="members">Church Members Only</option>
                      <option value="family">Family Only</option>
                      <option value="only_me">Only Me</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <p className="church-label">Show Information to Others:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: 'showPhone', label: 'Show Phone Number' },
                        { key: 'showEmail', label: 'Show Email' },
                        { key: 'showDob', label: 'Show Birthday' },
                        { key: 'showAddress', label: 'Show Home Address' },
                      ].map(p => (
                        <label key={p.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-100">
                          <input type="checkbox" {...register(`settings.privacy.${p.key}`)} className="w-4 h-4 text-church-gold rounded" />
                          <span className="text-xs font-semibold text-gray-800">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 space-y-3">
                    <h3 className="font-bold text-church-royal-blue text-sm">Data & Storage Controls</h3>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={handleDownloadData} className="btn-outline-gold text-xs py-2.5 px-4 flex items-center gap-2">
                        <FiDownload /> Download My Data (JSON)
                      </button>
                      <button type="button" onClick={handleClearCache} className="btn-ghost text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 py-2.5 px-4">
                        Clear Browser Cache
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 7. Family Settings */}
              {activeTab === 'family' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                        <FiUsers className="text-church-gold" />Family Settings
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">Manage family name, role, and household members</p>
                    </div>
                    <button type="button" onClick={() => append({ name: '', role: '' })} className="btn-gold py-2 px-3 text-xs">
                      <FiPlus /> Add Family Member
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="church-label">Current Family Name</label>
                      <input {...register('familyName')} className="church-input" placeholder="e.g. Xavier Family" />
                    </div>
                    <div>
                      <label className="church-label">Your Role in Family</label>
                      <select {...register('familyRole')} className="church-select">
                        <option value="">Select Role</option>
                        {FAMILY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      {watchedFamilyRole === 'Other' && (
                        <input
                          {...register('familyRoleOther')}
                          className="church-input mt-2"
                          placeholder="Please specify your role"
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="font-bold text-sm text-church-royal-blue">Listed Household Members ({fields.length})</h3>
                    {fields.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-12 gap-3 items-start bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="col-span-6">
                          <input {...register(`familyMembers.${index}.name`)} className="church-input py-2 text-xs" placeholder="Member Name" />
                        </div>
                        <div className="col-span-5 space-y-2">
                          <select {...register(`familyMembers.${index}.role`)} className="church-select py-2 text-xs">
                            <option value="">Select Role</option>
                            {FAMILY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {watchedMembers?.[index]?.role === 'Other' && (
                            <input
                              {...register(`familyMembers.${index}.roleOther`)}
                              className="church-input py-2 text-xs"
                              placeholder="Specify custom role"
                            />
                          )}
                        </div>
                        <div className="col-span-1 pt-1 flex justify-center">
                          <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700 p-1.5">
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                </motion.div>
              )}

              {/* 8 & 9. Ministries & Volunteering */}
              {activeTab === 'ministries_volunteer' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiHeart className="text-church-gold" />Ministry & Volunteer Preferences
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Select ministries you wish to participate in and volunteer availability</p>
                  </div>

                  <div>
                    <label className="church-label mb-2 block">Select Ministries You're Interested In</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {['Choir', 'Youth', 'Sunday School', 'Altar Servers', 'Legion of Mary', 'Prayer Group'].map(m => (
                        <label key={m} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-100">
                          <input
                            type="checkbox"
                            value={m}
                            {...register('settings.ministries')}
                            className="w-4 h-4 text-church-gold rounded"
                          />
                          <span className="text-xs font-semibold text-gray-800">{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 space-y-4">
                    <h3 className="font-bold text-church-royal-blue text-sm">Volunteer Availability</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="church-label">Available Time of Day</label>
                        <select {...register('settings.volunteering.timeOfDay')} className="church-select">
                          <option value="Morning">Morning</option>
                          <option value="Afternoon">Afternoon</option>
                          <option value="Evening">Evening</option>
                          <option value="Anytime">Anytime</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-3 p-3 bg-amber-50/60 border border-amber-200 rounded-xl cursor-pointer self-end">
                        <input type="checkbox" {...register('settings.volunteering.emergencyVolunteer')} className="w-4 h-4 text-amber-600 rounded" />
                        <span className="text-xs font-bold text-amber-900">Emergency Volunteer On-Call</span>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 10. Prayer Preferences */}
              {activeTab === 'prayer' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiCalendar className="text-church-gold" />Prayer & Devotional Preferences
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Configure automated spiritual reminders and daily verses</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'dailyBibleVerse', label: 'Receive Daily Bible Verse' },
                      { key: 'saintOfTheDay', label: 'Receive Saint of the Day' },
                      { key: 'prayerReminder', label: 'Prayer Reminder' },
                      { key: 'rosaryReminder', label: 'Rosary Reminder' },
                      { key: 'massReminder', label: 'Mass Reminder' },
                    ].map(p => (
                      <label key={p.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-100">
                        <input type="checkbox" {...register(`settings.prayer.${p.key}`)} className="w-4 h-4 text-church-gold rounded" />
                        <span className="text-xs font-semibold text-gray-800">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 11. Donation Settings */}
              {activeTab === 'donations' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiDollarSign className="text-church-gold" />Donation Settings
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Default offering amounts and payment preferences</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="church-label">Default Offering Amount (₹)</label>
                      <input type="number" {...register('settings.donations.defaultAmount')} className="church-input" />
                    </div>
                    <div>
                      <label className="church-label">Preferred Payment Method</label>
                      <select {...register('settings.donations.preferredPaymentMethod')} className="church-select">
                        <option value="UPI">UPI / GPay / PhonePe</option>
                        <option value="Card">Credit / Debit Card</option>
                        <option value="NetBanking">Net Banking</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                    <Link to="/donate" className="btn-gold text-xs py-2.5 px-4">
                      Make a Donation Now
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* 12 & 13. Security & Connected Accounts */}
              {activeTab === 'security' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiShield className="text-church-gold" />Security & Connected Accounts
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Manage active devices and third-party logins</p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-800">Current Session Device</p>
                        <p className="text-[11px] text-gray-500">Windows Chrome • IP 127.0.0.1 (Active Now)</p>
                      </div>
                      <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-bold">Connected</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-sm text-church-royal-blue">Connected Accounts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {['Google Login', 'WhatsApp Number'].map((acc, i) => (
                        <div key={acc} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800">{acc}</span>
                          <span className="text-[10px] text-green-600 font-bold">Linked</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 14, 15 & 16. App & Location Preferences */}
              {activeTab === 'app_location' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiGrid className="text-church-gold" />App & Location Preferences
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Configure layout, views, and location-based alerts</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="church-label">Default Home Landing Page</label>
                      <select {...register('settings.appPreferences.defaultHomePage')} className="church-select">
                        <option value="Dashboard">User Dashboard</option>
                        <option value="Home">Church Home Page</option>
                        <option value="Mass">Mass Timings</option>
                      </select>
                    </div>
                    <div>
                      <label className="church-label">Default Calendar View</label>
                      <select {...register('settings.appPreferences.calendarView')} className="church-select">
                        <option value="Month">Month View</option>
                        <option value="List">List View</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {[
                      { key: 'enableLocation', label: 'Enable Location Services' },
                      { key: 'nearestParishSuggestions', label: 'Nearest Parish Suggestions' },
                      { key: 'locationBasedEvents', label: 'Location-based Event Notifications' },
                    ].map(loc => (
                      <label key={loc.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-100">
                        <input type="checkbox" {...register(`settings.location.${loc.key}`)} className="w-4 h-4 text-church-gold rounded" />
                        <span className="text-xs font-semibold text-gray-800">{loc.label}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 17 & 18. Church & Emergency Contact */}
              {activeTab === 'church_emergency' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiCrosshair className="text-church-gold" />Church & Emergency Preferences
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Specify preferred Mass times, parish priest, and emergency contact</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="church-label">Preferred Parish</label>
                      <select {...register('settings.churchPreferences.preferredParish')} className="church-select">
                        <option>Select Preferred Parish</option>
                        <option value="St. John de Britto Church (Kalayarkoil)">St. John de Britto Church (Kalayarkoil)</option>
                        {SUB_STATIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                  </div>

                  <div>
                    <label className="church-label mb-2 block">Preferred Mass Timings</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {MASS_SCHEDULE_OPTIONS.map(m => (
                        <label key={m.id} className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-100 transition-colors">
                          <input
                            type="checkbox"
                            value={m.label}
                            {...register('settings.churchPreferences.preferredMassTiming')}
                            className="w-4 h-4 text-church-gold rounded focus:ring-church-gold"
                          />
                          <span className="text-xs font-semibold text-gray-800">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 space-y-4">

                    <h3 className="font-bold text-church-royal-blue text-sm">Emergency Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="church-label">Contact Name</label>
                        <input {...register('settings.emergencyContact.name')} className="church-input" placeholder="Name" />
                      </div>
                      <div>
                        <label className="church-label">Relationship</label>
                        <input {...register('settings.emergencyContact.relationship')} className="church-input" placeholder="e.g. Spouse / Brother" />
                      </div>
                      <div>
                        <label className="church-label">Phone Number</label>
                        <input {...register('settings.emergencyContact.phone')} className="church-input" placeholder="Phone" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* AI-Based Settings */}
              {activeTab === 'ai_preferences' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiCpu className="text-church-gold" /> AI-Based Settings (Smart Personalization)
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Control AI recommendations for events, career guidance, and spiritual growth</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'notificationRecommendations', label: 'AI Notification Recommendations' },
                      // { key: 'careerGuidance', label: 'AI Career Guidance Preferences' },
                      { key: 'spiritualGrowth', label: 'AI Spiritual Growth Suggestions' },
                      { key: 'eventRecommendations', label: 'AI Event Recommendations' },
                      { key: 'familyInsights', label: 'AI Family Insights' },
                      { key: 'prayerSuggestions', label: 'AI Prayer Suggestions' },
                    ].map(ai => (
                      <label key={ai.key} className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-amber-50/50 to-white rounded-xl hover:bg-amber-50 cursor-pointer border border-amber-200/60 shadow-xs">
                        <input type="checkbox" {...register(`settings.aiSettings.${ai.key}`)} className="w-4 h-4 text-church-gold rounded" />
                        <span className="text-xs font-bold text-gray-800">{ai.label}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Admin-Configurable Preferences */}
              {activeTab === 'admin_comm' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiRadio className="text-church-gold" /> Admin-Configurable Member Preferences
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">Control permissions for church staff communication and automated syncing</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'receiveAnnouncements', label: 'Receive Parish Announcements' },
                      { key: 'receiveEmergencyAlerts', label: 'Receive Urgent Emergency Alerts' },
                      // { key: 'joinBetaFeatures', label: 'Join Beta Features' },
                      { key: 'autoSyncFamily', label: 'Auto-sync profile with family' },
                      { key: 'allowStaffContact', label: 'Allow church staff to contact me' },
                      { key: 'receiveVolunteerRequests', label: 'Receive volunteer requests' },
                    ].map(adm => (
                      <label key={adm.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer border border-gray-100">
                        <input type="checkbox" {...register(`settings.adminCommPreferences.${adm.key}`)} className="w-4 h-4 text-church-gold rounded" />
                        <span className="text-xs font-semibold text-gray-800">{adm.label}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 19 & 20. Feedback & About */}
              {activeTab === 'feedback_about' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 md:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiInfo className="text-church-gold" />Feedback & App Info
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">App version, support channels, and feedback options</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                      <h3 className="font-bold text-xs text-church-royal-blue uppercase tracking-wider">Church Management System</h3>
                      <p className="text-xs text-gray-600">St. John de Britto's Church, Kalayarkoil</p>
                      <p className="text-[11px] text-gray-400">Version 2.4.0 (Build 2026.07)</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                      <h3 className="font-bold text-xs text-church-royal-blue uppercase tracking-wider">Help & Feedback</h3>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Link to="/contact" className="text-xs font-bold text-church-gold hover:underline">Contact Administrator</Link>
                        {/* <span className="text-gray-300">•</span>
                        <Link to="/dashboard/tickets" className="text-xs font-bold text-church-gold hover:underline">Report Bug / Raise Ticket</Link> */}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Bottom Sticky Save Bar */}
              <div className="sticky bottom-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-xl flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">Unsaved changes will be updated upon clicking Save Settings.</p>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gold py-2.5 px-6 text-xs font-bold shadow-gold flex items-center gap-2"
                >
                  <FiSave className="text-base" /> {isSubmitting ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>

      {selectedPendingRequest && (
        <PendingApprovalModal
          request={selectedPendingRequest}
          onClose={() => setSelectedPendingRequest(null)}
          onResponded={(reqId) => setPendingRequests(prev => prev.filter(r => r._id !== reqId))}
        />
      )}
    </div>
  );
}

