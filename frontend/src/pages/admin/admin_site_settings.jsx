import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSun, FiSettings, FiUpload, FiYoutube, FiMusic, FiImage, FiCheck, FiLoader, FiExternalLink, FiTrash2, FiTool } from 'react-icons/fi';
import { GiCrucifix, GiSpellBook } from 'react-icons/gi';
import toast from 'react-hot-toast';
import api, { UPLOADS_URL, getMediaUrl } from '../../services/api';
import DailyVersesManager from '../../components/admin/admin_daily_verses_manager';
import DailySaintManager from '../../components/admin/admin_daily_saint_manager';
import RosarySongsManager from '../../components/admin/admin_rosary_songs_manager';
import DailyNotificationManager from '../../components/admin/admin_daily_notification_manager';

const SETTING_CARDS = [
  {
    key: 'videoAdId',
    label: 'Video Widget (YouTube)',
    description: 'Paste any YouTube link or just the video ID. The ID will be extracted automatically.',
    icon: <FiYoutube className="text-2xl" />,
    color: 'bg-red-500',
    type: 'text',
    placeholder: 'Paste YouTube URL or Video ID here',
    hint: 'Supports: full URL, share link, or bare ID (e.g. wQ49o-0L1Gk)'
  },
  {
    key: 'heroImage',
    label: 'Home Page Background Image',
    description: 'Upload the main header/hero background image shown on the Home page.',
    icon: <FiImage className="text-2xl" />,
    color: 'bg-blue-600',
    type: 'file',
    accept: 'image/*',
    fileLabel: 'Upload Background Image'
  },
  {
    key: 'stJohnImage',
    label: 'St. John de Britto Image',
    description: 'Upload the image of St. John de Britto shown on the Home page.',
    icon: <GiCrucifix className="text-2xl" />,
    color: 'bg-amber-600',
    type: 'file',
    accept: 'image/*',
    fileLabel: 'Upload Saint Image'
  },
  {
    key: 'priestImage',
    label: 'Parish Priest Image',
    description: 'Upload the photo of the current Parish Priest shown on the Home page.',
    icon: <FiImage className="text-2xl" />,
    color: 'bg-green-600',
    type: 'file',
    accept: 'image/*',
    fileLabel: 'Upload Priest Photo'
  },
  {
    key: 'daily_saint_fetch_url',
    label: 'Daily Saint Fetch URL',
    description: 'The URL to fetch the daily Saint of the Day details from (e.g. Vatican News).',
    icon: <FiSun className="text-2xl" />,
    color: 'bg-indigo-600',
    type: 'text',
    placeholder: 'https://www.vaticannews.va/en/saints/{MM}/{DD}.html',
    hint: 'Default: https://www.vaticannews.va/en/saints/{MM}/{DD}.html'
  },
  {
    key: 'daily_mass_fetch_url',
    label: 'Daily Mass Readings Fetch URL',
    description: 'The URL to fetch the daily Mass readings from (e.g. Catholic Gallery).',
    icon: <GiSpellBook className="text-2xl" />,
    color: 'bg-blue-600',
    type: 'text',
    placeholder: 'https://www.catholicgallery.org/tamil-mass-readings-today/',
    hint: 'Default: https://www.catholicgallery.org/tamil-mass-readings-today/'
  },
  {
    key: 'daily_reflection_fetch_url',
    label: 'Daily Reflection Fetch URL',
    description: 'The URL to fetch the daily “இன்றைய சிந்தனை” from Tamil Catholic Daily.',
    icon: <GiSpellBook className="text-2xl" />,
    color: 'bg-emerald-600',
    type: 'text',
    placeholder: 'https://www.tamilcatholicdaily.com/dailyverse',
    hint: 'Default: https://www.tamilcatholicdaily.com/dailyverse'
  },
  {
    key: 'donation_upi_id',
    label: 'Donation UPI ID',
    description: 'The Church UPI VPA address used for online donations and QR payments.',
    icon: <FiSettings className="text-2xl" />,
    color: 'bg-amber-600',
    type: 'text',
    placeholder: 'e.g. 112520120 or church@upi',
    hint: 'Environment fallback: DONATION_UPI_ID'
  },
  {
    key: 'whatsapp_bot_phone_number',
    label: 'WhatsApp Bot Phone Number',
    description: 'The official WhatsApp bot contact number for public widgets and test links.',
    icon: <FiTool className="text-2xl" />,
    color: 'bg-emerald-600',
    type: 'text',
    placeholder: 'e.g. 919655639144',
    hint: 'Environment fallback: WHATSAPP_BOT_PHONE_NUMBER'
  },
];

