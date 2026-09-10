import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FiMusic, FiUpload, FiTrash2, FiPlay, FiPause, 
  FiFolderPlus, FiLoader, FiCheck, FiRefreshCw, FiClock
} from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import { GiPrayerBeads } from 'react-icons/gi';
import toast from 'react-hot-toast';
import api, { getMediaUrl } from '../../services/api';
import useRosaryAudio from '../../hooks/useRosaryAudio';
import RosaryAudioPlayer from '../common/common_rosary_audio_player';

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
  
  const zipInputRef = useRef(null);
  const individualInputRef = useRef(null);

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
    } catch (_) {}
  };

  // Fetch all songs (admin endpoint)
  const fetchSongs = async () => {
    try {
      setLoadingSongs(true);
      const res = await api.get('/rosary-songs/admin');
      if (res.data && res.data.songs) {
        setSongs(res.data.songs);
      }
    } catch {
      toast.error('Failed to load songs');
    } finally {
      setLoadingSongs(false);
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

  // Upload Songs ZIP Archive
  const handleZipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return toast.error('Please upload a valid .zip archive');
    }

    setUploadingZip(true);
    const toastId = toast.loading('Extracting audio files from ZIP archive...');
    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await api.post('/rosary-songs/zip', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(res.data.message || 'Songs extracted and saved!', { id: toastId });
      fetchSongs();
      if (zipInputRef.current) zipInputRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extract ZIP archive', { id: toastId });
    } finally {
      setUploadingZip(false);
    }
  };

  // Upload Individual Songs
  const handleIndividualUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingIndividual(true);
    const toastId = toast.loading(`Uploading ${files.length} audio file(s)...`);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));

      const res = await api.post('/rosary-songs/individual', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(res.data.message || 'Songs uploaded successfully!', { id: toastId });
      fetchSongs();
      if (individualInputRef.current) individualInputRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload songs', { id: toastId });
    } finally {
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
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold self-start sm:self-auto border ${
            isCustomRosary 
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
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                    timerSeconds === preset 
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

          {/* Action Buttons (Strictly Horizontal) */}
          <div className="flex flex-row items-center gap-2.5 flex-nowrap shrink-0">
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
              disabled={uploadingZip}
              onClick={() => zipInputRef.current?.click()}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex flex-row items-center gap-1.5 cursor-pointer border border-indigo-200 whitespace-nowrap"
              title="Upload a .zip file containing songs"
            >
              {uploadingZip ? <FiLoader className="animate-spin text-sm" /> : <FiFolderPlus className="text-sm" />}
              <span>Upload Songs ZIP</span>
            </button>

            {/* Individual Songs Upload Button */}
            <button
              type="button"
              disabled={uploadingIndividual}
              onClick={() => individualInputRef.current?.click()}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all flex flex-row items-center gap-1.5 cursor-pointer border border-purple-200 whitespace-nowrap"
              title="Select and upload multiple audio files"
            >
              {uploadingIndividual ? <FiLoader className="animate-spin text-sm" /> : <FiUpload className="text-sm" />}
              <span>Add Songs</span>
            </button>
          </div>
        </div>

        {/* Songs List */}
        {loadingSongs ? (
          <div className="py-8 text-center text-gray-400">
            <FiLoader className="animate-spin text-2xl mx-auto mb-2 text-church-royal-blue" />
            <p className="text-xs">Loading songs catalog...</p>
          </div>
        ) : songs.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-200">
            <FiMusic className="text-2xl text-gray-400 mx-auto mb-2" />
            <h4 className="font-bold text-gray-800 text-xs mb-1">No Songs Uploaded Yet</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-3">
              Upload a <strong>.zip file</strong> containing multiple songs or select individual audio files directly.
            </p>
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
                    className={`p-3.5 transition-all select-none ${
                      isDragging ? 'opacity-30 bg-blue-50 scale-[0.99]' : ''
                    } ${
                      isDragOver ? 'border-t-2 border-church-royal-blue bg-blue-50/40' : ''
                    } ${
                      song.isActive ? 'bg-white hover:bg-gray-50/70' : 'bg-gray-50/60 opacity-70'
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
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                            song.isActive 
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
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isPreviewing 
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
    </div>
  );
}
