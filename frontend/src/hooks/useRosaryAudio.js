import { useState, useEffect, useCallback } from 'react';
import api, { getMediaUrl } from '../services/api';
import defaultRosaryAudio from '../assets/rosary.mp3';

export default function useRosaryAudio() {
  const [audioUrl, setAudioUrl] = useState(defaultRosaryAudio);
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
          setAudioUrl(defaultRosaryAudio);
          setIsCustom(false);
        }
      } else {
        setAudioUrl(defaultRosaryAudio);
        setIsCustom(false);
      }
    } catch {
      // If error or network offline, cleanly fall back to default Rosary audio asset
      setAudioUrl(defaultRosaryAudio);
      setIsCustom(false);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return { audioUrl, isCustom, loading, refreshAudio: fetchAudio, defaultAudio: defaultRosaryAudio };
}
