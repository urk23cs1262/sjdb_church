import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiMessageSquare, FiSend, FiMoreVertical, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import { useAuth } from '../../context/context_auth_context';

const STATUS_COLORS = { open: 'badge-blue', in_progress: 'badge-gold', resolved: 'badge-green', closed: 'badge-gray' };

const CATEGORY_LABELS = {
  enquiry: 'Enquiry',
  complaint: 'Complaint',
  meeting_request: 'Meeting Request',
  other: 'Other'
};

export default function AdminTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('open');
  const [active, setActive] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/tickets?status=${status}&limit=50`).then(r => setTickets(r.data.tickets || [])).finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    const handleOutsideClick = () => setOpenMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const toggleMenu = (e, ticketId) => {
    e.stopPropagation();
    setOpenMenuId(prev => (prev === ticketId ? null : ticketId));
  };

  const deleteTicketPermanently = async (e, ticketId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (!window.confirm('Are you sure you want to delete this ticket permanently?')) return;
    try {
      await api.delete(`/tickets/${ticketId}`);
      setTickets(prev => prev.filter(t => t._id !== ticketId));
      if (active?._id === ticketId) setActive(null);
      toast.success('Ticket deleted permanently');
    } catch {
      toast.error('Failed to delete ticket');
    }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      const res = await api.post(`/tickets/${active._id}/reply`, { message: replyText, from: 'admin' });
      setActive(res.data.ticket);
      setTickets(prev => prev.map(t => t._id === res.data.ticket._id ? res.data.ticket : t));
      setReplyText('');
    } catch { toast.error('Failed'); }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const res = await api.put(`/tickets/${id}/status`, { status: newStatus });
      const updated = res.data.ticket || { ...active, status: newStatus };
      setTickets(prev => prev.map(t => t._id === id ? { ...t, status: newStatus } : t));
      if (active?._id === id) setActive(prev => ({ ...prev, status: newStatus }));
      toast.success('Status updated');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6 flex flex-col lg:flex-row gap-6 min-h-screen lg:h-[calc(100vh-80px)]">
        {/* Ticket list */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
            {['open', 'in_progress', 'resolved', 'closed'].map(s => (
              <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all ${status === s ? 'bg-church-gold text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'}`}>{s.replace('_', ' ')}</button>
            ))}
          </div>
          {loading ? <SectionLoader /> : (
            <div className="space-y-2 overflow-y-auto max-h-[300px] lg:max-h-none flex-1">
              {tickets.map((t) => (
                <div key={t._id} onClick={() => setActive(t)} className={`church-card cursor-pointer transition-all p-3 sm:p-4 relative ${active?._id === t._id ? 'border-church-gold shadow-gold' : ''}`}>
                  <div className="flex items-start justify-between mb-1 gap-1">
                    <p className="font-semibold text-gray-800 text-sm truncate flex-1">{t.subject}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`badge ${STATUS_COLORS[t.status]} text-xs`}>{t.status?.replace('_', ' ')}</span>
                      <div className="relative">
                        <button
                          onClick={(e) => toggleMenu(e, t._id)}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Options"
                        >
                          <FiMoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === t._id && (
                          <div className="absolute right-0 top-7 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-in fade-in zoom-in-95">
                            <button
                              onClick={(e) => deleteTicketPermanently(e, t._id)}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 transition-colors"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                              Delete permanently
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs flex items-center gap-1.5 flex-wrap">
                    <span>{t.userId?.name || 'User'}</span>
                    <span>•</span>
                    <span>#{t.ticketNumber}</span>
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100/70 text-amber-800 border border-amber-200">
                      Reason: {CATEGORY_LABELS[t.category] || t.category || 'Enquiry'}
                    </span>
                    <p className="text-gray-400 text-xs">{t.replies?.length || 0} replies</p>
                  </div>
                </div>
              ))}
              {tickets.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No {status} tickets</p>}
            </div>
          )}
        </div>

        {/* Thread view */}
        {active ? (
          <div className="flex-1 glass-card p-4 sm:p-6 flex flex-col min-h-[400px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">{active.subject}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-gray-400">#{active.ticketNumber} • {active.userId?.name} ({active.userId?.phone || 'N/A'})</p>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Reason: {CATEGORY_LABELS[active.category] || active.category || 'Enquiry'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                  <button key={s} onClick={() => updateStatus(active._id, s)} className={`px-2 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${active.status === s ? 'bg-church-gold text-white' : 'bg-gray-100 text-gray-500'}`}>{s.replace('_', ' ')}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              <div className="bg-blue-50  p-3 rounded-xl">
                <p className="text-xs font-semibold text-blue-600 mb-1">{active.userId?.name}</p>
                <p className="text-sm text-gray-700 ">{active.message}</p>
              </div>
              {active.replies?.map((r, i) => (
                <div key={i} className={`p-3 rounded-xl ${r.from === 'admin' ? 'bg-gold-50  ml-8' : 'bg-blue-50  mr-8'}`}>
                  <p className={`text-xs font-semibold mb-1 ${r.from === 'admin' ? 'text-church-gold' : 'text-blue-600'}`}>{r.from === 'admin' ? 'Parish Office' : active.userId?.name}</p>
                  <p className="text-sm text-gray-700 ">{r.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(r.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
            {active.status !== 'closed' && (
              <div className="flex gap-2">
                <input value={replyText} onChange={e => setReplyText(e.target.value)} className="church-input flex-1" placeholder="Type admin reply..." onKeyDown={e => e.key === 'Enter' && sendReply()} />
                <button onClick={sendReply} className="btn-gold py-2 px-4"><FiSend /></button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FiMessageSquare className="text-6xl mx-auto mb-3 opacity-30" />
              <p>Select a ticket to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
