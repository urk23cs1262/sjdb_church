import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiLock, FiSend, FiAlertCircle, FiEdit3, FiBell, FiGlobe, 
  FiEye, FiCalendar, FiShield, FiCrosshair, FiCpu, FiRadio, FiSearch
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const SETTING_SCHEMAS = [
  {
    id: 'notifications',
    category: 'Notifications',
    icon: <FiBell />,
    items: [
      { key: 'notifications.eventReminders', label: 'Event Reminders', type: 'boolean' },
      { key: 'notifications.massSchedule', label: 'Mass Schedule Alerts', type: 'boolean' },
      { key: 'notifications.prayerMeetings', label: 'Prayer Meetings & Novenas', type: 'boolean' },
      { key: 'notifications.feastDays', label: 'Feast Days & Parish Events', type: 'boolean' },
      { key: 'notifications.saintOfTheDay', label: 'Saint of the Day Digest', type: 'boolean' },
      { key: 'notifications.donationReceipts', label: 'Donation & Payment Receipts', type: 'boolean' },
      { key: 'notifications.birthdayWishes', label: 'Birthday & Milestone Blessings', type: 'boolean' },
      { key: 'notifications.anniversaryWishes', label: 'Anniversary Wishes', type: 'boolean' },
      { key: 'notifications.whatsapp', label: 'WhatsApp Delivery Channel', type: 'boolean' },
      { key: 'notifications.email', label: 'Email Notifications', type: 'boolean' },
      { key: 'notifications.push', label: 'Push Notifications', type: 'boolean' },
    ]
  },
  {
    id: 'language',
    category: 'Language & Accessibility',
    icon: <FiGlobe />,
    items: [
      { key: 'language', label: 'App Language', type: 'select', options: [{ v: 'en', l: 'English' }, { v: 'ta', l: 'Tamil' }] },
      { key: 'accessibility.fontSize', label: 'Text Size', type: 'select', options: [{ v: 'small', l: 'Small' }, { v: 'normal', l: 'Normal' }, { v: 'large', l: 'Large' }, { v: 'xlarge', l: 'Extra Large' }] },
      { key: 'accessibility.highContrast', label: 'High Contrast Mode', type: 'boolean' },
      { key: 'accessibility.reduceAnimations', label: 'Reduce Motion & Animations', type: 'boolean' },
      { key: 'accessibility.screenReader', label: 'Screen Reader Support', type: 'boolean' },
    ]
  },
  {
    id: 'privacy',
    category: 'Privacy & Data',
    icon: <FiEye />,
    items: [
      { key: 'privacy.visibility', label: 'Profile Directory Visibility', type: 'select', options: [{ v: 'members', l: 'Members Only' }, { v: 'private', l: 'Private' }, { v: 'public', l: 'Public' }] },
      { key: 'privacy.showPhone', label: 'Show Phone Number to Members', type: 'boolean' },
      { key: 'privacy.showEmail', label: 'Show Email Address to Members', type: 'boolean' },
      { key: 'privacy.showDob', label: 'Show Date of Birth', type: 'boolean' },
      { key: 'privacy.showAddress', label: 'Show Residential Address', type: 'boolean' },
    ]
  },
  {
    id: 'prayer',
    category: 'Spiritual & Prayer',
    icon: <FiCalendar />,
    items: [
      { key: 'prayer.dailyBibleVerse', label: 'Daily Bible Verse Digest', type: 'boolean' },
      { key: 'prayer.saintOfTheDay', label: 'Daily Saint Feature', type: 'boolean' },
      { key: 'prayer.prayerReminder', label: 'Daily Prayer Reminders', type: 'boolean' },
      { key: 'prayer.rosaryReminder', label: 'Holy Rosary Reminders', type: 'boolean' },
      { key: 'prayer.massReminder', label: 'Mass Intention Reminders', type: 'boolean' },
    ]
  },
  {
    id: 'church',
    category: 'Church & Emergency Contact',
    icon: <FiCrosshair />,
    items: [
      { key: 'churchPreferences.preferredParish', label: 'Preferred Parish', type: 'text' },
      { key: 'churchPreferences.preferredLanguage', label: 'Preferred Mass Language', type: 'select', options: [{ v: 'Tamil', l: 'Tamil' }, { v: 'English', l: 'English' }] },
      { key: 'churchPreferences.preferredPriest', label: 'Preferred Spiritual Director', type: 'text' },
      { key: 'emergencyContact.name', label: 'Emergency Contact Name', type: 'text' },
      { key: 'emergencyContact.relationship', label: 'Relationship', type: 'text' },
      { key: 'emergencyContact.phone', label: 'Emergency Phone Number', type: 'text' },
    ]
  },
  {
    id: 'ai',
    category: 'AI-Based Settings',
    icon: <FiCpu />,
    items: [
      { key: 'aiSettings.notificationRecommendations', label: 'AI Smart Notification Timing', type: 'boolean' },
      { key: 'aiSettings.spiritualGrowth', label: 'Spiritual Growth Recommendations', type: 'boolean' },
      { key: 'aiSettings.eventRecommendations', label: 'Personalized Event Suggestions', type: 'boolean' },
      { key: 'aiSettings.familyInsights', label: 'Family Engagement Insights', type: 'boolean' },
      { key: 'aiSettings.prayerSuggestions', label: 'Personalized Prayer Digest', type: 'boolean' },
    ]
  },
  {
    id: 'admin_comm',
    category: 'Parish Communication',
    icon: <FiRadio />,
    items: [
      { key: 'adminCommPreferences.receiveAnnouncements', label: 'Parish Announcements', type: 'boolean' },
      { key: 'adminCommPreferences.receiveEmergencyAlerts', label: 'Urgent Emergency Alerts', type: 'boolean' },
      { key: 'adminCommPreferences.allowStaffContact', label: 'Allow Parish Staff Contact', type: 'boolean' },
      { key: 'adminCommPreferences.receiveVolunteerRequests', label: 'Volunteer Callouts', type: 'boolean' },
    ]
  }
  // {
  //   id: 'security',
  //   category: 'Security',
  //   icon: <FiShield />,
  //   items: [
  //     { key: 'security.twoFactorEnabled', label: 'Two-Factor Authentication', type: 'boolean' },
  //   ]
  // }
];

