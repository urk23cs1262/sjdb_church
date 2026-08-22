import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FiCalendar, FiArrowLeft, FiClock, FiFileText, FiCheckCircle, FiInfo, FiPaperclip, FiX, FiCheck } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { GiChurch, GiCrucifix, GiPrayer } from 'react-icons/gi';
import { Link } from 'react-router-dom';
import api, { UPLOADS_URL } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

const INTENTION_TYPES = [
  { value: 'thanksgiving', label: 'Thanksgiving Mass' },
  { value: 'birthday', label: 'Birthday Blessing' },
  { value: 'wedding_anniversary', label: 'Wedding Anniversary' },
  { value: 'healing', label: 'Good Health & Healing' },
  { value: 'special', label: 'Special Intention' },
  { value: 'death_anniversary', label: 'For Departed Soul (RIP)' },
  { value: 'other', label: 'Other Special Intention' },
];

const MASS_TIMES = [
  'Any Available Time',
  '6:00 AM',
  '7:30 AM',
  '9:00 AM',
  'Evening Mass (6:00 PM)',
  'Feast Day Mass',
];

const getAIPrayerText = (type, person) => {
  const name = person?.trim() ? person.trim() : 'our family';
  switch (type) {
    case 'thanksgiving':
      return `We give heartfelt thanks to Almighty God for all the abundant blessings, guidance, protection, and grace bestowed upon ${name}.`;
    case 'birthday':
      return `We humbly request prayers and God's abundant blessings, good health, peace, and joy for ${name} on this birthday occasion.`;
    case 'wedding_anniversary':
      return `We offer this Holy Mass in thanksgiving for the sacred gift of marriage for ${name}. May God continue to bless their union with love, unity, and peace.`;
    case 'healing':
      return `We humbly request prayers for the complete healing, speedy recovery, and good health of ${name}. May God grant strength and peace.`;
    case 'special':
      return `We present our special intentions for ${name} before the Lord, asking for wisdom, guidance, success in work/studies, and heavenly protection.`;
    case 'death_anniversary':
      return `We pray for the eternal repose of the soul of ${name}. May perpetual light shine upon them and grant them eternal peace in God's heavenly kingdom.`;
    case 'other':
    default:
      return `We offer this Holy Mass for the intentions of ${name}, placing all prayers and needs in the loving hands of God.`;
  }
};

