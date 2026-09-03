import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiArrowRight, FiBookOpen, FiMusic, 
  FiRotateCcw, FiRotateCw, FiPlay, FiPause, 
  FiList, FiVolume2, FiVolumeX, FiLoader 
} from 'react-icons/fi';
import { GiPrayerBeads, GiDove } from 'react-icons/gi';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import useRosaryAudio from '../../hooks/useRosaryAudio';
import RosaryAudioPlayer from './common_rosary_audio_player';
import { MYSTERIES } from '../../data/rosary_prayers';
import api, { getMediaUrl } from '../../services/api';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds === Infinity) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) {
    return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function RosaryModal({ isOpen, onClose, initialMode = 'rosary' }) {
  const { audioUrl: rosaryAudioUrl, isCustom } = useRosaryAudio();
  
  // Available Songs from Database
  const [songsList, setSongsList] = useState([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [loadingSongs, setLoadingSongs] = useState(false);

  // Modal View Mode: 'rosary' | 'finished' | 'songs'
  const [viewMode, setViewMode] = useState('rosary');
  const [autoPlayRosary, setAutoPlayRosary] = useState(true);

  // Devotional Playlist Audio State
  const devotionalAudioRef = useRef(null);
  const preloadAudioRef = useRef(null);
  const [isPlayingSong, setIsPlayingSong] = useState(false);
  const [songCurrentTime, setSongCurrentTime] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const [songIsSeeking, setSongIsSeeking] = useState(false);
  const [songSeekValue, setSongSeekValue] = useState(0);
  const [songVolume, setSongVolume] = useState(1);
  const [songIsMuted, setSongIsMuted] = useState(false);
  const [songPlaybackRate, setSongPlaybackRate] = useState(1);
  const [songIsBuffering, setSongIsBuffering] = useState(false);
  const [devotionalPlaylistStarted, setDevotionalPlaylistStarted] = useState(false);

  // Dynamic Countdown Timer State (configurable by Admin in Site Settings)
  const [totalTimerDuration, setTotalTimerDuration] = useState(10);
  const [countdown, setCountdown] = useState(10);
  const totalDurationRef = useRef(10);

  // Mutable refs to prevent effect re-triggers and stale closures
  const songsListRef = useRef([]);
  songsListRef.current = songsList;

  const playDevotionalSongRef = useRef(null);

  // Initialize preloader audio element
  useEffect(() => {
    preloadAudioRef.current = new Audio();
    return () => {
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = '';
      }
    };
  }, []);

  // Preload next song in background for instant transition
  const preloadNextSong = useCallback((index, list = songsListRef.current) => {
    const nextIndex = index + 1;
    const songs = list && list.length > 0 ? list : songsListRef.current;
    if (!songs || nextIndex >= songs.length || !songs[nextIndex]) return;
    const nextSong = songs[nextIndex];
    if (preloadAudioRef.current && nextSong?.fileUrl) {
      try {
        preloadAudioRef.current.preload = 'auto';
        preloadAudioRef.current.src = getMediaUrl(nextSong.fileUrl);
        preloadAudioRef.current.load();
      } catch (err) {
        console.warn('Preload audio error:', err);
      }
    }
  }, []);

  // Core Play Devotional Song function
  const playDevotionalSong = useCallback((index, list = songsListRef.current) => {
    const songs = list && list.length > 0 ? list : songsListRef.current;
    if (!songs || songs.length === 0 || !songs[index]) return;

    setCurrentSongIndex(index);
    setDevotionalPlaylistStarted(true);

    const song = songs[index];
    const audio = devotionalAudioRef.current;
    if (audio) {
      const songUrl = getMediaUrl(song.fileUrl);
      if (audio.src !== songUrl) {
        audio.src = songUrl;
        audio.load();
      }
      setSongIsBuffering(true);
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlayingSong(true);
            setSongIsBuffering(false);
            preloadNextSong(index, songs);
          })
          .catch((err) => {
            console.warn('Playback initiation error, waiting for canplay:', err);
            const onCanPlay = () => {
              audio.play().then(() => {
                setIsPlayingSong(true);
                setSongIsBuffering(false);
                preloadNextSong(index, songs);
              }).catch(() => {
                setSongIsBuffering(false);
              });
            };
            audio.addEventListener('canplay', onCanPlay, { once: true });
          });
      }
    }
    preloadNextSong(index, songs);
  }, [preloadNextSong]);

  playDevotionalSongRef.current = playDevotionalSong;

  // Fetch active songs from API
  const fetchActiveSongs = useCallback(async (shouldAutoPlay = false) => {
    try {
      setLoadingSongs(true);
      const res = await api.get('/rosary-songs');
      const fetchedSongs = (res.data && res.data.songs && res.data.songs.length > 0) 
        ? res.data.songs 
        : [];
      setSongsList(fetchedSongs);
      songsListRef.current = fetchedSongs;

      if (shouldAutoPlay && fetchedSongs.length > 0) {
        playDevotionalSong(0, fetchedSongs);
      }
      return fetchedSongs;
    } catch {
      setSongsList([]);
      songsListRef.current = [];
      return [];
    } finally {
      setLoadingSongs(false);
    }
  }, [playDevotionalSong]);

  // Fetch Admin Configured Timer Duration
  const fetchTimerSetting = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      const customSeconds = parseInt(res.data?.settings?.rosaryAutoPlayTimer);
      if (customSeconds && !isNaN(customSeconds) && customSeconds > 0) {
        setTotalTimerDuration(customSeconds);
        totalDurationRef.current = customSeconds;
      }
    } catch (_) {}
  }, []);

  // Listen for dynamic settings update
  useEffect(() => {
    const handleSettingsUpdated = () => {
      fetchTimerSetting();
    };
    window.addEventListener('site-settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('site-settings-updated', handleSettingsUpdated);
    };
  }, [fetchTimerSetting]);

  // When modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      fetchTimerSetting();
      if (initialMode === 'songs') {
        setViewMode('songs');
        setAutoPlayRosary(false);
        fetchActiveSongs(true);
      } else {
        setViewMode('rosary');
        setAutoPlayRosary(true);
        fetchActiveSongs(false);
      }
    } else {
      // Modal Closed -> Pause and Reset All Audio
      if (devotionalAudioRef.current) {
        devotionalAudioRef.current.pause();
        devotionalAudioRef.current.currentTime = 0;
      }
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = '';
      }
      setIsPlayingSong(false);
      setDevotionalPlaylistStarted(false);
      setCurrentSongIndex(0);
      setSongCurrentTime(0);
      setSongSeekValue(0);
      setAutoPlayRosary(false);
    }
  }, [isOpen, initialMode]); // Stably dependent only on isOpen and initialMode

  // Devotional Audio Element Event Listeners
  useEffect(() => {
    const audio = devotionalAudioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setSongDuration(audio.duration);
      }
      setSongIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      if (!songIsSeeking) {
        setSongCurrentTime(audio.currentTime);
        setSongSeekValue(audio.currentTime);
      }
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity && songDuration !== audio.duration) {
        setSongDuration(audio.duration);
      }
      if (songIsBuffering) setSongIsBuffering(false);
    };

    const handlePlay = () => {
      setIsPlayingSong(true);
      setSongIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlayingSong(false);
      setSongIsBuffering(false);
    };

    // Automatic continuous transition: When current song ends, immediately play next song
    const handleEnded = () => {
      setIsPlayingSong(false);
      setSongIsBuffering(false);
      setSongCurrentTime(0);
      setSongSeekValue(0);

      const songs = songsListRef.current;
      const nextIndex = currentSongIndex + 1;
      if (nextIndex < songs.length) {
        // Immediately start next song in continuous playlist
        if (playDevotionalSongRef.current) {
          playDevotionalSongRef.current(nextIndex, songs);
        }
      } else {
        // All songs completed -> reset to beginning
        setDevotionalPlaylistStarted(false);
        setCurrentSongIndex(0);
      }
    };

    const handleWaiting = () => {
      if (isPlayingSong) setSongIsBuffering(true);
    };

    const handleCanPlay = () => {
      setSongIsBuffering(false);
      if (audio.duration && !isNaN(audio.duration)) {
        setSongDuration(audio.duration);
      }
    };

    const handleError = () => {
      setSongIsBuffering(false);
      setIsPlayingSong(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [currentSongIndex, songIsSeeking, songDuration, isPlayingSong]);

  // Current Song Metadata
  const currentSongTitle = useMemo(() => {
    if (songsList.length > 0 && songsList[currentSongIndex]) {
      return songsList[currentSongIndex].title;
    }
    return "Tamil Devotional Song";
  }, [songsList, currentSongIndex]);

  // Today's mystery based on Catholic calendar
  const todayMystery = useMemo(() => {
    const day = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    if (day === 1 || day === 6) return MYSTERIES[0]; // Joyful (Mon, Sat)
    if (day === 2 || day === 5) return MYSTERIES[1]; // Sorrowful (Tue, Fri)
    if (day === 4) return MYSTERIES[3]; // Luminous (Thu)
    return MYSTERIES[2]; // Glorious (Wed, Sun)
  }, []);

  const dayName = useMemo(() => {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  }, []);

  // Handle Modal Close
  const handleClose = () => {
    if (devotionalAudioRef.current) {
      devotionalAudioRef.current.pause();
      devotionalAudioRef.current.currentTime = 0;
    }
    if (preloadAudioRef.current) {
      preloadAudioRef.current.src = '';
    }
    setIsPlayingSong(false);
    setDevotionalPlaylistStarted(false);
    setCurrentSongIndex(0);
    setViewMode('rosary');
    setAutoPlayRosary(false);
    setCountdown(totalDurationRef.current || totalTimerDuration || 10);
    onClose();
  };

  // When Rosary Audio ends -> trigger finished view & start countdown timer
  const handleRosaryEnded = () => {
    setAutoPlayRosary(false);
    const startDuration = totalDurationRef.current || totalTimerDuration || 10;
    setCountdown(startDuration);
    setViewMode('finished');
    
    // Preload Song 1 in background so it starts instantaneously when timer hits 0
    if (songsListRef.current.length > 0 && songsListRef.current[0]) {
      if (preloadAudioRef.current && songsListRef.current[0].fileUrl) {
        try {
          preloadAudioRef.current.preload = 'auto';
          preloadAudioRef.current.src = getMediaUrl(songsListRef.current[0].fileUrl);
          preloadAudioRef.current.load();
        } catch (_) {}
      }
    }
  };

  // Dedicated, stable countdown timer effect on finished screen
  // Counts down 10 -> 9 -> 8 -> ... -> 0, then automatically transitions and plays devotional songs
  useEffect(() => {
    if (viewMode !== 'finished' || !isOpen) return;

    const startSeconds = totalDurationRef.current || totalTimerDuration || 10;
    setCountdown(startSeconds);

    let remaining = startSeconds;

    const intervalId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalId);
        setCountdown(0);
        // Timer reached 0: Automatically switch to devotional songs mode and play immediately!
        setAutoPlayRosary(false);
        setViewMode('songs');
        if (playDevotionalSongRef.current) {
          playDevotionalSongRef.current(0);
        }
      } else {
        setCountdown(remaining);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [viewMode, isOpen]); // ONLY depend on viewMode and isOpen for stability

  // Replay Rosary: Stop devotional songs and switch back to Rosary
  const handleReplayRosary = () => {
    if (devotionalAudioRef.current) {
      devotionalAudioRef.current.pause();
      devotionalAudioRef.current.currentTime = 0;
    }
    setIsPlayingSong(false);
    setDevotionalPlaylistStarted(false);
    setCurrentSongIndex(0);
    setAutoPlayRosary(true);
    setCountdown(totalDurationRef.current || totalTimerDuration || 10);
    setViewMode('rosary');
  };

  // Switch to Devotional Songs mode & start playing Song 1 immediately (skips remaining timer)
  const handleSwitchToSongs = () => {
    setAutoPlayRosary(false);
    setViewMode('songs');
    if (!isPlayingSong && playDevotionalSongRef.current) {
      playDevotionalSongRef.current(0);
    }
  };

  // User selects an individual song from playlist
  const handleSelectSong = (idx) => {
    playDevotionalSong(idx);
  };

  // Toggle Devotional Play / Pause
  const toggleDevotionalPlay = () => {
    const audio = devotionalAudioRef.current;
    if (!audio) return;
    if (isPlayingSong) {
      audio.pause();
    } else {
      setSongIsBuffering(true);
      if (!audio.src || audio.src === window.location.href) {
        playDevotionalSong(currentSongIndex);
      } else {
        audio.play()
          .then(() => {
            setIsPlayingSong(true);
            setSongIsBuffering(false);
            setDevotionalPlaylistStarted(true);
            preloadNextSong(currentSongIndex);
          })
          .catch((err) => {
            console.warn('Audio play prevented:', err);
            setSongIsBuffering(false);
          });
      }
    }
  };

  const skipSongTime = (amount) => {
    const audio = devotionalAudioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(audio.currentTime + amount, songDuration || 99999));
    audio.currentTime = target;
    setSongCurrentTime(target);
    setSongSeekValue(target);
  };

  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    setSongSeekValue(val);
  };

  const handleSeekStart = () => {
    setSongIsSeeking(true);
  };

  const handleSeekEnd = (e) => {
    const val = parseFloat(e.target.value);
    const audio = devotionalAudioRef.current;
    if (audio) {
      audio.currentTime = val;
      setSongCurrentTime(val);
    }
    setSongIsSeeking(false);
  };

  const toggleMute = () => {
    const audio = devotionalAudioRef.current;
    if (!audio) return;
    const newMuted = !songIsMuted;
    setSongIsMuted(newMuted);
    audio.muted = newMuted;
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    const audio = devotionalAudioRef.current;
    if (!audio) return;
    setSongVolume(val);
    audio.volume = val;
    setSongIsMuted(val === 0);
  };

  const togglePlaybackRate = () => {
    const audio = devotionalAudioRef.current;
    if (!audio) return;
    const rates = [1, 1.25, 1.5, 0.75];
    const nextRate = rates[(rates.indexOf(songPlaybackRate) + 1) % rates.length];
    audio.playbackRate = nextRate;
    setSongPlaybackRate(nextRate);
  };

  const songProgressPercent = songDuration > 0 ? (songSeekValue / songDuration) * 100 : 0;

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white w-full max-w-md max-h-[94vh] rounded-3xl shadow-2xl overflow-hidden border border-gray-100 my-auto z-10 flex flex-col"
        >
          {/* Single Persistent Native Audio for Continuous Devotional Playlist */}
          <audio 
            ref={devotionalAudioRef} 
            id="navbarDevotionalAudio"
            preload="auto"
          />

          {/* 1. Header */}
          <div className="bg-gradient-to-br from-church-royal-blue via-blue-900 to-indigo-950 px-4 py-3.5 sm:py-4 text-center text-white relative flex-shrink-0">
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-all cursor-pointer"
              title="Close"
            >
              <FiX className="text-lg" />
            </button>
            <div className="w-10 h-10 bg-church-gold rounded-xl flex items-center justify-center mx-auto mb-1.5 shadow-md shadow-amber-950/30">
              {viewMode === 'songs' ? (
                <FiMusic className="text-white text-2xl" />
              ) : viewMode === 'finished' ? (
                <GiDove className="text-white text-2xl" />
              ) : (
                <GiPrayerBeads className="text-white text-2xl" />
              )}
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight leading-tight">
              {viewMode === 'songs' 
                ? 'Devotional Songs' 
                : viewMode === 'finished' 
                ? 'Rosary Completed' 
                : 'The Holy Rosary'}
            </h3>
            <p className="text-gold-300 text-xs font-tamil font-bold">
              {viewMode === 'songs' 
                ? 'பக்திப் பாடல்கள்' 
                : viewMode === 'finished' 
                ? 'ஜெபமாலை முடிந்தது ' 
                : 'புனித ஜெபமாலை ஆடியோ'}
            </p>
          </div>



          {/* 2. Dynamic Content Area */}
          <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 flex-1">
            
            {/* VIEW MODE 1: Normal Rosary Player */}
            {viewMode === 'rosary' && (
              <>
                <div className="bg-amber-50/80 p-3 sm:p-3.5 rounded-2xl border border-amber-200/90 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                      <span className="text-[10px] sm:text-[11px] font-black text-church-royal-blue uppercase tracking-wider">
                        {isCustom ? 'Live Parish Audio' : 'Official Tamil Rosary'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-white border border-amber-200/80 px-2 py-0.5 rounded-full text-amber-900 font-bold flex-shrink-0 shadow-2xs">
                      {dayName}
                    </span>
                  </div>

                  {/* Rosary Audio Player with onEnded listener */}
                  <RosaryAudioPlayer 
                    key={`rosary-${rosaryAudioUrl}-${autoPlayRosary}`}
                    src={rosaryAudioUrl} 
                    autoPlay={autoPlayRosary} 
                    title={todayMystery.name}
                    onEnded={handleRosaryEnded}
                  />

                  {/* Mystery Today Info */}
                  <div className="mt-2 pt-2 border-t border-amber-200/70 flex flex-wrap items-center justify-between text-xs gap-1">
                    <span className="text-gray-600 font-medium text-[11px]">Today's Mystery:</span>
                    <span className="font-bold text-church-royal-blue font-tamil text-right leading-tight text-xs">
                      {todayMystery.tag}
                    </span>
                  </div>
                </div>

                {/* Mystery Decades Preview */}
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/80 text-xs">
                  <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-gray-200/60">
                    <p className="font-bold text-church-royal-blue uppercase tracking-wider flex items-center gap-1 text-[11px]">
                      <FiBookOpen className="text-church-gold flex-shrink-0" /> {todayMystery.name.split('(')[0].trim()}
                    </p>
                    <span className="text-[10px] text-gray-500 font-bold font-tamil">{todayMystery.days.split('(')[0].trim()}</span>
                  </div>
                  <ul className="space-y-1 text-gray-700 font-tamil max-h-24 sm:max-h-32 overflow-y-auto pr-1">
                    {todayMystery.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1 text-[11px] leading-snug">
                        <span className="text-church-gold font-bold flex-shrink-0">•</span>
                        <span>{item.ta}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* VIEW MODE 2: Rosary Finished Completion Screen with Animated Countdown */}
            {viewMode === 'finished' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-2 px-2 space-y-3.5"
              >
                {/* Circular Animated Countdown Timer */}
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center my-1">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r="33"
                      className="stroke-amber-100"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="33"
                      className="stroke-amber-500 transition-all duration-1000 ease-linear"
                      strokeWidth="5"
                      strokeDasharray={2 * Math.PI * 33}
                      strokeDashoffset={2 * Math.PI * 33 * (1 - Math.max(0, countdown) / (totalTimerDuration || 10))}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-mono text-base font-black text-amber-950 tracking-wider">
                      00:{countdown < 10 ? `0${countdown}` : countdown}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-amber-700 font-bold -mt-0.5">
                      Auto-play
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 font-display">
                    Rosary Completed
                  </h3>
                  <p className="text-sm font-tamil text-church-royal-blue font-bold mt-0.5">
                    ஜெபமாலை முடிந்தது 
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Songs will auto-play in <strong className="text-amber-800 font-mono">00:{countdown < 10 ? `0${countdown}` : countdown}</strong> / {totalTimerDuration} வினாடிகளில் பாடல்கள் தொடங்கும்
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSwitchToSongs}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-church-royal-blue to-indigo-900 hover:from-blue-900 hover:to-indigo-950 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-98"
                  >
                    <FiMusic className="text-base text-church-gold" />
                    <span>Play Songs Now / பாடல்கள் இசைக்க</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReplayRosary}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-98 border border-gray-200"
                  >
                    <FiRotateCcw className="text-base text-church-royal-blue" />
                    <span>Replay Rosary / மீண்டும் ஜெபமாலை</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW MODE 3: Devotional Songs Continuous Playlist Player & List */}
            {viewMode === 'songs' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                {/* Active Song Player Card */}
                <div className="bg-indigo-50/80 p-3 sm:p-3.5 rounded-2xl border border-indigo-200/90 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full ${isPlayingSong ? 'bg-indigo-600 animate-pulse' : 'bg-gray-400'} flex-shrink-0`} />
                      <span className="text-[10px] sm:text-[11px] font-black text-indigo-950 uppercase tracking-wider truncate">
                        NOW PLAYING: {currentSongTitle}
                      </span>
                    </div>
                    {songsList.length > 0 && (
                      <span className="text-[10px] bg-white border border-indigo-200 px-2 py-0.5 rounded-full text-indigo-900 font-bold flex-shrink-0 shadow-2xs">
                        {currentSongIndex + 1} / {songsList.length}
                      </span>
                    )}
                  </div>

                  {/* Devotional Continuous Audio Player UI */}
                  <div className="w-full bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-indigo-100 shadow-2xs flex flex-col gap-2.5 select-none">
                    
                    {/* 1. Full-Width Interactive Seek Slider */}
                    <div className="space-y-1 w-full">
                      <div className="relative flex items-center group w-full">
                        <input
                          type="range"
                          min="0"
                          max={songDuration || 100}
                          step="0.1"
                          value={songSeekValue}
                          onChange={handleSeekChange}
                          onMouseDown={handleSeekStart}
                          onMouseUp={handleSeekEnd}
                          onTouchStart={handleSeekStart}
                          onTouchEnd={handleSeekEnd}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-church-gold focus:outline-none"
                          style={{
                            background: `linear-gradient(to right, #d4a017 0%, #d4a017 ${songProgressPercent}%, #e2e8f0 ${songProgressPercent}%, #e2e8f0 100%)`
                          }}
                          title="Drag or tap to seek audio position"
                        />
                      </div>

                      {/* Timestamps */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 tracking-wide font-mono px-0.5">
                        <span className="text-indigo-900">{formatTime(songSeekValue)}</span>
                        <span>{formatTime(songDuration)}</span>
                      </div>
                    </div>

                    {/* 2. Audio Control Buttons Single Row */}
                    <div className="flex items-center justify-between gap-1 sm:gap-2 pt-1.5 border-t border-gray-100">
                      
                      {/* Left Controls: Rewind, Play/Pause, Forward */}
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        {/* Rewind -10s */}
                        <button
                          type="button"
                          onClick={() => skipSongTime(-10)}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold transition-all cursor-pointer active:scale-90"
                          title="Rewind 10 seconds"
                        >
                          <FiRotateCcw className="text-xs sm:text-sm" />
                        </button>

                        {/* Primary Play / Pause Button */}
                        <button
                          type="button"
                          onClick={toggleDevotionalPlay}
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-church-royal-blue to-indigo-900 hover:from-blue-900 hover:to-indigo-950 text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
                          title={isPlayingSong ? 'Pause' : 'Play'}
                        >
                          {songIsBuffering ? (
                            <FiLoader className="animate-spin text-sm" />
                          ) : isPlayingSong ? (
                            <FiPause className="text-sm sm:text-base" />
                          ) : (
                            <FiPlay className="text-sm sm:text-base translate-x-0.5" />
                          )}
                        </button>

                        {/* Forward +10s */}
                        <button
                          type="button"
                          onClick={() => skipSongTime(10)}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold transition-all cursor-pointer active:scale-90"
                          title="Fast forward 10 seconds"
                        >
                          <FiRotateCw className="text-xs sm:text-sm" />
                        </button>
                      </div>

                      {/* Right Controls: Playback Speed & Volume */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Speed Toggle */}
                        <button
                          type="button"
                          onClick={togglePlaybackRate}
                          className="px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] sm:text-[11px] font-black tracking-tight transition-all cursor-pointer"
                          title="Playback Speed"
                        >
                          {songPlaybackRate}x
                        </button>

                        {/* Volume Control */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={toggleMute}
                            className="text-gray-600 hover:text-gray-900 p-0.5 transition-colors cursor-pointer"
                            title={songIsMuted ? 'Unmute' : 'Mute'}
                          >
                            {songIsMuted || songVolume === 0 ? <FiVolumeX className="text-xs sm:text-sm" /> : <FiVolume2 className="text-xs sm:text-sm" />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={songIsMuted ? 0 : songVolume}
                            onChange={handleVolumeChange}
                            className="w-10 sm:w-14 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            title="Adjust Volume"
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Individual Song Selection List */}
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 text-xs space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-200">
                    <p className="font-bold text-church-royal-blue uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                      <FiList className="text-church-gold" /> SELECT A SONG / பாடலைத் தேர்வு செய்க
                    </p>
                    <span className="text-[10px] text-gray-500 font-bold">{songsList.length} Songs</span>
                  </div>

                  {loadingSongs ? (
                    <div className="py-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                      <FiLoader className="animate-spin text-indigo-600" />
                      <span>Loading devotional songs...</span>
                    </div>
                  ) : songsList.length === 0 ? (
                    <p className="text-xs text-gray-500 py-3 text-center font-tamil">
                      பக்திப் பாடல்கள் பதிவேற்றப்படவில்லை (No songs active)
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 sm:max-h-44 overflow-y-auto pr-1">
                      {songsList.map((song, idx) => {
                        const isSelected = idx === currentSongIndex;
                        const isCurrentlyPlaying = isSelected && isPlayingSong;
                        return (
                          <button
                            key={song._id || idx}
                            type="button"
                            onClick={() => handleSelectSong(idx)}
                            className={`w-full p-2 rounded-xl text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-indigo-600 text-white font-bold shadow-xs' 
                                : 'bg-white hover:bg-indigo-50/70 text-gray-800 border border-gray-100'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="text-xs truncate">{song.title}</span>
                            </div>
                            <span className="text-xs flex-shrink-0">
                              {isCurrentlyPlaying ? <FiPause /> : <FiPlay />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Back to Rosary Switch Button */}
                <button
                  type="button"
                  onClick={handleReplayRosary}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-all cursor-pointer border border-gray-200"
                >
                  <FiRotateCcw className="text-xs" />
                  <span> Replay Rosary / மீண்டும் ஜெபமாலை</span>
                </button>
              </motion.div>
            )}

          </div>

          {/* 3. Footer Action (Link to Dedicated Page) */}
          <div className="p-3 sm:p-4 pt-0 bg-white flex-shrink-0">
            <Link
              to="/rosary"
              onClick={handleClose}
              className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 bg-church-royal-blue hover:bg-blue-900 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all text-center cursor-pointer active:scale-98"
            >
              <span>View Full Tamil Rosary Prayers</span>
              <FiArrowRight className="text-sm" />
            </Link>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
