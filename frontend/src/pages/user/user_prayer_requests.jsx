import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GiPrayer, GiChurch, GiCandleLight, GiCrossedSwords, GiCrucifix, GiAngelWings } from 'react-icons/gi';
import { FiHeart, FiLock, FiUnlock, FiSearch, FiFilter, FiCheckCircle, FiPlusCircle } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/context_auth_context';
import { SectionLoader } from '../../components/common/common_loader';
import PageHero from '../../components/common/common_page_hero';

export default function PrayerRequests() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [prayers, setPrayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [prayedIds, setPrayedIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('submit'); // 'submit' on left, 'wall' on right

  const todayStr = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: {
      isPublic: true,
      prayerLocation: 'personal',
      type: 'General Prayer Request',
      preferredDate: todayStr
    }
  });

  const prayerLocation = watch('prayerLocation');
  const selectedType = watch('type');
  const isConfession = prayerLocation === 'confession' || selectedType === 'Confession Request';

  const SUB_STATIONS = [
    "Kalayarkoil (Main Parish)",
    "Pallithammam",
    "Nedungulam",
    "Kalluvazhy",
    "Natarajapuram",
    "Susaiapparpattinam",
    "Maravamangalam",
    "Other"
  ];

  const fetchPublicPrayers = () => {
    setLoading(true);
    api.get('/prayers/public')
      .then(r => setPrayers(r.data.prayers || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPublicPrayers();
  }, []);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        name: data.name || user?.name || 'Anonymous',
        email: data.email || user?.email,
        phone: data.contactPhone || data.phone || user?.phone,
        language: i18n.language
      };
      if (data.prayerLocation === 'confession' || data.type === 'Confession Request') {
        payload.isPublic = false;
        payload.type = 'Confession Request';
      } else {
        payload.isPublic = Boolean(data.isPublic);
      }
      await api.post('/prayers', payload);
      toast.success(
        payload.isPublic === false
          ? ' Private prayer intention submitted confidentially.'
          : ' Prayer intention submitted! It will appear on the Prayer Wall once approved by admin.'
      );
      reset({ isPublic: true, prayerLocation: 'personal', type: 'General Prayer Request', preferredDate: todayStr });
      fetchPublicPrayers();
    } catch {
      toast.error('Failed to submit prayer. Please try again.');
    }
  };

  const prayFor = async (id) => {
    if (prayedIds.has(id)) {
      toast('You already prayed for this intention today!');
      return;
    }

    // Optimistic update
    setPrayers(prev => prev.map(p => p._id === id ? { ...p, prayerCount: (p.prayerCount || 0) + 1 } : p));
    setPrayedIds(prev => new Set(prev).add(id));

    try {
      await api.post(`/prayers/${id}/pray`);
      toast.success(' Your prayer has been recorded!');
    } catch {
      // Revert if error
      setPrayers(prev => prev.map(p => p._id === id ? { ...p, prayerCount: Math.max(0, (p.prayerCount || 0) - 1) } : p));
      setPrayedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.error('Failed to record prayer.');
    }
  };

  // Filtered public prayers
  const filteredPrayers = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prayers.filter(p => {
      // Exclude prayers whose preferredDate has already passed
      if (p.preferredDate) {
        const pDate = new Date(p.preferredDate);
        pDate.setHours(0, 0, 0, 0);
        if (pDate < today) {
          return false;
        }
      }

      const matchesSearch = !searchQuery || 
        (p.intention && p.intention.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.type && p.type.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFilter = selectedFilter === 'All' || 
        (selectedFilter === 'General' && (p.type === 'General Prayer Request' || p.prayerLocation === 'personal')) ||
        (selectedFilter === 'Mass Intentions' && p.prayerLocation === 'church') ||
        (selectedFilter === 'Thanksgiving' && p.type === 'Thanksgiving') ||
        (selectedFilter === 'Healing' && (p.type === 'Healing' || p.type === 'Good Health'));

      return matchesSearch && matchesFilter;
    });
  }, [prayers, searchQuery, selectedFilter]);

  const totalPrayersCount = useMemo(() => {
    return prayers.reduce((acc, p) => acc + (p.prayerCount || 0), 0);
  }, [prayers]);

  return (
    <div className="min-h-screen bg-church-cream pb-16 pt-10">
      {/* Page Hero */}
      <PageHero
        title="Community Prayer Wall"
        subtitle="Gather in prayer, share your intentions, and support one another in faith, hope, and charity."
        badge="SACRED PRAYER WALL"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        
        {/* Quick Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white p-5 rounded-2xl border border-gold-200/80 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-church-gold flex items-center justify-center text-2xl font-bold shadow-inner">
              <GiPrayer />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Public Intentions</p>
              <p className="text-2xl font-black text-church-royal-blue">{prayers.length}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gold-200/80 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-2xl font-bold shadow-inner">
              <FiHeart />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Prayers Offered</p>
              <p className="text-2xl font-black text-church-royal-blue">{totalPrayersCount}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gold-200/80 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold shadow-inner">
              <GiCandleLight />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Parish Community</p>
              <p className="text-2xl font-black text-church-royal-blue">United in Faith</p>
            </div>
          </div>
        </div>

        {/* Mobile View Toggle */}
        <div className="flex md:hidden bg-white p-1 rounded-2xl border border-gray-200 mb-6 shadow-sm">
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'submit' ? 'bg-church-gold text-white shadow-gold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiPlusCircle className="text-base" /> Submit Intention
          </button>
          <button
            onClick={() => setActiveTab('wall')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'wall' ? 'bg-church-gold text-white shadow-gold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <GiPrayer className="text-base" /> Prayer Wall ({filteredPrayers.length})
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Submit Prayer Intention Form (5 cols) */}
          <div className={`lg:col-span-5 xl:col-span-5 ${activeTab === 'submit' ? 'block' : 'hidden md:block'} ml-30 mr-35`}>
            <div className="sticky top-28 bg-white rounded-2xl p-6 shadow-xl border border-gold-200/80">
              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-church-royal-blue flex items-center gap-2">
                  <FiPlusCircle className="text-church-gold" /> Share Your Intention
                </h3>
                <p className="text-gray-500 text-xs mt-1">
                  Submit a prayer request for our parish community or a private confession request for the Parish Priest.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="church-label">Your Name</label>
                  <input
                    {...register('name')}
                    className="church-input"
                    placeholder="Full Name (or leave blank for Anonymous)"
                    defaultValue={user?.name || ''}
                  />
                </div>

                {/* Where should prayer be offered */}
                <div>
                  <label className="church-label">Prayer Type & Venue</label>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-amber-50/50 cursor-pointer transition-all">
                      <input
                        {...register('prayerLocation')}
                        type="radio"
                        value="personal"
                        className="w-4 h-4 text-church-gold focus:ring-church-gold"
                        onChange={(e) => {
                          register('prayerLocation').onChange(e);
                          setValue('type', 'General Prayer Request');
                        }}
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-800">Home Prayer</p>
                        <p className="text-[10px] text-gray-500">Appears on the Prayer Wall for parishioners</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-amber-50/50 cursor-pointer transition-all">
                      <input
                        {...register('prayerLocation')}
                        type="radio"
                        value="church"
                        className="w-4 h-4 text-church-gold focus:ring-church-gold"
                        onChange={(e) => {
                          register('prayerLocation').onChange(e);
                          setValue('type', 'Thanksgiving');
                        }}
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-800">Church Mass Intention</p>
                        <p className="text-[10px] text-gray-500">Offered during Holy Mass celebration</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/30 hover:bg-amber-50/80 cursor-pointer transition-all">
                      <input
                        {...register('prayerLocation')}
                        type="radio"
                        value="confession"
                        className="w-4 h-4 text-church-gold focus:ring-church-gold"
                        onChange={(e) => {
                          register('prayerLocation').onChange(e);
                          setValue('type', 'Confession Request');
                        }}
                      />
                      <div>
                        <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                          <FiLock size={12} className="text-amber-700" /> Private Confession Request
                        </p>
                        <p className="text-[10px] text-amber-700">100% Confidential request to Parish Priest</p>
                      </div>
                    </label>
                  </div>
                </div>

                

                {/* Sub-station selection for Mass intentions */}
                {prayerLocation === 'church' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 p-4 bg-amber-50/60 rounded-xl border border-amber-200"
                  >
                    <div>
                      <label className="church-label text-xs">Select Church / Sub-station</label>
                      <select {...register('churchLocation')} className="church-input bg-white text-xs text-gray-800">
                        {SUB_STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </motion.div>
                )}

                {/* Confession details */}
                {isConfession && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 bg-amber-50 border border-amber-300 p-4 rounded-xl"
                  >
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <FiLock className="text-amber-700" /> Confidential Sacrament of Reconciliation
                    </div>

                    <div>
                      <label className="church-label text-xs">Preferred Time Slot</label>
                      <select {...register('preferredTime')} className="church-input bg-white text-xs text-gray-800">
                        <option value="Before Morning Mass (6:00 AM)">Before Morning Mass (6:00 AM)</option>
                        <option value="After Morning Mass (7:00 AM)">After Morning Mass (7:00 AM)</option>
                        <option value="Evening Slot (5:00 PM - 6:00 PM)">Evening Slot (5:00 PM - 6:00 PM)</option>
                        <option value="Before Evening Mass (6:00 PM)">Before Evening Mass (6:00 PM)</option>
                        <option value="Any Time Suitable for Parish Priest">Any Time Suitable for Parish Priest</option>
                      </select>
                    </div>

                    <div>
                      <label className="church-label text-xs">Contact Phone for Confirmation</label>
                      <input
                        type="tel"
                        {...register('contactPhone')}
                        className="church-input bg-white text-xs"
                        placeholder="Phone / WhatsApp number"
                        defaultValue={user?.phone || ''}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Preferred Date defaulted to today */}
                <div>
                  <label className="church-label text-xs">Preferred Date</label>
                  <input
                    type="date"
                    {...register('preferredDate')}
                    defaultValue={todayStr}
                    className="church-input bg-white text-xs text-gray-800"
                  />
                </div>

                {/* Intention category */}
                {!isConfession && (
                  <div>
                    <label className="church-label">Intention Category</label>
                    <select {...register('type')} className="church-input bg-white text-gray-800 text-xs">
                      {prayerLocation === 'personal' ? (
                        <>
                          <option value="General Prayer Request">General Prayer Request</option>
                          <option value="Home Blessing Prayer">Home Blessing Prayer</option>
                          <option value="Healing & Good Health">Healing & Good Health</option>
                          <option value="Special Occasion: Housewarming">Special Occasion: Housewarming</option>
                          <option value="Special Occasion: Wedding Anniversary">Special Occasion: Wedding Anniversary</option>
                          <option value="Special Occasion: Birthday">Special Occasion: Birthday</option>
                          <option value="Others">Others</option>
                        </>
                      ) : (
                        <>
                          <option value="Thanksgiving">Thanksgiving</option>
                          <option value="Birthday Blessing">Birthday Blessing</option>
                          <option value="Wedding Anniversary">Wedding Anniversary</option>
                          <option value="Good Health & Healing">Good Health & Healing</option>
                          <option value="Safe Journey">Safe Journey</option>
                          <option value="Exam Success">Exam Success</option>
                          <option value="For the Souls of the Departed">For the Souls of the Departed</option>
                          <option value="RIP Anniversary Mass">RIP Anniversary Mass</option>
                          <option value="Special Intention">Special Intention</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                {/* Intention message text area */}
                <div>
                  <label className="church-label">
                    {isConfession ? 'Confession Note / Private Intention' : 'Prayer Intention Message *'}
                  </label>
                  <textarea
                    {...register('intention', { required: !isConfession })}
                    rows={4}
                    className="church-input resize-none text-xs leading-relaxed"
                    placeholder={
                      isConfession
                        ? 'Share any confidential note for the Parish Priest...'
                        : 'Share your prayer intention here for our community to pray with you...'
                    }
                  />
                </div>

                {/* Public toggle - shown for both Home Prayer and Mass Intentions, hidden only for Confession */}
                {!isConfession && (
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
                    <input {...register('isPublic')} type="checkbox" className="w-4 h-4 rounded text-church-gold" />
                    <div className="flex items-center gap-2">
                      {watch('isPublic') ? <FiUnlock className="text-church-gold text-sm" /> : <FiLock className="text-gray-400 text-sm" />}
                      <div>
                        <p className="text-xs font-bold text-gray-800">
                          {watch('isPublic') ? 'Public Intention' : 'Private Intention'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {watch('isPublic') ? 'Displays on the public Prayer Wall' : 'Sent privately to church team'}
                        </p>
                      </div>
                    </div>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gold w-full justify-center py-3.5 text-sm shadow-gold font-bold flex items-center gap-2 mt-2"
                >
                  <GiPrayer className="text-lg" />
                  <span>{isSubmitting ? 'Submitting Intention...' : 'Submit Prayer Intention'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT: Public Prayer Wall (7 cols) */}
          <div className={`lg:col-span-7 xl:col-span-7 space-y-6 ${activeTab === 'wall' ? 'block' : 'hidden md:block'}`}>
            
            {/* Header & Filter / Search Bar */}
            <div className="bg-white p-5 rounded-2xl shadow-lg border border-gold-200/60">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-church-royal-blue flex items-center gap-2">
                    <GiPrayer className="text-church-gold text-3xl" /> Prayer Wall
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Read intentions submitted by parishioners and join in prayer.</p>
                </div>
                
                {/* Search Bar */}
                <div className="relative min-w-[200px]">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search intentions..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-church-gold focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['All', 'General', 'Mass Intentions', 'Thanksgiving', 'Healing'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      selectedFilter === filter
                        ? 'bg-church-gold text-white shadow-gold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Prayer Wall Cards List */}
            {loading ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-md">
                <SectionLoader />
              </div>
            ) : filteredPrayers.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-md">
                <GiPrayer className="text-6xl text-gray-300 mx-auto mb-4" />
                <h3 className="font-display text-lg font-bold text-gray-700">No prayer intentions found</h3>
                <p className="text-gray-400 text-xs mt-1 max-w-md mx-auto">
                  {searchQuery || selectedFilter !== 'All' 
                    ? 'Try clearing your search or filter to see more prayer requests.' 
                    : 'Be the first to share your prayer intention on the community wall.'}
                </p>
                {searchQuery || selectedFilter !== 'All' ? (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedFilter('All'); }}
                    className="mt-4 text-xs font-bold text-church-gold hover:underline"
                  >
                    Clear Filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {filteredPrayers.map((prayer, i) => {
                    const hasPrayed = prayedIds.has(prayer._id);
                    return (
                      <motion.div
                        key={prayer._id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-white rounded-2xl p-6 border-l-4 border-church-gold shadow-md hover:shadow-xl transition-all duration-300 relative group overflow-hidden"
                      >
                        <div className="flex justify-between items-start mb-3 gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
                              {prayer.name ? prayer.name.charAt(0).toUpperCase() : <GiPrayer />}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-sm sm:text-base leading-tight">
                                {prayer.name || 'Anonymous Parishioner'}
                              </p>
                              <p className="text-[11px] text-gray-400 font-medium">
                                {new Date(prayer.createdAt).toLocaleDateString(undefined, {
                                  year: 'numeric', month: 'short', day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {prayer.prayerLocation === 'church' && (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-300 inline-flex items-center gap-1">
                                <GiChurch className="text-xs text-amber-700" /> Mass Intention
                              </span>
                            )}
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold px-3 py-1 rounded-full">
                              {prayer.type || 'General Intention'}
                            </span>
                          </div>
                        </div>

                        {/* Intention Text */}
                        <p className="text-gray-700 text-sm leading-relaxed mb-5 italic bg-amber-50/40 p-4 rounded-xl border border-amber-100/80">
                          "{prayer.intention}"
                        </p>

                        {/* Card Footer with Pray Action */}
                        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                            <GiPrayer className="text-base text-church-gold" />
                            <span className="text-church-royal-blue font-bold">{prayer.prayerCount || 0}</span>
                            <span>{prayer.prayerCount === 1 ? 'person has prayed' : 'people have prayed'}</span>
                          </span>

                          <button
                            onClick={() => prayFor(prayer._id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-200 ${
                              hasPrayed
                                ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm cursor-default'
                                : 'bg-church-gold/10 text-church-gold hover:bg-church-gold hover:text-white border border-church-gold/30 shadow-sm hover:shadow-gold active:scale-95'
                            }`}
                          >
                            <FiHeart className={`text-sm ${hasPrayed ? 'fill-red-500 text-red-500' : 'group-hover:fill-current'}`} />
                            <span>{hasPrayed ? 'Prayed' : 'Pray For This'}</span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
