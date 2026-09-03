const { getOrCreateSettings, setSystemState } = require('./systemStateService');
const { dispatchPreMaintenanceNotice } = require('../controllers/maintenanceController');

const getLeadTimeMinutes = (leadTimeStr) => {
  switch (leadTimeStr) {
    case '15m': return 15;
    case '30m': return 30;
    case '1h': return 60;
    case '2h': return 120;
    case '6h': return 360;
    case '12h': return 720;
    case '24h': return 1440;
    default: return 60; // Default 1 hour
  }
};

const checkMaintenanceSchedule = async () => {
  try {
    const settings = await getOrCreateSettings();
    if (!settings) return;

    const now = new Date();
    const schedulerEnabled = settings.scheduler && settings.scheduler.isEnabled;
    const scheduledStart = schedulerEnabled && settings.scheduler.scheduledStart ? new Date(settings.scheduler.scheduledStart) : null;
    const scheduledEnd = schedulerEnabled && settings.scheduler.scheduledEnd ? new Date(settings.scheduler.scheduledEnd) : null;
    const expectedCompletion = settings.expectedCompletion ? new Date(settings.expectedCompletion) : null;

    const currentStatus = settings.status || (settings.isEnabled ? (settings.isEmergency ? 'emergency' : 'maintenance') : 'live');

    // 1. Pre-Maintenance Notice Trigger (Lead Time before Maintenance Start)
    if (scheduledStart && currentStatus === 'live') {
      const leadTimeStr = settings.scheduler?.noticeLeadTime || settings.noticeBanner?.noticeLeadTime || '1h';
      const leadTimeMs = getLeadTimeMinutes(leadTimeStr) * 60 * 1000;
      const noticeTriggerTime = new Date(scheduledStart.getTime() - leadTimeMs);

      if (now >= noticeTriggerTime && now < scheduledStart) {
        if (!settings.noticeBanner?.isEnabled || !settings.noticeSentForEventId) {
          console.log(`[Scheduler] Pre-maintenance notice auto-trigger activated (${leadTimeStr} before start) at:`, now.toISOString());
          await dispatchPreMaintenanceNotice(settings, {
            reason: `Scheduled Pre-Maintenance Notice Auto-Trigger (${leadTimeStr} lead time)`,
            changedBy: 'Automated Scheduler'
          });
        }
      }
    }

    // 2. Auto Start Maintenance using central setSystemState
    if (scheduledStart && now >= scheduledStart && (!scheduledEnd || now < scheduledEnd)) {
      if (currentStatus === 'live') {
        console.log('[Scheduler] Scheduled Maintenance auto-start triggered at:', now.toISOString());
        await setSystemState('maintenance', {
          reason: 'Scheduled Maintenance Auto-Start',
          changedBy: 'Automated Scheduler',
          category: settings.category || 'Scheduled Update',
          expectedCompletion: scheduledEnd || settings.expectedCompletion
        });
      }
    }

    // 3. Auto End Maintenance using central setSystemState
    const isScheduledEndReached = scheduledEnd && now >= scheduledEnd;
    const isCountdownFinished = expectedCompletion && now >= expectedCompletion;

    if (currentStatus !== 'live' && (isScheduledEndReached || isCountdownFinished)) {
      console.log('[Scheduler] Scheduled Maintenance auto-end triggered at:', now.toISOString());
      await setSystemState('live', {
        reason: 'Scheduled Maintenance Auto-End',
        changedBy: 'Automated Scheduler'
      });
    }
  } catch (err) {
    console.error('[Scheduler] Error running maintenance scheduler check:', err.message);
  }
};

// Run check every 60 seconds
setInterval(checkMaintenanceSchedule, 60 * 1000);

module.exports = { checkMaintenanceSchedule };
