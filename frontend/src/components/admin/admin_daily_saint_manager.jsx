import { useState, useEffect } from 'react';
import { FiRefreshCw, FiCheckCircle, FiAlertCircle, FiLink, FiCalendar, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function DailySaintManager() {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/daily-saint/status');
      if (res.data.success) {
        setStatusData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch daily saint sync status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const toastId = toast.loading('Syncing Saint of the Day details and translating...');
    try {
      const res = await api.post('/daily-saint/refresh');
      if (res.data.success) {
        toast.success('Saint of the Day synced successfully!', { id: toastId });
        await fetchStatus();
      } else {
        toast.error('Sync failed.', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed.', { id: toastId });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 flex items-center justify-center min-h-[250px] shadow-sm">
        <FiRefreshCw className="animate-spin text-3xl text-church-gold" />
      </div>
    );
  }

  const formattedDate = statusData?.currentDate
    ? new Date(statusData.currentDate).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : '';

  const formattedSynced = statusData?.lastSynced
    ? new Date(statusData.lastSynced).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Never';

  const isSynced = statusData?.status === 'Synced';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-church-royal-blue font-display">Today's Saint Administration</h2>
          <p className="text-gray-500 text-xs mt-0.5">View synchronization details and trigger manual scraper updates.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-church-gold to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer w-full sm:w-auto`}
        >
          <FiRefreshCw className={`text-sm ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Refresh Now'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* CURRENT DATE */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <FiCalendar className="text-lg" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Current Date</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{formattedDate}</p>
          </div>
        </div>

        {/* SOURCE */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <FiLink className="text-lg" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Source</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 truncate" title={statusData?.sourceUrl || 'Catholic.org'}>
              {statusData?.sourceUrl ? new URL(statusData.sourceUrl).hostname : 'Catholic.org'}
            </p>
          </div>
        </div>

        {/* SAINT */}
        <div className="flex items-start gap-3 col-span-2 md:col-span-1">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <FiUser className="text-lg" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Saint</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 line-clamp-1" title={statusData?.name || 'Unknown'}>
              {statusData?.name || 'Unknown'}
            </p>
          </div>
        </div>

        {/* LAST SYNCED */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <FiRefreshCw className="text-lg" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Last Synced</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{formattedSynced}</p>
          </div>
        </div>

        {/* STATUS */}
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${isSynced ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {isSynced ? <FiCheckCircle className="text-lg" /> : <FiAlertCircle className="text-lg" />}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Status</p>
            <span className={`inline-flex items-center gap-1 text-sm font-bold mt-0.5 ${isSynced ? 'text-green-600' : 'text-red-600'}`}>
              {isSynced ? ' Synced' : ' Sync Error'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
