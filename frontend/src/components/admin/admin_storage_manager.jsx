import { useState, useEffect, useRef, useMemo } from 'react';
import {
  FiDatabase, FiHardDrive, FiTrash2, FiRefreshCw, FiAlertTriangle,
  FiCheck, FiX, FiPlay, FiPause, FiEye, FiMusic, FiFileText,
  FiImage, FiLayers, FiInfo, FiSliders, FiClock, FiHelpCircle,
  FiChevronDown, FiChevronUp, FiSearch, FiShield
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api, { getMediaUrl } from '../../services/api';

export default function StorageManager() {
  const [loading, setLoading] = useState(false);
  const [storageData, setStorageData] = useState(null);
  const [activeTab, setActiveTab] = useState('unreferenced'); // 'unreferenced' | 'duplicates' | 'inuse' | 'all' | 'logs'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Audio playback state
  const audioRef = useRef(null);
  const [playingUrl, setPlayingUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Inspect File Modal
  const [inspectingFile, setInspectingFile] = useState(null);

  // Explainer toggle
  const [showStorageExplainer, setShowStorageExplainer] = useState(false);

  // Log Retention state
  const [logsData, setLogsData] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [cleaningLogs, setCleaningLogs] = useState(false);

  const fetchStorageData = async (showToast = false) => {
    setLoading(true);
    const toastId = showToast ? toast.loading('Auditing MongoDB GridFS storage...') : null;
    try {
      const res = await api.get('/admin/storage/gridfs');
      if (res.data?.success) {
        setStorageData(res.data.data);
        setSelectedIds(new Set());
        if (showToast) toast.success('GridFS storage scan complete!', { id: toastId });
      }
    } catch (err) {
      console.error('Storage audit error:', err);
      if (showToast) toast.error(err.response?.data?.message || 'Failed to scan GridFS storage', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const fetchLogsData = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get('/admin/storage/logs');
      if (res.data?.success) {
        setLogsData(res.data.data);
      }
    } catch (err) {
      console.error('Logs fetch error:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchStorageData(false);
    fetchLogsData();
  }, []);

  // Audio Play / Pause handler
  const handleTogglePlay = (url) => {
    if (!url) return;
    const fullUrl = getMediaUrl(url);

    if (playingUrl === fullUrl && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.src = fullUrl;
        audioRef.current.play().then(() => {
          setPlayingUrl(fullUrl);
          setIsPlaying(true);
        }).catch(() => {
          toast.error('Could not play audio preview');
          setIsPlaying(false);
        });
      }
    }
  };

  // Selection handlers
  const handleToggleSelect = (id, inUse) => {
    if (inUse) return; // Cannot select files in use
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllRemovable = () => {
    const removableFiles = displayedFiles.filter(f => !f.inUse);
    const allSelected = removableFiles.length > 0 && removableFiles.every(f => selectedIds.has(f._id));

    const next = new Set(selectedIds);
    if (allSelected) {
      removableFiles.forEach(f => next.delete(f._id));
    } else {
      removableFiles.forEach(f => next.add(f._id));
    }
    setSelectedIds(next);
  };

  // Filtered and searched files
  const displayedFiles = useMemo(() => {
    if (!storageData?.files) return [];
    let list = storageData.files;

    if (activeTab === 'unreferenced') {
      list = list.filter(f => !f.inUse);
    } else if (activeTab === 'inuse') {
      list = list.filter(f => f.inUse);
    } else if (activeTab === 'duplicates') {
      const duplicateIds = new Set(
        (storageData.duplicateGroups || []).flatMap(g => g.files.map(f => f._id))
      );
      list = list.filter(f => duplicateIds.has(f._id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.originalName?.toLowerCase().includes(q) ||
        f.filename?.toLowerCase().includes(q) ||
        f._id?.toLowerCase().includes(q) ||
        f.contentType?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [storageData, activeTab, searchQuery]);

  // Selected files summary
  const selectedFilesList = useMemo(() => {
    if (!storageData?.files) return [];
    return storageData.files.filter(f => selectedIds.has(f._id));
  }, [storageData, selectedIds]);

  const selectedTotalBytes = useMemo(() => {
    return selectedFilesList.reduce((acc, f) => acc + (f.length || 0), 0);
  }, [selectedFilesList]);

  const selectedTotalMB = (selectedTotalBytes / (1024 * 1024)).toFixed(2);

  // Execute safe deletion
  const handleConfirmPermanentDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Permanently deleting ${selectedIds.size} GridFS file(s)...`);

    try {
      const res = await api.post('/admin/storage/gridfs/delete', {
        fileIds: Array.from(selectedIds),
        confirmPermanent: true
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Files safely deleted from GridFS!', { id: toastId });
        setShowDeleteModal(false);
        setDeleteConfirmationText('');
        setSelectedIds(new Set());
        setInspectingFile(null);
        if (playingUrl && audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
          setPlayingUrl(null);
        }
        await fetchStorageData(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete selected files', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  // Log cleanup handler
  const handleCleanupLogs = async () => {
    if (!window.confirm(`Are you sure you want to purge log records older than ${retentionDays} days? This cannot be undone.`)) {
      return;
    }
    setCleaningLogs(true);
    const toastId = toast.loading(`Cleaning up logs older than ${retentionDays} days...`);
    try {
      const res = await api.post('/admin/storage/logs/cleanup', { retentionDays });
      if (res.data?.success) {
        toast.success(res.data.message, { id: toastId });
        await fetchLogsData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clean up logs', { id: toastId });
    } finally {
      setCleaningLogs(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mt-8" id="storage-manager-section">
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg text-lg">
              <FiHardDrive />
            </span>
            <h2 className="text-xl font-bold text-slate-800">MongoDB GridFS Storage Manager</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Safe binary storage diagnostics, duplicate detection, and unreferenced orphan cleanup for uploads.files & uploads.chunks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStorageExplainer(!showStorageExplainer)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            <FiHelpCircle />
            <span>Storage Guide</span>
            {showStorageExplainer ? <FiChevronUp /> : <FiChevronDown />}
          </button>

          <button
            onClick={() => fetchStorageData(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Scanning...' : 'Scan Storage'}</span>
          </button>
        </div>
      </div>

      {/* Storage Explainer Collapsible Banner */}
      {showStorageExplainer && (
        <div className="mt-4 p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-slate-700 space-y-2 animate-in fade-in">
          <div className="font-bold text-indigo-900 flex items-center gap-1.5">
            <FiInfo className="text-indigo-600" />
            <span>Understanding MongoDB Atlas Storage vs. GridFS Data Size</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-white p-3 rounded-lg border border-indigo-100">
              <span className="font-bold text-slate-800 block mb-1">1. Why does Atlas show ~392 MB while GridFS reports ~224 MB?</span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                <strong>Data Size (223.9 MB / 362.9 MB):</strong> The uncompressed binary bytes of files stored in GridFS.<br />
                <strong>Storage Size (392.4 MB):</strong> The physical disk space allocated by MongoDB WiredTiger, including 256 KB chunk pre-allocation extents and indexes (<code>files_id_1_n_1</code>). Also, the active Atlas cluster has 67 files vs 45 on local test DB.
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-indigo-100">
              <span className="font-bold text-slate-800 block mb-1">2. How WiredTiger reclaims deleted space</span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                When you delete files using this Storage Manager, MongoDB deletes both the <code>uploads.files</code> document and all binary <code>uploads.chunks</code>. WiredTiger marks those disk blocks as <em>free reuse space</em>, preventing future uploads from expanding your cluster.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Storage Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        {/* Total Storage */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total GridFS</span>
            <FiDatabase className="text-slate-500" />
          </div>
          <div className="text-xl font-black text-slate-800">
            {storageData?.totalFormatted || '...'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {storageData?.totalFiles || 0} total files
          </div>
        </div>

        {/* Active In-Use */}
        <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-xl">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active In-Use</span>
            <FiCheck className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-800">
            {storageData?.activeCount || 0}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">
            Protected from deletion
          </div>
        </div>

        {/* Unreferenced Orphans */}
        <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unreferenced</span>
            <FiAlertTriangle className="text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-800">
            {storageData?.orphanCount || 0}
          </div>
          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
            {storageData?.orphanFormatted || '0 Bytes'} unreferenced
          </div>
        </div>

        {/* Duplicate Groups */}
        <div className="p-4 bg-purple-50/50 border border-purple-200/60 rounded-xl">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Duplicate Groups</span>
            <FiLayers className="text-purple-600" />
          </div>
          <div className="text-xl font-black text-purple-800">
            {storageData?.duplicateGroupCount || 0}
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-0.5">
            {storageData?.duplicateReclaimableFormatted || '0 Bytes'} duplicates
          </div>
        </div>

        {/* Safe Reclaimable Potential */}
        <div className="p-4 bg-rose-50/50 border border-rose-200/60 rounded-xl col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Removable</span>
            <FiTrash2 className="text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-800">
            {storageData?.orphanFormatted || '0 Bytes'}
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">
            Select files to delete
          </div>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('unreferenced')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'unreferenced' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Unreferenced Files</span>
            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px]">
              {storageData?.orphanCount || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('duplicates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'duplicates' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Duplicate Groups</span>
            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded-full text-[10px]">
              {storageData?.duplicateGroupCount || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inuse')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'inuse' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Active In-Use</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
              {storageData?.activeCount || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Files</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
              {storageData?.totalFiles || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'logs' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Log Retention</span>
            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[10px]">
              Policy
            </span>
          </button>
        </div>

        {/* Actions & Search */}
        {activeTab !== 'logs' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-2.5 text-slate-400 text-xs" />
              <input
                type="text"
                placeholder="Search filename or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-48 md:w-60"
              />
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm animate-pulse"
              >
                <FiTrash2 />
                <span>Delete {selectedIds.size} Selected ({selectedTotalMB} MB)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'logs' ? (
        /* Log Retention Section */
        <div className="mt-6 border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FiClock className="text-indigo-600" />
                <span>System Logs & Retention Policy</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically purges aged notification logs and delivery history older than your configured threshold without deleting live user activity or security incidents.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-600">Retain:</label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700"
              >
                <option value={30}>30 Days (Aggressive)</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days (Recommended)</option>
                <option value={180}>180 Days (Conservative)</option>
              </select>

              <button
                onClick={handleCleanupLogs}
                disabled={cleaningLogs}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                {cleaningLogs ? 'Cleaning...' : `Purge > ${retentionDays} Days`}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {(logsData?.collections || []).map((col) => (
              <div key={col.name} className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[11px] text-slate-500 font-bold uppercase">{col.label}</div>
                <div className="text-lg font-black text-slate-800 mt-1">{col.count} records</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {col.oldestDate ? `Oldest: ${new Date(col.oldestDate).toLocaleDateString('en-IN')}` : 'No date recorded'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'duplicates' && (storageData?.duplicateGroups || []).length > 0 ? (
        /* Dedicated Duplicate Resolution Deck */
        <div className="mt-4 space-y-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiLayers className="text-purple-600 text-base" />
              <span>
                <strong>{storageData.duplicateGroupCount} Duplicate Groups</strong> detected by SHA-256 binary hash. Review and play each copy below, then choose which duplicate to remove.
              </span>
            </div>
            <span className="font-bold text-purple-700 bg-white px-2.5 py-1 rounded-lg border border-purple-200">
              Wasted space: {storageData.duplicateReclaimableFormatted}
            </span>
          </div>

          {storageData.duplicateGroups.map((group, groupIdx) => {
            return (
              <div key={group.hash} className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-bold text-[11px]">
                      Group #{groupIdx + 1}
                    </span>
                    <span className="font-bold text-slate-800 text-xs">
                      {group.files[0]?.originalName || group.files[0]?.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{group.count} identical copies ({group.sizePerFile} each)</span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border">
                      SHA: {group.hash.slice(0, 12)}...
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.files.map((file, fileIdx) => {
                    const isSelected = selectedIds.has(file._id);
                    const isAudio = file.contentType?.startsWith('audio/');
                    const fullMediaUrl = getMediaUrl(file.url);
                    const isCurrentPlaying = isPlaying && playingUrl === fullMediaUrl;

                    return (
                      <div
                        key={file._id}
                        className={`p-3.5 rounded-xl border transition ${
                          isSelected
                            ? 'bg-rose-50/40 border-rose-300 ring-2 ring-rose-200'
                            : file.inUse
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : 'bg-slate-50/60 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Copy #{fileIdx + 1}
                              </span>
                              {file.inUse ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px] flex items-center gap-1">
                                  <FiShield className="text-[10px]" /> KEEP (In Active Use)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[9px]">
                                  Unreferenced Duplicate
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-slate-800 text-xs truncate mt-1" title={file.originalName}>
                              {file.originalName}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Uploaded: {new Date(file.uploadDate).toLocaleDateString('en-IN')} • Size: {file.sizeFormatted}
                            </div>
                            <div className="text-[9px] font-mono text-slate-400 truncate mt-0.5">
                              ID: {file._id}
                            </div>
                          </div>

                          {/* Audio Player Button */}
                          {isAudio && (
                            <button
                              onClick={() => handleTogglePlay(file.url)}
                              className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                                isCurrentPlaying
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                              title={isCurrentPlaying ? 'Pause Audio Preview' : 'Play & Compare Audio'}
                            >
                              {isCurrentPlaying ? <FiPause /> : <FiPlay />}
                              <span className="text-[10px]">{isCurrentPlaying ? 'Pause' : 'Play'}</span>
                            </button>
                          )}
                        </div>

                        {/* Action Decision */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setInspectingFile(file)}
                            className="text-[11px] text-slate-500 hover:text-indigo-600 font-semibold flex items-center gap-1"
                          >
                            <FiEye /> Inspect File
                          </button>

                          {file.inUse ? (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                              Referenced by Website
                            </span>
                          ) : isSelected ? (
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(file._id, false)}
                              className="px-3 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold shadow-xs hover:bg-rose-700 transition flex items-center gap-1"
                            >
                              <FiCheck /> Marked for Deletion
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(file._id, false)}
                              className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                            >
                              <FiTrash2 /> Select to Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* GridFS Files Table */
        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        displayedFiles.filter(f => !f.inUse).length > 0 &&
                        displayedFiles.filter(f => !f.inUse).every(f => selectedIds.has(f._id))
                      }
                      onChange={handleSelectAllRemovable}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="p-3">File / Original Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Uploaded</th>
                  <th className="p-3">Status / Reference</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <FiRefreshCw className="animate-spin text-2xl mx-auto mb-2 text-indigo-500" />
                      <span>Scanning GridFS binary storage and cross-referencing collections...</span>
                    </td>
                  </tr>
                ) : displayedFiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <span>No files found in this category.</span>
                    </td>
                  </tr>
                ) : (
                  displayedFiles.map((file) => {
                    const isAudio = file.contentType?.startsWith('audio/');
                    const fullMediaUrl = getMediaUrl(file.url);
                    const isCurrentPlaying = isPlaying && playingUrl === fullMediaUrl;
                    const isSelected = selectedIds.has(file._id);

                    return (
                      <tr
                        key={file._id}
                        className={`hover:bg-slate-50/80 transition ${
                          isSelected ? 'bg-indigo-50/40' : file.inUse ? 'bg-white' : 'bg-amber-50/20'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={file.inUse}
                            onChange={() => handleToggleSelect(file._id, file.inUse)}
                            title={file.inUse ? 'Cannot delete file in use' : 'Select for deletion'}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* File Name */}
                        <td className="p-3">
                          <div className="font-bold text-slate-800 line-clamp-1 max-w-xs md:max-w-md" title={file.originalName}>
                            {file.originalName || file.filename}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>ID: {file._id}</span>
                            {file.sha256 && (
                              <span title={`SHA-256: ${file.sha256}`}>
                                • Hash: {file.sha256.slice(0, 10)}...
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Type */}
                        <td className="p-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            {isAudio && <FiMusic className="text-purple-600" />}
                            {file.contentType?.startsWith('image/') && <FiImage className="text-blue-600" />}
                            {file.contentType === 'application/pdf' && <FiFileText className="text-rose-600" />}
                            <span>{file.contentType?.split('/')[1]?.toUpperCase() || 'BIN'}</span>
                          </span>
                        </td>

                        {/* Size */}
                        <td className="p-3 whitespace-nowrap font-bold text-slate-700">
                          {file.sizeFormatted}
                        </td>

                        {/* Upload Date */}
                        <td className="p-3 whitespace-nowrap text-slate-500">
                          {file.uploadDate ? new Date(file.uploadDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>

                        {/* Status / Reason */}
                        <td className="p-3">
                          {file.inUse ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <FiCheck /> In Use
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                {file.references.map(r => `${r.collection}: ${r.title}`).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                <FiAlertTriangle /> Removable
                              </span>
                              <div className="text-[10px] text-amber-700 mt-0.5 line-clamp-1">
                                {file.reason}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Preview / Inspect Action */}
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAudio && (
                              <button
                                onClick={() => handleTogglePlay(file.url)}
                                className={`p-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 ${
                                  isCurrentPlaying
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
                                }`}
                                title={isCurrentPlaying ? 'Pause Audio Preview' : 'Play Audio Preview'}
                              >
                                {isCurrentPlaying ? <FiPause /> : <FiPlay />}
                                <span className="text-[10px]">{isCurrentPlaying ? 'Pause' : 'Play'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => setInspectingFile(file)}
                              className="p-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1 transition"
                              title="Inspect File Details"
                            >
                              <FiEye />
                              <span className="text-[10px]">Inspect</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Safety Notice Footer */}
      <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-2.5 text-slate-500 text-xs">
        <FiShield className="text-emerald-600 mt-0.5 text-base flex-shrink-0" />
        <div>
          <span className="font-bold text-slate-700">Safety Verification Guarantee: </span>
          Files assigned to Devotional Songs, Priests, Team Members, Users, Documents, Events, Announcements, Notifications, or Site Settings are marked <span className="text-emerald-700 font-bold">In-Use</span> and protected against deletion. Always inspect audio and file details before selecting files for deletion.
        </div>
      </div>

      {/* INSPECT FILE MODAL */}
      {inspectingFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg text-lg">
                  <FiEye />
                </span>
                <h3 className="text-base font-bold text-slate-800">File Inspection</h3>
              </div>
              <button
                onClick={() => setInspectingFile(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">File Name:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[240px]">{inspectingFile.originalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GridFS File ID:</span>
                  <span className="font-mono text-slate-700">{inspectingFile._id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Size:</span>
                  <span className="font-bold text-slate-800">{inspectingFile.sizeFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Content Type:</span>
                  <span className="text-slate-700">{inspectingFile.contentType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Uploaded On:</span>
                  <span className="text-slate-700">{new Date(inspectingFile.uploadDate).toLocaleString('en-IN')}</span>
                </div>
                {inspectingFile.sha256 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">SHA-256 Hash:</span>
                    <span className="font-mono text-[10px] text-slate-500 truncate max-w-[200px]" title={inspectingFile.sha256}>
                      {inspectingFile.sha256}
                    </span>
                  </div>
                )}
              </div>

              {/* Media Preview Box */}
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700 block mb-2">Media Preview:</span>
                {inspectingFile.contentType?.startsWith('audio/') ? (
                  <div className="space-y-2">
                    <audio
                      controls
                      src={getMediaUrl(inspectingFile.url)}
                      className="w-full"
                    />
                    <p className="text-[11px] text-slate-400 italic">
                      Listen to confirm this is an unused audio track before deletion.
                    </p>
                  </div>
                ) : inspectingFile.contentType?.startsWith('image/') ? (
                  <div className="text-center">
                    <img
                      src={getMediaUrl(inspectingFile.url)}
                      alt={inspectingFile.originalName}
                      className="max-h-48 mx-auto rounded-lg object-contain border"
                    />
                  </div>
                ) : (
                  <a
                    href={getMediaUrl(inspectingFile.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold"
                  >
                    <FiEye /> Open Document in New Tab
                  </a>
                )}
              </div>

              {/* Reference Audit Check */}
              <div className={`p-3 rounded-xl border ${
                inspectingFile.inUse ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  {inspectingFile.inUse ? <FiCheck /> : <FiAlertTriangle />}
                  <span>{inspectingFile.inUse ? 'Referenced in Database' : 'Unreferenced / Orphaned File'}</span>
                </div>
                <p className="text-[11px]">
                  {inspectingFile.inUse
                    ? `Linked to: ${inspectingFile.references.map(r => `${r.collection} (${r.title})`).join(', ')}`
                    : 'Scanned across 10 collections (RosarySong, Gallery, Priest, TeamMember, User, Document, Event, Announcement, SiteSettings, Notification). No active references found.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectingFile(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>

              {!inspectingFile.inUse && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleSelect(inspectingFile._id, false);
                    setInspectingFile(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${
                    selectedIds.has(inspectingFile._id)
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  <FiTrash2 />
                  <span>
                    {selectedIds.has(inspectingFile._id) ? 'Deselect from Deletion' : 'Select for Permanent Deletion'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <span className="p-2 bg-rose-50 rounded-lg text-lg">
                  <FiAlertTriangle />
                </span>
                <h3 className="text-base font-bold text-slate-800">Permanent deletion</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-600 space-y-2">
              <p className="font-semibold text-slate-800">
                This will permanently delete the selected file(s) and their associated GridFS chunks from MongoDB Atlas. This action cannot be undone.
              </p>
              
              <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-rose-900">
                  <span>Files selected:</span>
                  <span>{selectedFilesList.length} file(s)</span>
                </div>
                <div className="flex justify-between font-bold text-rose-900">
                  <span>Storage to reclaim:</span>
                  <span>{selectedTotalMB} MB</span>
                </div>
              </div>

              {/* List of files to be deleted */}
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1">
                {selectedFilesList.map(f => (
                  <div key={f._id} className="flex justify-between text-[11px] text-slate-600">
                    <span className="truncate max-w-[280px]" title={f.originalName}>{f.originalName}</span>
                    <span className="font-mono text-slate-500">{f.sizeFormatted}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Type <span className="font-mono text-rose-600 font-bold">DELETE</span> to confirm permanent deletion:
                </label>
                <input
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={deleteConfirmationText !== 'DELETE' || isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <FiTrash2 />
                <span>{isDeleting ? 'Deleting Permanently...' : `Permanently Delete (${selectedTotalMB} MB)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
