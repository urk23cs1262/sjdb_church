import churchLogo from '../../assets/church_extirior.png';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GiChurch } from 'react-icons/gi';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { FiCalendar, FiClock, FiMapPin, FiUser, FiFilter, FiX, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import { useAuth } from '../../context/context_auth_context';
import PageHero from '../../components/common/common_page_hero';
import { resolveEventImageUrl, handleImageError, FALLBACK_EVENT_IMAGE } from '../../utils/eventImageHelper';

import LoginRequiredModal from '../../components/common/common_login_required_modal';

const CATEGORIES = ['all', 'feast', 'mass', 'meeting', 'youth', 'choir', 'catechism', 'community', 'other'];
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

export default function Events() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [view, setView] = useState('upcoming'); // upcoming | past

  // Registration Modal State
  const [registeringEvent, setRegisteringEvent] = useState(null);
  const [withdrawingEvent, setWithdrawingEvent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingTargetUrl, setPendingTargetUrl] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    gender: 'male',
    comingFrom: SUB_STATIONS[0]
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  const fetchEvents = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (view === 'upcoming') params.set('upcoming', 'true');
    api.get(`/events?${params}`)
      .then(r => setEvents(r.data.events || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
  }, [category, view]);

  // Auto-open registration modal if returning from login with eventId & action=register
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const targetEventId = searchParams.get('eventId');
    const action = searchParams.get('action');

    if (targetEventId && action === 'register' && events.length > 0) {
      const match = events.find(e => e._id === targetEventId);
      if (match) {
        setRegisteringEvent(match);
        setIsSuccess(false);
      }
    }
  }, [events]);

  const handleRegisterClick = (event) => {
    if (!isAuthenticated) {
      setPendingTargetUrl(`/events?eventId=${event._id}&action=register`);
      setShowAuthModal(true);
      return;
    }
    setRegisteringEvent(event);
    setIsSuccess(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!registeringEvent) return;
    const targetEventId = registeringEvent._id;
    setIsSubmitting(true);
    try {
      const res = await api.post(`/events/${targetEventId}/register`, formData);
      const regData = res.data?.registration || {
        userId: user?._id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        registeredAt: new Date().toISOString()
      };
      const updatedCount = res.data?.registrationCount;

      // 1. Immediately update React state with zero refresh required
      setEvents(prev => prev.map(ev => {
        if (ev._id === targetEventId) {
          const currentRegs = ev.registrations || [];
          const updatedRegs = [...currentRegs, regData];
          return {
            ...ev,
            isRegistered: true,
            registrations: updatedRegs,
            registrationCount: updatedCount !== undefined ? updatedCount : updatedRegs.length
          };
        }
        return ev;
      }));

      setIsSuccess(true);
      toast.success(res.data?.message || 'Registration confirmed!');

      // Close modal smoothly after brief celebration feedback
      setTimeout(() => {
        setRegisteringEvent(null);
        setIsSuccess(false);
      }, 1500);
    } catch (e) {
      const code = e.response?.data?.code;
      const msg = e.response?.data?.message || 'Failed to register';
      if (code === 'ALREADY_REGISTERED') {
        // Reflect registered state immediately
        setEvents(prev => prev.map(ev => ev._id === targetEventId ? { ...ev, isRegistered: true } : ev));
        setRegisteringEvent(null);
      }
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawClick = (event) => {
    setWithdrawingEvent(event);
  };

  const confirmWithdraw = async () => {
    if (!withdrawingEvent) return;
    const targetEventId = withdrawingEvent._id;
    setIsSubmitting(true);
    try {
      const res = await api.delete(`/events/${targetEventId}/register`);
      const updatedCount = res.data?.registrationCount;

      // 1. Immediately update React state with zero refresh required
      setEvents(prev => prev.map(ev => {
        if (ev._id === targetEventId) {
          const updatedRegs = (ev.registrations || []).filter(
            r => String(r.userId?._id || r.userId) !== String(user?._id)
          );
          return {
            ...ev,
            isRegistered: false,
            registrations: updatedRegs,
            registrationCount: updatedCount !== undefined ? updatedCount : Math.max(0, (ev.registrationCount || 1) - 1)
          };
        }
        return ev;
      }));

      toast.success(res.data?.message || 'Registration withdrawn successfully');
      setWithdrawingEvent(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to withdraw');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="min-h-screen pt-10 pb-20 bg-church-cream ">
      <PageHero title={<>{t('nav.events')}</>} subtitle={<>What's Happening</>} />

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <div className="flex gap-2">
              {['upcoming', 'past'].map(v => (
                <button key={v} onClick={() => setView(v)} className={`px-5 py-2 rounded-xl font-semibold text-sm capitalize transition-all ${view === v ? 'bg-church-royal-blue text-white' : 'bg-white  text-gray-600  hover:bg-gray-50'}`}>{v}</button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <FiFilter className="text-gray-400 self-center" />
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${category === c ? 'bg-church-gold text-white' : 'bg-white  text-gray-500 hover:bg-gold-50'}`}>{c}</button>
              ))}
            </div>
          </div>

          {loading ? <SectionLoader /> : events.length === 0 ? (
            <div className="bg-amber-50/50 rounded-2xl p-12 text-center border border-amber-200/60 shadow-xs my-4">
              <GiChurch className="text-5xl mx-auto mb-3 text-amber-500/40" />
              <h3 className="font-display font-bold text-gray-800 text-lg mb-1">No Events Found</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                There are currently no {view === 'upcoming' ? 'upcoming' : 'past'} events scheduled. Please check back later or explore other categories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((ev, i) => {
                const isUserRegistered = Boolean(
                  ev.isRegistered || (user && (ev.registrations || []).some(r => String(r.userId?._id || r.userId) === String(user._id)))
                );
                const regCount = ev.registrationCount !== undefined ? ev.registrationCount : (ev.registrations?.length || 0);
                const isFull = Boolean(ev.registrationLimit && ev.registrationLimit > 0 && regCount >= ev.registrationLimit && !isUserRegistered);

                return (
                  <motion.div
                    key={ev._id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="church-card overflow-hidden group flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-full h-48 rounded-xl mb-4 overflow-hidden bg-church-cream/50 relative">
                        <img 
                          src={resolveEventImageUrl(ev.image)} 
                          alt={ev.title} 
                          onError={(e) => handleImageError(e, churchLogo)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          loading="lazy"
                        />
                      </div>
                      <div className="flex items-start justify-between mb-2">
                        <span className="badge badge-gold capitalize">{ev.category}</span>
                        <div className="text-right">
                          <p className="text-church-royal-blue font-bold font-display text-xl">{new Date(ev.date).getDate()}</p>
                          <p className="text-gray-400 text-xs">{new Date(ev.date).toLocaleString('default', { month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-800 text-lg mb-2 group-hover:text-church-gold transition-colors">{ev.title}</h3>
                      {ev.description && <p className="text-gray-500 text-sm mb-3 line-clamp-2">{ev.description}</p>}
                      <div className="space-y-1.5 text-xs text-gray-400 mb-4">
                        {ev.time && <div className="flex items-center gap-1.5"><FiClock className="text-church-gold" />{ev.time}</div>}
                        {ev.venue && <div className="flex items-center gap-1.5"><FiMapPin className="text-church-gold" />{ev.venue}</div>}
                        {ev.organizer && <div className="flex items-center gap-1.5"><FiUser className="text-church-gold" />{ev.organizer}</div>}
                      </div>
                    </div>

                    {ev.registrationRequired && (
                      <div className="space-y-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Total Registrations</span>
                          <span className="font-bold text-church-royal-blue">
                            {regCount} {ev.registrationLimit > 0 ? `/ ${ev.registrationLimit}` : 'participants'}
                          </span>
                        </div>

                        {isUserRegistered ? (
                          <div className="space-y-2">
                            <div className="bg-emerald-50 text-emerald-700 text-xs py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 border border-emerald-200">
                              <FiCheckCircle className="text-sm shrink-0" /> Registration Confirmed
                            </div>
                            <button 
                              onClick={() => handleWithdrawClick(ev)} 
                              disabled={isSubmitting && withdrawingEvent?._id === ev._id}
                              className="w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                              {isSubmitting && withdrawingEvent?._id === ev._id ? 'Withdrawing...' : 'Withdraw Registration'}
                            </button>
                          </div>
                        ) : isFull ? (
                          <button disabled className="w-full bg-gray-200 text-gray-500 py-2.5 rounded-xl text-sm font-bold cursor-not-allowed">
                            Registration Full
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleRegisterClick(ev)} 
                            disabled={isSubmitting && registeringEvent?._id === ev._id}
                            className="btn-gold w-full justify-center text-sm py-2.5 disabled:opacity-60"
                          >
                            {isSubmitting && registeringEvent?._id === ev._id ? 'Registering...' : 'Register Now'}
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Registration Modal */}
      <AnimatePresence>
        {registeringEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setRegisteringEvent(null)}
              className="absolute inset-0 bg-church-dark/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white  rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
            >
              {isSuccess ? (
                <div className="p-12 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <FiCheckCircle className="text-4xl" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-800  mb-2">Registration Successful!</h3>
                  <p className="text-gray-500 ">You have been registered for {registeringEvent.title}. See you there!</p>
                </div>
              ) : (
                <>
                  <div className="p-6 border-b border-gray-100  flex justify-between items-center bg-church-gradient">
                    <div>
                      <h3 className="text-white font-bold text-lg">Event Registration</h3>
                      <p className="text-white/70 text-xs">{registeringEvent.title}</p>
                    </div>
                    <button 
                      onClick={() => setRegisteringEvent(null)}
                      className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all"
                    >
                      <FiX />
                    </button>
                  </div>

                  <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                    <div>
                      <label className="church-label">Full Name</label>
                      <input 
                        type="text" 
                        required 
                        className="church-input" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="church-label">Phone Number</label>
                        <input 
                          type="tel" 
                          required 
                          className="church-input" 
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="church-label">Gender</label>
                        <select 
                          className="church-select"
                          value={formData.gender}
                          onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        >
                          <option>Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="church-label">Email Address</label>
                      <input 
                        type="email" 
                        required 
                        className="church-input" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="church-label">Coming From (Sub-station)</label>
                      <select 
                        className="church-select"
                        value={formData.comingFrom}
                        onChange={(e) => setFormData({...formData, comingFrom: e.target.value})}
                      >
                        <option>Select</option>
                        {SUB_STATIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                          
                        ))}
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="btn-gold w-full justify-center py-3 mt-4"
                    >
                      {isSubmitting ? 'Registering...' : 'Confirm Registration'}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdrawal Confirmation Modal */}
      <AnimatePresence>
        {withdrawingEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setWithdrawingEvent(null)}
              className="absolute inset-0 bg-church-dark/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10 p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiX className="text-4xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Are you sure?</h3>
              <p className="text-gray-500 mb-8">Are you sure you want to withdraw your registration for <span className="font-bold">{withdrawingEvent.title}</span>?</p>
              
              <div className="flex flex-col gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={confirmWithdraw}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Withdrawing...' : 'Withdraw Registration'}
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => setWithdrawingEvent(null)}
                  className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LoginRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        targetUrl={pendingTargetUrl}
      />
    </div>
  );
}
