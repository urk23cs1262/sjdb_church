import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SiWhatsapp } from 'react-icons/si';
import {
  FiUsers,
  FiMessageSquare,
  FiSend,
  FiZap,
  FiCheck,
  FiInfo,
  FiCopy,
  FiPhone,
  FiGrid,
  FiRefreshCw,
  FiAlertTriangle,
  FiX,
  FiCheckCircle,
  FiClock,
  FiActivity,
  FiSearch,
  FiEye,
  FiPlay,
  FiShield,
  FiCalendar,
  FiSliders,
  FiArrowRight,
  FiRadio,
  FiCornerDownRight,
  FiChevronDown,
  FiTrash2
} from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PREF_LABELS = {
  verse: 'Daily Bible Verse',
  saint: 'Saint of the Day',
  mass: 'Mass Readings',
  events: 'Church Events',
  announcements: 'Announcements',
  birthday: 'Birthday Wishes',
};

const PREF_ICONS = {
  verse: '📖',
  saint: '🕊️',
  mass: '⛪',
  events: '📅',
  announcements: '📢',
  birthday: '🎂',
};

const LANG_LABELS = {
  en: 'English',
  ta: 'Tamil (தமிழ்)',
  ml: 'Malayalam',
  both: 'Tamil + English',
};

export default function AdminWhatsApp() {
  // Main Data States
  const [stats, setStats] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [waStatus, setWaStatus] = useState({ connected: false, status: 'connecting' });
  const [qrCode, setQrCode] = useState(null);
  const [todayPreview, setTodayPreview] = useState(null);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [dailyJob, setDailyJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab State: 'overview' | 'subscribers' | 'broadcast' | 'test-bot' | 'history'
  const [activeTab, setActiveTab] = useState('overview');

  // Connection Management States
  const [connectionMode, setConnectionMode] = useState('qr'); // 'qr' | 'phone'
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneInput, setPhoneInput] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [isGeneratingPairing, setIsGeneratingPairing] = useState(false);
  const [copiedPairing, setCopiedPairing] = useState(false);
  const [pairingCountdown, setPairingCountdown] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showClearFreshModal, setShowClearFreshModal] = useState(false);
  const [clearingFresh, setClearingFresh] = useState(false);
  const [subscriberToDelete, setSubscriberToDelete] = useState(null);
  const [isDeletingSubscriber, setIsDeletingSubscriber] = useState(false);

  // Broadcast & Composer States
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Custom Message Mode: 'broadcast' | 'direct'
  const [sendMode, setSendMode] = useState('broadcast');
  const [targetSubscriber, setTargetSubscriber] = useState(null);
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberFilter, setSubscriberFilter] = useState('all'); // 'all' | 'website' | 'bot' | 'active'

  // Test Playground States
  const [chatHistory, setChatHistory] = useState([
    {
      id: 1,
      sender: 'bot',
      text: '✨ *Welcome to SJDB Connect*\n_St. John de Britto\'s Church WhatsApp Bot Simulator_\n\nReply *HI* or pick a shortcut below to begin testing.',
      timestamp: Date.now(),
    },
  ]);
  const [testInput, setTestInput] = useState('');
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [sessionState, setSessionState] = useState({ step: 'welcome' });
  const [directTestPhone, setDirectTestPhone] = useState('');
  const [isSendingDirectTest, setIsSendingDirectTest] = useState(false);
  const [directTestOpen, setDirectTestOpen] = useState(false);

  const chatContainerRef = useRef(null);

  // Auto-scroll chat history in playground
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isTestingBot]);

  // Pairing code countdown
  useEffect(() => {
    if (pairingCountdown <= 0) return;
    const timer = setInterval(() => {
      setPairingCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [pairingCountdown]);

  // Primary Data Fetcher (Dashboard Monitoring Only — Zero Side Effects)
  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const [statsRes, subsRes, statusRes, qrRes, previewRes, historyRes, jobRes] = await Promise.all([
        api.get('/bot/stats').catch(() => ({ data: { stats: null } })),
        api.get('/bot/subscribers').catch(() => ({ data: { subscribers: [] } })),
        api.get('/bot/status').catch(() => ({ data: { connected: false, status: 'disconnected' } })),
        api.get('/bot/qr').catch(() => ({ data: { qr: null } })),
        api.get('/bot/preview-today').catch(() => ({ data: null })),
        api.get('/bot/history').catch(() => ({ data: { history: [] } })),
        api.get('/daily-notifications/job-status').catch(() => ({ data: null })),
      ]);

      if (statsRes.data?.stats) setStats(statsRes.data.stats);
      if (subsRes.data?.subscribers) setSubscribers(subsRes.data.subscribers);
      if (statusRes.data) setWaStatus(statusRes.data);
      if (qrRes.data?.qr) setQrCode(qrRes.data.qr);
      else if (statusRes.data?.connected) setQrCode(null);
      if (previewRes.data?.success) setTodayPreview(previewRes.data);
      if (historyRes.data?.history) setBroadcastHistory(historyRes.data.history);
      if (jobRes.data?.job) setDailyJob(jobRes.data);
    } catch {
      if (!isBackground) toast.error('Failed to load WhatsApp bot data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial mount load
  useEffect(() => {
    fetchData(false);
  }, []);

  // Adaptive auto-polling interval
  useEffect(() => {
    // Poll every 5s if disconnected or generating pairing/QR, every 30s if connected
    const pollIntervalTime = waStatus.connected ? 30000 : 6000;
    const timer = setInterval(() => {
      fetchData(true);
    }, pollIntervalTime);
    return () => clearInterval(timer);
  }, [waStatus.connected]);

  // Handle Manual Reconnect
  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await api.post('/bot/reconnect');
      toast.success('Reconnecting WhatsApp socket...');
      setTimeout(() => fetchData(true), 2000);
    } catch {
      toast.error('Failed to initiate reconnect');
    } finally {
      setReconnecting(false);
    }
  };

  // Handle Session Reset
  const handleResetSession = async () => {
    setShowResetModal(false);
    setResetting(true);
    setQrCode(null);
    setPairingCode(null);
    setPairingCountdown(0);
    try {
      const res = await api.post('/bot/reset');
      toast.success(res.data.message || 'Session reset. Generating fresh QR code...');
      setTimeout(() => fetchData(true), 1500);
    } catch {
      toast.error('Failed to reset session');
    } finally {
      setResetting(false);
    }
  };

  // Clear / Start Fresh: Reset all bot sessions & preferences for all users
  const handleClearStartFresh = async () => {
    setClearingFresh(true);
    try {
      const res = await api.post('/bot/clear-start-fresh');
      if (res.data?.success) {
        toast.success(res.data.message || 'Bot started fresh! All bot preferences cleared.');
        setShowClearFreshModal(false);
        await fetchData(true);
      } else {
        toast.error(res.data?.message || 'Failed to start bot fresh');
      }
    } catch (err) {
      console.error('Clear fresh error:', err);
      toast.error(err.response?.data?.message || 'Error clearing bot sessions');
    } finally {
      setClearingFresh(false);
    }
  };

  // Delete Individual Subscriber
  const handleDeleteSubscriber = async () => {
    if (!subscriberToDelete) return;
    setIsDeletingSubscriber(true);
    try {
      const phone = subscriberToDelete.phoneNumber;
      const res = await api.delete(`/bot/subscriber/${encodeURIComponent(phone)}`);
      if (res.data?.success) {
        toast.success(res.data.message || 'Subscriber removed successfully');
        setSubscriberToDelete(null);
        await fetchData(true);
      } else {
        toast.error(res.data?.message || 'Failed to delete subscriber');
      }
    } catch (err) {
      console.error('Delete subscriber error:', err);
      toast.error(err.response?.data?.message || 'Error deleting subscriber');
    } finally {
      setIsDeletingSubscriber(false);
    }
  };

  // Request Pairing Code
  const handleRequestPairingCode = async (e) => {
    e?.preventDefault();
    const cleanNum = phoneInput.replace(/\D/g, '');
    if (!cleanNum || cleanNum.length < 10) {
      return toast.error('Please enter a valid 10-digit WhatsApp phone number');
    }

    const fullPhone = `${countryCode.replace(/\D/g, '')}${cleanNum.slice(-10)}`;
    setIsGeneratingPairing(true);
    try {
      const res = await api.post('/bot/pairing-code', { phoneNumber: fullPhone });
      if (res.data?.success && res.data?.pairingCode) {
        setPairingCode(res.data.pairingCode);
        setPairingCountdown(60);
        toast.success('Pairing Code Generated! Enter it on your WhatsApp within 60s.');
      } else {
        toast.error(res.data?.message || 'Failed to generate pairing code');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error generating pairing code. Please try resetting session.');
    } finally {
      setIsGeneratingPairing(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/-/g, ''));
    setCopiedPairing(true);
    toast.success('Pairing code copied to clipboard!');
    setTimeout(() => setCopiedPairing(false), 2500);
  };

  // Trigger Instant Spiritual Broadcast
  const handleConfirmBroadcast = async () => {
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await api.post('/bot/broadcast/now');
      toast.success(res.data.message || 'Daily spiritual broadcast dispatched successfully!');
      setBroadcastResult({
        status: 'success',
        message: 'Daily spiritual broadcast dispatched to all active subscribers.',
        timestamp: new Date().toLocaleTimeString('en-IN'),
      });
      setTimeout(() => {
        setBroadcastModalOpen(false);
      }, 500);
      fetchData(true);
      setTimeout(() => fetchData(true), 2500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Broadcast failed to dispatch');
      setBroadcastResult({
        status: 'error',
        message: err.response?.data?.message || 'Failed to trigger broadcast.',
      });
    } finally {
      setBroadcasting(false);
    }
  };

  // Send Custom / Targeted Message
  const handleSendCustomMessage = async (e) => {
    e?.preventDefault();
    if (!customMsg.trim()) return toast.error('Please write a message to send');

    if (sendMode === 'direct' && !targetSubscriber) {
      return toast.error('Please select a recipient subscriber for direct message');
    }

    setSending(true);
    setSendResult(null);
    try {
      const payload = {
        message: customMsg.trim(),
        recipientPhone: sendMode === 'direct' ? targetSubscriber.phoneNumber : undefined,
      };

      const res = await api.post('/bot/send', payload);
      toast.success(res.data.message || 'Message sent successfully!');
      setSendResult({
        success: true,
        text: res.data.message || 'Message delivered successfully.',
      });
      setCustomMsg('');
      if (sendMode === 'direct') setTargetSubscriber(null);
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send WhatsApp message');
      setSendResult({
        success: false,
        text: err.response?.data?.message || 'Failed to send WhatsApp message.',
      });
    } finally {
      setSending(false);
    }
  };

  // Toggle Subscriber Opt-In
  const handleToggleOptIn = async (sub) => {
    const newStatus = !sub.optedIn;
    try {
      await api.post('/bot/subscriber/toggle-optin', {
        phoneNumber: sub.phoneNumber,
        optedIn: newStatus,
      });
      toast.success(`Subscriber ${sub.name} status updated to ${newStatus ? 'Active' : 'Paused'}`);
      setSubscribers((prev) =>
        prev.map((s) => (s.phoneNumber === sub.phoneNumber ? { ...s, optedIn: newStatus } : s))
      );
    } catch {
      toast.error('Failed to update subscriber status');
    }
  };

  // Simulator Test Message
  const handleSendSimulatorMessage = async (overrideText) => {
    const text = overrideText || testInput;
    if (!text || !text.trim() || isTestingBot) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    if (!overrideText) setTestInput('');
    setIsTestingBot(true);

    try {
      const res = await api.post('/bot/test-message', {
        message: text.trim(),
        sessionState,
      });

      if (res.data?.success) {
        setSessionState(res.data.sessionState || {});
        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: res.data.botReply,
          timestamp: Date.now(),
        };
        setChatHistory((prev) => [...prev, botMsg]);
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: '⚠️ Simulator error: Failed to process bot command. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTestingBot(false);
    }
  };

  // Live Test Message to real phone
  const handleSendDirectTestMessage = async (e) => {
    e?.preventDefault();
    const clean = directTestPhone.replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      return toast.error('Please enter a valid 10-digit phone number with country code');
    }

    setIsSendingDirectTest(true);
    try {
      const res = await api.post('/bot/test-direct', { phoneNumber: clean });
      toast.success(res.data.message || 'Test message sent to WhatsApp!');
      setDirectTestOpen(false);
      setDirectTestPhone('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send direct test message');
    } finally {
      setIsSendingDirectTest(false);
    }
  };

  // Filtered Subscribers
  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((sub) => {
      const matchesSearch =
        !subscriberSearch.trim() ||
        (sub.name && sub.name.toLowerCase().includes(subscriberSearch.toLowerCase())) ||
        (sub.phoneNumber && sub.phoneNumber.includes(subscriberSearch.replace(/\D/g, '')));

      if (!matchesSearch) return false;

      if (subscriberFilter === 'website') return sub.source === 'Website User';
      if (subscriberFilter === 'bot') return sub.source === 'WhatsApp Bot';
      if (subscriberFilter === 'active') return sub.optedIn !== false;
      return true;
    });
  }, [subscribers, subscriberSearch, subscriberFilter]);

  // Format Next 04:00 AM IST Countdown
  const nextBroadcastInfo = useMemo(() => {
    const now = new Date();
    // Convert to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);

    const next4Am = new Date(istTime);
    next4Am.setUTCHours(4, 0, 0, 0);
    if (istTime.getUTCHours() >= 4) {
      next4Am.setUTCDate(next4Am.getUTCDate() + 1);
    }

    const diffMs = next4Am.getTime() - istTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMins}m remaining`;
  }, []);

  return (
    <div className="p-3 sm:p-6 w-full max-w-7xl mx-auto overflow-hidden">
      {/* ─── Top Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200/80">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-[#128C7E] to-[#25D366] flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 text-white">
            <SiWhatsapp className="text-2xl sm:text-3xl" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-black text-church-royal-blue tracking-tight">
                WhatsApp Bot
              </h1>
              {/* Connection Live Pill */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-xs ${waStatus.connected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : waStatus.status === 'connecting'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${waStatus.connected
                      ? 'bg-emerald-500 animate-pulse'
                      : waStatus.status === 'connecting'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                />
                {waStatus.connected
                  ? 'Connected'
                  : waStatus.status === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              SJDB Connect • Baileys WhatsApp Engine & 04:00 AM Automated Spiritual Broadcast
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-3 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 disabled:opacity-60 cursor-pointer"
            title="Refresh status & statistics"
          >
            <FiRefreshCw className={`text-xs ${refreshing ? 'animate-spin text-church-royal-blue' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowClearFreshModal(true)}
            className="px-3 sm:px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
            title="Clear all bot preferences and reset subscribers to start fresh"
          >
            <FiTrash2 className="text-xs sm:text-sm shrink-0" />
            <span>Clear / Start Fresh</span>
          </button>

          <button
            onClick={() => setBroadcastModalOpen(true)}
            className="btn-gold py-2 px-3.5 sm:px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md flex-1 sm:flex-initial cursor-pointer"
          >
            <FiZap className="text-xs sm:text-sm shrink-0" />
            <span>Broadcast Now</span>
          </button>
        </div>
      </div>

      {/* ─── 6 Responsive Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 mb-6">
        {[
          {
            label: 'Conversations',
            val: stats?.total ?? (loading ? '...' : 0),
            icon: <FiMessageSquare />,
            color: 'bg-blue-500/10 text-blue-600 border-blue-200',
          },
          {
            label: 'Subscribers',
            val: stats?.active ?? (loading ? '...' : 0),
            icon: <FiUsers />,
            color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
          },
          {
            label: 'Opted-in Users',
            val: stats?.optedIn ?? (loading ? '...' : 0),
            icon: <FiCheck />,
            color: 'bg-amber-500/10 text-amber-700 border-amber-200',
          },
          {
            label: 'Sent Today',
            val: stats?.sentToday ?? (loading ? '...' : 0),
            icon: <FiSend />,
            color: 'bg-teal-500/10 text-teal-600 border-teal-200',
          },
          {
            label: 'Failed Today',
            val: stats?.failedToday ?? (loading ? '...' : 0),
            icon: <FiAlertTriangle />,
            color: 'bg-rose-500/10 text-rose-600 border-rose-200',
          },
          {
            label: 'Broadcasts Today',
            val: stats?.broadcastsToday ?? (loading ? '...' : 0),
            icon: <FiRadio />,
            color: 'bg-purple-500/10 text-purple-600 border-purple-200',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-3 sm:p-4 flex flex-col justify-between border border-gray-100/80 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-gray-500 truncate">{card.label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs border ${card.color}`}>
                {card.icon}
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-church-royal-blue tracking-tight">
                {card.val}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Navigation Tabs (Horizontally Scrollable) ────────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {[
          { id: 'overview', label: 'Overview & Device', icon: <FiGrid /> },
          { id: 'subscribers', label: `Subscribers (${subscribers.length})`, icon: <FiUsers /> },
          { id: 'broadcast', label: 'Broadcast & Send', icon: <FiSend /> },
          { id: 'test-bot', label: 'Playground & Test', icon: <FiPlay /> },
          { id: 'history', label: 'Automation & History', icon: <FiClock /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all shrink-0 cursor-pointer ${activeTab === tab.id
                ? 'bg-church-royal-blue text-white shadow-md shadow-blue-900/20'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/80'
              }`}
          >
            <span className="text-xs sm:text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── TAB 1: OVERVIEW & DEVICE CONNECTION ─────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Baileys Connection Card */}
          <div className="glass-card p-4 sm:p-6 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-church-royal-blue flex items-center gap-2">
                  <FiActivity className="text-emerald-600" /> WhatsApp Bot Engine (Baileys)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Direct WebSocket integration connected to MongoDB Atlas auth state.
                </p>
              </div>

              {/* Status Indicator Badge */}
              <div className="flex items-center gap-2">
                {waStatus.connected ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold shadow-xs">
                    <FiCheckCircle className="text-emerald-600 text-sm" />
                    <span>Live & Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold shadow-xs">
                    <FiAlertTriangle className="text-rose-600 text-sm" />
                    <span>Action Needed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Connection Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-400 block mb-1">Bot Account Number</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-church-royal-blue">
                  {waStatus.phoneNumber ? `+${waStatus.phoneNumber}` : 'Not Linked'}
                </span>
              </div>

              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-400 block mb-1">Account Display</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800 truncate block">
                  {waStatus.userName || "St. John de britto Church"}
                </span>
              </div>

              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-400 block mb-1">Session Uptime</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-700">
                  {waStatus.connected
                    ? waStatus.uptimeSeconds > 60
                      ? `${Math.floor(waStatus.uptimeSeconds / 60)} mins`
                      : `${waStatus.uptimeSeconds || 1} secs`
                    : 'Offline'}
                </span>
              </div>

              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-400 block mb-1">Daily Broadcast</span>
                <span className="text-xs sm:text-sm font-bold text-church-gold">04:00 AM IST (Active)</span>
              </div>
            </div>

            {/* CONNECTED STATE CONTROLS */}
            {waStatus.connected ? (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md">
                    <FiCheck />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-950">WhatsApp Bot is Active</h3>
                    <p className="text-xs text-emerald-800">
                      All daily 04:00 AM spiritual broadcasts, automatic birthday wishes, and on-demand reading commands are live.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleReconnect}
                    disabled={reconnecting}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
                  >
                    <FiRefreshCw className={reconnecting ? 'animate-spin' : ''} />
                    <span>{reconnecting ? 'Reconnecting...' : 'Reconnect'}</span>
                  </button>
                  <button
                    onClick={() => setShowResetModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
                  >
                    <span>Pair Again / Clear</span>
                  </button>
                </div>
              </div>
            ) : (
              /* DISCONNECTED STATE & PAIRING WORKFLOW */
              <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 border border-amber-200 rounded-2xl p-4 sm:p-6 text-amber-950">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-200/70 pb-4 mb-5">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-church-royal-blue flex items-center gap-2">
                      <SiWhatsapp className="text-green-600 text-lg sm:text-xl shrink-0" /> Link WhatsApp Device
                    </h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Pair the church phone via <strong>QR Code scan</strong> or <strong>8-digit Phone Pairing Code</strong>.
                    </p>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex items-center bg-white p-1 rounded-xl border border-amber-200 shadow-xs w-full sm:w-auto justify-center">
                    <button
                      type="button"
                      onClick={() => setConnectionMode('qr')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${connectionMode === 'qr'
                          ? 'bg-church-royal-blue text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      <FiGrid className="text-xs" /> QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectionMode('phone')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${connectionMode === 'phone'
                          ? 'bg-church-royal-blue text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      <FiPhone className="text-xs" /> Pairing Code
                    </button>
                  </div>
                </div>

                {/* METHOD 1: QR CODE */}
                {connectionMode === 'qr' && (
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {qrCode ? (
                      <div className="flex flex-col items-center bg-white p-4 rounded-2xl shadow-md border border-amber-200 min-w-[200px]">
                        <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 rounded-lg" />
                        <span className="text-[11px] font-semibold text-green-700 mt-2 animate-pulse flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" /> Live QR — Ready to scan
                        </span>
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-amber-100/60 rounded-2xl flex flex-col items-center justify-center text-amber-800 text-center p-4 border border-amber-200 text-xs">
                        <FiRefreshCw className="text-2xl mb-2 animate-spin text-amber-700" />
                        <span>Initializing QR code...</span>
                      </div>
                    )}

                    <div className="flex-1 space-y-3 w-full">
                      <h4 className="text-sm font-bold text-church-royal-blue">
                        Scan QR Code with the Church Phone:
                      </h4>
                      <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-700 font-medium">
                        <li>Open <strong>WhatsApp</strong> on your phone</li>
                        <li>Go to <strong>Settings / Menu (⋮)</strong> → <strong>Linked Devices</strong></li>
                        <li>Tap <strong>Link a Device</strong> and scan the code on your screen</li>
                      </ol>
                      <p className="text-[11px] text-gray-500">
                        Session credentials persist automatically in MongoDB Atlas.
                      </p>

                      <div className="pt-2 flex items-center gap-2">
                        <button
                          onClick={handleResetSession}
                          disabled={resetting}
                          className="px-3.5 py-2 rounded-xl bg-amber-200/90 hover:bg-amber-300 text-amber-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <FiRefreshCw className={resetting ? 'animate-spin' : ''} />
                          <span>{resetting ? 'Resetting...' : 'Regenerate Fresh QR'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* METHOD 2: PHONE PAIRING CODE */}
                {connectionMode === 'phone' && (
                  <div className="space-y-4 max-w-xl">
                    <form onSubmit={handleRequestPairingCode} className="space-y-3">
                      <label className="text-xs font-bold text-church-royal-blue block">
                        Enter Church WhatsApp Phone Number
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="church-select w-28 text-xs font-bold bg-white shrink-0"
                          >
                            <option value="+91">+91 (IN)</option>
                            <option value="+1">+1 (US)</option>
                            <option value="+44">+44 (UK)</option>
                            <option value="+971">+971 (UAE)</option>
                            <option value="+65">+65 (SG)</option>
                            <option value="+60">+60 (MY)</option>
                          </select>
                          <input
                            type="tel"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="Phone number (e.g. 9876543210)"
                            className="church-input flex-1 text-xs sm:text-sm bg-white min-w-0"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isGeneratingPairing || !phoneInput.trim() || pairingCountdown > 0}
                          className="btn-gold py-2.5 px-4 text-xs font-bold w-full sm:w-auto shrink-0 flex items-center justify-center gap-1 disabled:opacity-60 cursor-pointer"
                        >
                          {isGeneratingPairing
                            ? 'Generating...'
                            : pairingCountdown > 0
                              ? `Valid (${pairingCountdown}s)`
                              : 'Generate Code'}
                        </button>
                      </div>
                    </form>

                    {pairingCode && (
                      <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-church-gold shadow-md space-y-3 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            Pairing Code:
                            {pairingCountdown > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black animate-pulse">
                                ⏳ {pairingCountdown}s
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyPairingCode}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <FiCopy className="text-xs" /> {copiedPairing ? 'Copied!' : 'Copy'}
                          </button>
                        </div>

                        <div className="text-center py-3 bg-amber-50/80 rounded-xl border border-amber-200">
                          <span className="font-mono text-2xl sm:text-3xl font-black text-church-royal-blue tracking-widest break-all select-all">
                            {pairingCode}
                          </span>
                        </div>

                        <div className="text-xs text-gray-700 space-y-1">
                          <p className="font-bold text-church-royal-blue">On the church phone:</p>
                          <p className="text-[11px] text-gray-600">
                            WhatsApp → Linked Devices → Link a Device → <strong>Link with phone number instead</strong> → Enter code above.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subscription Preference Breakdown */}
          {stats?.prefCounts?.length > 0 && (
            <div className="glass-card p-4 sm:p-6 border border-gray-100 shadow-sm">
              <h3 className="font-bold text-church-royal-blue mb-4 flex items-center gap-2 text-sm sm:text-base">
                <FiInfo className="text-church-gold" /> Subscriber Service Preferences
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {stats.prefCounts.map((p) => (
                  <div
                    key={p._id}
                    className="bg-gray-50/90 rounded-xl p-3 border border-gray-100 flex flex-col justify-between"
                  >
                    <span className="text-base mb-1">{PREF_ICONS[p._id] || '✨'}</span>
                    <span className="text-xs font-medium text-gray-600 truncate">{PREF_LABELS[p._id] || p._id}</span>
                    <span className="font-black text-church-royal-blue text-sm sm:text-base mt-1">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's 04:00 AM IST Daily Catholic Notification Job Status */}
          <div className="glass-card p-4 sm:p-6 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-church-royal-blue text-sm sm:text-base flex items-center gap-2">
                  <FiClock className="text-church-gold" /> Daily Catholic Notifications (04:00 AM IST)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  100% backend automated delivery across WhatsApp & Email. Zero browser dependency.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  dailyJob?.status === 'Completed' || dailyJob?.job?.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : dailyJob?.job?.status === 'running'
                      ? 'bg-blue-50 text-blue-800 border-blue-300 animate-pulse'
                      : dailyJob?.job?.status === 'partial'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}>
                  Job: {dailyJob?.status || (dailyJob?.job?.status ? dailyJob.job.status.toUpperCase() : 'PENDING')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-50/90 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500 block mb-1">WhatsApp Delivered</span>
                <span className="text-base sm:text-lg font-black text-emerald-700">
                  {dailyJob?.channels?.whatsapp ?? stats?.sentToday ?? 0}
                </span>
                {Boolean(dailyJob?.channels?.whatsappFailed) && (
                  <span className="text-[10px] text-rose-600 block">({dailyJob.channels.whatsappFailed} failed)</span>
                )}
              </div>
              <div className="bg-gray-50/90 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500 block mb-1">Email Delivered</span>
                <span className="text-base sm:text-lg font-black text-blue-700">
                  {dailyJob?.channels?.email ?? 0}
                </span>
                {Boolean(dailyJob?.channels?.emailFailed) && (
                  <span className="text-[10px] text-rose-600 block">({dailyJob.channels.emailFailed} failed)</span>
                )}
              </div>
              <div className="bg-gray-50/90 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500 block mb-1">Daily Schedule</span>
                <span className="text-xs sm:text-sm font-bold text-church-royal-blue block">
                  04:00 AM IST
                </span>
                <span className="text-[10px] text-gray-400">Asia/Kolkata</span>
              </div>
              <div className="bg-gray-50/90 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500 block mb-1">Next Run</span>
                <span className="text-xs sm:text-sm font-bold text-church-gold block truncate">
                  {nextBroadcastInfo}
                </span>
                <span className="text-[10px] text-gray-400">Server cron active</span>
              </div>
            </div>

            <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100 text-xs text-blue-900 flex items-start gap-2.5">
              <FiShield className="text-blue-600 text-base shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Autonomous 24/7 Delivery Architecture</span>
                <span className="text-[11px] text-blue-800">
                  Daily Catholic notifications run independently on the backend server. Closing the browser, logging out, or keeping tabs closed will NOT affect delivery.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SUBSCRIBERS DIRECTORY ───────────────────────────────────── */}
      {activeTab === 'subscribers' && (
        <div className="glass-card p-4 sm:p-6 border border-gray-100 shadow-sm">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                value={subscriberSearch}
                onChange={(e) => setSubscriberSearch(e.target.value)}
                placeholder="Search by member name or phone..."
                className="church-input pl-9 pr-8 py-2 text-xs sm:text-sm w-full bg-white"
              />
              {subscriberSearch && (
                <button
                  onClick={() => setSubscriberSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  <FiX />
                </button>
              )}
            </div>

            {/* Filter Pills & Actions */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Opted-In' },
                { id: 'website', label: 'Website' },
                { id: 'bot', label: 'Bot Only' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSubscriberFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${subscriberFilter === f.id
                      ? 'bg-church-royal-blue text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {f.label}
                </button>
              ))}

              {/* <button
                type="button"
                onClick={() => setShowClearFreshModal(true)}
                className="ml-auto px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                title="Clear all bot preferences and reset subscribers to start fresh"
              >
                <FiTrash2 className="text-xs" />
                <span>Clear / Start Fresh</span>
              </button> */}
            </div>
          </div>

          {/* Subscribers Table / List */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                  <th className="py-3 px-4">Subscriber</th>
                  <th className="py-3 px-4">WhatsApp No</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSubscribers.map((sub, idx) => (
                  <motion.tr
                    key={sub._id || idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-xs sm:text-sm text-church-royal-blue">{sub.name}</div>
                      <div className="text-[10px] text-gray-400">
                        {sub.updatedAt ? new Date(sub.updatedAt).toLocaleDateString('en-IN') : 'Recent'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-700">
                      +{sub.phoneNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.source === 'Website User'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                          }`}
                      >
                        {sub.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {LANG_LABELS[sub.language] || sub.language}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <span className="capitalize font-medium">{sub.readingPreference || 'Full'}</span>
                      {sub.sendLinks !== false && (
                        <span className="ml-1 text-[10px] text-emerald-600 font-bold">+Links</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleOptIn(sub)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${sub.optedIn !== false
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        title="Click to toggle opt-in state"
                      >
                        {sub.optedIn !== false ? '● Active' : '○ Paused'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetSubscriber(sub);
                            setSendMode('direct');
                            setActiveTab('broadcast');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-church-royal-blue text-white text-xs font-bold hover:bg-blue-900 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Compose direct message to this subscriber"
                        >
                          <FiSend className="text-[10px]" />
                          <span>Message</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSubscriberToDelete(sub)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Remove this subscriber from notifications"
                        >
                          <FiTrash2 className="text-[10px]" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredSubscribers.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-xs sm:text-sm">
                No matching subscribers found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: BROADCAST & MESSAGE STUDIO ──────────────────────────────── */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Composer */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card p-4 sm:p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <h2 className="font-bold text-church-royal-blue text-base sm:text-lg flex items-center gap-2">
                  <FiSend className="text-church-gold" /> Message Studio
                </h2>

                {/* Broadcast vs Single Target Mode */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => {
                      setSendMode('broadcast');
                      setTargetSubscriber(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${sendMode === 'broadcast'
                        ? 'bg-church-royal-blue text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    All Subscribers ({stats?.active ?? subscribers.length})
                  </button>
                  <button
                    onClick={() => setSendMode('direct')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${sendMode === 'direct'
                        ? 'bg-church-royal-blue text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Direct 1-on-1
                  </button>
                </div>
              </div>

              {/* Direct Subscriber Picker (When in direct mode) */}
              {sendMode === 'direct' && (
                <div className="mb-4 bg-blue-50/60 p-3.5 rounded-xl border border-blue-200/80">
                  <label className="text-xs font-bold text-church-royal-blue block mb-1.5">
                    Select Target Subscriber:
                  </label>
                  {targetSubscriber ? (
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-blue-300">
                      <div>
                        <span className="font-bold text-xs text-church-royal-blue">{targetSubscriber.name}</span>
                        <span className="text-xs text-gray-500 font-mono ml-2">+{targetSubscriber.phoneNumber}</span>
                      </div>
                      <button
                        onClick={() => setTargetSubscriber(null)}
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <select
                      onChange={(e) => {
                        const found = subscribers.find((s) => s.phoneNumber === e.target.value);
                        if (found) setTargetSubscriber(found);
                      }}
                      className="church-select w-full text-xs font-semibold bg-white"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        -- Select subscriber to message --
                      </option>
                      {subscribers.map((s) => (
                        <option key={s.phoneNumber} value={s.phoneNumber}>
                          {s.name} (+{s.phoneNumber})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Quick Template Shortcuts */}
              <div className="mb-3">
                <span className="text-[11px] font-bold text-gray-400 block mb-1.5">Quick Templates:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: '🔔 Sunday Mass',
                      text: '🔔 *Sunday Holy Mass Reminder*\n\nMorning Masses:\n• 6:00 AM — Tamil Mass\n• 7:30 AM — English Mass\n• 9:00 AM — Youth Mass\n\nMay God bless your week!',
                    },
                    {
                      label: '🕊️ Special Prayer',
                      text: '🙏 *Special Parish Prayer Request*\n\nDear brothers and sisters in Christ, let us unite our hearts in prayer for our parish community and all who seek God’s grace.',
                    },
                    {
                      label: '📢 Event Notice',
                      text: '📢 *Important Parish Announcement*\n\nPlease join us for our upcoming church celebration. All are welcome to participate!',
                    },
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      onClick={() => setCustomMsg(tpl.text)}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Composer Textarea */}
              <form onSubmit={handleSendCustomMessage} className="space-y-3">
                <div className="relative">
                  <textarea
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    rows={6}
                    placeholder="Compose your custom announcement, pastoral notice, or spiritual message..."
                    className="church-input w-full text-xs sm:text-sm p-3 resize-none bg-white leading-relaxed"
                  />
                  <span className="absolute right-3 bottom-3 text-[10px] text-gray-400 font-mono">
                    {customMsg.length} chars
                  </span>
                </div>

                {sendResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${sendResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                  >
                    {sendResult.success ? <FiCheckCircle /> : <FiAlertTriangle />}
                    <span>{sendResult.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending || !customMsg.trim() || (sendMode === 'direct' && !targetSubscriber)}
                  className="btn-gold w-full justify-center py-3 text-xs sm:text-sm font-bold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <FiSend className={sending ? 'animate-bounce' : ''} />
                  <span>
                    {sending
                      ? 'Sending Message...'
                      : sendMode === 'direct'
                        ? `Send to ${targetSubscriber?.name || 'Selected'}`
                        : `Broadcast to All (${stats?.active ?? subscribers.length}) Subscribers`}
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Live Message Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-4 sm:p-5 border border-gray-100 shadow-sm">
              <span className="text-xs font-bold text-church-royal-blue uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <FiEye className="text-church-gold" /> WhatsApp Delivery Preview
              </span>

              {/* WhatsApp Message Bubble Simulation */}
              <div className="bg-[#E5DDD5] dark:bg-slate-900 rounded-2xl p-4 shadow-inner border border-gray-200 space-y-3">
                {/* 1. Devotional / Custom Text Message */}
                <div className="bg-[#DCF8C6] dark:bg-[#005c4b] text-gray-900 dark:text-white rounded-2xl rounded-tr-none p-3.5 shadow-sm text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                  <div className="font-bold text-church-royal-blue dark:text-church-gold mb-1">
                    *SJDB Connect*
                  </div>
                  <div>{customMsg || todayPreview?.previewTa || '<Your announcement message will appear here>'}</div>
                  <div className="mt-2 text-[11px] italic text-gray-600 dark:text-gray-300">
                    _St. John de britto Church, Kalayarkoil_
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-green-200/60 text-right mt-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </div>
                </div>

                {/* 2. Saint of the Day Picture Message Simulation */}
                {todayPreview?.saintImage && !customMsg && (
                  <div className="bg-[#DCF8C6] dark:bg-[#005c4b] text-gray-900 dark:text-white rounded-2xl rounded-tr-none p-2 shadow-sm text-xs overflow-hidden">
                    <div className="relative rounded-xl overflow-hidden mb-2 bg-gray-100 max-h-48 flex items-center justify-center">
                      <img
                        src={todayPreview.saintImage}
                        alt={todayPreview.saintName}
                        className="w-full h-48 object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold backdrop-blur-xs">
                        👑 Saint of the Day Image
                      </span>
                    </div>
                    <div className="px-1.5 pb-1">
                      <p className="font-bold text-church-royal-blue dark:text-church-gold text-xs">
                        🕊️ *{todayPreview.saintName}* {todayPreview.saintNameTa ? `(${todayPreview.saintNameTa})` : ''}
                      </p>
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
                        📅 Feast: {todayPreview.saintFeastDay || 'Today'}
                      </p>
                      {todayPreview.saintDescription && (
                        <p className="text-[11px] text-gray-700 dark:text-gray-200 mt-1 line-clamp-3 italic">
                          "{todayPreview.saintDescription}"
                        </p>
                      )}
                      <div className="text-[10px] text-gray-400 dark:text-green-200/60 text-right mt-1">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-400 mt-3 text-center">
                Saint portrait is sent as an actual WhatsApp photo message along with the daily readings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: BOT TESTING PLAYGROUND ──────────────────────────────────── */}
      {activeTab === 'test-bot' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl mx-auto">
          <div className="lg:col-span-12 glass-card p-4 sm:p-6 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-church-royal-blue text-base sm:text-lg flex items-center gap-2">
                  <FiPlay className="text-church-gold" /> Interactive Bot Playground
                </h2>
                <p className="text-xs text-gray-500">
                  Live state simulator — Test interactive replies, language choices, and scripture commands.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => window.open('https://wa.me/919655639144?text=Hi', '_blank', 'noopener,noreferrer')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors flex-1 sm:flex-initial cursor-pointer"
                  title="Open WhatsApp chat with Bot number (+91 96556 39144)"
                >
                  <SiWhatsapp className="text-xs" /> Real Test
                </button>
                <button
                  onClick={() => {
                    setChatHistory([
                      {
                        id: Date.now(),
                        sender: 'bot',
                        text: '✨ *Welcome to SJDB Connect*\n_State reset._ Reply *HI* to begin again.',
                        timestamp: Date.now(),
                      },
                    ]);
                    setSessionState({ step: 'welcome' });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Reset Flow
                </button>
              </div>
            </div>

            {/* Quick Trigger Chips */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
              {[
                { label: 'Send "HI"', text: 'HI', color: 'bg-green-50 text-green-700 border-green-200' },
                { label: '1,2,3 (Prefs)', text: '1,2,3', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { label: '1 (English)', text: '1', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                { label: '2 (Tamil)', text: '2', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                { label: '📖 READINGS', text: 'READINGS', color: 'bg-amber-50 text-amber-800 border-amber-300' },
                { label: '📜 SHOW ALL', text: 'SHOW ALL', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                { label: '🛑 STOP', text: 'STOP', color: 'bg-rose-50 text-rose-700 border-rose-200' },
              ].map((btn) => (
                <button
                  key={btn.text}
                  onClick={() => handleSendSimulatorMessage(btn.text)}
                  disabled={isTestingBot}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50 ${btn.color}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Chat History Viewport */}
            <div
              ref={chatContainerRef}
              className="bg-slate-900 rounded-2xl p-4 h-[350px] sm:h-[380px] overflow-y-auto space-y-3 shadow-inner border border-slate-800 mb-4"
            >
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow ${msg.sender === 'user'
                        ? 'bg-[#005c4b] text-white rounded-tr-none'
                        : 'bg-[#202c33] text-gray-100 rounded-tl-none border border-slate-700'
                      }`}
                  >
                    {msg.text}
                    <div
                      className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-green-200/60' : 'text-gray-400'
                        }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {isTestingBot && (
                <div className="flex justify-start">
                  <div className="bg-[#202c33] text-gray-300 rounded-2xl rounded-tl-none px-4 py-2 text-xs flex items-center gap-1.5 border border-slate-700 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-church-gold rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-church-gold rounded-full animate-bounce delay-100" />
                    <span className="w-1.5 h-1.5 bg-church-gold rounded-full animate-bounce delay-200" />
                    <span>Bot is typing...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendSimulatorMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type a test command (e.g. 'HI', 'READINGS', '1')..."
                disabled={isTestingBot}
                className="church-input flex-1 py-2.5 text-xs sm:text-sm min-w-0 bg-white"
              />
              <button
                type="submit"
                disabled={isTestingBot || !testInput.trim()}
                className="btn-gold py-2.5 px-4 text-xs sm:text-sm font-bold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <FiSend className="text-xs" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── TAB 5: AUTOMATION & BROADCAST LOGS ─────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Cron Schedules Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-4 sm:p-5 border border-gray-100 shadow-sm flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center text-xl shrink-0">
                <FiClock />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-church-royal-blue">Daily Spiritual Broadcast</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Active Cron
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Dispatches today's Mass readings, Bible verse, and Saint of the Day to all active subscribers.
                </p>
                <div className="mt-2 text-xs font-mono font-bold text-church-gold">
                  ⏰ 04:00 AM IST ({nextBroadcastInfo})
                </div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-5 border border-gray-100 shadow-sm flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 border border-purple-200 flex items-center justify-center text-xl shrink-0">
                <FiCalendar />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-church-royal-blue">Birthday Blessings</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Active Cron
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Sends personalized prayer blessings and scripture on church members' birthdays.
                </p>
                <div className="mt-2 text-xs font-mono font-bold text-purple-700">
                  🎂 12:00 AM IST (Midnight)
                </div>
              </div>
            </div>
          </div>

          {/* Broadcast History Table */}
          <div className="glass-card p-4 sm:p-6 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-church-royal-blue text-sm sm:text-base mb-4 flex items-center gap-2">
              <FiClock className="text-church-gold" /> Recent Daily Broadcast Logs
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Saint / Scripture</th>
                    <th className="py-3 px-4">Recipients</th>
                    <th className="py-3 px-4">Sent</th>
                    <th className="py-3 px-4">Failed</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {broadcastHistory.map((h, i) => (
                    <tr key={h._id || i} className="hover:bg-gray-50/60">
                      <td className="py-3 px-4 font-bold text-church-royal-blue">
                        {h.dateKey}
                      </td>
                      <td className="py-3 px-4 text-gray-600 truncate max-w-xs">
                        {h.saintName || h.bibleRef || 'Catholic Liturgy'}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-700">
                        {h.totalRecipients}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600">
                        {h.whatsappSent ?? h.totalRecipients}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600">
                        {h.whatsappFailed ?? 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Delivered
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {broadcastHistory.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-xs sm:text-sm">
                  No previous broadcast records found. Scheduled broadcasts will appear here automatically.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: BROADCAST CONFIRMATION & PREVIEW ─────────────────────────── */}
      <AnimatePresence>
        {broadcastModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <h3 className="font-bold text-church-royal-blue text-base sm:text-lg flex items-center gap-2">
                  <FiZap className="text-church-gold" /> Trigger Daily Spiritual Broadcast
                </h3>
                <button
                  onClick={() => setBroadcastModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer"
                >
                  <FiX />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-950">
                  <p className="font-bold text-sm mb-1">📢 Ready to Broadcast:</p>
                  <p>
                    This will dispatch today's <strong>Saint of the Day</strong>, <strong>Daily Bible Verse</strong>, and <strong>Mass Readings</strong> to all <strong>{stats?.active ?? subscribers.length} active subscribers</strong>.
                  </p>
                </div>

                {todayPreview && (
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-xs space-y-3">
                    {/* Saint of the Day Card with Image */}
                    <div className="flex items-center gap-3.5 bg-white p-3 rounded-xl border border-gray-200/80 shadow-xs">
                      {todayPreview.saintImage ? (
                        <img
                          src={todayPreview.saintImage}
                          alt={todayPreview.saintName}
                          className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xl shrink-0">
                          👑
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">
                          👑 Saint of the Day (WhatsApp Photo)
                        </span>
                        <div className="font-black text-sm text-church-royal-blue truncate">
                          {todayPreview.saintName}
                        </div>
                        {todayPreview.saintNameTa && (
                          <div className="text-xs text-gray-500 font-medium truncate">
                            {todayPreview.saintNameTa}
                          </div>
                        )}
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          📅 Feast: {todayPreview.saintFeastDay || 'Today'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                        <span className="text-[10px] text-gray-400 font-semibold block">Bible Verse</span>
                        <span className="font-bold text-church-royal-blue truncate block">
                          {todayPreview.bibleRef}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                        <span className="text-[10px] text-gray-400 font-semibold block">Broadcast Schedule</span>
                        <span className="font-bold text-emerald-700 truncate block">
                          ⏰ 04:00 AM IST Daily
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {broadcastResult && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold ${broadcastResult.status === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border border-rose-300'
                      }`}
                  >
                    {broadcastResult.message}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBroadcastModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBroadcast}
                  disabled={broadcasting}
                  className="flex-1 btn-gold py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <FiZap className={broadcasting ? 'animate-bounce' : ''} />
                  <span>{broadcasting ? 'Broadcasting...' : 'Confirm & Send Now'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: RESET SESSION CONFIRMATION ────────────────────────────────── */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <h3 className="font-bold text-rose-600 text-base sm:text-lg mb-2 flex items-center gap-2">
                <FiAlertTriangle /> Reset WhatsApp Session?
              </h3>
              <p className="text-xs text-gray-600 mb-5 leading-relaxed">
                This will disconnect the active WhatsApp device, clear saved session credentials from MongoDB Atlas, and generate a fresh QR code / Pairing code.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetSession}
                  disabled={resetting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  {resetting ? 'Resetting...' : 'Yes, Reset Session'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: CLEAR / START FRESH CONFIRMATION ──────────────────────────── */}
      <AnimatePresence>
        {showClearFreshModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mb-4 shadow-inner">
                <FiAlertTriangle />
              </div>

              <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-2">
                ⚠️ Start Bot Fresh?
              </h3>

              <p className="text-xs sm:text-sm text-gray-600 mb-6 leading-relaxed">
                This will clear the current WhatsApp bot preferences and subscription selections for <strong>all users</strong>.
                <br /><br />
                All users will need to go through the bot setup again.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowClearFreshModal(false)}
                  disabled={clearingFresh}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearStartFresh}
                  disabled={clearingFresh}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {clearingFresh ? (
                    <>
                      <FiRefreshCw className="animate-spin text-xs" />
                      <span>Starting Fresh...</span>
                    </>
                  ) : (
                    <span>Yes, Start Fresh</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: DELETE INDIVIDUAL SUBSCRIBER CONFIRMATION ──────────────────── */}
      <AnimatePresence>
        {subscriberToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mb-4 shadow-inner">
                <FiAlertTriangle />
              </div>

              <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-2">
                ⚠️ Delete Subscriber?
              </h3>

              <p className="text-xs sm:text-sm text-gray-600 mb-2 leading-relaxed">
                Are you sure you want to remove <strong>{subscriberToDelete.name}</strong> (+{subscriberToDelete.phoneNumber}) from SJDB Connect notifications?
              </p>
              <p className="text-[11px] text-gray-500 mb-6">
                This will remove their bot subscription and selected notification preferences. Their main website account remains completely safe.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSubscriberToDelete(null)}
                  disabled={isDeletingSubscriber}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubscriber}
                  disabled={isDeletingSubscriber}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isDeletingSubscriber ? (
                    <>
                      <FiRefreshCw className="animate-spin text-xs" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: TEST DIRECT ON REAL PHONE ────────────────────────────────── */}
      <AnimatePresence>
        {directTestOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <h3 className="font-bold text-church-royal-blue text-base flex items-center gap-2">
                  <SiWhatsapp className="text-green-600" /> Send Live Test to WhatsApp
                </h3>
                <button
                  onClick={() => setDirectTestOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer"
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSendDirectTestMessage} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-church-royal-blue block mb-1.5">
                    Enter Test WhatsApp Phone Number (with Country Code)
                  </label>
                  <input
                    type="tel"
                    value={directTestPhone}
                    onChange={(e) => setDirectTestPhone(e.target.value)}
                    placeholder="e.g. 919876543210"
                    className="church-input w-full text-xs sm:text-sm bg-white"
                    required
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Format: Country code + 10-digit number (e.g. 919876543210 for India)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDirectTestOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingDirectTest || !directTestPhone.trim()}
                    className="flex-1 btn-gold py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <FiSend />
                    <span>{isSendingDirectTest ? 'Sending...' : 'Send Test'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
