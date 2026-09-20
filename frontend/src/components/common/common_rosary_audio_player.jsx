import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  FiPlay, FiPause, FiRotateCcw, FiRotateCw, 
  FiLoader 
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

function isSameAudioSource(src1, src2) {
  if (!src1 || !src2) return false;
  if (src1 === src2) return true;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u1 = new URL(src1, origin).href;
    const u2 = new URL(src2, origin).href;
    return u1 === u2;
  } catch (_) {
    return src1 === src2;
  }
}

const RosaryAudioPlayer = forwardRef(function RosaryAudioPlayer({ 
  src, 
  autoPlay = false, 
  isOpen = true,
  title = "Rosary Audio",
  onEnded,
  onPlay
}, ref) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  // Mutable refs to keep event listeners stable across state changes
  const isSeekingRef = useRef(false);
  isSeekingRef.current = isSeeking;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Expose imperative control (e.g. pause when switching to devotional songs, play on demand)
  useImperativeHandle(ref, () => ({
    pause: () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
        setIsPlaying(false);
        setIsBuffering(false);
      }
    },
    play: () => {
      const audio = audioRef.current;
      if (!audio) return Promise.resolve();
      audio.autoplay = true;
      setIsBuffering(true);

      if (src && (!audio.src || !isSameAudioSource(audio.src, src))) {
        audio.src = src;
        audio.load();
      }

      const p = audio.play();
      if (p !== undefined) {
        return p
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          })
          .catch((err) => {
            if (err.name === 'AbortError') return;
            console.warn('Rosary play() interrupted, waiting for readyState:', err.message);
            const onReady = () => {
              audio.play().then(() => {
                setIsPlaying(true);
                setIsBuffering(false);
              }).catch(() => {
                setIsBuffering(false);
              });
            };
            if (audio.readyState >= 2) {
              onReady();
            } else {
              audio.addEventListener('canplay', onReady, { once: true });
              audio.addEventListener('loadeddata', onReady, { once: true });
            }
          });
      }
      return Promise.resolve();
    },
    get audio() {
      return audioRef.current;
    }
  }));

  // Synchronize audio.src whenever src changes & resume/start playback if active
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (!isSameAudioSource(audio.src, src)) {
      const wasPlaying = !audio.paused;
      const currentPos = audio.currentTime;
      audio.src = src;
      audio.load();

      if (wasPlaying || (autoPlay && isOpen)) {
        audio.autoplay = true;
        setIsBuffering(true);
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (wasPlaying && currentPos > 0) {
                try { audio.currentTime = currentPos; } catch (_) {}
              }
              setIsPlaying(true);
              setIsBuffering(false);
            })
            .catch((err) => {
              if (err.name === 'AbortError') return;
              console.warn('Source change play notice:', err.message);
              const onCanPlay = () => {
                audio.play().then(() => {
                  if (wasPlaying && currentPos > 0) {
                    try { audio.currentTime = currentPos; } catch (_) {}
                  }
                  setIsPlaying(true);
                  setIsBuffering(false);
                }).catch(() => {
                  setIsBuffering(false);
                });
              };
              if (audio.readyState >= 2) {
                onCanPlay();
              } else {
                audio.addEventListener('canplay', onCanPlay, { once: true });
                audio.addEventListener('loadeddata', onCanPlay, { once: true });
              }
            });
        }
      }
    }
  }, [src, isOpen, autoPlay]);

  // Handle immediate autoPlay when modal opens or autoPlay becomes true
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !autoPlay || !isOpen) return;

    audio.autoplay = true;
    let isSubscribed = true;

    if (src && (!audio.src || !isSameAudioSource(audio.src, src))) {
      audio.src = src;
      audio.load();
    }

    const startPlayback = () => {
      if (!isSubscribed) return;
      if (!audio.paused) {
        setIsPlaying(true);
        setIsBuffering(false);
        return;
      }
      setIsBuffering(true);
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
            if (err.name === 'AbortError') return;
            console.warn('AutoPlay delayed until interaction or readyState:', err.message);
            const onReady = () => {
              if (!isSubscribed) return;
              audio.play().then(() => {
                if (isSubscribed) {
                  setIsPlaying(true);
                  setIsBuffering(false);
                }
              }).catch(() => {
                if (isSubscribed) setIsBuffering(false);
              });
            };
            if (audio.readyState >= 2) {
              onReady();
            } else {
              audio.addEventListener('canplay', onReady, { once: true });
              audio.addEventListener('loadeddata', onReady, { once: true });
            }
          });
      }
    };

    if (audio.readyState >= 2) {
      startPlayback();
    } else {
      audio.addEventListener('canplay', startPlayback, { once: true });
      audio.addEventListener('loadeddata', startPlayback, { once: true });
      audio.addEventListener('loadedmetadata', startPlayback, { once: true });
    }

    return () => {
      isSubscribed = false;
      audio.removeEventListener('canplay', startPlayback);
      audio.removeEventListener('loadeddata', startPlayback);
      audio.removeEventListener('loadedmetadata', startPlayback);
    };
  }, [isOpen, autoPlay, src]);

  // Cleanly pause audio when modal closes
  useEffect(() => {
    const audio = audioRef.current;
    if (!isOpen && audio && !audio.paused) {
      audio.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    }
  }, [isOpen]);

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

  const progressPercent = duration > 0 ? (seekValue / duration) * 100 : 0;

  return (
    <div className="w-full bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-200 shadow-2xs flex flex-col gap-2.5 select-none">
      {/* Hidden Native Audio Element (managed via ref to avoid JSX reconciliation resetting the browser load algorithm) */}
      <audio 
        ref={audioRef} 
        preload="auto"
        autoPlay={autoPlay && isOpen}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && !isNaN(d) && d !== Infinity && d > 0) setDuration(d);
          setIsBuffering(false);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (d && !isNaN(d) && d !== Infinity && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (!isSeekingRef.current) {
            setCurrentTime(audio.currentTime);
            setSeekValue(audio.currentTime);
          }
          const d = audio.duration;
          if (d && !isNaN(d) && d !== Infinity && d > 0) setDuration(d);
          setIsBuffering(false);
        }}
        onPlay={(e) => {
          setIsPlaying(true);
          setIsBuffering(false);
          const d = e.currentTarget.duration;
          if (d && !isNaN(d) && d !== Infinity && d > 0) setDuration(d);
          if (onPlayRef.current) onPlayRef.current();
        }}
        onPlaying={(e) => {
          setIsPlaying(true);
          setIsBuffering(false);
          const d = e.currentTarget.duration;
          if (d && !isNaN(d) && d !== Infinity && d > 0) setDuration(d);
          if (onPlayRef.current) onPlayRef.current();
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsBuffering(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setIsBuffering(false);
          setCurrentTime(0);
          setSeekValue(0);
          if (onEndedRef.current) onEndedRef.current();
        }}
        onCanPlay={(e) => {
          setIsBuffering(false);
          const d = e.currentTarget.duration;
          if (d && !isNaN(d) && d !== Infinity && d > 0) setDuration(d);
        }}
        onCanPlayThrough={(e) => {
          setIsBuffering(false);
          const d = e.currentTarget.duration;
          if (d && !isNaN(d) && d !== Infinity && d > 0) setDuration(d);
        }}
        onWaiting={() => {
          if (isPlayingRef.current) setIsBuffering(true);
        }}
        onError={(e) => {
          const audio = e.currentTarget;
          if (audio.error && audio.error.code === 1) return;
          console.warn('Rosary audio event notice:', audio.error);
          setIsBuffering(false);
          setIsPlaying(false);
        }}
      />

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

      {/* 2. Audio Control Buttons — Centered */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 pt-1.5 border-t border-gray-100">

        {/* Rewind -10s */}
        <button
          type="button"
          onClick={() => skipTime(-10)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-all cursor-pointer active:scale-90"
          title="Rewind 10 seconds"
        >
          <FiRotateCcw className="text-sm sm:text-base" />
        </button>

        {/* Primary Play / Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-r from-church-royal-blue to-blue-900 hover:from-blue-900 hover:to-indigo-950 text-white flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-95"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering && isPlaying ? (
            <FiLoader className="animate-spin text-lg" />
          ) : isPlaying ? (
            <FiPause className="text-lg sm:text-xl" />
          ) : (
            <FiPlay className="text-lg sm:text-xl translate-x-0.5" />
          )}
        </button>

        {/* Forward +10s */}
        <button
          type="button"
          onClick={() => skipTime(10)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-all cursor-pointer active:scale-90"
          title="Fast forward 10 seconds"
        >
          <FiRotateCw className="text-sm sm:text-base" />
        </button>

      </div>
    </div>
  );
});

export default RosaryAudioPlayer;
