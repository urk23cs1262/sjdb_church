import { useState, useEffect, useRef, useMemo } from 'react';
import {
  FiMusic, FiUpload, FiTrash2, FiPlay, FiPause,
  FiFolderPlus, FiLoader, FiCheck, FiRefreshCw, FiClock,
  FiAlertTriangle, FiX
} from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import { GiPrayerBeads } from 'react-icons/gi';
import toast from 'react-hot-toast';
import api, { getMediaUrl } from '../../services/api';
import useRosaryAudio from '../../hooks/useRosaryAudio';
import RosaryAudioPlayer from '../common/common_rosary_audio_player';
import defaultDevotionalSongs from '../../data/defaultDevotionalSongs.json';

export default function RosarySongsManager() {
  const { audioUrl: currentRosaryUrl, isCustom: isCustomRosary, refreshAudio } = useRosaryAudio();

  // Rosary Audio Upload State
  const [rosaryFile, setRosaryFile] = useState(null);
  const [uploadingRosary, setUploadingRosary] = useState(false);
  const rosaryInputRef = useRef(null);

  // Auto-Play Countdown Timer State
  const [timerSeconds, setTimerSeconds] = useState(10);
  const [savingTimer, setSavingTimer] = useState(false);

  // Songs List & Upload State
  const [songs, setSongs] = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [uploadingIndividual, setUploadingIndividual] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [restoringDefaults, setRestoringDefaults] = useState(false);

  // Persistent Number Percentage & Upload Progress State
  const [uploadPercent, setUploadPercent] = useState(null);
  const [uploadStatusText, setUploadStatusText] = useState('');

  const zipInputRef = useRef(null);
  const individualInputRef = useRef(null);

  // Delete All Songs Modal State
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Duplicate Songs Resolution Modal State
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSession, setDuplicateSession] = useState(null);
  const [duplicateChoices, setDuplicateChoices] = useState({});
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [cancellingImport, setCancellingImport] = useState(false);

  // Audio Player for Duplicate Review Modal
  const modalAudioRef = useRef(null);
  const [modalPlayingUrl, setModalPlayingUrl] = useState(null);
  const [modalAudioPlaying, setModalAudioPlaying] = useState(false);

  // Audio Preview State for individual song row
  const [previewSongId, setPreviewSongId] = useState(null);

  // Drag & Drop State
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Fetch Settings (including Timer)
  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data?.settings?.rosaryAutoPlayTimer) {
        const val = parseInt(res.data.settings.rosaryAutoPlayTimer);
        if (!isNaN(val) && val > 0) setTimerSeconds(val);
      }
    } catch (_) { }
  };

  // Fetch all songs (admin endpoint)
  const fetchSongs = async () => {
    try {
      setLoadingSongs(true);
      const res = await api.get('/rosary-songs/admin');
      if (res.data && res.data.songs && res.data.songs.length > 0) {
        setSongs(res.data.songs);
      } else {
        // Fallback to default devotional songs from Devos archive
        setSongs(defaultDevotionalSongs || []);
      }
    } catch {
      setSongs(defaultDevotionalSongs || []);
    } finally {
      setLoadingSongs(false);
    }
  };

  // Restore Default Devotional Songs from Devos Archive
  const handleRestoreDefaults = async () => {
    const defaultCount = defaultDevotionalSongs?.length || 53;
    setRestoringDefaults(true);
    const toastId = toast.loading(`Restoring ${defaultCount} default devotional songs from Devos archive...`);
    try {
      const res = await api.post('/rosary-songs/restore-defaults');
      if (res.data && res.data.songs) {
        setSongs(res.data.songs);
      } else {
        setSongs(defaultDevotionalSongs || []);
      }
      toast.success(res.data?.message || `Successfully restored ${res.data?.songs?.length || defaultCount} default devotional songs!`, { id: toastId });
    } catch (err) {
      setSongs(defaultDevotionalSongs || []);
      toast.success(`Restored ${defaultCount} default devotional songs from catalog.`, { id: toastId });
    } finally {
      setRestoringDefaults(false);
    }
  };

  useEffect(() => {
    fetchSongs();
    fetchSettings();
  }, []);

  // Save Auto-Play Timer Duration
  const handleSaveTimer = async (secondsToSave) => {
    const val = Number(secondsToSave !== undefined ? secondsToSave : timerSeconds);
    if (isNaN(val) || val < 1 || val > 300) {
      return toast.error('Please enter a valid timer duration (1 to 300 seconds)');
    }
    setSavingTimer(true);
    try {
      await api.post('/settings/text', {
        key: 'rosaryAutoPlayTimer',
        value: String(val),
        label: 'Rosary Auto-Play Timer (Seconds)'
      });
      setTimerSeconds(val);
      toast.success(`Auto-play timer saved (${val} seconds)`);
      window.dispatchEvent(new CustomEvent('site-settings-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update timer');
    } finally {
      setSavingTimer(false);
    }
  };

  // Upload Rosary Audio
  const handleUploadRosary = async () => {
    if (!rosaryFile) return toast.error('Please select an audio file for Rosary');
    setUploadingRosary(true);
    try {
      const fd = new FormData();
      fd.append('file', rosaryFile);
      fd.append('key', 'rosaryAudio');
      fd.append('label', 'Tamil Rosary Audio');

      const res = await api.post('/settings/file', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Tamil Rosary Audio updated!');
      setRosaryFile(null);
      if (rosaryInputRef.current) rosaryInputRef.current.value = '';
      refreshAudio();
      window.dispatchEvent(new CustomEvent('rosary-audio-updated', { detail: res.data.filePath }));
      window.dispatchEvent(new CustomEvent('site-settings-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload Rosary audio');
    } finally {
      setUploadingRosary(false);
    }
  };

  // Revert Rosary Audio to Default
  const handleRevertRosary = async () => {
    if (!window.confirm('Revert Rosary audio to default bundled file?')) return;
    try {
      await api.delete('/settings/rosaryAudio');
      toast.success('Reverted to default Rosary audio');
      refreshAudio();
      window.dispatchEvent(new CustomEvent('rosary-audio-updated', { detail: null }));
      window.dispatchEvent(new CustomEvent('site-settings-updated'));
    } catch {
      toast.error('Failed to remove custom audio');
    }
  };

  // Stop modal preview audio
  const stopModalAudio = () => {
    if (modalAudioRef.current) {
      modalAudioRef.current.pause();
      modalAudioRef.current.currentTime = 0;
    }
    setModalPlayingUrl(null);
    setModalAudioPlaying(false);
  };

  // Toggle audio preview in Duplicate Modal
  const handleToggleModalAudio = (rawUrl) => {
    if (!rawUrl) return;
    const fullUrl = getMediaUrl(rawUrl);

    if (!modalAudioRef.current) {
      modalAudioRef.current = new Audio();
      modalAudioRef.current.onended = () => {
        setModalPlayingUrl(null);
        setModalAudioPlaying(false);
      };
      modalAudioRef.current.onerror = () => {
        toast.error('Failed to play preview audio');
        setModalPlayingUrl(null);
        setModalAudioPlaying(false);
      };
    }

    const audio = modalAudioRef.current;

    if (modalPlayingUrl === rawUrl && modalAudioPlaying) {
      audio.pause();
      setModalAudioPlaying(false);
    } else {
      audio.src = fullUrl;
      audio.play().then(() => {
        setModalPlayingUrl(rawUrl);
        setModalAudioPlaying(true);
      }).catch(err => {
        console.warn('Playback error:', err);
        setModalAudioPlaying(false);
      });
    }
  };

  // Delete All Devotional Songs
  const handleDeleteAllSongs = async () => {
    setDeletingAll(true);
    try {
      await api.delete('/rosary-songs/all');
      setSongs([]);
      setPreviewSongId(null);
      stopModalAudio();
      toast.success('All devotional songs have been permanently deleted.');
      setShowDeleteAllModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete all songs');
    } finally {
      setDeletingAll(false);
    }
  };

  // Upload Songs ZIP Archive with Duplicate Detection Flow
  const handleZipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return toast.error('Please upload a valid .zip archive');
    }

    setUploadingZip(true);
    setUploadPercent(0);
    setUploadStatusText('Uploading ZIP archive: 0%...');
    const toastId = toast.loading('Uploading ZIP: 0%...');
    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await api.post('/rosary-songs/zip', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            if (percent < 99) {
              setUploadPercent(percent);
              setUploadStatusText(`Uploading ZIP: ${percent}%...`);
              toast.loading(`Uploading ZIP: ${percent}%...`, { id: toastId });
            } else {
              setUploadPercent(99);
              setUploadStatusText('Processing & extracting songs in parallel: 99%...');
              toast.loading('Processing & extracting songs in parallel: 99%...', { id: toastId });
            }
          }
        }
      });

      if (res.data.hasDuplicates) {
        toast.dismiss(toastId);
        setUploadPercent(null);
        setUploadStatusText('');
        // Do NOT silently import duplicates -> Show review dialog
        const initialChoices = {};
        (res.data.duplicates || []).forEach(d => {
          initialChoices[d.id] = ''; // No default -> require explicit decision
        });
        setDuplicateSession({
          sessionId: res.data.sessionId,
          duplicates: res.data.duplicates || [],
          nonDuplicatesCount: res.data.nonDuplicatesCount || 0,
          totalAudioFound: res.data.totalAudioFound || 0
        });
        setDuplicateChoices(initialChoices);
        setDuplicateModalOpen(true);
      } else {
        // Keep 100% visible until songs are fetched and rendered on the page!
        setUploadPercent(100);
        setUploadStatusText('Adding extracted songs to page: 100%...');
        toast.loading('Adding extracted songs to page: 100%...', { id: toastId });
        await fetchSongs();
        toast.success(res.data.message || 'Songs extracted and added to page!', { id: toastId });
      }
      if (zipInputRef.current) zipInputRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extract ZIP archive', { id: toastId });
    } finally {
      setUploadPercent(null);
      setUploadStatusText('');
      setUploadingZip(false);
    }
  };

  // Confirm ZIP Import Choices
  const handleConfirmDuplicateImport = async () => {
    if (!duplicateSession || !duplicateSession.duplicates) return;

    const unresolved = duplicateSession.duplicates.some(d => !duplicateChoices[d.id]);
    if (unresolved) {
      return toast.error('Please select a choice (Keep Existing or Keep Uploaded) for every duplicate song before confirming.');
    }

    setConfirmingImport(true);
    setUploadPercent(100);
    setUploadStatusText('Importing & adding songs to page: 100%...');
    const toastId = toast.loading('Importing and updating songs according to your choices...');
    try {
      const res = await api.post('/rosary-songs/zip/confirm', {
        sessionId: duplicateSession.sessionId,
        choices: duplicateChoices
      });

      stopModalAudio();
      setDuplicateModalOpen(false);
      setDuplicateSession(null);
      setDuplicateChoices({});

      // Keep 100% until songs are fetched and shown on page
      toast.loading('Adding songs to page: 100%...', { id: toastId });
      await fetchSongs();
      toast.success(res.data.message || 'Import complete and songs added to page!', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm imports', { id: toastId });
    } finally {
      setConfirmingImport(false);
      setUploadPercent(null);
      setUploadStatusText('');
    }
  };

  // Cancel ZIP Import & Purge Temporary Files
  const handleCancelDuplicateImport = async () => {
    setCancellingImport(true);
    try {
      if (duplicateSession?.sessionId) {
        await api.post('/rosary-songs/zip/cancel', { sessionId: duplicateSession.sessionId });
      }
      toast.success('ZIP upload cancelled.');
    } catch (_) { } finally {
      setCancellingImport(false);
      stopModalAudio();
      setDuplicateModalOpen(false);
      setDuplicateSession(null);
      setDuplicateChoices({});
    }
  };

  // Upload Individual Songs in reliable batches
  // Upload Individual Songs with real-time percentage toast and high-speed batching
  const handleIndividualUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingIndividual(true);
    setUploadPercent(0);
    setUploadStatusText(`Uploading songs: 0% (0 of ${files.length})...`);
    const toastId = toast.loading(`Uploading songs: 0% (0 of ${files.length})...`);

    try {
      const BATCH_SIZE = 50; // Maximum efficiency for bulk uploads
      const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
      let loadedBytesPrior = 0;
      let totalUploaded = 0;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchBytes = batch.reduce((acc, f) => acc + (f.size || 0), 0);

        const fd = new FormData();
        batch.forEach(f => fd.append('files', f));

        const res = await api.post('/rosary-songs/individual', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const currentTotalLoaded = loadedBytesPrior + (progressEvent.loaded || 0);
            const overallPercent = totalBytes > 0
              ? Math.min(99, Math.round((currentTotalLoaded * 100) / totalBytes))
              : Math.round(((i + ((progressEvent.loaded || 0) / (progressEvent.total || 1)) * batch.length) / files.length) * 100);

            if (overallPercent < 99) {
              setUploadPercent(overallPercent);
              setUploadStatusText(`Uploading songs: ${overallPercent}% (${Math.min(i + batch.length, files.length)} of ${files.length})...`);
              toast.loading(`Uploading songs: ${overallPercent}% (${Math.min(i + batch.length, files.length)} of ${files.length})...`, { id: toastId });
            } else {
              setUploadPercent(99);
              setUploadStatusText(`Saving songs to database: 99% (${files.length} songs)...`);
              toast.loading(`Saving songs to database: 99% (${files.length} songs)...`, { id: toastId });
            }
          }
        });

        loadedBytesPrior += batchBytes;

        if (res.data?.songs) {
          totalUploaded += res.data.songs.length;
        }
      }

      // CRITICAL: Keep 100% number percentage visible until songs are added and shown in page!
      setUploadPercent(100);
      setUploadStatusText(`Adding ${totalUploaded} song(s) to page: 100%...`);
      toast.loading(`Adding ${totalUploaded} song(s) to page: 100%...`, { id: toastId });

      // Await fetchSongs() to ensure state is updated and DOM renders the songs
      await fetchSongs();

      toast.success(`Successfully uploaded and added ${totalUploaded} of ${files.length} song(s) to page!`, { id: toastId });
      if (individualInputRef.current) individualInputRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload songs', { id: toastId });
      await fetchSongs();
    } finally {
      setUploadPercent(null);
      setUploadStatusText('');
      setUploadingIndividual(false);
    }
  };

  // Toggle Song Active Status
  const handleToggleSong = (id) => {
    setSongs(prev => prev.map(s => s._id === id ? { ...s, isActive: !s.isActive } : s));
  };

  // Select / Deselect All Songs
  const handleSelectAll = (active) => {
    setSongs(prev => prev.map(s => ({ ...s, isActive: active })));
  };

  // Save All Song Status Changes to DB
  const handleSaveChanges = async () => {
    setSavingChanges(true);
    try {
      const updates = songs.map(s => ({ id: s._id, isActive: s.isActive }));
      await api.patch('/rosary-songs/bulk-status', { updates });
      toast.success('Songs availability updated!');
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSavingChanges(false);
    }
  };

  // Delete Song
  const handleDeleteSong = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await api.delete(`/rosary-songs/${id}`);
      toast.success('Song deleted');
      setSongs(prev => prev.filter(s => s._id !== id));
      if (previewSongId === id) setPreviewSongId(null);
    } catch {
      toast.error('Failed to delete song');
    }
  };

  // ── Drag and Drop Handlers ──
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = Array.from(songs);
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, movedItem);

    setSongs(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);

    try {
      await api.patch('/rosary-songs/reorder', {
        songIds: reordered.map(s => s._id)
      });
      toast.success('Song order updated!');
    } catch {
      toast.error('Failed to save new song order');
      fetchSongs();
    }
  };

  const activeCount = useMemo(() => songs.filter(s => s.isActive).length, [songs]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-church-royal-blue font-display flex items-center gap-2">
            <GiPrayerBeads className="text-church-gold text-xl" />
            <span>Rosary & Songs Management</span>
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Upload Tamil Rosary audio and manage post-rosary devotional songs. Drag songs to relocate and reorder.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full font-bold">
            {activeCount} Active Song{activeCount === 1 ? '' : 's'} for Users
          </span>
        </div>
      </div>

      {/* ── 1. TAMIL ROSARY AUDIO SECTION ── */}
      <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Tamil Rosary Audio (தமிழ் ஜெபமாலை)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Synchronized automatically across both the Navbar Rosary Modal and Dedicated Rosary Page.
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold self-start sm:self-auto border ${isCustomRosary
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-blue-50 text-church-royal-blue border-blue-200'
            }`}>
            {isCustomRosary ? '● Custom Upload Active' : '● Default Audio Active'}
          </span>
        </div>

        {/* Rosary Preview Player */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
          <RosaryAudioPlayer
            src={currentRosaryUrl}
            title="Tamil Rosary Audio"
          />
        </div>

        {/* Rosary Upload Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <input
            type="file"
            ref={rosaryInputRef}
            accept="audio/*"
            onChange={(e) => setRosaryFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => rosaryInputRef.current?.click()}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-gray-200 shadow-2xs"
          >
            <FiUpload className="text-sm text-church-royal-blue" />
            <span>{rosaryFile ? rosaryFile.name : 'Choose New Rosary MP3'}</span>
          </button>

          {rosaryFile && (
            <button
              type="button"
              onClick={handleUploadRosary}
              disabled={uploadingRosary}
              className="px-4 py-2 bg-church-royal-blue hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {uploadingRosary ? <FiLoader className="animate-spin text-sm" /> : <FiCheck className="text-sm" />}
              <span>Upload & Apply</span>
            </button>
          )}

          {isCustomRosary && (
            <button
              type="button"
              onClick={handleRevertRosary}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-red-200 ml-auto"
            >
              <FiRefreshCw className="text-xs" />
              <span>Revert to Default MP3</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. AUTO-PLAY COUNTDOWN TIMER SETTINGS ── */}
      <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 bg-blue-50 text-church-royal-blue rounded-xl flex-shrink-0 mt-0.5">
              <FiClock className="text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 leading-snug">
                Post-Rosary Auto-Play Timer <span className="block sm:inline text-xs font-tamil text-church-royal-blue font-bold">(தானியங்கி பாடல் டைமர்)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Set how many seconds the circular timer counts down before automatically playing devotional songs.
              </p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto shadow-2xs font-mono whitespace-nowrap">
            Active: 00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds} ({timerSeconds}s)
          </span>
        </div>

        {/* Controls Row: Quick Presets + Custom Input + Save Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          {/* Quick Presets */}
          <div className="space-y-1.5 w-full lg:w-auto">
            <span className="text-xs font-bold text-gray-500 block">Quick Presets:</span>
            <div className="grid grid-cols-5 sm:flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs w-full sm:w-auto">
              {[5, 10, 15, 20, 30].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setTimerSeconds(preset);
                    handleSaveTimer(preset);
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${timerSeconds === preset
                      ? 'bg-church-royal-blue text-white shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {preset}s
                </button>
              ))}
            </div>
          </div>

          {/* Custom Stepper Input & Save Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto pt-1 sm:pt-0">
            <div className="flex items-center justify-between sm:justify-center bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-2xs">
              <span className="text-xs text-gray-500 font-medium sm:hidden">Custom:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={timerSeconds}
                  onChange={(e) => setTimerSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-xs sm:text-sm font-mono font-bold text-gray-900 focus:outline-none text-center bg-gray-50 rounded-lg py-1 border border-gray-200"
                />
                <span className="text-xs text-gray-400 font-medium">seconds</span>
              </div>
            </div>

            <button
              type="button"
              disabled={savingTimer}
              onClick={() => handleSaveTimer()}
              className="px-5 py-2.5 bg-church-gold hover:bg-gold-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap active:scale-98"
            >
              {savingTimer ? <FiLoader className="animate-spin text-xs" /> : <FiCheck className="text-xs stroke-[2.5]" />}
              <span>Save Timer</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. POST-ROSARY SONGS MANAGEMENT ── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FiMusic className="text-church-royal-blue text-base" />
              <span>Post-Rosary Songs (பக்திப் பாடல்கள்)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload songs via ZIP or individual audio. Drag and drop songs by the handle to relocate their order.
            </p>
          </div>

          {/* Action Buttons (Responsive: 2-column grid on mobile, horizontal row on desktop) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
            {/* Hidden Inputs */}
            <input
              type="file"
              ref={zipInputRef}
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={handleZipUpload}
              className="hidden"
            />
            <input
              type="file"
              ref={individualInputRef}
              accept="audio/*"
              multiple
              onChange={handleIndividualUpload}
              className="hidden"
            />

            {/* ZIP Upload Button */}
            <button
              type="button"
              disabled={uploadingZip || uploadPercent !== null}
              onClick={() => zipInputRef.current?.click()}
              className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex flex-row items-center justify-center gap-1.5 cursor-pointer border border-indigo-200 whitespace-nowrap disabled:opacity-70 active:scale-98 shadow-2xs"
              title="Upload a .zip file containing songs"
            >
              {uploadingZip ? (
                <>
                  <FiLoader className="animate-spin text-sm shrink-0" />
                  <span className="truncate">{uploadPercent !== null ? `ZIP (${uploadPercent}%)` : 'Uploading ZIP...'}</span>
                </>
              ) : (
                <>
                  <FiFolderPlus className="text-sm shrink-0" />
                  <span className="truncate">Upload Songs ZIP</span>
                </>
              )}
            </button>

            {/* Individual Songs Upload Button */}
            <button
              type="button"
              disabled={uploadingIndividual || uploadPercent !== null}
              onClick={() => individualInputRef.current?.click()}
              className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex flex-row items-center justify-center gap-1.5 cursor-pointer border border-purple-200 whitespace-nowrap disabled:opacity-70 active:scale-98 shadow-2xs"
              title="Select and upload multiple audio files"
            >
              {uploadingIndividual ? (
                <>
                  <FiLoader className="animate-spin text-sm shrink-0" />
                  <span className="truncate">{uploadPercent !== null ? `Adding (${uploadPercent}%)` : 'Adding Songs...'}</span>
                </>
              ) : (
                <>
                  <FiUpload className="text-sm shrink-0" />
                  <span className="truncate">Add Songs</span>
                </>
              )}
            </button>

            {/* Restore Default Songs Button */}
            <button
              type="button"
              disabled={restoringDefaults || uploadPercent !== null}
              onClick={handleRestoreDefaults}
              className={`w-full sm:w-auto px-2.5 sm:px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex flex-row items-center justify-center gap-1.5 cursor-pointer border border-emerald-200 whitespace-nowrap active:scale-98 shadow-2xs ${songs.length === 0 ? 'col-span-2 sm:col-span-1' : ''}`}
              title={`Restore default devotional songs (${defaultDevotionalSongs?.length || 53}) from Devos archive`}
            >
              {restoringDefaults ? <FiLoader className="animate-spin text-sm shrink-0" /> : <FiRefreshCw className="text-sm shrink-0" />}
              <span className="truncate">Restore Defaults ({defaultDevotionalSongs?.length || 53})</span>
            </button>

            {/* Delete All Songs Button (Destructive Red Style) */}
            {songs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(true)}
                className="w-full sm:w-auto px-2.5 sm:px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex flex-row items-center justify-center gap-1.5 cursor-pointer border border-red-200 whitespace-nowrap active:scale-98 shadow-2xs"
                title="Permanently delete all devotional songs"
              >
                <FiTrash2 className="text-sm text-red-600 shrink-0" />
                <span className="truncate">Delete All Songs</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Active Upload & Processing Progress Bar (Visible until songs are loaded into page) ── */}
        {uploadPercent !== null && (
          <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-xs transition-all animate-fadeIn">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-700 shrink-0 font-bold">
                  <FiLoader className="animate-spin text-base" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                    {uploadStatusText || `Adding songs to page: ${uploadPercent}%`}
                  </p>
                  <p className="text-[11px] text-amber-800/80">
                    {uploadPercent === 100
                      ? 'Finalizing and updating songs list on page...'
                      : 'Please wait, your songs will appear below automatically once ready.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-black shadow-xs shrink-0 tracking-wider">
                <span>{uploadPercent}%</span>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="w-full bg-amber-200/60 rounded-full h-2.5 overflow-hidden p-0.5 border border-amber-300/80">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(4, Math.min(100, uploadPercent))}%` }}
              />
            </div>
          </div>
        )}

        {/* Songs List */}
        {uploadPercent !== null && songs.length === 0 ? (
          <div className="bg-amber-50/50 rounded-2xl p-8 text-center border-2 border-dashed border-amber-300 transition-all">
            <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-700 mb-3 shadow-inner">
              <FiLoader className="animate-spin text-2xl text-amber-600" />
              <span className="absolute text-[11px] font-black">{uploadPercent}%</span>
            </div>
            <h4 className="font-bold text-gray-800 text-sm mb-1">
              {uploadPercent === 100 ? 'Rendering Songs on Page...' : 'Uploading & Adding Songs...'}
            </h4>
            <p className="text-xs text-gray-600 max-w-sm mx-auto mb-2">
              {uploadStatusText || `Adding songs: ${uploadPercent}%. Almost ready to show in page...`}
            </p>
            <div className="max-w-xs mx-auto w-full bg-amber-200/50 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, Math.min(100, uploadPercent))}%` }}
              />
            </div>
          </div>
        ) : loadingSongs ? (
          <div className="py-8 text-center text-gray-400">
            <FiLoader className="animate-spin text-2xl mx-auto mb-2 text-church-royal-blue" />
            <p className="text-xs">Loading songs catalog...</p>
          </div>
        ) : songs.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-200">
            <FiMusic className="text-2xl text-gray-400 mx-auto mb-2" />
            <h4 className="font-bold text-gray-800 text-xs mb-1">No Songs In Catalog</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              Upload a <strong>.zip file</strong> containing multiple songs, select individual audio files, or restore the default devotional songs.
            </p>
            <button
              type="button"
              disabled={restoringDefaults}
              onClick={handleRestoreDefaults}
              className="px-4 py-2 bg-church-royal-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs active:scale-98"
            >
              {restoringDefaults ? <FiLoader className="animate-spin text-sm" /> : <FiRefreshCw className="text-sm" />}
              <span>Restore Default Devotional Songs ({defaultDevotionalSongs?.length || 53})</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Quick Filter & Bulk Action Toolbar */}
            <div className="flex items-center justify-between text-xs text-gray-600 px-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-church-royal-blue font-bold hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-gray-500 hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
              <span className="font-bold text-gray-500">
                {activeCount} of {songs.length} Songs Selected
              </span>
            </div>

            {/* Draggable Song Cards */}
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white overflow-hidden shadow-2xs">
              {songs.map((song, idx) => {
                const fullSongUrl = getMediaUrl(song.fileUrl);
                const isPreviewing = previewSongId === song._id;
                const isDragging = draggedIndex === idx;
                const isDragOver = dragOverIndex === idx && draggedIndex !== idx;

                return (
                  <div
                    key={song._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`p-3.5 transition-all select-none ${isDragging ? 'opacity-30 bg-blue-50 scale-[0.99]' : ''
                      } ${isDragOver ? 'border-t-2 border-church-royal-blue bg-blue-50/40' : ''
                      } ${song.isActive ? 'bg-white hover:bg-gray-50/70' : 'bg-gray-50/60 opacity-70'
                      }`}
                  >
                    {/* Top Row: Drag Handle, Checkbox, Title, Meta, Move Buttons, Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Drag Handle + Checkbox + Title + Meta */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* Drag Handle */}
                        <div
                          className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 flex items-center justify-center"
                          title="Drag up or down to relocate song"
                        >
                          <MdDragIndicator className="text-xl text-gray-400" />
                        </div>

                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleSong(song._id)}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${song.isActive
                              ? 'bg-church-royal-blue text-white shadow-2xs'
                              : 'border-2 border-gray-300 text-transparent hover:border-gray-400'
                            }`}
                          title={song.isActive ? 'Disable song' : 'Enable song'}
                        >
                          <FiCheck className="text-xs stroke-[3]" />
                        </button>

                        {/* Title & Metadata */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-400 font-bold">#{idx + 1}</span>
                            <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                              {song.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 font-mono">
                            <span className="truncate max-w-[220px]">{song.fileName}</span>
                            {song.fileSize > 0 && (
                              <>
                                <span>•</span>
                                <span>{(song.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Audio Preview + Delete */}
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">

                        {/* Preview / Stop Button */}
                        <button
                          type="button"
                          onClick={() => setPreviewSongId(isPreviewing ? null : song._id)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${isPreviewing
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                            }`}
                        >
                          {isPreviewing ? <FiPause className="text-xs" /> : <FiPlay className="text-xs" />}
                          <span>{isPreviewing ? 'Stop' : 'Preview'}</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteSong(song._id, song.title)}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors cursor-pointer border border-red-100"
                          title="Delete Song"
                        >
                          <FiTrash2 className="text-xs" />
                        </button>
                      </div>
                    </div>

                    {/* Preview Drawer */}
                    {isPreviewing && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/80">
                        <RosaryAudioPlayer
                          src={fullSongUrl}
                          autoPlay={true}
                          title={song.title}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Save Action Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={savingChanges}
                onClick={handleSaveChanges}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                {savingChanges ? <FiLoader className="animate-spin text-sm" /> : <FiCheck className="text-base" />}
                <span>Save Availability Changes</span>
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ── DELETE ALL SONGS CONFIRMATION MODAL ── */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
              <FiTrash2 className="text-2xl" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">
              Delete All Devotional Songs?
            </h3>
            <p className="text-xs text-gray-600 text-center leading-relaxed mb-6">
              This will permanently delete all uploaded devotional songs and their stored files. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deletingAll}
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAll}
                onClick={handleDeleteAllSongs}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                {deletingAll ? <FiLoader className="animate-spin text-xs" /> : <FiTrash2 className="text-xs" />}
                <span>Delete All Songs</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DUPLICATE SONGS REVIEW MODAL ── */}
      {duplicateModalOpen && duplicateSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3 bg-amber-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <FiAlertTriangle className="text-xl" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                    Duplicate Songs Found
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Some songs in the uploaded ZIP already exist. Please review the duplicates before completing the upload.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelDuplicateImport}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Cancel & Close"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Quick Batch Actions Toolbar */}
            <div className="px-4 sm:px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-gray-700">Quick 1-Click Decisions:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = {};
                    duplicateSession.duplicates.forEach(d => { next[d.id] = 'uploaded'; });
                    setDuplicateChoices(next);
                  }}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  Keep All Uploaded (Replace)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = {};
                    duplicateSession.duplicates.forEach(d => { next[d.id] = 'existing'; });
                    setDuplicateChoices(next);
                  }}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  Keep All Existing (Skip)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = {};
                    duplicateSession.duplicates.forEach(d => { next[d.id] = 'new'; });
                    setDuplicateChoices(next);
                  }}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  Import All as New (Keep Both)
                </button>
              </div>
            </div>

            {/* Scrollable Duplicate Songs List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {duplicateSession.duplicates.map((dup, index) => {
                const choice = duplicateChoices[dup.id];
                const existingPlaying = modalAudioPlaying && modalPlayingUrl === dup.existingSong?.fileUrl;
                const uploadedPlaying = modalAudioPlaying && modalPlayingUrl === dup.uploadedSong?.previewUrl;

                return (
                  <div
                    key={dup.id}
                    className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-gray-50 transition-colors space-y-3"
                  >
                    {/* Song Title Header */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-church-royal-blue bg-blue-50 px-2 py-0.5 rounded-md">
                        #{index + 1}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        🎵 {dup.title}
                      </h4>
                    </div>

                    {/* Comparative Cards: Existing vs Uploaded */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Existing Song Box */}
                      <div className={`p-3.5 rounded-xl border transition-all ${choice === 'existing'
                          ? 'bg-blue-50/70 border-church-royal-blue shadow-2xs'
                          : 'bg-white border-gray-200'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-bold uppercase tracking-wider text-gray-500">Existing Song</span>
                          <span className="text-2xs font-mono font-bold text-gray-500">
                            {(dup.existingSong.fileSize / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate mb-3" title={dup.existingSong.fileName}>
                          {dup.existingSong.fileName}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleModalAudio(dup.existingSong.fileUrl)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${existingPlaying
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                              }`}
                          >
                            {existingPlaying ? <FiPause className="text-xs" /> : <FiPlay className="text-xs" />}
                            <span>{existingPlaying ? 'Pause' : 'Play Existing'}</span>
                          </button>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="radio"
                              name={`choice_${dup.id}`}
                              value="existing"
                              checked={choice === 'existing'}
                              onChange={() => setDuplicateChoices(prev => ({ ...prev, [dup.id]: 'existing' }))}
                              className="accent-church-royal-blue w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-gray-800">Keep Existing</span>
                          </label>
                        </div>
                      </div>

                      {/* Uploaded Song Box */}
                      <div className={`p-3.5 rounded-xl border transition-all ${choice === 'uploaded'
                          ? 'bg-indigo-50/70 border-indigo-600 shadow-2xs'
                          : 'bg-white border-gray-200'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-bold uppercase tracking-wider text-indigo-600">Uploaded Song</span>
                          <span className="text-2xs font-mono font-bold text-gray-500">
                            {(dup.uploadedSong.fileSize / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate mb-3" title={dup.uploadedSong.fileName}>
                          {dup.uploadedSong.fileName}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleModalAudio(dup.uploadedSong.previewUrl)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${uploadedPlaying
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                              }`}
                          >
                            {uploadedPlaying ? <FiPause className="text-xs" /> : <FiPlay className="text-xs" />}
                            <span>{uploadedPlaying ? 'Pause' : 'Play Uploaded'}</span>
                          </button>
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="radio"
                                name={`choice_${dup.id}`}
                                value="uploaded"
                                checked={choice === 'uploaded'}
                                onChange={() => setDuplicateChoices(prev => ({ ...prev, [dup.id]: 'uploaded' }))}
                                className="accent-indigo-600 w-3.5 h-3.5 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-gray-800">Keep Uploaded</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="radio"
                                name={`choice_${dup.id}`}
                                value="new"
                                checked={choice === 'new'}
                                onChange={() => setDuplicateChoices(prev => ({ ...prev, [dup.id]: 'new' }))}
                                className="accent-emerald-600 w-3.5 h-3.5 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-emerald-700">Keep Both</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs text-gray-600 font-medium">
                Decisions: <strong className="text-gray-900">{Object.values(duplicateChoices).filter(Boolean).length}</strong> of <strong className="text-gray-900">{duplicateSession.duplicates.length}</strong> resolved
                {duplicateSession.nonDuplicatesCount > 0 && (
                  <span className="ml-2 text-emerald-600 font-bold">
                    (+{duplicateSession.nonDuplicatesCount} non-duplicate song(s) will be imported)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={cancellingImport || confirmingImport}
                  onClick={handleCancelDuplicateImport}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {cancellingImport ? 'Cancelling...' : 'Cancel Upload'}
                </button>
                <button
                  type="button"
                  disabled={
                    confirmingImport ||
                    cancellingImport ||
                    Object.values(duplicateChoices).filter(Boolean).length < duplicateSession.duplicates.length
                  }
                  onClick={handleConfirmDuplicateImport}
                  className="px-4 py-2 bg-church-royal-blue hover:bg-blue-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                >
                  {confirmingImport ? <FiLoader className="animate-spin text-xs" /> : <FiCheck className="text-xs" />}
                  <span>Confirm & Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
