import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FiFileText, FiArrowLeft, FiDownload } from 'react-icons/fi';
import api, { UPLOADS_URL } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

const DOC_TYPES = [
  { value: 'baptism', label: 'Baptism Certificate' },
  { value: 'marriage', label: 'Marriage Certificate' },
  { value: 'confirmation', label: 'Confirmation Certificate' },
  { value: 'family_card', label: 'Family Card' },
  { value: 'parish_membership', label: 'Parish Membership Certificate' },
  { value: 'death', label: 'Death Certificate' },
];

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  useEffect(() => { api.get('/documents/my').then(r => setDocuments(r.data.documents || [])).finally(() => setLoading(false)); }, []);

  const onSubmit = async (data) => {
    try {
      const res = await api.post('/documents', data);
      setDocuments(prev => [res.data.document, ...prev]);
      toast.success('Document request submitted!');
      setShowForm(false);
      reset();
    } catch (e) { toast.error(e.response?.data?.message || 'Request failed'); }
  };

  const statusColor = (s) => ({ pending: 'badge-gold', processing: 'badge-blue', approved: 'badge-green', rejected: 'badge-red' }[s] || 'badge-gray');

  const forceFileDownload = async (e, fileUrl, type) => {
    e.preventDefault();
    try {
      toast.loading("Starting download...", { id: "download" });
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = fileUrl.split('.').pop() || 'pdf';
      link.download = `${type?.replace('_', '-')}-document.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Download complete", { id: "download" });
    } catch (err) {
      toast.error("Download failed, opening directly.", { id: "download" });
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen pt-24 bg-church-cream ">
      <div className="bg-gray-600 py-10">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/dashboard" className="text-gold-400 text-sm hover:underline flex items-center gap-1 mb-3"><FiArrowLeft /> Back to dashboard</Link>
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl font-bold text-white">My Document Requests</h1>
            <button onClick={() => setShowForm(!showForm)} className="btn-gold text-sm py-2">{showForm ? 'Cancel' : '+ New Request'}</button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="church-card p-8 mb-8">
            <h2 className="font-display text-xl font-bold text-church-royal-blue  mb-5">Request a Document</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="church-label">Document Type *</label>
                <select {...register('type', { required: true })} className="church-select">
                  <option value="">Select document type</option>
                  {DOC_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="church-label">Additional Details</label>
                <textarea {...register('requestDetails')} rows={3} className="church-input resize-none" placeholder="Provide any relevant details (baptism date, spouse name, etc.)" />
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-gold"><FiFileText /> {isSubmitting ? 'Submitting...' : 'Submit Request'}</button>
            </form>
          </motion.div>
        )}

        {loading ? <SectionLoader /> : documents.length === 0 ? (
          <div className="church-card text-center py-16">
            <FiFileText className="text-5xl text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No document requests yet</p>
            <button onClick={() => setShowForm(true)} className="btn-gold mt-4 text-sm">Request a Document</button>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((d, i) => (
              <motion.div key={d._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="church-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-800  capitalize">{d.type?.replace('_', ' ')}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Requested: {new Date(d.createdAt).toLocaleDateString()}</p>
                    {d.requestDetails && <p className="text-sm text-gray-500 mt-1">{d.requestDetails}</p>}
                    {d.adminNote && <p className="text-sm text-amber-600 mt-1">Note: {d.adminNote}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`badge ${statusColor(d.status)} capitalize`}>{d.status}</span>
                    {d.status === 'approved' && d.uploadedFile && (
                      <button onClick={(e) => forceFileDownload(e, d.uploadedFile.startsWith('http') ? d.uploadedFile : `${UPLOADS_URL.replace('/uploads', '')}${d.uploadedFile.startsWith('/') ? '' : '/'}${d.uploadedFile}`, d.type)} className="flex items-center gap-1 text-church-gold text-sm hover:underline"><FiDownload /> Download</button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
