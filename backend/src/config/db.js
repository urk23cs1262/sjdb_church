const mongoose = require('mongoose');
const { autoAssignMemberIds } = require('../services/memberIdService');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church';
    const conn = await mongoose.connect(mongoUri);
    console.log(` MongoDB Connected: ${conn.connection.host}`);
    // Auto-assign member IDs for any existing users missing them
    autoAssignMemberIds().catch(console.error);

    // Initialize/migrate individual 30-day user re-verification cycles
    const { migrateUserVerificationCycles } = require('../services/userVerificationMigrationService');
    migrateUserVerificationCycles().catch(console.error);
    // Auto-rename sccGroup to anbiyam in users collection
    const User = require('../models/User');
    User.updateMany({ sccGroup: { $exists: true } }, { $rename: { sccGroup: 'anbiyam' } })
      .then(res => { if (res.modifiedCount > 0) console.log(` Renamed ${res.modifiedCount} MongoDB sccGroup fields to anbiyam`); })
      .catch(console.error);

    // Auto-restore any administrator, priest, or technical accounts to active status
    const { getAdminEmails, getAdminPhones } = require('./contactConfig');
    const adminEmails = getAdminEmails();
    const emailConditions = adminEmails.length > 0 ? [{ email: { $in: adminEmails } }] : [];

    User.updateMany(
      { 
        $or: [
          { role: { $in: ['admin', 'priest', 'technical_team', 'staff'] } },
          ...emailConditions,
          { isTechnicalTeam: true }
        ] 
      },
      { 
        $set: { 
          isActive: true, 
          deactivatedReason: null, 
          isSuspended: false, 
          failedLoginAttempts: 0, 
          isLockedUntil: null,
          tokenVersion: 1,
          authVersion: 1
        } 
      }
    ).then(res => {
      if (res && res.modifiedCount > 0) {
        console.log(`[Auto-Repair] Restored ${res.modifiedCount} admin/staff accounts to active status.`);
      }
    }).catch(console.error);

    // Auto-unblock admin phone numbers in UserModeration
    const UserModeration = require('../models/UserModeration');
    const adminPhones = getAdminPhones();
    const phoneVariants = [];
    adminPhones.forEach(p => {
      phoneVariants.push(p);
      if (p.length === 10) {
        phoneVariants.push('91' + p, '+91' + p, '0' + p);
      } else if (p.startsWith('91') && p.length === 12) {
        const raw10 = p.slice(2);
        phoneVariants.push(raw10, '+' + p, '0' + raw10);
      }
    });
    const phoneConditions = phoneVariants.length > 0 ? [{ phoneNumber: { $in: phoneVariants } }] : [];

    UserModeration.updateMany(
      { 
        $or: [
          ...phoneConditions,
          { role: { $in: ['admin', 'priest', 'staff'] } }
        ] 
      },
      { 
        $set: { 
          status: 'active', 
          violationCount: 0, 
          violations: [], 
          blockedAt: null, 
          blockedReason: null, 
          unblockedAt: new Date() 
        } 
      }
    ).then(res => {
      if (res && res.modifiedCount > 0) {
        console.log(`[Auto-Repair] Unblocked ${res.modifiedCount} admin phone records in UserModeration.`);
      }
    }).catch(console.error);
  } catch (err) {
    console.error(` MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