export default function Booking() {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      massTime: 'Any Available Time',
      intentionType: 'thanksgiving',
      offertory: '',
      intentionDetails: getAIPrayerText('thanksgiving', '')
    }
  });

  const [submittedBooking, setSubmittedBooking] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const intentionDetailsWatch = watch('intentionDetails') || '';
  const selectedTypeWatch = watch('intentionType') || 'thanksgiving';
  const personNameWatch = watch('personName') || '';

  useEffect(() => {
    fetchMyBookings();
  }, []);

  // Automatically update intention details whenever intention type or person name changes
  useEffect(() => {
    const text = getAIPrayerText(selectedTypeWatch, personNameWatch);
    setValue('intentionDetails', text, { shouldValidate: true });
  }, [selectedTypeWatch]);

  const fetchMyBookings = async () => {
    try {
      setLoadingHistory(true);
      const r = await api.get('/bookings/my');
      setMyBookings(r.data.bookings || []);
    } catch { }
    finally { setLoadingHistory(false); }
  };

  const generateAIPrayer = () => {
    const text = getAIPrayerText(selectedTypeWatch, personNameWatch);
    setValue('intentionDetails', text, { shouldValidate: true });
    toast.success(' Filled with AI prayer description!');
  };

  const handleFileUpload = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }
    const formData = new FormData();
    formData.append('file', selected);
    try {
      setUploading(true);
      const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFile(res.data.url);
      toast.success('Attachment uploaded!');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        attachmentUrl: file || '',
        personName: data.personName || data.familyName
      };
      const res = await api.post('/bookings', payload);
      setSubmittedBooking(res.data.booking);
      toast.success('Mass booking submitted!');
      fetchMyBookings();
      reset();
      setFile(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Booking failed');
    }
  };

  const filteredHistory = myBookings.filter(b => {
    if (historyFilter === 'all') return true;
    return b.status === historyFilter;
  });

  return (
    <div className="min-h-screen pt-20 bg-church-cream pb-16">
      {/* Header Banner */}
      <div className="bg-gray-600 py-6 sm:py-8 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Link to="/dashboard" className="text-gold-400 text-xs sm:text-sm hover:underline flex items-center gap-1 mb-2">
                <FiArrowLeft /> Back to Dashboard
              </Link>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">Book a Holy Mass</h1>
              </div>
              <p className="text-gray-300 text-xs sm:text-sm mt-0.5">Submit your mass intention for parish priest review & approval</p>
            </div>
            <button
              onClick={() => { fetchMyBookings(); setShowHistoryModal(true); }}
              className="btn-gold py-2 px-4 text-xs sm:text-sm shadow-sm flex items-center gap-2 self-start sm:self-auto"
            >
              <FiCalendar /> My Mass Bookings
              {myBookings.length > 0 && (
                <span className="bg-white text-church-royal-blue text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-1">
                  {myBookings.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Purpose / Info Box */}
        <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-4 sm:p-5 mb-6 flex items-start gap-3 shadow-xs">
          <GiCrucifix className="text-church-gold text-2xl sm:text-3xl flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-950 text-sm sm:text-base">Book a Holy Mass Intention</h3>
            <p className="text-xs sm:text-sm text-amber-900 mt-1 leading-relaxed">
              Submit your Mass intention for your loved ones, thanksgiving, special occasions, birthdays, anniversaries, healing, or the repose of departed souls.
            </p>
            <p className="text-[11px] text-amber-800 font-semibold mt-1">
              * Your request will be reviewed by the parish office before confirmation.
            </p>
          </div>
        </div>

        {/* Booking Process Steps */}
        {/* <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-8 shadow-xs">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Mass Request Flow</p>
          <div className="grid grid-cols-5 gap-1 text-center">
            {[
              { label: 'Submit', num: '1' },
              { label: 'Under Review', num: '2' },
              { label: 'Approved', num: '3' },
              { label: 'Mass Scheduled', num: '4' },
              { label: 'Completed', num: '5' }
            ].map((step, idx) => (
              <div key={step.label} className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-church-gold text-white shadow-xs' : 'bg-gray-100 text-gray-400'}`}>
                  {step.num}
                </div>
                <span className="text-[10px] font-semibold text-gray-600 mt-1 leading-tight">{step.label}</span>
              </div>
            ))}
          </div>
        </div> */}

        {/* Main Content: Success Card vs Form */}
        {submittedBooking ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="church-card p-6 sm:p-10 text-center max-w-xl mx-auto shadow-gold-lg">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              <FiCheckCircle />
            </div>
            <h2 className="font-display text-2xl font-bold text-church-royal-blue mb-1">Mass Request Submitted!</h2>
            <p className="text-xs text-gray-400 font-mono mb-4">Reference ID: <span className="text-church-gold font-bold">{submittedBooking.bookingNumber || 'MB-PENDING'}</span></p>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs text-gray-700">
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <span className="text-gray-400 font-medium">Status:</span>
                <span className="font-bold text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Pending Approval</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <span className="text-gray-400 font-medium">Requested Date:</span>
                <span className="font-semibold">{new Date(submittedBooking.massDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <span className="text-gray-400 font-medium">Mass Time:</span>
                <span className="font-semibold">{submittedBooking.massTime || 'Any Available Time'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">Intention:</span>
                <span className="font-semibold capitalize">{submittedBooking.intentionType?.replace('_', ' ')}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-6 italic">You will receive an email and notification once your mass booking is reviewed & approved by the parish office.</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => setSubmittedBooking(null)} className="btn-gold text-xs sm:text-sm py-2.5 px-5">Book Another Mass</button>
              <button onClick={() => { setSubmittedBooking(null); setShowHistoryModal(true); }} className="btn-outline-gold text-xs sm:text-sm py-2.5 px-5">View My Bookings</button>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="church-card p-6 sm:p-8 shadow-card">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="church-label">Mass Date *</label>
                  <input
                    {...register('massDate', { required: 'Please select a date' })}
                    type="date"
                    className="church-input"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {errors.massDate && <p className="text-red-500 text-xs mt-1">{errors.massDate.message}</p>}
                </div>

                <div>
                  <label className="church-label">Preferred Mass Time</label>
                  <select {...register('massTime')} className="church-select">
                    {MASS_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Intention Type & Person/Family Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="church-label">Intention Type *</label>
                  <select
                    {...register('intentionType', { required: true })}
                    className="church-select"
                    onChange={(e) => {
                      register('intentionType').onChange(e);
                      const text = getAIPrayerText(e.target.value, personNameWatch);
                      setValue('intentionDetails', text, { shouldValidate: true });
                    }}
                  >
                    {INTENTION_TYPES.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="church-label">Name of Person / Family *</label>
                  <input
                    {...register('personName', { required: 'Please specify name of person or family' })}
                    className="church-input"
                    placeholder="e.g. Mr. Antony / Xavier Family"
                    onChange={(e) => {
                      register('personName').onChange(e);
                      const text = getAIPrayerText(selectedTypeWatch, e.target.value);
                      setValue('intentionDetails', text, { shouldValidate: true });
                    }}
                  />
                  {errors.personName && <p className="text-red-500 text-xs mt-1">{errors.personName.message}</p>}
                </div>
              </div>

              {/* Intention Details with AI Generator */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="church-label mb-0">Intention Details</label>
                  <button
                    type="button"
                    onClick={generateAIPrayer}
                    className="text-xs text-church-gold hover:underline font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200"
                  >
                    <HiSparkles className="text-amber-500" /> Fill with AI
                  </button>
                </div>
                <textarea
                  {...register('intentionDetails', { maxLength: 500 })}
                  rows={3}
                  maxLength={500}
                  className="church-input resize-none"
                  placeholder="e.g. Pray for the speedy recovery of my mother."
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[11px] text-gray-400 font-medium">
                    {intentionDetailsWatch.length} / 500 characters
                  </span>
                </div>
              </div>

              {/* Optional Attachment Upload & Voluntary Offering Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="church-label flex items-center gap-1">
                    <FiPaperclip className="text-gray-400" /> Optional Attachment
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Upload death notice, invitation, or note (Max 5MB)</p>
                  {uploading && <p className="text-xs text-church-gold mt-1 animate-pulse">Uploading attachment...</p>}
                  {file && <p className="text-xs text-green-600 mt-1 font-semibold flex items-center gap-1"><FiCheck className="text-xs" /> File attached</p>}
                </div>

                <div>
                  <label className="church-label">Voluntary Offering (₹)</label>
                  <input
                    {...register('offertory')}
                    type="number"
                    min="0"
                    className="church-input"
                    placeholder="0 (optional)"
                  />
                  <p className="text-[10px] text-gray-500 font-medium mt-1">
                    * Offering is optional and does not affect approval.
                  </p>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    {...register('confirmCorrect', { required: 'Please confirm accuracy of information' })}
                    type="checkbox"
                    className="w-4 h-4 rounded text-church-gold focus:ring-church-gold"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    I confirm that the above information is correct.
                  </span>
                </label>
                {errors.confirmCorrect && <p className="text-red-500 text-xs mt-1">{errors.confirmCorrect.message}</p>}
              </div>

              {/* Submit Button & Terms Note */}
              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || uploading}
                  className="btn-gold w-full justify-center py-3.5 text-base shadow-gold font-bold flex items-center gap-2"
                >
                  {isSubmitting ? 'Submitting Request...' : 'Request Holy Mass'}
                </button>
                <p className="text-[11px] text-center text-gray-400 italic">
                  By submitting, you agree to the parish Mass booking guidelines.
                </p>
              </div>

            </form>
          </motion.div>
        )}
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistoryModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 15 }} className="relative bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              
              <div className="bg-church-royal-blue p-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FiCalendar className="text-church-gold text-xl" />
                  <h3 className="font-bold font-display text-lg">My Mass Bookings</h3>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  <FiX size={20} />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'rejected', label: 'Rejected' }
                ].map(tab => {
                  const isActive = historyFilter === tab.id;
                  const count = tab.id === 'all' ? myBookings.length : myBookings.filter(b => b.status === tab.id).length;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setHistoryFilter(tab.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        isActive
                          ? 'bg-church-gold text-white shadow-sm ring-2 ring-church-gold/20'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Booking List */}
              <div className="p-5 overflow-y-auto space-y-3 flex-1">
                {loadingHistory ? <SectionLoader /> : filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <GiChurch className="text-5xl mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No {historyFilter === 'all' ? '' : historyFilter} mass bookings found.</p>
                  </div>
                ) : (
                  filteredHistory.map(b => (
                    <div key={b._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-mono text-gray-400 block">{b.bookingNumber}</span>
                          <h4 className="font-bold text-gray-800 text-sm">{b.name}</h4>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' :
                          b.status === 'completed' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          b.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {b.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded-xl">
                        <div>
                          <span className="text-gray-400 block text-[10px]">Mass Date & Time:</span>
                          <span className="font-semibold">{new Date(b.massDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {b.massTime || 'Any time'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Intention Type:</span>
                          <span className="font-semibold capitalize">{b.intentionType?.replace('_', ' ')}</span>
                        </div>
                      </div>

                      {b.intentionDetails && (
                        <p className="text-xs text-gray-600 italic mt-2">"{b.intentionDetails}"</p>
                      )}

                      {b.suggestedDate && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-1.5">
                          <FiInfo className="text-blue-600 flex-shrink-0" />
                          <span><strong className="font-bold">Reschedule Suggestion:</strong> {new Date(b.suggestedDate).toLocaleDateString()} ({b.suggestedTime || 'Any time'})</span>
                        </div>
                      )}

                      {b.adminNote && (
                        <p className="text-xs text-amber-800 mt-1 font-medium">Note: {b.adminNote}</p>
                      )}

                      {b.attachmentUrl && (
                        <a href={b.attachmentUrl.startsWith('http') ? b.attachmentUrl : `${UPLOADS_URL.replace('/uploads', '')}${b.attachmentUrl}`} target="_blank" rel="noreferrer" className="text-[11px] text-church-gold hover:underline flex items-center gap-1 mt-2 font-semibold">
                          <FiPaperclip /> View Attachment
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
