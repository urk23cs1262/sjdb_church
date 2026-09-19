const User = require('../models/User');

/**
 * Runs a safe, non-destructive migration on server startup to ensure
 * all existing user accounts have their individual 30-day verification
 * cycle fields properly initialized.
 */
async function migrateUserVerificationCycles() {
  try {
    const users = await User.find({});
    const now = new Date();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    let updatedCount = 0;

    for (const user of users) {
      let needsSave = false;

      // 1. Initialize registeredAt
      if (!user.registeredAt) {
        user.registeredAt = user.createdAt || now;
        needsSave = true;
      }

      // 2. Initialize lastVerifiedAt
      if (!user.lastVerifiedAt) {
        user.lastVerifiedAt = user.otpVerifiedAt || user.last_verified_at || user.registeredAt;
        needsSave = true;
      }

      // 3. Initialize nextVerificationAt based on individual lastVerifiedAt
      if (!user.nextVerificationAt) {
        user.nextVerificationAt = new Date(new Date(user.lastVerifiedAt).getTime() + THIRTY_DAYS_MS);
        needsSave = true;
      }

      // 4. Compute status & verification requirement
      const isAdmin = ['admin', 'priest', 'technical_team'].includes(user.role) || Boolean(user.isTechnicalTeam);
      const isPastDue = now.getTime() >= new Date(user.nextVerificationAt).getTime();
      const isUnverified = user.isVerified === false && user.otpVerified === false;

      if (isAdmin) {
        if (user.otpVerificationRequired !== false) {
          user.otpVerificationRequired = false;
          needsSave = true;
        }
        if (user.verificationStatus !== 'Verified') {
          user.verificationStatus = 'Verified';
          needsSave = true;
        }
      } else {
        const required = Boolean(user.otpVerificationRequired || isPastDue || isUnverified);
        if (user.otpVerificationRequired !== required) {
          user.otpVerificationRequired = required;
          needsSave = true;
        }

        let newStatus = 'Verified';
        if (required) {
          newStatus = isPastDue ? 'Overdue' : 'Pending Verification';
        } else {
          const daysRemaining = (new Date(user.nextVerificationAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysRemaining <= 3) {
            newStatus = 'Due Soon';
          }
        }

        if (user.verificationStatus !== newStatus) {
          user.verificationStatus = newStatus;
          needsSave = true;
        }
      }

      if (needsSave) {
        await user.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`[UserVerificationMigration] Successfully initialized individual 30-day verification cycles for ${updatedCount} existing user(s).`);
    }
  } catch (err) {
    console.error('[UserVerificationMigration] Migration error:', err.message);
  }
}

module.exports = { migrateUserVerificationCycles };
