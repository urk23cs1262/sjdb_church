import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiMail,
  FiSend,
  FiUser,
  FiPhone,
  FiTag,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiTrash2,
  FiMessageSquare,
  FiChevronDown,
  FiChevronUp,
  FiLoader
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const QUICK_SUBJECTS = [
  'Important Notice from Parish Office',
  'Membership Details Updated',
  'Sacrament & Family Record Update',
  'Mass Booking & Prayer Request Update',
  'Parish Event & Community Notice',
  'Account Verification Notice'
];

export default function MessageUserModal({ user, onClose, onMessageSent }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal'); // 'normal' | 'important' | 'urgent'
  const [sendEmail, setSendEmail] = useState(true);
  const [sendPush, setSendPush] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Sent History for this user
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (user?._id) {
      fetchHistory();
    }
  }, [user?._id]);

  const fetchHistory = async () => {
    if (!user?._id) return;
    setLoadingHistory(true);
    try {
      const res = await api.get(`/messages/admin/thread/${user._id}`);
      setHistory(res.data.messages || []);
    } catch (err) {
      console.warn('Failed to load message history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error('Please enter a message subject');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter message content');
      return;
    }

    setIsSending(true);
    try {
      const res = await api.post('/messages/admin/send', {
        recipientId: user._id,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        sendEmail,
        sendPush,
        sendWhatsApp
      });

      if (res.data.success) {
        toast.success(`Message sent successfully to ${user.name}!`);
        if (onMessageSent) onMessageSent(res.data.data);
        onClose();
      } else {
        toast.error(res.data.message || 'Failed to send message');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error sending message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Delete this message from record?')) return;
    try {
      await api.delete(`/messages/admin/${msgId}`);
      toast.success('Message deleted');
      setHistory(prev => prev.filter(m => m._id !== msgId));
    } catch (err) {
      toast.error('Failed to delete message');
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-auto flex flex-col max-h-[90vh]"
        >
          {/* FIXED MODAL HEADER */}
          <div className="bg-gradient-to-r from-slate-900 via-church-royal-blue to-slate-900 px-5 py-3.5 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-church-gold text-base">
                <FiMail />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  Send Message
                </h2>
                <p className="text-[11px] text-slate-300">
                  Deliver official parish notification & email
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <FiX className="text-lg" />
            </button>
          </div>

          {/* FIXED RECIPIENT SUMMARY BAR */}
          <div className="bg-slate-50 border-b border-gray-200/80 px-5 py-2.5 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-church-royal-blue text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user.name?.[0]?.toUpperCase() || 'P'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-gray-900 text-xs truncate">{user.name}</span>
                  {user.parishMemberId && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-950 font-mono text-[10px] font-bold">
                      {user.parishMemberId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-500 truncate">
                  {user.email && <span className="truncate">{user.email}</span>}
                  {user.phone && <span>&bull; {user.phone}</span>}
                </div>
              </div>
            </div>

            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer flex-shrink-0 shadow-2xs"
              >
                <FiMessageSquare className="text-amber-600 text-xs" />
                <span>History ({history.length})</span>
                {showHistory ? <FiChevronUp className="text-xs" /> : <FiChevronDown className="text-xs" />}
              </button>
            )}
          </div>

          {/* MESSAGE HISTORY ACCORDION */}
          {showHistory && (
            <div className="bg-amber-50/60 border-b border-amber-200/80 p-3 max-h-40 overflow-y-auto flex-shrink-0 text-xs custom-scrollbar">
              <div className="font-bold text-amber-900 mb-1.5 flex items-center justify-between text-[11px]">
                <span>Previous Messages:</span>
                <span className="text-[10px] text-amber-700">{history.length} records</span>
              </div>
              <div className="space-y-1.5">
                {history.map((m) => (
                  <div key={m._id} className="bg-white p-2 rounded-lg border border-amber-200/70 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-gray-900 truncate text-[11px]">{m.subject}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${m.isRead ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {m.isRead ? 'Read' : 'Unread'}
                        </span>
                        <button
                          onClick={() => handleDeleteMessage(m._id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="text-[10px]" />
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-600 text-[11px] line-clamp-1 mb-0.5">{m.message}</p>
                    <div className="text-[9px] text-gray-400">
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FORM CONTAINER WITH ISOLATED SCROLLABLE BODY AND STICKY FOOTER */}
          <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden min-h-0">
            {/* SCROLLABLE FORM BODY */}
            <div className="p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
              {/* QUICK PRESETS */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Quick Subject Suggestions:
                </label>
                <div className="flex flex-wrap gap-1">
                  {QUICK_SUBJECTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSubject(preset)}
                      className="px-2 py-0.5 rounded-md bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 text-[10.5px] font-medium transition-colors cursor-pointer border border-gray-200"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* SUBJECT */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Important Notice regarding Parish Membership..."
                  className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-300 focus:border-church-gold rounded-lg text-xs sm:text-sm text-gray-900 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                  required
                />
              </div>

              {/* MESSAGE CONTENT */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Message Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Dear ${user.name},\n\nType your message here...`}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 focus:bg-white border border-gray-300 focus:border-church-gold rounded-lg text-xs sm:text-sm text-gray-900 focus:ring-2 focus:ring-amber-200 outline-none transition-all resize-y"
                  required
                />
              </div>

              {/* PRIORITY & CHANNELS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                {/* PRIORITY */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <div className="flex gap-1.5">
                    {[
                      { id: 'normal', label: 'Normal', color: 'border-blue-300 text-blue-800 bg-blue-50' },
                      { id: 'important', label: 'Important', color: 'border-amber-300 text-amber-800 bg-amber-50' },
                      { id: 'urgent', label: 'Urgent', color: 'border-red-300 text-red-800 bg-red-50' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriority(p.id)}
                        className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-bold border transition-all cursor-pointer text-center ${
                          priority === p.id ? `${p.color} ring-1 ring-church-gold shadow-2xs` : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CHANNELS */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Delivery Options
                  </label>
                  <div className="space-y-1 text-[11px] text-gray-700">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        disabled={!user.email}
                        className="w-3.5 h-3.5 text-church-gold rounded focus:ring-amber-400 cursor-pointer"
                      />
                      <span className={user.email ? 'font-medium truncate' : 'text-gray-400'}>
                        Send Email ({user.email ? user.email : 'No email'})
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sendPush}
                        onChange={(e) => setSendPush(e.target.checked)}
                        className="w-3.5 h-3.5 text-church-gold rounded focus:ring-amber-400 cursor-pointer"
                      />
                      <span className="font-medium">Send Web Push Notification</span>
                    </label>
                    {user.phone && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={sendWhatsApp}
                          onChange={(e) => setSendWhatsApp(e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-400 cursor-pointer"
                        />
                        <span className="font-medium text-emerald-800">
                          Send WhatsApp ({user.phone})
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* FIXED PINNED STICKY FOOTER (OUTSIDE SCROLL CONTAINER) */}
            <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200/80 px-5 py-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <FiLoader className="animate-spin text-sm" /> Sending...
                  </>
                ) : (
                  <>
                    <FiSend className="text-sm" /> Send Message
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
