import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiUpload, FiFileText } from 'react-icons/fi';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

export default function AdminDocuments() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const targetId = paramId || searchParams.get('id') || searchParams.get('highlight');

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [targetDoc, setTargetDoc] = useState(null);
  const fileRefs = useRef({});
  const targetCardRef = useRef(null);

  useEffect(() => {
    if (targetId) {
      setLoading(true);
      api.get(`/documents/${targetId}`)
        .then(r => {
          if (r.data.document) {
            setTargetDoc(r.data.document);
            if (r.data.document.status) setStatus(r.data.document.status);
          }
        })
        .catch(() => {
          api.get(`/documents?id=${targetId}`).then(r => {
            if (r.data.documents?.[0]) {
              setTargetDoc(r.data.documents[0]);
              if (r.data.documents[0].status) setStatus(r.data.documents[0].status);
            }
          }).catch(() => {});
        })
        .finally(() => setLoading(false));
    }
  }, [targetId]);

  useEffect(() => {
    fetchDocs();
  }, [status]);

  const fetchDocs = () => {
    setLoading(true);
    api.get(`/documents?status=${status}&limit=50`).then(r => {
      let list = r.data.documents || [];
      if (targetDoc && !list.some(d => d._id === targetDoc._id)) {
        list = [targetDoc, ...list];
      }
      setDocs(list);
    }).finally(() => {
      setLoading(false);
      if (targetId) {
        setTimeout(() => {
          targetCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    });
  };

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
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue flex items-center gap-2">
              <FiFileText className="text-church-gold" /> Manage Documents
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Process and issue certificates and parish documents</p>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
            {['pending', 'processing', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold capitalize whitespace-nowrap transition-all ${status === s ? 'bg-church-gold text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'}`}>{s}</button>
            ))}
          </div>
        </div>

        {loading ? <SectionLoader /> : docs.length === 0 ? <p className="text-center text-gray-400 py-10">No {status} documents</p> : (
          <div className="space-y-4">
            {docs.map((d, i) => {
              const isTarget = Boolean(targetId && (d._id === targetId || d._id.endsWith(targetId) || targetId.includes(d._id.slice(-6))));
              return (
                <motion.div
                  key={d._id}
                  ref={isTarget ? targetCardRef : null}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`glass-card p-4 sm:p-5 transition-all ${
                    isTarget ? 'border-2 border-amber-500 ring-4 ring-amber-200/60 shadow-xl bg-amber-50/20' : ''
                  }`}
                >
                  {isTarget && (
                    <div className="mb-3 pb-2 border-b border-amber-200 flex items-center justify-between flex-wrap gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center gap-1.5 shadow-xs">
                        <span>🎯 Targeted Document Request</span>
                      </span>
                      <span className="text-xs text-amber-900 font-bold">Direct Deep Link Active</span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-church-gold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {`DOC-${d._id.slice(-6).toUpperCase()}`}
                        </span>
                        <h3 className="font-bold text-gray-800 text-sm sm:text-base capitalize">{d.type?.replace('_', ' ')}</h3>
                      </div>
                      <p className="text-gray-600 text-xs sm:text-sm mt-1">
                        <strong className="text-gray-800">{d.userId?.name || 'Parishioner'}</strong> — {d.userId?.phone || 'No phone'}
                      </p>
                      {d.requestDetails && <p className="text-gray-500 text-xs mt-1 italic bg-gray-50 p-2 rounded-lg border border-gray-100">"{d.requestDetails}"</p>}
                      <p className="text-gray-400 text-xs mt-1">Requested: {new Date(d.createdAt).toLocaleDateString()}</p>
                    </div>
                    {status === 'pending' && (
                      <div className="flex flex-col gap-2 items-start sm:items-end">
                        <div className="flex flex-wrap gap-2">
                          <input type="file" ref={el => fileRefs.current[d._id] = el} className="hidden" accept=".pdf,.jpg,.png" onChange={e => updateDoc(d._id, 'approved', e.target.files[0])} />
                          <button onClick={() => { updateDoc(d._id, 'processing'); }} className="px-3 py-1.5 bg-blue-100 text-blue-600 rounded-xl text-xs sm:text-sm hover:bg-blue-200 transition-colors font-semibold">Processing</button>
                          <button onClick={() => fileRefs.current[d._id]?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-xs sm:text-sm hover:bg-green-200 transition-colors font-semibold">
                            <FiUpload /> Upload & Approve
                          </button>
                          <button onClick={() => updateDoc(d._id, 'rejected')} className="p-1.5 sm:p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"><FiX /></button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

