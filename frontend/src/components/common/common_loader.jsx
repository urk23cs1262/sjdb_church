import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import churchImg from '../../assets/church_extirior.png';

/* ─── Animated shimmer ring ─── */
function ShimmerRing({ size, delay, duration, color }) {
  return (
    <motion.div
      className="absolute rounded-full border"
      style={{
        width: size,
        height: size,
        borderColor: color,
        top: '50%',
        left: '50%',
        translateX: '-50%',
        translateY: '-50%',
      }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: [0.6, 1.4], opacity: [0.6, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeOut' }}
    />
  );
}

/* ─── Star/cross particle ─── */
function CrossParticle({ x, y, delay }) {
  return (
    <motion.div
      className="absolute text-yellow-300/60 text-lg select-none pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 0], y: -30, scale: [0.5, 1, 0.5] }}
      transition={{ duration: 3, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      ✝
    </motion.div>
  );
}

/* ─── Floating orb ─── */
function FloatingOrb({ x, y, size, delay, color }) {
  return (
    <motion.div
      className="absolute rounded-full blur-2xl"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: color }}
      animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 4, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export default function PageLoader() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0d1f4a 40%, #0a0f1e 100%)' }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background ambient orbs */}
        <FloatingOrb x={10}  y={20}  size="300px" delay={0}   color="rgba(212,160,23,0.12)" />
        <FloatingOrb x={70}  y={60}  size="250px" delay={1.5} color="rgba(30,58,138,0.25)" />
        <FloatingOrb x={50}  y={80}  size="200px" delay={0.8} color="rgba(212,160,23,0.08)" />

        {/* Floating cross particles */}
        {[
          { x: 12, y: 15, delay: 0 },
          { x: 85, y: 25, delay: 1 },
          { x: 25, y: 75, delay: 0.5 },
          { x: 78, y: 70, delay: 1.8 },
          { x: 55, y: 10, delay: 2.2 },
          { x: 8,  y: 55, delay: 1.4 },
        ].map((p, i) => (
          <CrossParticle key={i} {...p} />
        ))}

        {/* Radial golden gradient behind the logo */}
        <motion.div
          className="absolute"
          style={{
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,160,23,0.18) 0%, transparent 70%)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />

        {/* Pulsing shimmer rings */}
        <ShimmerRing size={220} delay={0}   duration={2.5} color="rgba(212,160,23,0.5)" />
        <ShimmerRing size={270} delay={0.7} duration={2.5} color="rgba(212,160,23,0.3)" />
        <ShimmerRing size={320} delay={1.4} duration={2.5} color="rgba(212,160,23,0.15)" />

        {/* Church image */}
        <motion.div
          className="relative z-10 mb-8"
          initial={{ scale: 0.4, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
        >
          {/* Rotating golden ring */}
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: -5,
              background: 'conic-gradient(from 0deg, transparent 60%, #d4a017 80%, transparent 100%)',
              borderRadius: '50%',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />

          {/* Image container */}
          <div
            className="relative overflow-hidden"
            style={{
              width: 168,
              height: 168,
              borderRadius: '50%',
              border: '3px solid rgba(212,160,23,0.8)',
              boxShadow: '0 0 40px rgba(212,160,23,0.4), 0 0 80px rgba(212,160,23,0.15), inset 0 0 30px rgba(0,0,0,0.3)',
            }}
          >
            <img
              src={churchImg}
              alt="St. John de Britto Church"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 30%',
              }}
            />
            {/* Shine overlay */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%)',
                borderRadius: '50%',
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* Cross on top */}
          <motion.div
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-yellow-300 text-2xl"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            style={{ textShadow: '0 0 12px rgba(212,160,23,0.9)' }}
          >
            ✝
          </motion.div>
        </motion.div>

        {/* Text block */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-1 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 20 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {/* English name */}
          <motion.p
            className="text-white font-bold tracking-wide"
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '1.25rem',
              textShadow: '0 0 20px rgba(212,160,23,0.6)',
              letterSpacing: '0.08em',
            }}
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            St. John de Britto Church
          </motion.p>

          {/* Decorative divider */}
          <motion.div
            className="flex items-center gap-2 my-1"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.0, duration: 0.6 }}
          >
            <div className="h-px w-12" style={{ background: 'linear-gradient(to right, transparent, #d4a017)' }} />
            <div className="text-yellow-400 text-xs">✦</div>
            <div className="h-px w-12" style={{ background: 'linear-gradient(to left, transparent, #d4a017)' }} />
          </motion.div>

          {/* Tamil name */}
          <motion.p
            style={{
              fontFamily: "'Noto Sans Tamil', sans-serif",
              fontSize: '0.95rem',
              color: 'rgba(212,160,23,0.9)',
              letterSpacing: '0.04em',
            }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          >
            புனித அருளானந்தர் தேவாலயம்
          </motion.p>
        </motion.div>

        {/* Loading indicator */}
        <motion.div
          className="relative z-10 mt-10 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          {/* Animated loading bar */}
          <div
            className="overflow-hidden rounded-full"
            style={{ width: 160, height: 3, background: 'rgba(255,255,255,0.1)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(to right, #8b6914, #d4a017, #f5c842, #d4a017, #8b6914)' }}
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          {/* Dot loader */}
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                className="rounded-full"
                style={{
                  width: i === 2 ? 8 : 5,
                  height: i === 2 ? 8 : 5,
                  background: i === 2 ? '#d4a017' : 'rgba(212,160,23,0.5)',
                }}
                animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 1,
                  delay: i * 0.12,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-church-gold"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}
