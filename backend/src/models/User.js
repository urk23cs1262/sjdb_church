const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  familyName: { type: String, trim: true },
  dob: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  address: { type: String },
  subStation: { type: String, trim: true },
  familyRole: { type: String, trim: true },
  familyId: { type: String, trim: true },
  parishZone: { type: String, trim: true },
  anbiyam: { type: String, trim: true },
  weddingDate: { type: Date },
  bloodGroup: { type: String, trim: true },
  memberStatus: { type: String, enum: ['Active', 'Inactive', 'Deceased', 'Transferred'], default: 'Active' },
  sacraments: {
    baptismDate: { type: Date },
    baptismParish: { type: String, trim: true },
    baptismCertNo: { type: String, trim: true },
    firstCommunionDate: { type: Date },
    firstCommunionParish: { type: String, trim: true },
    confirmationDate: { type: Date },
    confirmationParish: { type: String, trim: true },
    marriageDate: { type: Date },
    marriageParish: { type: String, trim: true },
    spouseName: { type: String, trim: true }
  },
  familyMembers: [{
    name: { type: String, trim: true },
    role: { type: String, trim: true }
  }],
  parishMemberId: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'priest', 'staff', 'technical_team'], default: 'user' },
  isTechnicalTeam: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  account_verified: { type: Boolean, default: false },
  last_verified_at: { type: Date, default: null },
  last_verification_reminder_at: { type: Date, default: null },
  last_verification_stage: { type: String, default: null },
  otpVerified: { type: Boolean, default: false },
  otpVerifiedAt: { type: Date, default: null },
  otp: { type: String, default: null },
  otpExpires: { type: Date, default: null },
  otpGeneratedAt: { type: Date, default: null },
  otpNotifiedExpired: { type: Boolean, default: false },
  registrationReportPdfUrl: { type: String },
  profilePhoto: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  lastSuccessfulLogin: { type: Date },
  firstSuccessfulLoginAt: { type: Date },
  tokenVersion: { type: Number, default: 1 },
  authVersion: { type: Number, default: 1 },
  // Security & Suspension Tracking
  failedLoginAttempts: { type: Number, default: 0 },
  firstFailedAttempt: { type: Date },
  lastFailedAttempt: { type: Date },
  isSuspended: { type: Boolean, default: false },
  suspendedAt: { type: Date },
  suspensionReason: { type: String },
  preferredLanguage: { type: String, enum: ['en', 'ta', 'both'], default: 'en' },
  mass_reflection_language: { type: String, enum: ['ta', 'en', 'both'], default: 'en' },
  // WhatsApp Bot preferences — defaults to opted-in for website registrants
  whatsappOptIn: { type: Boolean, default: true },
  readingPreference: { type: String, enum: ['full', 'short', 'verse-reflection', 'complete'], default: 'full' },
  sendLinks: { type: Boolean, default: true },
  botPreferences: {
    type: [{
      type: String,
      enum: ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday']
    }],
    default: ['verse', 'saint', 'mass', 'events', 'announcements', 'birthday']
  },

  // Comprehensive User Settings
  settings: {
    type: Object,
    default: {
      notifications: {
        eventReminders: true,
        massSchedule: true,
        prayerMeetings: true,
        feastDays: true,
        saintOfTheDay: true,
        donationReceipts: true,
        birthdayWishes: true,
        anniversaryWishes: true,
        mass_reflection_language: 'ta',
        whatsapp: true,
        email: true,
        inApp: true,
        push: true
      },
      language: 'en',
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
        preferredParish: 'St. John de Britto Church',
        preferredMassTiming: '7:00 AM',
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
    },
    // Progressive Security & Multi-Tier Lockout Fields
    failedLoginAttempts: { type: Number, default: 0 },
    firstFailedAttempt: { type: Date },
    lastFailedAttempt: { type: Date },
    isLockedUntil: { type: Date },
    lockoutCount: { type: Number, default: 0 },
    firstLockoutAt: { type: Date },
    isSuspended: { type: Boolean, default: false },
    suspendedAt: { type: Date },
    suspensionReason: { type: String },
    lastSuccessfulLogin: { type: Date }
  }
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);
