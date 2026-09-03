import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiClock, FiMessageSquare, FiTrash2, FiCheckCircle } from 'react-icons/fi';
import { GiPrayer } from 'react-icons/gi';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import { Link } from 'react-router-dom';

const STATUS_COLORS = { 
  pending: 'bg-amber-100 text-amber-700 border border-amber-300', 
  approved: 'bg-green-100 text-green-700 border border-green-300', 
  rejected: 'bg-red-100 text-red-700 border border-red-300',
  completed: 'bg-blue-100 text-blue-700 border border-blue-300'
};

export default function AdminPrayers() {
  const [prayers, setPrayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const fetchPrayers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/prayers?status=${filter}`);
      setPrayers(res.data.prayers || []);
    } catch { 
      toast.error('Failed to load prayers'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchPrayers(); 
  }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/prayers/${id}/status`, { status });
      toast.success(`Prayer request updated to ${status}`);
      setPrayers(prev => prev.filter(p => p._id !== id));
    } catch { 
      toast.error('Failed to update status'); 
    }
  };

  const deletePrayer = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this prayer request?')) return;
    try {
      await api.delete(`/prayers/${id}`);
      toast.success('Prayer request permanently deleted');
      setPrayers(prev => prev.filter(p => p._id !== id));
    } catch {
      toast.error('Failed to delete prayer request');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(`Are you sure you want to delete ALL ${filter.toUpperCase()} prayer requests permanently?`)) return;
    try {
      await api.delete(`/prayers/all?status=${filter}`);
      toast.success(`All ${filter} prayer requests deleted`);
      fetchPrayers();
    } catch {
      toast.error('Failed to delete prayers');
    }
  };

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="font-display text-xl sm:text-3xl font-bold text-church-royal-blue flex items-center gap-2 sm:gap-3">
              <GiPrayer className="text-church-gold text-2xl sm:text-3xl" /> Prayer Wall Requests
            </h1>
            <p className="text-gray-500 mt-1 text-xs sm:text-sm">Review, approve, and manage parish prayer intentions</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {prayers.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                title={`Delete all ${filter} prayers permanently`}
              >
                <FiTrash2 className="text-white text-sm" />
                <span>Delete All</span>
              </button>
            )}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 overflow-x-auto no-scrollbar max-w-full">
              {['pending', 'approved', 'rejected', 'completed'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${filter === s ? 'bg-church-gold text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? <SectionLoader /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prayers.map((prayer, i) => {
              const isExpired = prayer.preferredDate && new Date(prayer.preferredDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
              const displayStatus = (isExpired || prayer.status === 'completed') ? 'completed' : prayer.status;

              return (
                <motion.div
                  key={prayer._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="church-card p-6 border-l-4 border-church-gold hover:shadow-gold transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-church-royal-blue text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        <GiPrayer />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{prayer.name || 'Anonymous'}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">{new Date(prayer.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[displayStatus] || STATUS_COLORS.pending}`}>
                      {displayStatus}
                    </span>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl mb-6 italic text-gray-600 text-sm leading-relaxed relative">
                     <span className="absolute -top-2 left-4 text-3xl text-church-gold/20 font-serif">"</span>
                     {prayer.intention}
                     <span className="absolute -bottom-4 right-4 text-3xl text-church-gold/20 font-serif">"</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px] mb-6">
                      <div className="flex items-center gap-2 text-gray-500">
                          <span className="font-bold text-church-royal-blue">Location:</span> {prayer.prayerLocation === 'personal' ? 'Home' : prayer.prayerLocation === 'church' ? 'Church' : prayer.prayerLocation === 'confession' ? 'Confession' : (prayer.prayerLocation || 'Home')}
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                          <span className="font-bold text-church-royal-blue">Type:</span> {prayer.type || 'General'}
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                          <span className="font-bold text-church-royal-blue">Prayer Count:</span>
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 text-[11px]">
                             {prayer.prayerCount || 0} {prayer.prayerCount === 1 ? 'prayer' : 'prayers'}
                          </span>
                      </div>
                      {prayer.preferredDate && (
                          <div className="flex items-center gap-2 text-gray-500">
                              <span className="font-bold text-church-royal-blue">Date:</span> {new Date(prayer.preferredDate).toLocaleDateString('en-IN')}
                          </div>
                      )}
                      {prayer.preferredTime && (
                          <div className="flex items-center gap-2 text-gray-500">
                              <span className="font-bold text-church-royal-blue">Time Slot:</span> {prayer.preferredTime}
                          </div>
                      )}
                      {prayer.confessionLocation && (
                          <div className="col-span-2 flex items-center gap-2 text-gray-500">
                              <span className="font-bold text-church-royal-blue">Venue:</span> {prayer.confessionLocation}
                          </div>
                      )}
                      {prayer.contactPhone && (
                          <div className="col-span-2 flex items-center gap-2 text-gray-500">
                              <span className="font-bold text-church-royal-blue">Phone:</span> {prayer.contactPhone}
                          </div>
                      )}
                      {prayer.churchLocation && (
                          <div className="col-span-2 flex items-center gap-2 text-gray-500">
                              <span className="font-bold text-church-royal-blue">Church:</span> {prayer.churchLocation}
                          </div>
                      )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {filter !== 'approved' && (
                      <button
                        onClick={() => updateStatus(prayer._id, 'approved')}
                        className="flex-1 min-w-[90px] flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        <FiCheck /> Approve
                      </button>
                    )}
                    {filter !== 'rejected' && (
                      <button
                        onClick={() => updateStatus(prayer._id, 'rejected')}
                        className="flex-1 min-w-[90px] flex items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 rounded-xl text-xs font-bold transition-all border border-amber-200"
                      >
                        <FiX /> Reject
                      </button>
                    )}
                    {filter !== 'completed' && (
                      <button
                        onClick={() => updateStatus(prayer._id, 'completed')}
                        className="flex-1 min-w-[90px] flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl text-xs font-bold transition-all border border-blue-200"
                      >
                        <FiCheckCircle /> Complete
                      </button>
                    )}
                    <button
                      onClick={() => deletePrayer(prayer._id)}
                      className="flex-1 min-w-[90px] flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
                      title="Permanently Delete Request"
                    >
                      <FiTrash2 /> Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {!loading && prayers.length === 0 && (
          <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200">
            <FiMessageSquare className="text-5xl mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No {filter} prayer requests to show.</p>
          </div>
        )}
      </div>
    </div>
  );
}
