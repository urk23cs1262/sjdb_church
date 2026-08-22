import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FiMessageSquare, FiArrowLeft, FiSend } from 'react-icons/fi';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import { useAuth } from '../../context/context_auth_context';

const STATUS_COLORS = { open: 'badge-blue', in_progress: 'badge-gold', resolved: 'badge-green', closed: 'badge-gray' };

export default function Tickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  useEffect(() => { api.get('/tickets/my').then(r => setTickets(r.data.tickets || [])).finally(() => setLoading(false)); }, []);

  const onSubmit = async (data) => {
    try {
      const res = await api.post('/tickets', data);
      setTickets(prev => [res.data.ticket, ...prev]);
      toast.success('Ticket submitted!');
      setShowForm(false);
      reset();
    } catch { toast.error('Failed to submit'); }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      const res = await api.post(`/tickets/${activeTicket._id}/reply`, { message: replyText, from: 'user' });
      setActiveTicket(res.data.ticket);
      setTickets(prev => prev.map(t => t._id === res.data.ticket._id ? res.data.ticket : t));
      setReplyText('');
    } catch { toast.error('Failed to send'); }
  };

  return (
    <div className="min-h-screen pt-24 bg-church-cream ">
      <div className="bg-gray-600 py-10">
        <div className="max-w-5xl mx-auto px-4">
          <Link to="/dashboard" className="text-gold-400 text-sm hover:underline flex items-center gap-1 mb-3"><FiArrowLeft /> Back to dashboard</Link>
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl font-bold text-white">My Tickets & Enquiries</h1>
            <button onClick={() => setShowForm(!showForm)} className="btn-gold text-sm py-2">{showForm ? 'Cancel' : '+ New Ticket'}</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="church-card p-8 mb-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="church-label">Subject *</label>
                  <input {...register('subject', { required: true })} className="church-input" placeholder="Brief subject" />
                </div>
                <div>
                  <label className="church-label">Category</label>
                  <select {...register('category')} className="church-select">
                    <option value="enquiry">Enquiry</option>
                    <option value="complaint">Complaint</option>
                    <option value="meeting_request">Meeting Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="church-label">Message *</label>
                <textarea {...register('message', { required: true })} rows={4} className="church-input resize-none" placeholder="Describe your issue or question in detail..." />
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-gold"><FiSend /> {isSubmitting ? 'Submitting...' : 'Submit Ticket'}</button>
            </form>
          </motion.div>
        )}

        {activeTicket ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="church-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <button onClick={() => setActiveTicket(null)} className="text-church-gold text-sm hover:underline flex items-center gap-1 mb-2"><FiArrowLeft /> All tickets</button>
                <h2 className="font-bold text-gray-800 ">{activeTicket.subject}</h2>
                <p className="text-xs text-gray-400">#{activeTicket.ticketNumber}</p>
              </div>
              <span className={`badge ${STATUS_COLORS[activeTicket.status]} capitalize`}>{activeTicket.status?.replace('_', ' ')}</span>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              <div className="bg-blue-50  p-3 rounded-xl">
                <p className="text-xs font-semibold text-blue-600 mb-1">You</p>
                <p className="text-sm text-gray-700 ">{activeTicket.message}</p>
              </div>
              {activeTicket.replies?.map((r, i) => (
                <div key={i} className={`p-3 rounded-xl ${r.from === 'admin' ? 'bg-gold-50 ' : 'bg-blue-50 '}`}>
                  <p className={`text-xs font-semibold mb-1 ${r.from === 'admin' ? 'text-church-gold' : 'text-blue-600'}`}>{r.from === 'admin' ? 'Parish Office' : 'You'}</p>
                  <p className="text-sm text-gray-700 ">{r.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(r.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
            {activeTicket.status !== 'resolved' && activeTicket.status !== 'closed' && (
              <div className="flex gap-2">
                <input value={replyText} onChange={e => setReplyText(e.target.value)} className="church-input flex-1" placeholder="Type your reply..." onKeyDown={e => e.key === 'Enter' && sendReply()} />
                <button onClick={sendReply} className="btn-gold py-2 px-4"><FiSend /></button>
              </div>
            )}
          </motion.div>
        ) : loading ? <SectionLoader /> : tickets.length === 0 ? (
          <div className="church-card text-center py-16">
            <FiMessageSquare className="text-5xl text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No tickets yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t, i) => (
              <motion.div key={t._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => setActiveTicket(t)} className="church-card cursor-pointer hover:border-church-gold transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">#{t.ticketNumber}</span>
                      <span className="badge badge-gray capitalize text-xs">{t.category?.replace('_', ' ')}</span>
                    </div>
                    <h3 className="font-semibold text-gray-800 ">{t.subject}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">{new Date(t.createdAt).toLocaleDateString()} • {t.replies?.length || 0} replies</p>
                  </div>
                  <span className={`badge ${STATUS_COLORS[t.status]} capitalize`}>{t.status?.replace('_', ' ')}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
