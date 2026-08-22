import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUsers, FiCalendar, FiClock, FiMapPin, FiUserCheck, FiHeart, FiSearch, FiShield } from 'react-icons/fi';
import { GiChurch, GiCrossedSwords } from 'react-icons/gi';
import PageHero from '../../components/common/common_page_hero';
import api, { getMediaUrl } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

export default function Anbiyams() {
  const [anbiyams, setAnbiyams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPublicAnbiyams();
  }, []);

  const fetchPublicAnbiyams = async () => {
    try {
      setLoading(true);
      const res = await api.get('/anbiyam/public');
      setAnbiyams(res.data.anbiyams || []);
    } catch (err) {
      console.error('Failed to load public anbiyams:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = anbiyams.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.patronSaint && a.patronSaint.toLowerCase().includes(search.toLowerCase())) ||
    (a.meetingVenue && a.meetingVenue.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <PageHero
        title="Parish Anbiyams"
        subtitle="Anbiyam — Fellowship, Prayer & Christian Unity in Ward Neighborhoods"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="relative w-full sm:w-80">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Anbiyam or Patron Saint..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-xs sm:text-sm font-medium shadow-xs focus:ring-2 focus:ring-church-gold focus:outline-hidden"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold bg-white px-4 py-2 rounded-2xl border border-gray-200 shadow-2xs">
            <FiShield className="text-emerald-600 text-sm" />
            <span>Member privacy protected (Official public listings only)</span>
          </div>
        </div>

        {loading ? (
          <SectionLoader />
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filtered.map((anbiyam, idx) => (
              <motion.div
                key={anbiyam._id || idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all border border-gray-100/80 bg-white"
              >
                <div>
                  {/* Photo Header */}
                  <div className="h-48 bg-gradient-to-br from-church-royal-blue via-blue-900 to-indigo-950 relative overflow-hidden flex items-center justify-center">
                    {anbiyam.image ? (
                      <img
                        src={getMediaUrl(anbiyam.image)}
                        alt={anbiyam.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-6 text-white/40">
                        <GiChurch className="text-6xl mx-auto mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">{anbiyam.name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-church-gold/90 text-white px-2.5 py-0.5 rounded-full inline-block mb-1 shadow-xs">
                        {anbiyam.patronSaint ? `Saint: ${anbiyam.patronSaint}` : 'Basic Ecclesial Community'}
                      </span>
                      <h3 className="font-display text-xl font-bold leading-tight">{anbiyam.name}</h3>
                    </div>
                  </div>

                  {/* Body Details */}
                  <div className="p-5 space-y-4 text-xs sm:text-sm">
                    {anbiyam.description && (
                      <p className="text-gray-600 italic text-xs leading-relaxed border-l-2 border-church-gold pl-3">
                        "{anbiyam.description}"
                      </p>
                    )}

                    {/* Summary Numbers */}
                    <div className="grid grid-cols-2 gap-3 bg-amber-50/60 p-3 rounded-2xl border border-amber-200/60 text-center">
                      <div>
                        <span className="text-lg font-black text-church-royal-blue block">{anbiyam.totalFamilies || 0}</span>
                        <span className="text-[10px] font-bold text-amber-900 uppercase">Total Families</span>
                      </div>
                      <div>
                        <span className="text-lg font-black text-emerald-700 block">{anbiyam.totalMembers || 0}</span>
                        <span className="text-[10px] font-bold text-emerald-950 uppercase">Active Members</span>
                      </div>
                    </div>

                    {/* Meeting Schedule */}
                    <div className="space-y-2 pt-2 border-t border-gray-100 text-gray-700">
                      <div className="flex items-center gap-2">
                        <FiCalendar className="text-church-gold flex-shrink-0" />
                        <span><strong>Meeting Day:</strong> {anbiyam.meetingDay || 'Scheduled Monthly'} ({anbiyam.meetingFrequency || 'Monthly'})</span>
                      </div>
                      {anbiyam.meetingTime && (
                        <div className="flex items-center gap-2">
                          <FiClock className="text-church-gold flex-shrink-0" />
                          <span><strong>Meeting Time:</strong> {anbiyam.meetingTime}</span>
                        </div>
                      )}
                      {anbiyam.meetingVenue && (
                        <div className="flex items-start gap-2">
                          <FiMapPin className="text-church-gold flex-shrink-0 mt-0.5" />
                          <span><strong>Venue:</strong> {anbiyam.meetingVenue}</span>
                        </div>
                      )}
                    </div>

                    {/* Leaders & Office Bearers */}
                    <div className="bg-gray-50/80 p-3 rounded-2xl space-y-1.5 text-xs border border-gray-100">
                      <p className="font-extrabold text-church-royal-blue text-[11px] uppercase tracking-wider mb-1">
                        Anbiyam Leadership
                      </p>
                      {anbiyam.leaderName && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-medium">Leader:</span>
                          <span className="font-bold text-gray-900">{anbiyam.leaderName}</span>
                        </div>
                      )}
                      {anbiyam.viceLeaderName && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-medium">Vice Leader:</span>
                          <span className="font-semibold text-gray-800">{anbiyam.viceLeaderName}</span>
                        </div>
                      )}
                      {anbiyam.secretaryName && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-medium">Secretary:</span>
                          <span className="font-semibold text-gray-800">{anbiyam.secretaryName}</span>
                        </div>
                      )}
                      {anbiyam.contactPerson && (
                        <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                          <span className="text-amber-800 font-bold">Contact Person:</span>
                          <span className="font-bold text-amber-950">{anbiyam.contactPerson}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 border-t border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 font-medium">
                    St. John de Britto Church — Anbiyams
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
            <GiChurch className="text-5xl text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-700">No Anbiyams Found</h3>
            <p className="text-xs text-gray-500 mt-1">Check back later or clear your search query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
