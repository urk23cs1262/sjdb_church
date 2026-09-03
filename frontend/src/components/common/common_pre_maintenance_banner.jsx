import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FiAlertTriangle, FiX, FiClock } from 'react-icons/fi';
import api from '../../services/api';

export default function PreMaintenanceBanner() {
  const [maintenance, setMaintenance] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await api.get('/maintenance/status');
        if (res.data.success && isMounted) {
          setMaintenance(res.data);
        }
      } catch (err) {
        // Silent catch
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const isExcludedRoute = ['/maintenance', '/login'].includes(location.pathname);

  const isBannerActive = Boolean(maintenance?.noticeBanner?.isEnabled || maintenance?.scheduler?.isEnabled);

  const showBanner = !bannerDismissed && 
    isBannerActive && 
    !maintenance?.isEnabled && 
    !isExcludedRoute;

  if (!showBanner) return null;

  const format12Hour = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const startTime = maintenance?.noticeBanner?.scheduledStartTime || maintenance?.scheduler?.scheduledStart;
  const endTime = maintenance?.noticeBanner?.scheduledEndTime || maintenance?.scheduler?.scheduledEnd || maintenance?.expectedCompletion;

  const fromTime = format12Hour(startTime);
  const toTime = format12Hour(endTime);

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-amber-950 font-bold px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between shadow-md relative z-40 border-t border-amber-600/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <FiAlertTriangle className="text-base text-amber-950 flex-shrink-0 animate-bounce" />
          <span>
            <strong>Scheduled Maintenance Notice:</strong> {maintenance.noticeBanner.message || 'The website will undergo scheduled maintenance shortly.'}
          </span>
        </div>
        {(fromTime || toTime) && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold self-start sm:self-auto">
            {fromTime && (
              <span className="inline-flex items-center gap-1 bg-amber-950/15 text-amber-950 px-2.5 py-0.5 rounded-lg">
                <FiClock className="text-xs" /> From: {fromTime}
              </span>
            )}
            {fromTime && toTime && <span className="text-amber-900 font-bold"></span>}
            {toTime && (
              <span className="inline-flex items-center gap-1 bg-amber-950/15 text-amber-950 px-2.5 py-0.5 rounded-lg">
                <FiClock className="text-xs" /> To: {toTime}
              </span>
            )}
          </div>
        )}
      </div>
      <button 
        onClick={() => setBannerDismissed(true)} 
        className="p-1 hover:bg-amber-700/20 rounded-lg transition-colors cursor-pointer flex-shrink-0 ml-2"
        title="Dismiss notice"
      >
        <FiX className="text-base" />
      </button>
    </div>
  );
}