function extractYouTubeId(input) {
  if (!input) return '';
  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = input.match(re);
    if (m) return m[1];
  }
  return input.split(/[?&]/)[0].trim();
}

function SettingCard({ setting, currentValue, onValueUpdate }) {
  const [textValue, setTextValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (setting.type === 'text' && currentValue !== undefined) {
      setTextValue(currentValue || '');
      setDebouncedValue(currentValue || '');
    }
  }, [currentValue, setting.type]);

  // Debounce input to prevent typing lag caused by iframe re-rendering
  useEffect(() => {
    if (setting.type !== 'text') return;
    const timer = setTimeout(() => {
      setDebouncedValue(textValue);
    }, 350);
    return () => clearTimeout(timer);
  }, [textValue, setting.type]);

  const extractedId = useMemo(() => {
    return setting.key === 'videoAdId' ? extractYouTubeId(debouncedValue) : debouncedValue;
  }, [debouncedValue, setting.key]);

  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    if (currentValue && setting.type === 'file') {
      return getMediaUrl(currentValue);
    }
    return null;
  }, [file, currentValue, setting.type]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (setting.type === 'text') {
        if (!textValue.trim()) return toast.error('Please enter a value');
        const valueToSave = setting.key === 'videoAdId' ? extractYouTubeId(textValue) : textValue.trim();
        if (!valueToSave) return toast.error('Could not extract a valid YouTube ID.');

        await api.post('/settings/text', { key: setting.key, value: valueToSave, label: setting.label });
        setTextValue(valueToSave);
        setDebouncedValue(valueToSave);
        if (onValueUpdate) onValueUpdate(setting.key, valueToSave);
        window.dispatchEvent(new CustomEvent('site-settings-updated'));
        toast.success(`${setting.label} updated!`);
      } else {
        if (!file) return toast.error('Please select a file first');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('key', setting.key);
        fd.append('label', setting.label);
        const res = await api.post('/settings/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success(`${setting.label} uploaded!`);
        if (onValueUpdate && res.data.filePath) onValueUpdate(setting.key, res.data.filePath);
        window.dispatchEvent(new CustomEvent('site-settings-updated'));
        if (setting.key === 'rosaryAudio') {
          window.dispatchEvent(new CustomEvent('rosary-audio-updated', { detail: res.data.filePath }));
        }
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Are you sure you want to remove ${setting.label}? It will revert to default.`)) return;
    setRemoving(true);
    try {
      await api.delete(`/settings/${setting.key}`);
      setTextValue('');
      setDebouncedValue('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      if (onValueUpdate) onValueUpdate(setting.key, null);
      window.dispatchEvent(new CustomEvent('site-settings-updated'));
      if (setting.key === 'rosaryAudio') {
        window.dispatchEvent(new CustomEvent('rosary-audio-updated', { detail: null }));
      }
      toast.success(`${setting.label} removed! Reverted to default.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove setting');
    } finally {
      setRemoving(false);
    }
  };

  const hasConfiguredValue = Boolean(currentValue || file || (setting.type === 'text' && textValue.trim()));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
      <div>
        <div className={`${setting.color} p-4 flex items-center justify-between text-white`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              {setting.icon}
            </div>
            <div>
              <p className="font-bold text-base leading-tight">{setting.label}</p>
              <p className="text-white/70 text-xs">{setting.type === 'text' ? 'Text Setting' : 'File Upload'}</p>
            </div>
          </div>
          {hasConfiguredValue && (
            <span className="text-[10px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Customized
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          <p className="text-gray-500 text-xs leading-relaxed">{setting.description}</p>

          {setting.type === 'text' ? (
            <>
              <input
                type="text"
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                placeholder={setting.placeholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-church-gold transition-colors font-medium text-gray-800"
              />
              {setting.hint && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <FiExternalLink className="flex-shrink-0" /> {setting.hint}
                </p>
              )}
              {debouncedValue && setting.key === 'videoAdId' && extractedId && (
                <>
                  <div className="aspect-video rounded-xl overflow-hidden border border-gray-100 bg-black/5">
                    <iframe
                      key={extractedId}
                      src={`https://www.youtube-nocookie.com/embed/${extractedId}?mute=1`}
                      className="w-full h-full"
                      title="Preview"
                      loading="lazy"
                      frameBorder="0"
                      allow="accelerometer; autoplay"
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <label
                htmlFor={`file-${setting.key}`}
                className="flex items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-xl py-5 cursor-pointer hover:border-church-gold hover:bg-gold-50/50 transition-all text-gray-500"
              >
                <FiUpload className="text-lg text-church-gold" />
                <span className="text-xs font-semibold text-gray-700">{file ? file.name : setting.fileLabel}</span>
                <input
                  ref={fileRef}
                  id={`file-${setting.key}`}
                  type="file"
                  accept={setting.accept}
                  className="hidden"
                  onChange={e => setFile(e.target.files[0] || null)}
                />
              </label>

              {/* Preview */}
              {previewUrl && setting.accept?.startsWith('image') && (
                <div className="rounded-xl overflow-hidden border border-gray-100 h-32 bg-gray-50">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              {previewUrl && setting.accept?.startsWith('audio') && (
                <audio controls src={previewUrl} className="w-full" />
              )}
            </>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 pt-0 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || removing}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white text-xs sm:text-sm transition-all ${saved ? 'bg-green-600' : `${setting.color} hover:brightness-110`
            } disabled:opacity-60 shadow-xs cursor-pointer`}
        >
          {saving ? <FiLoader className="animate-spin" /> : saved ? <FiCheck /> : <FiUpload />}
          <span>{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}</span>
        </button>

        {hasConfiguredValue && (
          <button
            onClick={handleRemove}
            disabled={saving || removing}
            title={`Remove custom ${setting.label}`}
            className="px-3.5 py-2.5 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {removing ? <FiLoader className="animate-spin text-sm" /> : <FiTrash2 className="text-sm" />}
            <span>Remove</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function SiteSettings() {
  const [currentValues, setCurrentValues] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/settings')
      .then(r => setCurrentValues(r.data.settings || {}))
      .catch(() => { });
  }, []);

  const handleValueUpdate = (key, newValue) => {
    setCurrentValues(prev => ({ ...prev, [key]: newValue }));
  };

  return (
    <div className="p-3.5 sm:p-6 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      {/* Top Header & Maintenance Mode Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-church-gold text-white rounded-xl flex items-center justify-center shadow-gold flex-shrink-0">
            <FiSettings className="text-xl" />
          </div>
          <div>
            <h1 className="font-display text-lg sm:text-2xl font-bold text-church-royal-blue">Site Settings</h1>
            <p className="text-gray-500 text-xs">Manage website media, branding, and dynamic CMS content.</p>
          </div>
        </div>

        <Link
          to="/admin/maintenance"
          className="flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 via-red-600 to-amber-700 hover:from-amber-700 hover:via-red-700 hover:to-amber-800 text-white rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer whitespace-nowrap group w-full sm:w-auto"
        >
          <FiTool className="text-base text-amber-200 group-hover:rotate-45 transition-transform duration-300" />
          <span>Maintenance Mode</span>
        </Link>
      </div>

      <div className="p-3.5 sm:p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-800 leading-relaxed shadow-xs">
        <strong className="text-amber-950 font-bold">Note:</strong> After updating an image or audio file, users may need to refresh the website to see the new content.
        Removing a custom upload will instantly revert that setting back to default.
      </div>

      {/* ─── 1. GENERAL SITE ASSETS & MEDIA ─── */}
      <div className="space-y-3.5 sm:space-y-4">
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold text-church-royal-blue">General Site Assets & Media</h3>
          <p className="text-xs text-gray-500">Configure core website branding, backgrounds, and hero media.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {SETTING_CARDS.map(s => (
            <SettingCard
              key={s.key}
              setting={s}
              currentValue={currentValues[s.key]}
              onValueUpdate={handleValueUpdate}
            />
          ))}
        </div>
      </div>

      {/* ─── 2. 12:00 AM IST DAILY EMAIL NOTIFICATIONS MANAGER ─── */}
      <DailyNotificationManager />

      {/* ─── 3. DAILY SAINT SCRAPER SYNC MANAGER ─── */}
      <DailySaintManager />

      {/* ─── 4. ROSARY & DEVOTIONAL SONGS MANAGEMENT (ZIP & MULTI-AUDIO) ─── */}
      <RosarySongsManager />

      {/* ─── 5. DAILY BIBLE VERSES CMS MANAGER ─── */}
      <DailyVersesManager />
    </div>
  );
}
