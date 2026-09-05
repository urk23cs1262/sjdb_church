const {
  sendDailyChurchNotifications,
  getDailyNotificationStatus,
  getUserNotificationHistory,
  getSchedulerStatus,
  recoverMissedRun,
  claimDailyNotificationJob,
  executeDailyNotificationDispatch
} = require('../services/dailyNotificationService');
const DailyNotificationJob = require('../models/DailyNotificationJob');

/**
 * Get daily notification delivery status, stats, and content checks (Admin)
 */
const getStatus = async (req, res) => {
  try {
    const status = await getDailyNotificationStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get detailed job status and delivery breakdown for Admin Dashboard
 */
const getJobStatus = async (req, res) => {
  try {
    const status = await getDailyNotificationStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Trigger a test notification to the specified email / phone (Admin)
 */
const sendTestEmail = async (req, res) => {
  try {
    const { targetEmail, targetPhone, language = 'ta', name = 'Parishioner' } = req.body;
    const recipientEmail = targetEmail || req.user?.email;
    const recipientPhone = targetPhone || req.user?.phone;

    if (!recipientEmail && !recipientPhone) {
      return res.status(400).json({ success: false, message: 'Target email or phone is required' });
    }

    const result = await sendDailyChurchNotifications({
      isManualTest: true,
      targetEmail: recipientEmail,
      targetPhone: recipientPhone,
      testLang: language,
      testName: name
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully',
        result
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to send test notification',
        result
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Manually trigger the daily 4-channel broadcast for today (Admin Manual)
 */
const triggerBroadcast = async (req, res) => {
  try {
    console.log(`[Daily Notification Controller] 4-Channel Manual broadcast triggered by ${req.user?.email || 'admin'}...`);
    const result = await sendDailyChurchNotifications({
      isManualTest: false,
      triggerType: 'admin_manual',
      force: req.body?.force === true
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * External Cron / Webhook Trigger (04:00 AM IST)
 * 
 * Allows external scheduling systems (cron-job.org, Render Cron Job, GitHub Actions, AWS EventBridge)
 * to independently trigger the 04:00 AM IST Catholic daily job without relying on browser activity.
 * 
 * Acknowledges immediately with HTTP 200 after claiming the job (< 50ms), preventing any
 * 30-second webhook timeout (e.g. cron-job.org limits). The actual notification delivery
 * proceeds asynchronously in the backend worker.
 * 
 * Protected by secret key: x-cron-secret header, Bearer token, or ?secret= query.
 */
const triggerSchedulerCron = async (req, res) => {
  try {
    const configuredSecret = process.env.CRON_SECRET || process.env.JWT_SECRET;
    const providedSecret = req.headers['x-cron-secret'] ||
      req.query?.secret ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (!configuredSecret || providedSecret !== configuredSecret) {
      console.warn('[DAILY-CATHOLIC] Unauthorized scheduler webhook attempt.');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or missing cron secret.'
      });
    }

    console.log('[DAILY-CATHOLIC] External scheduler trigger received');

    // Claim today's DailyNotificationJob with atomic locking (< 50ms)
    const claimResult = await claimDailyNotificationJob({
      triggerType: 'external_webhook',
      force: req.body?.force === true
    });

    if (!claimResult.claimed) {
      console.log(`[DAILY-CATHOLIC] Daily job already completed or running for today (${claimResult.reason}). Returning idempotent response.`);
      return res.status(200).json({
        success: true,
        message: 'Daily Catholic notification job already claimed or completed for today.',
        skipped: true,
        jobId: claimResult.jobId,
        dateKey: claimResult.dateKey,
        status: claimResult.status || 'already_processed',
        reason: claimResult.reason
      });
    }

    console.log('[DAILY-CATHOLIC] Daily job claimed/created');

    // Acknowledge HTTP request immediately (< 50ms) to ensure external schedulers never time out
    res.status(200).json({
      success: true,
      message: '04:00 AM Daily Catholic notification job claimed and acknowledged. Background delivery started.',
      jobId: claimResult.jobId,
      dateKey: claimResult.dateKey,
      status: 'accepted'
    });

    console.log('[DAILY-CATHOLIC] Scheduler trigger acknowledged');

    console.log('[DAILY-CATHOLIC] Background delivery started');

    // Execute heavy delivery (WhatsApp Baileys socket + Brevo Email + Push) asynchronously in the backend
    setImmediate(() => {
      executeDailyNotificationDispatch(claimResult, {
        triggerType: 'external_webhook',
        force: req.body?.force === true
      }).catch(err => {
        console.error('[DAILY-CATHOLIC] Background delivery worker error:', err);
      });
    });

  } catch (err) {
    console.error('[DAILY-CATHOLIC] External webhook trigger error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Recover a missed broadcast safely with idempotency (Admin)
 */
const recoverMissed = async (req, res) => {
  try {
    console.log(`[DAILY-CATHOLIC] Manual recovery triggered by ${req.user?.email || 'admin'}`);
    const result = await recoverMissedRun();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get notification history for the current logged in user
 */
const getMyHistory = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const history = await getUserNotificationHistory(userId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getStatus,
  getJobStatus,
  sendTestEmail,
  triggerBroadcast,
  triggerSchedulerCron,
  recoverMissed,
  getMyHistory
};
