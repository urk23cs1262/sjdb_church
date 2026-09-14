import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiUpload, FiFileText, FiDownload, FiExternalLink, FiCheckCircle, FiClock } from 'react-icons/fi';
import api, { getMediaUrl } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

export default function AdminDocuments() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const targetId = paramId || searchParams.get('id') || searchParams.get('highlight');

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
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
      setProcessingId(id);
      const isApproving = newStatus === 'approved';
      if (isApproving && file) {
        toast.loading('Converting file to PDF & delivering to Parishioner...', { id: `doc-${id}` });
      } else {
        toast.loading(`Updating document to ${newStatus}...`, { id: `doc-${id}` });
      }

      const formData = new FormData();
      formData.append('status', newStatus);
      if (file) formData.append('file', file);
      
      const res = await api.put(`/documents/${id}/status`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDocs(prev => prev.filter(d => d._id !== id));

      if (isApproving) {
        toast.success('Document approved & final PDF delivered via Email attachment & WhatsApp!', { id: `doc-${id}`, duration: 5000 });
      } else {
        toast.success(`Document marked as ${newStatus}`, { id: `doc-${id}` });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update document', { id: `doc-${id}` });
    } finally {
      setProcessingId(null);
    }
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
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold capitalize whitespace-nowrap transition-all ${
                  status === s ? 'bg-church-gold text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? <SectionLoader /> : docs.length === 0 ? <p className="text-center text-gray-400 py-10">No {status} documents</p> : (
          <div className="space-y-4">
            {docs.map((d, i) => {
              const isTarget = Boolean(targetId && (d._id === targetId || d._id.endsWith(targetId) || targetId.includes(d._id.slice(-6))));
              const isWorking = processingId === d._id;

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
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-church-gold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {`DOC-${d._id.slice(-6).toUpperCase()}`}
                        </span>
                        <h3 className="font-bold text-gray-800 text-sm sm:text-base capitalize">
                          {d.type?.replace(/_/g, ' ')} Certificate
                        </h3>
                        {status === 'processing' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                            <FiClock className="animate-spin text-blue-500 text-[10px]" /> In Processing
                          </span>
                        )}
                        {status === 'approved' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                            <FiCheckCircle className="text-green-600" /> Approved & Delivered
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 text-xs sm:text-sm">
                        <strong className="text-gray-800">{d.userId?.name || 'Parishioner'}</strong>
                        {d.userId?.phone ? ` — ${d.userId.phone}` : ''}
                        {d.userId?.email ? ` • ${d.userId.email}` : ''}
                      </p>

                      {d.requestDetails && (
                        <p className="text-gray-600 text-xs italic bg-gray-50 p-2.5 rounded-lg border border-gray-100 max-w-xl">
                          "{d.requestDetails}"
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-gray-400 text-xs pt-1">
                        <span>Requested: {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {d.processedAt && <span>• Processed: {new Date(d.processedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                      </div>

                      {/* Approved multi-channel delivery banner */}
                      {status === 'approved' && (
                        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">Delivered via:</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">✉️ Email (PDF Attachment)</span>
                          <span className="px-2 py-0.5 rounded bg-green-50 text-green-800 border border-green-200 font-medium">💬 WhatsApp Bot (PDF Document)</span>
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium">🌐 User Portal</span>
                        </div>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-col gap-2 items-start sm:items-end shrink-0">
                      {/* Hidden File Input for PDF / Images */}
                      <input
                        type="file"
                        ref={el => fileRefs.current[d._id] = el}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            updateDoc(d._id, 'approved', e.target.files[0]);
                          }
                        }}
                      />

                      {/* Pending Tab Controls */}
                      {status === 'pending' && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            disabled={isWorking}
                            onClick={() => updateDoc(d._id, 'processing')}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs sm:text-sm transition-colors font-semibold disabled:opacity-50"
                          >
                            Move to Processing
                          </button>
                          <button
                            disabled={isWorking}
                            onClick={() => fileRefs.current[d._id]?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs sm:text-sm transition-colors font-semibold shadow-xs disabled:opacity-50"
                            title="Upload PDF or Image (automatically converts to PDF and delivers to parishioner)"
                          >
                            <FiUpload /> Upload & Approve
                          </button>
                          <button
                            disabled={isWorking}
                            onClick={() => updateDoc(d._id, 'rejected')}
                            className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                            title="Reject request"
                          >
                            <FiX />
                          </button>
                        </div>
                      )}

                      {/* Processing Tab Controls */}
                      {status === 'processing' && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            disabled={isWorking}
                            onClick={() => fileRefs.current[d._id]?.click()}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs sm:text-sm transition-colors font-semibold shadow-xs disabled:opacity-50"
                            title="Upload PDF or Image (automatically converts to PDF and delivers to parishioner)"
                          >
                            <FiUpload /> Upload & Approve
                          </button>
                          <button
                            disabled={isWorking}
                            onClick={() => updateDoc(d._id, 'rejected')}
                            className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                            title="Reject request"
                          >
                            <FiX />
                          </button>
                          <button
                            disabled={isWorking}
                            onClick={() => updateDoc(d._id, 'pending')}
                            className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Move back to pending"
                          >
                            Reset to Pending
                          </button>
                        </div>
                      )}

                      {/* Approved Tab Controls: View and Download Final PDF */}
                      {status === 'approved' && d.uploadedFile && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <a
                            href={getMediaUrl(d.uploadedFile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-church-royal-blue text-white hover:bg-blue-900 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs"
                          >
                            <FiExternalLink /> View Approved PDF
                          </a>
                          <a
                            href={`${getMediaUrl(d.uploadedFile)}?download=true`}
                            download
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-gray-200"
                          >
                            <FiDownload /> Download PDF
                          </a>
                        </div>
                      )}
                    </div>
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

