import { motion } from 'framer-motion';
import { GiChurch } from 'react-icons/gi';
import churchLogo from '../../assets/church_extirior.png';

export default function PageLoader() {
  return (
    <div className="fixed inset-0 bg-church-royal-blue flex flex-col items-center justify-center z-[9999]">
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-8"
      >
        <div className="w-44 h-44 rounded-full overflow-hidden border-2 border-gold-400/50 shadow-gold-lg">
          <img src={churchLogo} alt="Logo" className="w-full h-full object-cover object-[center_20%]" />
        </div>
      </motion.div>
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-gold-300 font-display text-xl font-bold"
      >
        St. John de britto Church
      </motion.p>
      <p className="text-gold-400 font-tamil text-sm mt-1">புனித அருளானந்தர் தேவாலயம்</p>
      <div className="mt-6 flex gap-2">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            className="w-2 h-2 rounded-full bg-gold-400"
          />
        ))}
      </div>
    </div>
  );
}

export function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="spinner" />
    </div>
  );
}
