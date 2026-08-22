import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiUpload } from 'react-icons/fi';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

export default function AdminDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const fileRefs = useRef({});

  useEffect(() => {
    setLoading(true);
    api.get(`/documents?status=${status}&limit=50`).then(r => setDocs(r.data.documents || [])).finally(() => setLoading(false));
  }, [status]);

  const updateDoc = async (id, newStatus, file) => {
    try {
      const formData = new FormData();
      formData.append('status', newStatus);
      if (file) formData.append('file', file);
      await api.put(`/documents/${id}/status`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDocs(prev => prev.filter(d => d._id !== id));
      toast.success(`Document ${newStatus}`);
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue">Manage Documents</h1>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
            {['pending', 'processing', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold capitalize whitespace-nowrap transition-all ${status === s ? 'bg-church-gold text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'}`}>{s}</button>
            ))}
          </div>
        </div>

        {loading ? <SectionLoader /> : docs.length === 0 ? <p className="text-center text-gray-400 py-10">No {status} documents</p> : (
          <div className="space-y-4">
            {docs.map((d, i) => (
              <motion.div key={d._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="glass-card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base capitalize">{d.type?.replace('_', ' ')}</h3>
                    <p className="text-gray-500 text-xs sm:text-sm">{d.userId?.name} — {d.userId?.phone}</p>
                    {d.requestDetails && <p className="text-gray-400 text-xs mt-1">{d.requestDetails}</p>}
                    <p className="text-gray-400 text-xs mt-0.5">Requested: {new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                  {status === 'pending' && (
                    <div className="flex flex-col gap-2 items-start sm:items-end">
                      <div className="flex flex-wrap gap-2">
                        <input type="file" ref={el => fileRefs.current[d._id] = el} className="hidden" accept=".pdf,.jpg,.png" onChange={e => updateDoc(d._id, 'approved', e.target.files[0])} />
                        <button onClick={() => { updateDoc(d._id, 'processing'); }} className="px-3 py-1.5 bg-blue-100 text-blue-600 rounded-xl text-xs sm:text-sm hover:bg-blue-200 transition-colors">Processing</button>
                        <button onClick={() => fileRefs.current[d._id]?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-600 rounded-xl text-xs sm:text-sm hover:bg-green-200 transition-colors">
                          <FiUpload /> Upload & Approve
                        </button>
                        <button onClick={() => updateDoc(d._id, 'rejected')} className="p-1.5 sm:p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"><FiX /></button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>

  );
}
