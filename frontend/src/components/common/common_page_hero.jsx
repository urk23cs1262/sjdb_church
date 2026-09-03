import { motion } from 'framer-motion';

export default function PageHero({ title, subtitle, description }) {
  return (
    <section className="page-hero py-24 relative overflow-hidden bg-church-gradient">
      {/* Animated cross decorations only (No image) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        className="absolute top-10 right-20 text-white/5 text-[150px] font-display select-none pointer-events-none"
      ></motion.div>
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-10 left-10 text-white/5 text-[100px] font-display select-none pointer-events-none"
      ></motion.div>

      <div className="relative z-10 text-center px-4 notranslate" translate="no">
        {subtitle && <p className="section-subtitle text-gold-400 mb-2">{subtitle}</p>}
        <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-3">{title}</h1>
        {description && <p className="text-gray-200 max-w-2xl mx-auto">{description}</p>}
      </div>
    </section>
  );
}
