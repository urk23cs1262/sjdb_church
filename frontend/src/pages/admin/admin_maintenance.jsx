import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiTool, FiAlertOctagon, FiClock, FiSend, FiList, 
  FiShield, FiRefreshCw, FiEye, FiCheck, FiX, FiSquare,
  FiPhone, FiMail, FiSettings, FiLock, FiInfo
} from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Maintenance from '../public/public_maintenance';

export default function MaintenanceAdmin() {
  const [activeTab, setActiveTab] = useState('control'); // 'control', 'scheduler', 'logs'
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState({ accessAttemptsCount: 0, totalMaintenanceSessions: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Emergency Modal state
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('Emergency System Crash / Security Patch');

  const [activeEvent, setActiveEvent] = useState(null);

  const fetchSettings = async () => {
    try {
      const [settRes, histRes] = await Promise.all([
        api.get('/maintenance/settings'),
        api.get('/maintenance/history')
      ]);

      if (settRes.data.success) {
        setSettings(settRes.data.settings);
        setActiveEvent(settRes.data.activeEvent || null);
      }

      if (histRes.data.success) {
        setHistory(histRes.data.history || []);
        setAnalytics(histRes.data.analytics || { accessAttemptsCount: 0, totalMaintenanceSessions: 0 });
      }
    } catch (err) {
      console.error('Failed to load maintenance settings:', err);
      toast.error('Failed to load maintenance settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await api.put('/maintenance/settings', settings);
      if (res.data.success) {
        setSettings(res.data.settings);
        toast.success('Maintenance settings saved successfully');
      }
    } catch (err) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleShowcaseBanner = async () => {
    setSaving(true);
    try {
      const payload = {
        message: settings?.noticeBanner?.message || 'Scheduled website maintenance today.',
        scheduledStartTime: settings?.noticeBanner?.scheduledStartTime,
        scheduledEndTime: settings?.noticeBanner?.scheduledEndTime,
        noticeLeadTime: settings?.noticeBanner?.noticeLeadTime || '1h'
      };
      const res = await api.post('/maintenance/showcase-banner', payload);
      if (res.data.success) {
        setSettings(res.data.settings);
        toast.success('Pre-Maintenance Notice Banner is now Showcase Live! (Upcoming notices dispatched)');
        fetchSettings();
      }
    } catch (err) {
      toast.error('Failed to showcase notice banner: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleStopBanner = async () => {
    setSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        noticeBanner: {
          ...(settings?.noticeBanner || {}),
          isEnabled: false
        },
        scheduler: {
          ...(settings?.scheduler || {}),
          isEnabled: false
        }
      };
      const res = await api.put('/maintenance/settings', updatedSettings);
      if (res.data.success) {
        setSettings(res.data.settings);
        toast.success('Pre-Maintenance Notice Banner has been stopped.');
        fetchSettings();
      }
    } catch (err) {
      toast.error('Failed to stop notice banner: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMode = async (enable, reason = '') => {
    try {
      const res = await api.post('/maintenance/toggle', {
        isEnabled: enable,
        reason: reason || settings?.message || 'Scheduled System Maintenance',
        category: settings?.category || 'Scheduled Update'
      });
      if (res.data.success) {
        setSettings(res.data.settings);
        toast.success(res.data.message);
        fetchSettings();
      }
    } catch (err) {
      toast.error('Failed to toggle maintenance mode: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEmergencyShutdown = async () => {
    try {
      const res = await api.post('/maintenance/emergency', {
        reason: emergencyReason,
        category: 'Emergency Fix'
      });
      if (res.data.success) {
        setSettings(res.data.settings);
        setEmergencyModalOpen(false);
        toast.error(res.data.message || ' EMERGENCY SHUTDOWN ACTIVATED! Website is locked.');
        fetchSettings();
      }
    } catch (err) {
      toast.error('Emergency shutdown failed: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FiRefreshCw className="animate-spin text-3xl text-church-royal-blue" />
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-16">
      
      {/* Normal Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue flex items-center gap-2">
            <FiTool className="text-church-gold" /> Website Maintenance & Emergency Mode
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Website access control, scheduled upgrades & emergency lockout management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <FiEye className="text-sm" /> Preview Page
          </button>

          {settings?.isEnabled ? (
            <button
              onClick={() => handleToggleMode(false)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FiCheck className="text-sm" /> End Maintenance (Go Live)
            </button>
          ) : (
            <button
              onClick={() => handleToggleMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FiTool className="text-sm" /> Enable Maintenance Mode
            </button>
          )}

          <button
            onClick={() => setEmergencyModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <FiAlertOctagon className="text-sm" /> Emergency Shutdown
          </button>
        </div>
      </div>

      {/* Real-time Status Alert Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs ${
        settings?.isEmergency 
          ? 'bg-red-50 border-red-200 text-red-950'
          : settings?.isEnabled 
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : 'bg-emerald-50 border-emerald-200 text-emerald-950'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full animate-ping flex-shrink-0 ${
            settings?.isEmergency ? 'bg-red-600' : settings?.isEnabled ? 'bg-amber-500' : 'bg-emerald-500'
          }`} />
          <div>
            <span className="font-bold text-sm">
              Status: {settings?.isEmergency ? ' EMERGENCY SHUTDOWN ACTIVE' : settings?.isEnabled ? ' MAINTENANCE MODE ACTIVE' : ' WEBSITE ONLINE (LIVE)'}
            </span>
            <p className="text-xs opacity-80 mt-0.5">
              {settings?.isEnabled 
                ? `Only Super Admin & Technical Team can bypass. ${analytics.accessAttemptsCount} blocked attempt(s).` 
                : 'All parishioners and public visitors have full access.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="px-3 py-1.5 rounded-xl bg-white/80 border border-gray-200 shadow-2xs">
            Blocked Attempts: <strong className="text-gray-900">{analytics.accessAttemptsCount}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-white/80 border border-gray-200 shadow-2xs">
            Total Sessions: <strong className="text-gray-900">{analytics.totalMaintenanceSessions}</strong>
          </span>
        </div>
      </div>

      {/* Multi-Channel Notification Status Widget */}
      {activeEvent && (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <FiSend className="text-church-royal-blue" /> Latest State Transition Notification Status ({activeEvent.previousStatus?.toUpperCase()} → {activeEvent.newStatus?.toUpperCase()})
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeEvent.notificationSent ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {activeEvent.notificationSent ? ' Dispatch Complete' : ' Pending Dispatch'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-medium">
            <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
              <span className="text-blue-950 font-semibold flex items-center gap-1.5">
                 Mail
              </span>
              <span className="font-bold text-blue-900 bg-white px-2 py-0.5 rounded-md border border-blue-200 text-[11px]">
                {activeEvent.deliveries?.email?.count || activeEvent.emailSentCount || 0} sent
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
              <span className="text-purple-950 font-semibold flex items-center gap-1.5">
                 Web Push
              </span>
              <span className="font-bold text-purple-900 bg-white px-2 py-0.5 rounded-md border border-purple-200 text-[11px]">
                {activeEvent.deliveries?.push?.count || 0} sent
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
              <span className="text-amber-950 font-semibold flex items-center gap-1.5">
                 In-App
              </span>
              <span className="font-bold text-amber-900 bg-white px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                {activeEvent.deliveries?.inApp?.count || activeEvent.notifSentCount || 0} sent
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
              <span className="text-emerald-950 font-semibold flex items-center gap-1.5">
                 WhatsApp
              </span>
              <span className="font-bold text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                {activeEvent.deliveries?.whatsApp?.count || 0} sent
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('control')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'control' 
              ? 'border-church-royal-blue text-church-royal-blue' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiSettings className="text-base" /> Settings & Content
        </button>

        <button
          onClick={() => setActiveTab('scheduler')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'scheduler' 
              ? 'border-church-royal-blue text-church-royal-blue' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiClock className="text-base" /> Maintenance Scheduler
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'logs' 
              ? 'border-church-royal-blue text-church-royal-blue' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiList className="text-base" /> Audit Logs & History
        </button>
      </div>

      {/* Tab 1: Settings & Page Content */}
      {activeTab === 'control' && settings && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Automatic Notification Notice */}
            <div className="bg-blue-50/80 border border-blue-200 p-4 rounded-2xl flex items-center gap-3 text-xs text-blue-900 font-medium">
              <FiInfo className="text-blue-600 text-lg flex-shrink-0" />
              <span>
                <strong>Automated User Dispatch:</strong> Clicking <strong>Enable Maintenance Mode</strong> or <strong>Emergency Shutdown</strong> automatically sends Email and In-App/SMS notices to all registered parish members.
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                <FiTool className="text-church-royal-blue" /> Maintenance Page Display Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="church-label">Maintenance Title *</label>
                  <input
                    type="text"
                    value={settings.title || ''}
                    onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                    className="church-input"
                    placeholder="e.g. Website Under Maintenance"
                  />
                </div>

                <div>
                  <label className="church-label">Maintenance Category *</label>
                  <select
                    value={settings.category || 'Scheduled Update'}
                    onChange={(e) => setSettings({ ...settings, category: e.target.value })}
                    className="church-select"
                  >
                    <option value="Scheduled Update">Scheduled Update</option>
                    <option value="Security Patch">Security Patch</option>
                    <option value="Database Upgrade">Database Upgrade</option>
                    <option value="Server Migration">Server Migration</option>
                    <option value="Emergency Fix">Emergency Fix</option>
                    <option value="General Maintenance">General Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="church-label">Maintenance Message *</label>
                  <textarea
                    rows={3}
                    value={settings.message || ''}
                    onChange={(e) => setSettings({ ...settings, message: e.target.value })}
                    className="church-input py-2.5 resize-y"
                    placeholder="We are upgrading our website to serve you better. Please visit again shortly."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="church-label">Expected Completion Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={settings.expectedCompletion ? new Date(new Date(settings.expectedCompletion).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setSettings({ ...settings, expectedCompletion: new Date(e.target.value) })}
                      className="church-input"
                    />
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showCountdown !== false}
                        onChange={(e) => setSettings({ ...settings, showCountdown: e.target.checked })}
                        className="w-4 h-4 text-church-royal-blue rounded border-gray-300 focus:ring-church-royal-blue"
                      />
                      <span>Show Real-time Countdown Timer</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Media & Assistance Details */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                <FiPhone className="text-church-royal-blue" /> Assistance Contact & Media Header
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="church-label">Contact Phone</label>
                  <input
                    type="text"
                    value={settings.contactPhone || ''}
                    onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                    className="church-input"
                    placeholder="+91 94431 00000"
                  />
                </div>

                <div>
                  <label className="church-label">Contact Email</label>
                  <input
                    type="email"
                    value={settings.contactEmail || ''}
                    onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                    className="church-input"
                    placeholder="support@stjohndebrittochurch.org"
                  />
                </div>
              </div>

              <div>
                <label className="church-label">Header Media URL (Image or Video)</label>
                <input
                  type="text"
                  value={settings.mediaUrl || ''}
                  onChange={(e) => setSettings({ ...settings, mediaUrl: e.target.value, mediaType: e.target.value ? 'image' : 'none' })}
                  className="church-input"
                  placeholder="https://example.com/maintenance-image.jpg"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-6 py-2.5 bg-church-gold hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl cursor-pointer disabled:opacity-50 transition-colors shadow-md"
                >
                  {saving ? 'Saving Changes...' : 'Save Display Settings'}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Role Permissions & Pre-Notice Banner */}
          <div className="space-y-6">
            
            {/* Access Permission Control */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
                <FiShield className="text-church-royal-blue" /> Role Bypass Permissions
              </h2>

              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FiShield className="text-emerald-600" />
                    <div>
                      <span className="font-bold text-gray-900 block">Super Admin & Priests</span>
                      <span className="text-gray-500 text-[10px]">Full administrative bypass</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowAdminLogin !== false}
                    onChange={(e) => setSettings({ ...settings, allowAdminLogin: e.target.checked })}
                    className="w-4 h-4 text-church-royal-blue rounded border-gray-300"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FiTool className="text-blue-600" />
                    <div>
                      <span className="font-bold text-gray-900 block">Technical Team</span>
                      <span className="text-gray-500 text-[10px]">Development & testing bypass</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowTechTeam !== false}
                    onChange={(e) => setSettings({ ...settings, allowTechTeam: e.target.checked })}
                    className="w-4 h-4 text-church-royal-blue rounded border-gray-300"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FiLock className="text-amber-600" />
                    <div>
                      <span className="font-bold text-gray-900 block">Content Editors</span>
                      <span className="text-gray-500 text-[10px]">Parish council / office staff</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.allowContentEditors)}
                    onChange={(e) => setSettings({ ...settings, allowContentEditors: e.target.checked })}
                    className="w-4 h-4 text-church-royal-blue rounded border-gray-300"
                  />
                </label>
              </div>
            </div>

            {/* Pre-Maintenance Alert Banner */}
            <div className="bg-amber-50/80 border border-amber-200 p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                <h3 className="font-bold text-amber-950 text-sm flex items-center gap-2">
                  <FiAlertOctagon className="text-amber-600" /> Pre-Maintenance Notice Banner
                </h3>
                {/* <label className="flex items-center gap-2 text-xs font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.noticeBanner?.isEnabled)}
                    onChange={(e) => setSettings({
                      ...settings,
                      noticeBanner: { ...(settings.noticeBanner || {}), isEnabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300"
                  />
                  <span>Show Banner Live</span>
                </label> */}
              </div>

              <p className="text-xs text-amber-900/80">
                Displays a dismissible scheduled maintenance notification banner at the top of all public pages and admin panel before maintenance begins.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="church-label text-amber-950">Banner Message *</label>
                  <input
                    type="text"
                    value={settings.noticeBanner?.message || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      noticeBanner: { ...(settings.noticeBanner || {}), message: e.target.value }
                    })}
                    className="church-input bg-white border-amber-300 w-full"
                    placeholder="Scheduled website maintenance today."
                  />
                </div>

                <div>
                  <label className="church-label text-amber-950">From Date & Time (Maintenance Start) *</label>
                  <input
                    type="datetime-local"
                    value={settings.noticeBanner?.scheduledStartTime ? new Date(new Date(settings.noticeBanner.scheduledStartTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      noticeBanner: { ...(settings.noticeBanner || {}), scheduledStartTime: new Date(e.target.value) }
                    })}
                    className="church-input bg-white border-amber-300 w-full"
                  />
                </div>

                <div>
                  <label className="church-label text-amber-950">To Date & Time (Expected Completion) *</label>
                  <input
                    type="datetime-local"
                    value={settings.noticeBanner?.scheduledEndTime ? new Date(new Date(settings.noticeBanner.scheduledEndTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : (settings.expectedCompletion ? new Date(new Date(settings.expectedCompletion).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')}
                    onChange={(e) => setSettings({
                      ...settings,
                      expectedCompletion: new Date(e.target.value),
                      noticeBanner: { ...(settings.noticeBanner || {}), scheduledEndTime: new Date(e.target.value) }
                    })}
                    className="church-input bg-white border-amber-300 w-full"
                  />
                </div>

                <div>
                  <label className="church-label text-amber-950">Notify Users Before Maintenance *</label>
                  <select
                    value={settings.noticeBanner?.noticeLeadTime || '1h'}
                    onChange={(e) => setSettings({
                      ...settings,
                      noticeBanner: { ...(settings.noticeBanner || {}), noticeLeadTime: e.target.value }
                    })}
                    className="church-select bg-white border-amber-300 w-full"
                  >
                    <option value="15m">15 minutes before</option>
                    <option value="30m">30 minutes before</option>
                    <option value="1h">1 hour before</option>
                    <option value="2h">2 hours before</option>
                    <option value="6h">6 hours before</option>
                    <option value="12h">12 hours before</option>
                    <option value="24h">24 hours before</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-amber-200/60 space-y-3">
                <p className="text-[11px] font-semibold flex items-center gap-1.5">
                  {settings?.noticeBanner?.isEnabled ? (
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                       Notice Banner is currently SHOWCASED LIVE
                    </span>
                  ) : (
                    <span className="text-amber-900/70">
                      Clicking Showcase immediately saves and displays the notice banner live across the portal.
                    </span>
                  )}
                </p>

                {settings?.noticeBanner?.isEnabled ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleShowcaseBanner}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <FiSend className="text-sm" />
                      <span>{saving ? 'Updating...' : 'Update Showcase'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStopBanner}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <FiSquare className="text-sm" />
                      <span>{saving ? 'Stopping...' : 'Stop Banner'}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleShowcaseBanner}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <FiSend className="text-sm" />
                    <span>{saving ? 'Showcasing Notice Banner...' : 'Showcase Notice Banner'}</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 2: Scheduler */}
      {activeTab === 'scheduler' && settings && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 max-w-3xl">
          <div className="border-b pb-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FiClock className="text-church-royal-blue text-lg" /> Automated Maintenance Scheduler
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Schedule maintenance mode to start and end automatically at a specified date and time.
            </p>
          </div>

          <label className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.scheduler?.isEnabled)}
              onChange={(e) => setSettings({
                ...settings,
                scheduler: { ...(settings.scheduler || {}), isEnabled: e.target.checked }
              })}
              className="w-5 h-5 text-church-royal-blue rounded border-gray-300"
            />
            <div>
              <span className="font-bold text-sm text-gray-900 block">Enable Automated Maintenance Scheduler</span>
              <span className="text-xs text-gray-500">The system will auto-enable and disable maintenance mode at the set times.</span>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="church-label">Scheduled Start Date & Time</label>
              <input
                type="datetime-local"
                value={settings.scheduler?.scheduledStart ? new Date(new Date(settings.scheduler.scheduledStart).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                onChange={(e) => setSettings({
                  ...settings,
                  scheduler: { ...(settings.scheduler || {}), scheduledStart: new Date(e.target.value) }
                })}
                className="church-input"
              />
            </div>

            <div>
              <label className="church-label">Scheduled End Date & Time</label>
              <input
                type="datetime-local"
                value={settings.scheduler?.scheduledEnd ? new Date(new Date(settings.scheduler.scheduledEnd).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                onChange={(e) => setSettings({
                  ...settings,
                  scheduler: { ...(settings.scheduler || {}), scheduledEnd: new Date(e.target.value) }
                })}
                className="church-input"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="church-label">Notify Users Before Maintenance *</label>
              <select
                value={settings.scheduler?.noticeLeadTime || '1h'}
                onChange={(e) => setSettings({
                  ...settings,
                  scheduler: { ...(settings.scheduler || {}), noticeLeadTime: e.target.value }
                })}
                className="church-select"
              >
                <option value="15m">15 minutes before</option>
                <option value="30m">30 minutes before</option>
                <option value="1h">1 hour before</option>
                <option value="2h">2 hours before</option>
                <option value="6h">6 hours before</option>
                <option value="12h">12 hours before</option>
                <option value="24h">24 hours before</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-2.5 bg-church-gold hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl cursor-pointer disabled:opacity-50 shadow-md"
            >
              {saving ? 'Saving...' : 'Save Schedule Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Audit Logs & History */}
      {activeTab === 'logs' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FiList className="text-church-royal-blue text-lg" /> Maintenance Audit Trail & History Logs
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Complete historical record of maintenance activations, emergency shutdowns, and notification counts.
              </p>
            </div>

            <button
              onClick={fetchSettings}
              className="p-2 text-gray-500 hover:text-church-royal-blue transition-colors rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer"
            >
              <FiRefreshCw />
            </button>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              No maintenance history logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                    <th className="p-3">Event Transition</th>
                    <th className="p-3">Triggered By</th>
                    <th className="p-3">Category / Reason</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Deliveries (Mail | Push | In-App | WA)</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {history.map((log, idx) => (
                    <tr key={log._id || idx} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.newStatus === 'emergency' || log.eventType === 'emergency'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : log.newStatus === 'live' || log.eventType === 'live'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {(log.previousStatus || 'LIVE').toUpperCase()} → {(log.newStatus || log.eventType || 'MAINTENANCE').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-gray-900">{log.enabledBy || 'Admin'}</td>
                      <td className="p-3 text-gray-800 max-w-xs truncate font-medium">
                        <span className="block text-gray-900 font-bold">{log.category || 'Scheduled Update'}</span>
                        <span className="text-[11px] text-gray-500">{log.reason}</span>
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {log.startedAt || log.startTime ? new Date(log.startedAt || log.startTime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                      </td>
                      <td className="p-3 text-gray-700 whitespace-nowrap font-mono text-[11px]">
                         {log.deliveries?.email?.count || log.emailSentCount || 0} | {log.deliveries?.push?.count || 0} | {log.deliveries?.inApp?.count || log.notifSentCount || 0} | {log.deliveries?.whatsApp?.count || 0}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {log.notificationSent ? (
                          <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                             Sent
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold text-[10px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Emergency Shutdown Modal */}
      <AnimatePresence>
        {emergencyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border border-red-200 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-100 rounded-2xl">
                  <FiAlertOctagon className="text-2xl" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-red-950">Activate Emergency Shutdown</h3>
                  <p className="text-xs text-red-600 font-semibold">Immediate System Lockout</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                This will immediately lock down the website for public visitors and members, returning a 503 Service Unavailable status and logging an emergency audit trail.
              </p>

              <div>
                <label className="church-label">Emergency Shutdown Reason *</label>
                <textarea
                  rows={2}
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  className="church-input border-red-300 focus:border-red-500"
                  placeholder="Reason for emergency shutdown..."
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEmergencyShutdown}
                  className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-md cursor-pointer"
                >
                  Lock Website Now 
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Preview Modal */}
      <AnimatePresence>
        {previewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-5xl bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
                <span className="text-xs font-bold flex items-center gap-2">
                  <FiEye className="text-amber-400" /> Live Preview Mode (How Public Visitors Will See The Page)
                </span>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              <div className="max-h-[80vh] overflow-y-auto">
                <Maintenance isPreview={true} />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
