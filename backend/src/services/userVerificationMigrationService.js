const User = require('../models/User');

/**
 * Runs a safe, non-destructive migration on server startup to ensure
 * all existing user accounts have their individual 30-day verification
 * cycle fields properly initialized.
 */
async function migrateUserVerificationCycles() {
  try {
    const users = await User.find({}).lean();
    const now = new Date();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const bulkOps = [];

    for (const user of users) {
      const updateFields = {};

      // 1. Initialize registeredAt
      if (!user.registeredAt) {
        updateFields.registeredAt = user.createdAt || now;
      }

      // 2. Initialize lastVerifiedAt
      const lastVerifiedAt = user.lastVerifiedAt || user.otpVerifiedAt || user.last_verified_at || updateFields.registeredAt || user.registeredAt || user.createdAt || now;
      if (!user.lastVerifiedAt) {
        updateFields.lastVerifiedAt = lastVerifiedAt;
      }

      // 3. Initialize nextVerificationAt based on individual lastVerifiedAt
      const nextVerificationAt = user.nextVerificationAt || new Date(new Date(lastVerifiedAt).getTime() + THIRTY_DAYS_MS);
      if (!user.nextVerificationAt) {
        updateFields.nextVerificationAt = nextVerificationAt;
      }

      // 4. Compute status & verification requirement
      const isAdmin = ['admin', 'priest', 'technical_team'].includes(user.role) || Boolean(user.isTechnicalTeam);
      const isPastDue = now.getTime() >= new Date(nextVerificationAt).getTime();
      const isUnverified = user.isVerified === false && user.otpVerified === false;

      if (isAdmin) {
        if (user.otpVerificationRequired !== false) {
          updateFields.otpVerificationRequired = false;
        }
        if (user.verificationStatus !== 'Verified') {
          updateFields.verificationStatus = 'Verified';
        }
      } else {
        const required = Boolean(user.otpVerificationRequired || isPastDue || isUnverified);
        if (user.otpVerificationRequired !== required) {
          updateFields.otpVerificationRequired = required;
        }

        let newStatus = 'Verified';
        if (required) {
          newStatus = isPastDue ? 'Overdue' : 'Pending Verification';
        } else {
          const daysRemaining = (new Date(nextVerificationAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysRemaining <= 3) {
            newStatus = 'Due Soon';
          }
        }

        if (user.verificationStatus !== newStatus) {
          updateFields.verificationStatus = newStatus;
        }
      }

      if (Object.keys(updateFields).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: updateFields }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
      console.log(`[UserVerificationMigration] Successfully initialized individual 30-day verification cycles for ${bulkOps.length} existing user(s).`);
    }
  } catch (err) {
    console.error('[UserVerificationMigration] Migration error:', err.message);
  }
}

module.exports = { migrateUserVerificationCycles };
