import { useState, useRef, useEffect } from 'react';
import { 
  FiPlay, FiPause, FiRotateCcw, FiRotateCw, 
  FiVolume2, FiVolumeX, FiLoader 
} from 'react-icons/fi';

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

export default function RosaryAudioPlayer({ 
  src, 
  autoPlay = false, 
  title = "Rosary Audio",
  onEnded
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);

  // Sync with audio source changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Read duration if already cached or available
    if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
      setDuration(audio.duration);
    }

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
      setIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(audio.currentTime);
        setSeekValue(audio.currentTime);
      }
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity && duration !== audio.duration) {
        setDuration(audio.duration);
      }
      if (isBuffering) setIsBuffering(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
      setIsBuffering(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      setCurrentTime(0);
      setSeekValue(0);
      if (onEnded) onEnded();
    };

    const handleWaiting = () => {
      if (isPlaying) setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
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
  }, [src, autoPlay, isSeeking, duration, isPlaying]);

  // Handle reliable autoPlay when modal opens or autoPlay is active
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !autoPlay) return;

    let isSubscribed = true;

    const playAudio = () => {
      if (!isSubscribed) return;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (isSubscribed) {
              setIsPlaying(true);
              setIsBuffering(false);
            }
          })
          .catch((err) => {
            console.warn('AutoPlay delayed until interaction:', err.message);
          });
      }
    };

    if (audio.readyState >= 2) {
      playAudio();
    } else {
      audio.addEventListener('canplay', playAudio, { once: true });
      audio.addEventListener('loadeddata', playAudio, { once: true });
      audio.addEventListener('loadedmetadata', playAudio, { once: true });
    }

    return () => {
      isSubscribed = false;
      audio.removeEventListener('canplay', playAudio);
      audio.removeEventListener('loadeddata', playAudio);
      audio.removeEventListener('loadedmetadata', playAudio);
    };
  }, [src, autoPlay]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      setIsBuffering(true);
      audio.play()
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch((err) => {
          console.warn("Audio play prevented or interrupted:", err);
          setIsBuffering(false);
          setIsPlaying(false);
        });
    }
  };

  const skipTime = (amount) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(audio.currentTime + amount, duration || 99999));
    audio.currentTime = target;
    setCurrentTime(target);
    setSeekValue(target);
  };

  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    setSeekValue(val);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = (e) => {
    const val = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = val;
      setCurrentTime(val);
    }
    setIsSeeking(false);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audio.muted = newMuted;
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (!audio) return;
    setVolume(val);
    audio.volume = val;
    setIsMuted(val === 0);
  };

  const togglePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const rates = [1, 1.25, 1.5, 0.75];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const progressPercent = duration > 0 ? (seekValue / duration) * 100 : 0;

  return (
    <div className="w-full bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200 shadow-2xs flex flex-col gap-2.5 select-none">
      {/* Hidden Native Audio Element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* 1. Full-Width Interactive Seek Slider */}
      <div className="space-y-1 w-full">
        <div className="relative flex items-center group w-full">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={seekValue}
            onChange={handleSeekChange}
            onMouseDown={handleSeekStart}
            onMouseUp={handleSeekEnd}
            onTouchStart={handleSeekStart}
            onTouchEnd={handleSeekEnd}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-church-gold focus:outline-none"
            style={{
              background: `linear-gradient(to right, #d4a017 0%, #d4a017 ${progressPercent}%, #e2e8f0 ${progressPercent}%, #e2e8f0 100%)`
            }}
            title="Drag or tap to seek audio position"
          />
        </div>

        {/* Timestamps */}
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 tracking-wide font-mono px-0.5">
          <span className="text-church-royal-blue">{formatTime(seekValue)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 2. Audio Control Buttons Single Row */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 pt-1.5 border-t border-gray-100">
        
        {/* Left Controls: Rewind, Play/Pause, Forward */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Rewind -10s */}
          <button
            type="button"
            onClick={() => skipTime(-10)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold transition-all cursor-pointer active:scale-90"
            title="Rewind 10 seconds"
          >
            <FiRotateCcw className="text-xs sm:text-sm" />
          </button>

          {/* Primary Play / Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-church-royal-blue to-blue-900 hover:from-blue-900 hover:to-indigo-950 text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering && isPlaying ? (
              <FiLoader className="animate-spin text-sm" />
            ) : isPlaying ? (
              <FiPause className="text-sm sm:text-base" />
            ) : (
              <FiPlay className="text-sm sm:text-base translate-x-0.5" />
            )}
          </button>

          {/* Forward +10s */}
          <button
            type="button"
            onClick={() => skipTime(10)}
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
            {playbackRate}x
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              className="text-gray-600 hover:text-gray-900 p-0.5 transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <FiVolumeX className="text-xs sm:text-sm" /> : <FiVolume2 className="text-xs sm:text-sm" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-10 sm:w-14 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-church-royal-blue"
              title="Adjust Volume"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
