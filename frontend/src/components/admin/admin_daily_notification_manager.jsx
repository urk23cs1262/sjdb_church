import { useState, useEffect } from 'react';
import {
  FiMail, FiSend, FiCheckCircle, FiAlertCircle, FiRefreshCw,
  FiCalendar, FiUsers, FiClock, FiGlobe, FiBell, FiPhone, FiCheck, FiX
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function DailyNotificationManager() {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testLang, setTestLang] = useState('ta');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/daily-notifications/status');
      if (res.data && res.data.success) {
        setStatusData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch daily notification status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testEmail && !testPhone) {
      return toast.error('Please enter a test email or WhatsApp phone number');
    }

    setSendingTest(true);
    const toastId = toast.loading('Sending test notification across enabled channels...');
    try {
      const res = await api.post('/daily-notifications/send-test', {
        targetEmail: testEmail || null,
        targetPhone: testPhone || null,
        language: testLang
      });

      if (res.data && res.data.success) {
        toast.success('Test notification sent successfully!', { id: toastId });
        await fetchStatus();
      } else {
        toast.error(res.data?.message || 'Failed to send test notification.', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to send test notification.', { id: toastId });
    } finally {
      setSendingTest(false);
    }
  };

  const handleTriggerBroadcast = async () => {
    if (!window.confirm("Are you sure you want to send today's daily 4-channel notification (Email, In-App, Push, WhatsApp) to all registered parishioners now?")) {
      return;
    }

    setBroadcasting(true);
    const toastId = toast.loading("Sending 4-Channel Daily Catholic Notification to all registered users...");
    try {
      const res = await api.post('/daily-notifications/trigger-now');
      if (res.data && res.data.success) {
        toast.success(`4-Channel broadcast completed! Sent: ${res.data.sentCount}, Skipped: ${res.data.skippedCount}, Failed: ${res.data.failedCount}`, { id: toastId });
        await fetchStatus();
      } else {
        toast.error(res.data?.message || 'Broadcast failed.', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Broadcast failed.', { id: toastId });
    } finally {
      setBroadcasting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 flex items-center justify-center min-h-[220px] shadow-xs">
        <FiRefreshCw className="animate-spin text-3xl text-church-gold" />
      </div>
    );
  }

  const checklist = statusData?.contentChecklist || {};
  const channelMetrics = statusData?.channels || { email: 0, inApp: 0, push: 0, whatsapp: 0 };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs space-y-6">
      {/* Header & Main Broadcast Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 text-church-gold rounded-lg text-lg">
              <FiMail />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-church-royal-blue font-display">
                12:00 AM IST 4-Channel Catholic Notifications
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Automated midnight delivery of bilingual Bible Verses, Mass Readings, Reflection & Saint of the Day across Email, In-App, Push & WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStatus}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors cursor-pointer border border-gray-200"
            title="Refresh Status"
          >
            <FiRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleTriggerBroadcast}
            disabled={broadcasting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-church-royal-blue to-indigo-900 hover:from-blue-900 hover:to-indigo-950 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <FiSend className={`text-sm ${broadcasting ? 'animate-pulse' : ''}`} />
            <span>{broadcasting ? 'Sending...' : "Send Today's Notification Now"}</span>
          </button>
        </div>
      </div>

      {/* Main Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* DATE & STATUS */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <FiCalendar />
            <span>Today's Date</span>
          </div>
          <div className="mt-1.5 font-bold text-slate-900 text-sm">{statusData?.formattedDate || statusData?.dateKey}</div>
          <div className="mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
              statusData?.status === 'Completed' ? 'bg-green-100 text-green-800' :
              statusData?.status === 'Partially Sent' ? 'bg-amber-100 text-amber-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {statusData?.status || 'Pending'}
            </span>
          </div>
        </div>

        {/* TOTAL USERS */}
        <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold">
            <FiUsers />
            <span>Total Users</span>
          </div>
          <div className="mt-1.5 font-bold text-blue-950 text-xl">{statusData?.totalUsers ?? 0}</div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">Active parishioners</div>
        </div>

        {/* SENT SUCCESSFULLY */}
        <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
            <FiCheckCircle />
            <span>Delivered Today</span>
          </div>
          <div className="mt-1.5 font-bold text-emerald-950 text-xl">{statusData?.sentCount ?? 0}</div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">Parishioners reached</div>
        </div>

        {/* SKIPPED / DUPLICATES */}
        <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-100">
          <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
            <FiClock />
            <span>Duplicate Protected</span>
          </div>
          <div className="mt-1.5 font-bold text-amber-950 text-xl">{statusData?.skippedCount ?? 0}</div>
          <div className="text-[10px] text-amber-700/80 mt-0.5">Skipped (already received)</div>
        </div>
      </div>

      {/* 4-Channels Breakdown Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-church-royal-blue">
            <FiMail /> Email
          </span>
          <span className="text-sm font-extrabold text-gray-900">{channelMetrics.email}</span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <FiBell /> In-App
          </span>
          <span className="text-sm font-extrabold text-gray-900">{channelMetrics.inApp}</span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
            <FiGlobe /> Push
          </span>
          <span className="text-sm font-extrabold text-gray-900">{channelMetrics.push}</span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <FaWhatsapp /> WhatsApp
          </span>
          <span className="text-sm font-extrabold text-gray-900">{channelMetrics.whatsapp}</span>
        </div>
      </div>

      {/* Content Verification Checklist */}
      <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-100">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
          Today's Content Verification Checklist
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <div className={`flex items-center gap-1.5 p-2 rounded-lg ${checklist.bibleContent ? 'bg-green-50 text-green-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            {checklist.bibleContent ? <FiCheck className="text-sm text-green-600" /> : <FiX className="text-sm text-gray-400" />}
            <span>Bible Verses</span>
          </div>

          <div className={`flex items-center gap-1.5 p-2 rounded-lg ${checklist.massReadings ? 'bg-green-50 text-green-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            {checklist.massReadings ? <FiCheck className="text-sm text-green-600" /> : <FiX className="text-sm text-gray-400" />}
            <span>Mass Readings</span>
          </div>

          <div className={`flex items-center gap-1.5 p-2 rounded-lg ${checklist.reflection ? 'bg-green-50 text-green-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            {checklist.reflection ? <FiCheck className="text-sm text-green-600" /> : <FiX className="text-sm text-gray-400" />}
            <span>Reflection</span>
          </div>

          <div className={`flex items-center gap-1.5 p-2 rounded-lg ${checklist.saint ? 'bg-green-50 text-green-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            {checklist.saint ? <FiCheck className="text-sm text-green-600" /> : <FiX className="text-sm text-gray-400" />}
            <span>Saint of Day</span>
          </div>

          <div className={`flex items-center gap-1.5 p-2 rounded-lg ${checklist.bibleImage ? 'bg-green-50 text-green-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            {checklist.bibleImage ? <FiCheck className="text-sm text-green-600" /> : <FiX className="text-sm text-gray-400" />}
            <span>Bible Image</span>
          </div>

          <div className={`flex items-center gap-1.5 p-2 rounded-lg ${checklist.saintImage ? 'bg-green-50 text-green-700 font-semibold' : 'bg-gray-100 text-gray-500'}`}>
            {checklist.saintImage ? <FiCheck className="text-sm text-green-600" /> : <FiX className="text-sm text-gray-400" />}
            <span>Saint Image (CID)</span>
          </div>
        </div>
      </div>

      {/* Manual Test Tool */}
      <div className="pt-2 border-t border-gray-100">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <FiSend className="text-church-gold" /> Send Test Notification (Email & WhatsApp)
        </h3>
        <p className="text-gray-500 text-xs mb-3">
          Preview the exact notification that parishioners will receive across Email and WhatsApp Bot.
        </p>

        <form onSubmit={handleSendTest} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch sm:items-center">
          <div className="sm:col-span-4">
            <input
              type="email"
              placeholder="Test email (e.g. test@example.com)"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-church-gold"
            />
          </div>

          <div className="sm:col-span-3">
            <input
              type="tel"
              placeholder="WhatsApp number (e.g. +91...)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-church-gold"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={testLang}
              onChange={(e) => setTestLang(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-church-gold"
            >
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="en">English</option>
              <option value="both">Both (தமிழ் + English)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={sendingTest}
              className="w-full px-4 py-2.5 bg-church-gold hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <FiSend className="text-sm" />
              <span>{sendingTest ? 'Sending...' : 'Send Test'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
