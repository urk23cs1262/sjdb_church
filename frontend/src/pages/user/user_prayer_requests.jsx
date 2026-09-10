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
import { 
  CHURCH_MASS_INTENTION_CATEGORIES, 
  HOME_PRAYER_CATEGORIES, 
  getIntentionCategoryLabel 
} from '../../utils/massIntentionCategories';

export default function PrayerRequests() {
  const { t, i18n } = useTranslation();
  const isTa = i18n.language?.startsWith('ta');
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
      type: 'general_prayer',
      preferredDate: todayStr
    }
  });

  const prayerLocation = watch('prayerLocation');
  const selectedType = watch('type');
  const isConfession = prayerLocation === 'confession' || selectedType === 'confession_request' || selectedType === 'Confession Request';

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
      if (data.prayerLocation === 'confession' || data.type === 'confession_request' || data.type === 'Confession Request') {
        payload.isPublic = false;
        payload.type = 'confession_request';
      } else {
        payload.isPublic = Boolean(data.isPublic);
      }
      await api.post('/prayers', payload);
      toast.success(
        payload.isPublic === false
          ? (isTa ? 'உங்கள் தனிப்பட்ட விண்ணப்பம் இரகசியமாக சமர்ப்பிக்கப்பட்டது.' : 'Private prayer intention submitted confidentially.')
          : (isTa ? 'ஜெப விண்ணப்பம் சமர்ப்பிக்கப்பட்டது! நிர்வாகி அனுமதித்தவுடன் ஜெப சுவரில் தோன்றும்.' : 'Prayer intention submitted! It will appear on the Prayer Wall once approved by admin.')
      );
      reset({ isPublic: true, prayerLocation: 'personal', type: 'general_prayer', preferredDate: todayStr });
      fetchPublicPrayers();
    } catch {
      toast.error(isTa ? 'விண்ணப்பத்தை சமர்ப்பிப்பதில் தோல்வி. மீண்டும் முயற்சிக்கவும்.' : 'Failed to submit prayer. Please try again.');
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

      const pTypeLabelEn = getIntentionCategoryLabel(p.type, 'en');
      const pTypeLabelTa = getIntentionCategoryLabel(p.type, 'ta');

      const matchesSearch = !searchQuery || 
        (p.intention && p.intention.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.type && p.type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pTypeLabelEn && pTypeLabelEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pTypeLabelTa && pTypeLabelTa.includes(searchQuery));

      const matchesFilter = selectedFilter === 'All' || 
        (selectedFilter === 'General' && (p.type === 'general_prayer' || p.type === 'General Prayer Request' || p.prayerLocation === 'personal')) ||
        (selectedFilter === 'Mass Intentions' && p.prayerLocation === 'church') ||
        (selectedFilter === 'Thanksgiving' && (p.type === 'thanksgiving' || p.type === 'Thanksgiving')) ||
        (selectedFilter === 'Healing' && (p.type === 'good_health' || p.type === 'healing_health' || p.type === 'Healing' || p.type === 'Good Health' || p.type === 'Good Health & Healing'));

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
        title={isTa ? "பங்கு ஜெப சுவர்" : "Community Prayer Wall"}
        subtitle={isTa ? "விசுவாசம், நம்பிக்கை மற்றும் அன்பில் ஜெபித்து ஒருவருக்கொருவர் ஆதரவளிப்போம்." : "Gather in prayer, share your intentions, and support one another in faith, hope, and charity."}
        badge={isTa ? "புனித ஜெப சுவர்" : "SACRED PRAYER WALL"}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        
        {/* Quick Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white p-5 rounded-2xl border border-gold-200/80 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-church-gold flex items-center justify-center text-2xl font-bold shadow-inner">
              <GiPrayer />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{isTa ? 'பொதுவான கருத்துக்கள்' : 'Public Intentions'}</p>
              <p className="text-2xl font-black text-church-royal-blue">{prayers.length}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gold-200/80 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-2xl font-bold shadow-inner">
              <FiHeart />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{isTa ? 'ஏறெடுக்கப்பட்ட ஜெபங்கள்' : 'Prayers Offered'}</p>
              <p className="text-2xl font-black text-church-royal-blue">{totalPrayersCount}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gold-200/80 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold shadow-inner">
              <GiCandleLight />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{isTa ? 'பங்கு சமூகம்' : 'Parish Community'}</p>
              <p className="text-2xl font-black text-church-royal-blue">{isTa ? 'விசுவாசத்தில் ஒன்றிணைவோம்' : 'United in Faith'}</p>
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
            <FiPlusCircle className="text-base" /> {isTa ? 'கருத்து சமர்ப்பிக்க' : 'Submit Intention'}
          </button>
          <button
            onClick={() => setActiveTab('wall')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'wall' ? 'bg-church-gold text-white shadow-gold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <GiPrayer className="text-base" /> {isTa ? `ஜெப சுவர் (${filteredPrayers.length})` : `Prayer Wall (${filteredPrayers.length})`}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Submit Prayer Intention Form (5 cols) */}
          <div className={`lg:col-span-5 xl:col-span-5 ${activeTab === 'submit' ? 'block' : 'hidden md:block'} ml-30 mr-35`}>
            <div className="sticky top-28 bg-white rounded-2xl p-6 shadow-xl border border-gold-200/80">
              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-church-royal-blue flex items-center gap-2">
                  <FiPlusCircle className="text-church-gold" /> {isTa ? 'உங்கள் ஜெபக் கருத்தைப் பகிரவும்' : 'Share Your Intention'}
                </h3>
                <p className="text-gray-500 text-xs mt-1">
                  {isTa 
                    ? 'எங்கள் பங்கு சமூகத்திற்கான ஜெப விண்ணப்பம் அல்லது பங்கு தந்தைக்கு தனிப்பட்ட பாவசங்கீர்த்தன விண்ணப்பத்தை சமர்ப்பிக்கவும்.'
                    : 'Submit a prayer request for our parish community or a private confession request for the Parish Priest.'}
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="church-label">{isTa ? 'உங்கள் பெயர்' : 'Your Name'}</label>
                  <input
                    {...register('name')}
                    className="church-input"
                    placeholder={isTa ? 'முழு பெயர் (அல்லது பெயரின்றி அனுப்ப காலியாக விடவும்)' : 'Full Name (or leave blank for Anonymous)'}
                    defaultValue={user?.name || ''}
                  />
                </div>

                {/* Where should prayer be offered */}
                <div>
                  <label className="church-label">{isTa ? 'ஜெப வகை & இடம்' : 'Prayer Type & Venue'}</label>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-amber-50/50 cursor-pointer transition-all">
                      <input
                        {...register('prayerLocation')}
                        type="radio"
                        value="personal"
                        className="w-4 h-4 text-church-gold focus:ring-church-gold"
                        onChange={(e) => {
                          register('prayerLocation').onChange(e);
                          setValue('type', 'general_prayer');
                        }}
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-800">{isTa ? 'இல்ல ஜெபம்' : 'Home Prayer'}</p>
                        <p className="text-[10px] text-gray-500">{isTa ? 'பங்கு மக்களின் ஜெப சுவரில் தோன்றும்' : 'Appears on the Prayer Wall for parishioners'}</p>
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
                          setValue('type', 'thanksgiving');
                        }}
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-800">{isTa ? 'திருப்பலி கருத்து' : 'Church Mass Intention'}</p>
                        <p className="text-[10px] text-gray-500">{isTa ? 'பரிசுத்த திருப்பலியில் சமர்ப்பிக்கப்படும்' : 'Offered during Holy Mass celebration'}</p>
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
                          setValue('type', 'confession_request');
                        }}
                      />
                      <div>
                        <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                          <FiLock size={12} className="text-amber-700" /> {isTa ? 'தனிப்பட்ட பாவசங்கீர்த்தன விண்ணப்பம்' : 'Private Confession Request'}
                        </p>
                        <p className="text-[10px] text-amber-700">{isTa ? 'பங்கு தந்தைக்கு 100% இரகசிய விண்ணப்பம்' : '100% Confidential request to Parish Priest'}</p>
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
                      <label className="church-label text-xs">{isTa ? 'ஆலயம் / கிளைப்பங்கு தேர்ந்தெடுக்கவும்' : 'Select Church / Sub-station'}</label>
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
                      <FiLock className="text-amber-700" /> {isTa ? 'இரகசிய ஒப்புரவு அருளடையாளம்' : 'Confidential Sacrament of Reconciliation'}
                    </div>

                    <div>
                      <label className="church-label text-xs">{isTa ? 'விருப்பமான நேரம்' : 'Preferred Time Slot'}</label>
                      <select {...register('preferredTime')} className="church-input bg-white text-xs text-gray-800">
                        <option value="Before Morning Mass (6:00 AM)">{isTa ? 'காலை திருப்பலிக்கு முன் (6:00 AM)' : 'Before Morning Mass (6:00 AM)'}</option>
                        <option value="After Morning Mass (7:00 AM)">{isTa ? 'காலை திருப்பலிக்கு பின் (7:00 AM)' : 'After Morning Mass (7:00 AM)'}</option>
                        <option value="Evening Slot (5:00 PM - 6:00 PM)">{isTa ? 'மாலை நேரம் (5:00 PM - 6:00 PM)' : 'Evening Slot (5:00 PM - 6:00 PM)'}</option>
                        <option value="Before Evening Mass (6:00 PM)">{isTa ? 'மாலை திருப்பலிக்கு முன் (6:00 PM)' : 'Before Evening Mass (6:00 PM)'}</option>
                        <option value="Any Time Suitable for Parish Priest">{isTa ? 'பங்கு தந்தைக்கு வசதியான எந்த நேரத்திலும்' : 'Any Time Suitable for Parish Priest'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="church-label text-xs">{isTa ? 'தொடர்பு தொலைபேசி எண்' : 'Contact Phone for Confirmation'}</label>
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
                  <label className="church-label text-xs">{isTa ? 'விருப்பமான தேதி' : 'Preferred Date'}</label>
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
                    <label className="church-label">{isTa ? 'கருத்து பிரிவு' : 'Intention Category'}</label>
                    <select {...register('type')} className="church-input bg-white text-gray-800 text-xs">
                      {prayerLocation === 'personal' ? (
                        HOME_PRAYER_CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {isTa ? cat.ta : cat.en}
                          </option>
                        ))
                      ) : (
                        CHURCH_MASS_INTENTION_CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {isTa ? cat.ta : cat.en}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* Intention message text area */}
                <div>
                  <label className="church-label">
                    {isConfession 
                      ? (isTa ? 'பாவசங்கீர்த்தன குறிப்பு / தனிப்பட்ட கருத்து' : 'Confession Note / Private Intention') 
                      : (isTa ? 'ஜெப கருத்து செய்தி *' : 'Prayer Intention Message *')}
                  </label>
                  <textarea
                    {...register('intention', { required: !isConfession })}
                    rows={4}
                    className="church-input resize-none text-xs leading-relaxed"
                    placeholder={
                      isConfession
                        ? (isTa ? 'பங்கு தந்தைக்கு ஏதேனும் இரகசியக் குறிப்பைப் பகிரவும்...' : 'Share any confidential note for the Parish Priest...')
                        : (isTa ? 'பங்கு மக்கள் உங்களுக்காக ஜெபிக்க உங்கள் ஜெபக் கருத்தை இங்கே பகிரவும்...' : 'Share your prayer intention here for our community to pray with you...')
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
                          {watch('isPublic') 
                            ? (isTa ? 'பொதுவான கருத்து' : 'Public Intention') 
                            : (isTa ? 'தனிப்பட்ட கருத்து' : 'Private Intention')}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {watch('isPublic') 
                            ? (isTa ? 'பொது ஜெப சுவரில் காட்டப்படும்' : 'Displays on the public Prayer Wall') 
                            : (isTa ? 'பங்கு குழுவிற்கு தனிப்பட்ட முறையில் அனுப்பப்படும்' : 'Sent privately to church team')}
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
                  <span>{isSubmitting 
                    ? (isTa ? 'சமர்ப்பிக்கப்படுகிறது...' : 'Submitting Intention...') 
                    : (isTa ? 'ஜெப விண்ணப்பத்தை சமர்ப்பிக்கவும்' : 'Submit Prayer Intention')}</span>
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
                    <GiPrayer className="text-church-gold text-3xl" /> {isTa ? 'ஜெப சுவர்' : 'Prayer Wall'}
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {isTa ? 'பங்கு மக்கள் சமர்ப்பித்த கருத்துக்களை வாசித்து, ஜெபத்தில் இணையுங்கள்.' : 'Read intentions submitted by parishioners and join in prayer.'}
                  </p>
                </div>
                
                {/* Search Bar */}
                <div className="relative min-w-[200px]">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isTa ? 'கருத்துக்களைத் தேடவும்...' : 'Search intentions...'}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-church-gold focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { key: 'All', en: 'All', ta: 'அனைத்தும்' },
                  { key: 'General', en: 'General', ta: 'பொதுவானவை' },
                  { key: 'Mass Intentions', en: 'Mass Intentions', ta: 'திருப்பலி கருத்துக்கள்' },
                  { key: 'Thanksgiving', en: 'Thanksgiving', ta: 'நன்றி நவில்தல்' },
                  { key: 'Healing', en: 'Healing', ta: 'சுகமளிக்கும் ஜெபம்' }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setSelectedFilter(filter.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      selectedFilter === filter.key
                        ? 'bg-church-gold text-white shadow-gold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isTa ? filter.ta : filter.en}
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
                <h3 className="font-display text-lg font-bold text-gray-700">{isTa ? 'ஜெபக் கருத்துக்கள் எதுவும் கிடைக்கவில்லை' : 'No prayer intentions found'}</h3>
                <p className="text-gray-400 text-xs mt-1 max-w-md mx-auto">
                  {searchQuery || selectedFilter !== 'All' 
                    ? (isTa ? 'கூடுதல் ஜெப விண்ணப்பங்களைக் காண உங்கள் தேடல் அல்லது வடிப்பானை நீக்கவும்.' : 'Try clearing your search or filter to see more prayer requests.') 
                    : (isTa ? 'சமூக சுவரில் உங்கள் ஜெபக் கருத்தைப் பகிரும் முதல் நபராக இருங்கள்.' : 'Be the first to share your prayer intention on the community wall.')}
                </p>
                {searchQuery || selectedFilter !== 'All' ? (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedFilter('All'); }}
                    className="mt-4 text-xs font-bold text-church-gold hover:underline"
                  >
                    {isTa ? 'வடிப்பான்களை நீக்கு' : 'Clear Filters'}
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
                                {prayer.name || (isTa ? 'அறியப்படாத பங்கு மக்கள்' : 'Anonymous Parishioner')}
                              </p>
                              <p className="text-[11px] text-gray-400 font-medium">
                                {new Date(prayer.createdAt).toLocaleDateString(isTa ? 'ta-IN' : undefined, {
                                  year: 'numeric', month: 'short', day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {prayer.prayerLocation === 'church' && (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-300 inline-flex items-center gap-1">
                                <GiChurch className="text-xs text-amber-700" /> {isTa ? 'திருப்பலி கருத்து' : 'Mass Intention'}
                              </span>
                            )}
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold px-3 py-1 rounded-full">
                              {getIntentionCategoryLabel(prayer.type, i18n.language) || (isTa ? 'பொதுவான கருத்து' : 'General Intention')}
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
                            <span>{prayer.prayerCount === 1 ? (isTa ? 'நபர் ஜெபித்துள்ளார்' : 'person has prayed') : (isTa ? 'நபர்கள் ஜெபித்துள்ளனர்' : 'people have prayed')}</span>
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
                            <span>{hasPrayed ? (isTa ? 'ஜெபித்தாயிற்று' : 'Prayed') : (isTa ? 'நானும் ஜெபிக்கிறேன்' : 'Pray For This')}</span>
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