function getNestedValue(obj, path, fallback = '') {
  if (!obj) return fallback;
  const parts = path.split('.');
  let curr = obj;
  for (let p of parts) {
    if (curr === undefined || curr === null) return fallback;
    curr = curr[p];
  }
  return curr ?? fallback;
}

export default function MemberSettingsModal({ member, onClose }) {
  const [loading, setLoading] = useState(true);
  const [memberSettings, setMemberSettings] = useState({});
  const [mode, setMode] = useState('read'); // 'read' | 'request'
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [proposed, setProposed] = useState({});
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!member?._id) return;
    setLoading(true);
    api.get(`/users/${member._id}`)
      .then(r => {
        const settings = r.data.user?.settings || {};
        setMemberSettings(settings);
        setProposed(JSON.parse(JSON.stringify(settings)));
      })
      .catch(() => toast.error('Failed to load member settings'))
      .finally(() => setLoading(false));
  }, [member]);

  const handleToggle = (keyPath) => {
    setProposed(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const parts = keyPath.split('.');
      let curr = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
      }
      const oldVal = getNestedValue(prev, keyPath, false);
      curr[parts[parts.length - 1]] = !oldVal;
      return copy;
    });
  };

  const handleTextOrSelect = (keyPath, value) => {
    setProposed(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const parts = keyPath.split('.');
      let curr = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
      }
      curr[parts[parts.length - 1]] = value;
      return copy;
    });
  };

  // Compute diff
  const computeDiff = () => {
    const diff = {};
    SETTING_SCHEMAS.forEach(cat => {
      cat.items.forEach(item => {
        const oldVal = getNestedValue(memberSettings, item.key, item.type === 'boolean' ? false : '');
        const newVal = getNestedValue(proposed, item.key, item.type === 'boolean' ? false : '');
        if (oldVal !== newVal) {
          diff[item.key] = {
            label: item.label,
            old: oldVal,
            new: newVal
          };
        }
      });
    });
    return diff;
  };

  const handleSendRequest = async () => {
    const diff = computeDiff();
    if (Object.keys(diff).length === 0) {
      toast.error('No changes were made to request.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please enter a reason for the setting change request.');
      return;
    }

    setSending(true);
    try {
      await api.post('/permission-requests', {
        userId: member._id,
        reason: reason.trim(),
        requestedChanges: diff
      });
      toast.success(`Permission request sent to ${member.name}`);
      onClose();
    } catch {
      toast.error('Failed to send permission request.');
    } finally {
      setSending(false);
    }
  };

  const diffCount = Object.keys(computeDiff()).length;

  const filteredCategories = SETTING_SCHEMAS.map(cat => {
    if (activeCategory !== 'all' && cat.id !== activeCategory) return null;
    const items = cat.items.filter(item => 
      !search || item.label.toLowerCase().includes(search.toLowerCase())
    );
    if (items.length === 0) return null;
    return { ...cat, items };
  }).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-church-royal-blue text-white p-4 sm:p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 ring-2 ring-church-gold/50 flex items-center justify-center font-bold text-church-gold">
              {member?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
                {member?.name}'s Settings
                <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 font-semibold">
                  <FiLock className="text-[10px]" /> Read-Only
                </span>
              </h2>
              <p className="text-white/70 text-xs">{member?.email || member?.phone} • {member?.parishMemberId || 'Member'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <FiX size={20} />
          </button>
        </div>

        {/* Governance Notice Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FiAlertCircle className="text-amber-600 flex-shrink-0" />
            <span>Administrators cannot directly alter member preferences. Changes require member consent.</span>
          </div>
          {mode === 'read' ? (
            <button onClick={() => setMode('request')} className="flex items-center gap-1 bg-church-gold text-white font-bold px-3 py-1 rounded-lg shadow-sm hover:brightness-110 transition-all text-xs flex-shrink-0 ml-2">
              <FiEdit3 /> Request Changes
            </button>
          ) : (
            <button onClick={() => { setMode('read'); setProposed(JSON.parse(JSON.stringify(memberSettings))); }} className="text-amber-900 font-bold hover:underline ml-2">
              Cancel Request
            </button>
          )}
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeCategory === 'all' ? 'bg-church-royal-blue text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              All Categories
            </button>
            {SETTING_SCHEMAS.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeCategory === c.id ? 'bg-church-royal-blue text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
              >
                {c.icon} {c.category}
              </button>
            ))}
          </div>

          {/* <div className="relative w-full sm:w-48">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="church-input pl-8 py-1 text-xs w-full"
              placeholder="Search settings..."
            />
          </div> */}
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {loading ? (
            <p className="text-center text-gray-400 py-16">Loading member preferences...</p>
          ) : filteredCategories.length === 0 ? (
            <p className="text-center text-gray-400 py-16">No settings matched your search.</p>
          ) : (
            filteredCategories.map(cat => (
              <div key={cat.id} className="glass-card p-4 sm:p-5">
                <h3 className="font-bold text-sm text-church-royal-blue uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                  <span className="text-church-gold text-base">{cat.icon}</span>
                  {cat.category}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cat.items.map(item => {
                    const currentVal = getNestedValue(memberSettings, item.key, item.type === 'boolean' ? false : '');
                    const proposedVal = getNestedValue(proposed, item.key, item.type === 'boolean' ? false : '');
                    const isModified = currentVal !== proposedVal;

                    return (
                      <div key={item.key} className={`p-3 rounded-xl border transition-all ${isModified ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-gray-50/50 border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-gray-800">{item.label}</p>
                          {mode === 'read' ? (
                            item.type === 'boolean' ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${currentVal ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {currentVal ? 'ON' : 'OFF'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold">
                                {String(currentVal || '—')}
                              </span>
                            )
                          ) : (
                            item.type === 'boolean' ? (
                              <button
                                onClick={() => handleToggle(item.key)}
                                className={`w-11 h-5 flex items-center rounded-full p-0.5 transition-colors ${proposedVal ? 'bg-church-gold justify-end' : 'bg-gray-300 justify-start'}`}
                              >
                                <motion.div layout className="w-4 h-4 bg-white rounded-full shadow-md" />
                              </button>
                            ) : item.type === 'select' ? (
                              <select
                                value={proposedVal}
                                onChange={e => handleTextOrSelect(item.key, e.target.value)}
                                className="church-select py-0.5 px-2 text-xs"
                              >
                                {item.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={proposedVal}
                                onChange={e => handleTextOrSelect(item.key, e.target.value)}
                                className="church-input py-0.5 px-2 text-xs w-32"
                              />
                            )
                          )}
                        </div>

                        {mode === 'request' && isModified && (
                          <p className="text-[11px] text-amber-800 mt-1 font-medium flex items-center gap-1">
                            Change: <span className="line-through opacity-60">{String(currentVal || 'Empty')}</span> → <span className="font-bold text-church-royal-blue">{String(proposedVal)}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Mandatory Rationale in Request Mode */}
          {mode === 'request' && (
            <div className="glass-card p-4 border-2 border-church-gold/50 shadow-gold-lg">
              <label className="church-label text-church-royal-blue font-bold flex items-center justify-between mb-2">
                <span>Reason for Requested Preference Change *</span>
                <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                  {diffCount} setting(s) modified
                </span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                className="church-input resize-none text-sm"
                placeholder="e.g. Updating communication preferences per parish office request."
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-colors">
            Close
          </button>
          {mode === 'request' && (
            <button
              onClick={handleSendRequest}
              disabled={sending || diffCount === 0}
              className="btn-gold px-5 py-2.5 text-sm flex items-center gap-2 shadow-gold"
            >
              <FiSend /> {sending ? 'Sending Request...' : 'Send Permission Request'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
