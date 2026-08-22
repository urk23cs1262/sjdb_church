import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiBook, FiBookOpen, FiUpload, FiDownload, FiRefreshCw, FiSearch, FiPlus, 
  FiEdit2, FiTrash2, FiEye, FiCheck, FiX, FiFileText, FiTag, FiCalendar, FiClock 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { SectionLoader } from '../common/common_loader';

export default function DailyVersesManager() {
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('');
  const [todayVerse, setTodayVerse] = useState(null);
  const [changingToday, setChangingToday] = useState(false);

  const handleChangeTodayVerse = async (targetVerseId = null) => {
    setChangingToday(true);
    const toastId = toast.loading('Updating today\'s Bible verse...');
    try {
      const payload = targetVerseId ? { verseId: targetVerseId } : {};
      const res = await api.post('/settings/daily-verses/change-today', payload);
      if (res.data.success) {
        setTodayVerse(res.data.verse);
        toast.success(res.data.message || 'Today\'s Bible verse updated!', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change today verse', { id: toastId });
    } finally {
      setChangingToday(false);
    }
  };

  // File upload state
  const [file, setFile] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Modal states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVerse, setEditingVerse] = useState(null);

  // Form state
  const [formData, setFormData] = useState({ ref: '', category: 'General', verseTextEn: '', verseTextTa: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVerses = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/settings/daily-verses/all?page=${page}&limit=15&search=${encodeURIComponent(search)}`);
      if (res.data.success) {
        setVerses(res.data.verses);
        setPages(res.data.pages);
        setTotalCount(res.data.totalCount || res.data.total);
        if (res.data.lastUpdated) {
          setLastUpdated(new Date(res.data.lastUpdated).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch verses:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayVerse = async () => {
    try {
      const res = await api.get('/daily-verse');
      if (res.data.success) {
        setTodayVerse(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch today verse:', e);
    }
  };

  useEffect(() => {
    fetchVerses();
    fetchTodayVerse();
  }, [page, search]);

  // Upload handler (.json or .csv)
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a JSON or CSV file to import');

    setUploading(true);
    const toastId = toast.loading('Importing verses and replacing database...');
    try {
      const data = new FormData();
      data.append('file', file);

      const res = await api.post('/settings/daily-verses/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        toast.success(res.data.message || 'Imported daily verses successfully!', { id: toastId });
        setUploadedFileName(file.name);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPage(1);
        fetchVerses();
        fetchTodayVerse();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import file', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // Export handler
  const handleExport = async (format) => {
    const toastId = toast.loading(`Preparing ${format.toUpperCase()} export...`);
    try {
      const response = await api.get(`/settings/daily-verses/export?format=${format}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `daily_verses_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(`${format.toUpperCase()} exported successfully!`, { id: toastId });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export daily verses', { id: toastId });
    }
  };

  // Reset to default dataset
  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all verses back to the default curated list (400 verses)?')) return;
    const toastId = toast.loading('Resetting to default 400 verses...');
    try {
      const res = await api.post('/settings/daily-verses/reset');
      if (res.data.success) {
        toast.success(res.data.message, { id: toastId });
        setUploadedFileName('');
        setPage(1);
        fetchVerses();
        fetchTodayVerse();
      }
    } catch (err) {
      toast.error('Failed to reset verses', { id: toastId });
    }
  };

  // Open modal for add / edit
  const openModal = (verse = null) => {
    if (verse) {
      setEditingVerse(verse);
      setFormData({
        ref: verse.ref || '',
        category: verse.category || 'General',
        verseTextEn: verse.verseTextEn || '',
        verseTextTa: verse.verseTextTa || ''
      });
    } else {
      setEditingVerse(null);
      setFormData({ ref: '', category: 'General', verseTextEn: '', verseTextTa: '' });
    }
    setIsModalOpen(true);
  };

  // Submit add/edit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ref.trim()) return toast.error('Verse reference is required');

    setIsSubmitting(true);
    try {
      if (editingVerse) {
        await api.put(`/settings/daily-verses/${editingVerse.id || editingVerse._id}`, formData);
        toast.success('Verse updated successfully');
      } else {
        await api.post('/settings/daily-verses', formData);
        toast.success('New verse added successfully');
      }
      setIsModalOpen(false);
      fetchVerses();
      fetchTodayVerse();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save verse');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete verse
  const handleDelete = async (id) => {
    if (!confirm('Delete this verse document?')) return;
    try {
      await api.delete(`/settings/daily-verses/${id}`);
      toast.success('Verse deleted');
      fetchVerses();
      fetchTodayVerse();
    } catch {
      toast.error('Failed to delete verse');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-church-gold/20 mb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md">
            <FiBookOpen className="text-3xl text-white drop-shadow-xs" />
          </div>
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue">Daily Bible Verses CMS</h2>
            <p className="text-gray-500 text-xs sm:text-sm">Manage daily scripture rotation, upload JSON/CSV datasets, and preview today's verse</p>
          </div>
        </div>

        {/* Stats Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
            <FiTag className="text-amber-700" />
            <span>Records: <strong className="text-amber-950 font-black">{totalCount} Verses</strong></span>
          </div>
          {lastUpdated && (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-xs">
              <FiClock className="text-blue-600" />
              <span>Updated: <strong>{lastUpdated}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Upload File Card & Format Code Helper */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Upload Box */}
        <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
              <FiUpload className="text-amber-600" /> Upload JSON / CSV Verse Dataset
            </h3>
            <p className="text-gray-500 text-xs mb-4">
              Importing a file will replace all existing documents in MongoDB with the new dataset.
            </p>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv,application/json,text/csv"
                    onChange={e => setFile(e.target.files[0])}
                    className="block text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
                  />
                  
                  {(file || uploadedFileName) && (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300 shadow-xs">
                      <FiCheck className="text-emerald-600 text-base font-black" />
                      <span className="text-emerald-800">{file ? file.name : uploadedFileName}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="btn-gold px-5 py-2 text-xs font-bold flex items-center gap-2 shadow-gold disabled:opacity-50"
                >
                  <FiUpload /> {uploading ? 'Importing...' : 'Import & Replace Database'}
                </button>
                {(file || uploadedFileName) && (
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                    <FiCheck className="text-emerald-600" /> {file ? file.name : uploadedFileName}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* JSON / CSV Format Preview Helper */}
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between text-xs font-mono">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <FiFileText /> Expected JSON Format
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">Supported: .json, .csv</span>
            </div>
            <pre className="text-[11px] leading-relaxed text-slate-300 overflow-x-auto p-2 bg-slate-950/80 rounded-xl border border-slate-850">
{`[
  {
    "id": 1,
    "ref": "John 3:16",
    "category": "General",
    "verseTextEn": "For God so loved the world...",
    "verseTextTa": "தேவன் உலகத்தையே..."
  }
]`}
            </pre>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Optional fields: <code className="text-amber-300">verseTextEn</code> (English text), <code className="text-amber-300">verseTextTa</code> (Tamil text).
          </p>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-amber-50/60 p-3 sm:p-4 rounded-2xl border border-amber-200/60">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold shadow-xs transition-all"
            title="Download full dataset as JSON"
          >
            <FiDownload /> Export JSON
          </button>
          
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold shadow-xs transition-all"
            title="Download full dataset as CSV"
          >
            <FiDownload /> Export CSV
          </button>

          <button
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            title="Preview Today's Auto Verse"
          >
            <FiEye /> Preview Today's Verse
          </button>

          <button
            onClick={() => handleChangeTodayVerse()}
            disabled={changingToday}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Change Today's Verse to Next Verse"
          >
            <FiRefreshCw className={changingToday ? 'animate-spin' : ''} />
            <span>{changingToday ? 'Changing...' : 'Change Today\'s Verse'}</span>
          </button>

          {/* <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold shadow-xs transition-all"
            title="Reset database back to default 400 verses"
          >
            <FiRefreshCw /> Reset to Default
          </button> */}
        </div>

        <button
          onClick={() => openModal()}
          className="btn-gold px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-gold"
        >
          <FiPlus /> Add Single Verse
        </button>
      </div>

      {/* Verses Table & Search */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search reference or category..."
              className="church-input pl-10 pr-4 py-2 text-xs sm:text-sm w-full"
            />
          </div>
          <span className="text-xs text-gray-500 font-medium">Page {page} of {pages}</span>
        </div>

        {loading ? <SectionLoader /> : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-church-royal-blue text-white text-xs uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12 whitespace-nowrap">ID</th>
                  <th className="py-3 px-3 w-28 whitespace-nowrap">Reference</th>
                  <th className="py-3 px-3 w-28 whitespace-nowrap">Category</th>
                  <th className="py-3 px-3 min-w-[160px]">Verse Text (English)</th>
                  <th className="py-3 px-3 min-w-[160px]">Verse Text (Tamil)</th>
                  <th className="py-3 px-3 text-center w-24 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {verses.map(v => (
                  <tr key={v._id || v.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-3 text-center font-mono font-bold text-gray-500">#{v.id}</td>
                    <td className="py-3 px-3 font-bold text-church-royal-blue whitespace-nowrap">{v.ref}</td>
                    <td className="py-3 px-3">
                      <span className="bg-amber-100 text-amber-900 border border-amber-300/60 font-bold text-[10px] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                        {v.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600 max-w-[180px] sm:max-w-[220px] truncate" title={v.verseTextEn}>
                      {v.verseTextEn ? `"${v.verseTextEn}"` : <span className="text-gray-400 italic">Auto-fetched on view</span>}
                    </td>
                    <td className="py-3 px-3 text-gray-600 font-tamil max-w-[180px] sm:max-w-[220px] truncate" title={v.verseTextTa}>
                      {v.verseTextTa ? `"${v.verseTextTa}"` : <span className="text-gray-400 italic font-sans">—</span>}
                    </td>
                    <td className="py-3 px-3 text-center w-24">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleChangeTodayVerse(v.id || v._id)}
                          className="p-1.5 hover:bg-amber-100 text-amber-800 rounded-lg transition-colors border border-amber-300"
                          title="Set as Today's Verse"
                        >
                          <FiCheck className="text-sm font-bold" />
                        </button>
                        <button
                          onClick={() => openModal(v)}
                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors border border-blue-200/60"
                          title="Edit verse"
                        >
                          <FiEdit2 className="text-sm" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id || v._id)}
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-red-200/60"
                          title="Delete verse"
                        >
                          <FiTrash2 className="text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {verses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400 text-xs">
                      No verses found matching "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-outline-gold text-xs px-3 py-1.5 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-600 font-bold">Page {page} of {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="btn-outline-gold text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Today Verse Preview Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {isPreviewOpen && todayVerse && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-church-gold relative overflow-hidden"
            >
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl p-1 rounded-full hover:bg-gray-100"
              >
                <FiX />
              </button>

              <div className="text-center pt-2">
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Today's Verse (Day {todayVerse.dayOfYear} of {todayVerse.totalVerses})
                </span>

                <blockquote className="text-xl md:text-2xl text-gray-800 font-serif italic leading-relaxed my-6 px-4">
                  "{todayVerse.english}"
                </blockquote>

                {todayVerse.tamil && (
                  <p className="text-gray-600 font-tamil text-sm mb-4 px-4">{todayVerse.tamil}</p>
                )}

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-bold px-2">
                  <span className="text-church-gold text-base font-black">— {todayVerse.reference}</span>
                  <span className="bg-church-royal-blue/10 text-church-royal-blue px-2.5 py-1 rounded-lg">
                    {todayVerse.category}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Add / Edit Verse Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gold-200"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <h3 className="font-bold text-gray-900 text-base">
                  {editingVerse ? `Edit Verse #${editingVerse.id}` : 'Add New Daily Verse'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <FiX className="text-xl" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Bible Reference *</label>
                  <input
                    type="text"
                    required
                    value={formData.ref}
                    onChange={e => setFormData({ ...formData, ref: e.target.value })}
                    placeholder="e.g. John 3:16 or Psalm 23:1"
                    className="church-input w-full text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Love, Faith, Creation, Hope"
                    className="church-input w-full text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">English Verse Text (Optional)</label>
                  <textarea
                    rows={3}
                    value={formData.verseTextEn}
                    onChange={e => setFormData({ ...formData, verseTextEn: e.target.value })}
                    placeholder="Leave empty to auto-fetch from Bible API on view"
                    className="church-input w-full text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tamil Verse Text (Optional)</label>
                  <textarea
                    rows={3}
                    value={formData.verseTextTa}
                    onChange={e => setFormData({ ...formData, verseTextTa: e.target.value })}
                    placeholder="தமிழில் வசன உரை (விருப்பமானது)"
                    className="church-input w-full text-xs sm:text-sm font-tamil"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-outline-gold text-xs px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-gold text-xs px-5 py-2 shadow-gold"
                  >
                    {isSubmitting ? 'Saving...' : editingVerse ? 'Save Changes' : 'Add Verse'}
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
