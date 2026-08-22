const {
  sendDailyChurchNotifications,
  getDailyNotificationStatus,
  getUserNotificationHistory
} = require('../services/dailyNotificationService');

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
 * Manually trigger the daily 4-channel broadcast for today (Admin)
 */
const triggerBroadcast = async (req, res) => {
  try {
    console.log(`[Daily Notification Controller] 4-Channel Manual broadcast triggered by ${req.user?.email || 'admin'}...`);
    const result = await sendDailyChurchNotifications({ isManualTest: false });
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
  sendTestEmail,
  triggerBroadcast,
  getMyHistory
};
