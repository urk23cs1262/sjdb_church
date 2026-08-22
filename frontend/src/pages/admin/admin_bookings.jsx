import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiCalendar, FiClock, FiPaperclip, FiEdit3 } from 'react-icons/fi';
import api, { UPLOADS_URL } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [rescheduleModalBooking, setRescheduleModalBooking] = useState(null);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('6:00 AM');
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    fetchBookings();
  }, [status]);

  const fetchBookings = () => {
    setLoading(true);
    api.get(`/bookings?status=${status}&limit=50`)
      .then(r => setBookings(r.data.bookings || []))
      .finally(() => setLoading(false));
  };

  const updateStatus = async (id, newStatus, payloadData = {}) => {
    try {
      await api.put(`/bookings/${id}/status`, { status: newStatus, ...payloadData });
      setBookings(prev => prev.filter(b => b._id !== id));
      toast.success(`Booking status updated to ${newStatus}`);
      setRescheduleModalBooking(null);
    } catch {
      toast.error('Failed to update booking status');
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!suggestedDate) {
      toast.error('Please pick a suggested date');
      return;
    }
    await updateStatus(rescheduleModalBooking._id, 'pending', {
      suggestedDate,
      suggestedTime,
      adminNote: adminNote || 'Alternative date suggested by Parish Priest'
    });
  };

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue">Manage Mass Bookings</h1>
            {/* <p className="text-xs text-gray-400 mt-0.5">Review, approve, or suggest alternative dates for Holy Mass intentions</p> */}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
            {['pending', 'approved', 'completed', 'rejected'].map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold capitalize whitespace-nowrap transition-all ${status === s ? 'bg-church-gold text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SectionLoader />
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 text-gray-400 glass-card">
            <p className="text-sm">No {status} mass bookings found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b, i) => (
              <motion.div key={b._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass-card p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="min-w-14 sm:min-w-16 h-14 sm:h-16 rounded-2xl bg-church-gradient flex flex-col items-center justify-center flex-shrink-0 text-white shadow-xs">
                      <span className="font-extrabold text-base sm:text-lg">{new Date(b.massDate).getDate()}</span>
                      <span className="text-gold-300 text-[10px] font-bold uppercase tracking-wider">{new Date(b.massDate).toLocaleString('default', { month: 'short' })}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-church-gold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {b.bookingNumber || `MB-${b._id.slice(-6).toUpperCase()}`}
                        </span>
                        <h3 className="font-bold text-gray-800 text-sm sm:text-base">{b.userId?.name || 'Member'}</h3>
                        <span className="text-xs text-gray-400">({b.userId?.phone || 'N/A'})</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-200 capitalize">
                          Intention: {b.intentionType?.replace('_', ' ')}
                        </span>
                        <span className="text-gray-700 font-semibold">
                          For: {b.personName || b.familyName || 'Intention'}
                        </span>
                        {b.offertory > 0 && (
                          <span className="text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                            Voluntary Offering: ₹{b.offertory}
                          </span>
                        )}
                      </div>

                      {b.intentionDetails && (
                        <p className="text-xs text-gray-600 italic bg-gray-50 p-2.5 rounded-xl mt-2 border border-gray-100">
                          "{b.intentionDetails}"
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                        <span> Requested Time: <strong className="text-gray-700">{b.massTime || 'Any Available Time'}</strong></span>
                        {b.attachmentUrl && (
                          <a href={b.attachmentUrl.startsWith('http') ? b.attachmentUrl : `${UPLOADS_URL.replace('/uploads', '')}${b.attachmentUrl}`} target="_blank" rel="noreferrer" className="text-church-gold hover:underline flex items-center gap-1 font-bold">
                            <FiPaperclip /> View Attachment
                          </a>
                        )}
                      </div>

                      {b.suggestedDate && (
                        <p className="text-xs text-blue-800 font-semibold mt-1">
                           Reschedule Suggested: {new Date(b.suggestedDate).toLocaleDateString()} ({b.suggestedTime})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-auto flex-wrap">
                    {status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateStatus(b._id, 'approved')}
                          className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors shadow-xs flex items-center gap-1"
                          title="Approve Booking"
                        >
                          <FiCheck /> Approve
                        </button>
                        <button
                          onClick={() => { setRescheduleModalBooking(b); setSuggestedDate(b.massDate ? new Date(b.massDate).toISOString().split('T')[0] : ''); }}
                          className="px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors shadow-xs flex items-center gap-1"
                          title="Suggest Another Date"
                        >
                          <FiEdit3 /> Suggest Date
                        </button>
                        <button
                          onClick={() => updateStatus(b._id, 'rejected')}
                          className="px-3 py-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 text-xs font-bold transition-colors flex items-center gap-1"
                          title="Reject Booking"
                        >
                          <FiX /> Reject
                        </button>
                      </>
                    )}

                    {status === 'approved' && (
                      <button
                        onClick={() => updateStatus(b._id, 'completed')}
                        className="btn-gold text-xs py-2 px-4 shadow-xs"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>

                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Suggest Date Modal */}
      <AnimatePresence>
        {rescheduleModalBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRescheduleModalBooking(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="font-bold text-gray-800 text-base">Suggest Alternative Date / Time</h3>
                <button onClick={() => setRescheduleModalBooking(null)} className="p-1 hover:bg-gray-100 rounded-full">
                  <FiX size={18} />
                </button>
              </div>

              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                <div>
                  <label className="church-label">Suggested Mass Date *</label>
                  <input
                    type="date"
                    value={suggestedDate}
                    onChange={(e) => setSuggestedDate(e.target.value)}
                    className="church-input"
                    required
                  />
                </div>

                <div>
                  <label className="church-label">Suggested Mass Time</label>
                  <select value={suggestedTime} onChange={(e) => setSuggestedTime(e.target.value)} className="church-select">
                    <option value="6:00 AM">6:00 AM</option>
                    <option value="7:30 AM">7:30 AM</option>
                    <option value="9:00 AM">9:00 AM</option>
                    <option value="Evening Mass (6:00 PM)">Evening Mass (6:00 PM)</option>
                    <option value="Feast Day Mass">Feast Day Mass</option>
                  </select>
                </div>

                <div>
                  <label className="church-label">Note for Parishioner</label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    className="church-input resize-none"
                    placeholder="e.g., Requested date is fully booked. Kindly confirm this alternative date."
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => setRescheduleModalBooking(null)} className="btn-ghost text-xs py-2">Cancel</button>
                  <button type="submit" className="btn-gold text-xs py-2 px-4">Send Suggestion</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
