import { useState, useEffect, useCallback, useMemo } from 'react';
import api, { getMediaUrl } from '../services/api';

const DEFAULT_ROSARY_AUDIO_PATH = '/devotional-songs/rosary.mp3';

export default function useRosaryAudio() {
  const defaultAudio = useMemo(() => getMediaUrl(DEFAULT_ROSARY_AUDIO_PATH), []);
  const [audioUrl, setAudioUrl] = useState(defaultAudio);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAudio = useCallback(async () => {
    try {
      const res = await api.get('/settings/rosaryAudio');
      if (res.data && res.data.value) {
        const fullUrl = getMediaUrl(res.data.value);
        if (fullUrl) {
          setAudioUrl(fullUrl);
          setIsCustom(true);
        } else {
          setAudioUrl(defaultAudio);
          setIsCustom(false);
        }
      } else {
        setAudioUrl(defaultAudio);
        setIsCustom(false);
      }
    } catch {
      // If error or network offline, cleanly fall back to default Rosary audio
      setAudioUrl(defaultAudio);
      setIsCustom(false);
    } finally {
      setLoading(false);
    }
  }, [defaultAudio]);

  useEffect(() => {
    fetchAudio();

    // Listen for custom event when admin uploads/deletes rosary audio
    const handleUpdate = () => {
      fetchAudio();
    };

    window.addEventListener('site-settings-updated', handleUpdate);
    window.addEventListener('rosary-audio-updated', handleUpdate);

    return () => {
      window.removeEventListener('site-settings-updated', handleUpdate);
      window.removeEventListener('rosary-audio-updated', handleUpdate);
    };
  }, [fetchAudio]);

  return { audioUrl, isCustom, loading, refreshAudio: fetchAudio, defaultAudio };
}
