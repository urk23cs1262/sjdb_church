const { getOrCreateSettings, setSystemState } = require('./systemStateService');
const { dispatchPreMaintenanceEvent, getLeadTimeMinutes } = require('./maintenanceNotificationService');

const checkMaintenanceSchedule = async () => {
  try {
    const settings = await getOrCreateSettings();
    if (!settings) return;

    const now = new Date();
    const currentStatus = settings.status || (settings.isEnabled ? (settings.isEmergency ? 'emergency' : 'maintenance') : 'live');

    // Effective start, end, and lead times across Notice Banner or Scheduler
    const bannerConfig = settings.noticeBanner || {};
    const schedulerConfig = settings.scheduler || {};

    const scheduledStart = schedulerConfig.scheduledStart
      ? new Date(schedulerConfig.scheduledStart)
      : (bannerConfig.scheduledStartTime ? new Date(bannerConfig.scheduledStartTime) : null);

    const scheduledEnd = schedulerConfig.scheduledEnd
      ? new Date(schedulerConfig.scheduledEnd)
      : (bannerConfig.scheduledEndTime ? new Date(bannerConfig.scheduledEndTime) : (settings.expectedCompletion ? new Date(settings.expectedCompletion) : null));

    const leadTimeStr = bannerConfig.noticeLeadTime || schedulerConfig.noticeLeadTime || '15m';
    const leadTimeMs = getLeadTimeMinutes(leadTimeStr) * 60 * 1000;

    // 1. Pre-Maintenance Notice Trigger (Lead Time before Maintenance Start)
    if (scheduledStart && currentStatus === 'live') {
      const noticeTriggerTime = new Date(scheduledStart.getTime() - leadTimeMs);

      // Trigger if current time is within lead window and notice has not yet been sent for this cycle
      if (now >= noticeTriggerTime && now < scheduledStart) {
        const alreadySent = Boolean(bannerConfig.isNoticeSent || settings.preMaintenanceEventId);
        if (!alreadySent) {
          console.log(`[Scheduler] Pre-maintenance notice trigger activated (${leadTimeStr} before start at ${scheduledStart.toISOString()})`);
          await dispatchPreMaintenanceEvent({
            settings,
            changedBy: 'Automated Scheduler'
          });
        }
      }
    }

    // Scheduler-specific Auto-Start and Auto-End checks
    const schedulerEnabled = Boolean(schedulerConfig.isEnabled);
    if (!schedulerEnabled) {
      return;
    }

    // 2. Auto Start Maintenance when scheduledStart is reached
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

    // 3. Auto End Maintenance when scheduledEnd is reached
    if (scheduledEnd && now >= scheduledEnd) {
      if (currentStatus !== 'live') {
        console.log('[Scheduler] Scheduled Maintenance auto-end triggered at:', now.toISOString());
        await setSystemState('live', {
          reason: 'Scheduled Maintenance Auto-End',
          changedBy: 'Automated Scheduler'
        });
      }
      // Disable schedule once completed to prevent repeat executions
      settings.scheduler.isEnabled = false;
      await settings.save();
    }
  } catch (err) {
    console.error('[Scheduler] Error running maintenance scheduler check:', err.message);
  }
};

// Run check every 60 seconds
setInterval(checkMaintenanceSchedule, 60 * 1000);

module.exports = { checkMaintenanceSchedule };
