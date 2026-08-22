import churchLogo from '../../assets/church_extirior.png';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiX, FiChevronLeft, FiChevronRight, FiGrid } from 'react-icons/fi';
import { GiChurch } from 'react-icons/gi';
import api, { UPLOADS_URL } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import PageHero from '../../components/common/common_page_hero';

const CATEGORIES = ['all', 'church', 'feast', 'events', 'priests', 'community', 'other'];

export default function Gallery() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    setLoading(true);
    const params = category !== 'all' ? `?category=${category}` : '';
    api.get(`/gallery${params}`)
      .then(r => setItems(r.data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [category]);

  const filtered = category === 'all' ? items : items.filter(i => i.category === category);

  const openLightbox = (idx) => setLightbox(idx);
  const closeLightbox = () => setLightbox(null);
  const prevImg = () => setLightbox(l => (l - 1 + filtered.length) % filtered.length);
  const nextImg = () => setLightbox(l => (l + 1) % filtered.length);

  useEffect(() => {
    const onKey = (e) => { 
      if (lightbox === null) return; 
      if (e.key === 'ArrowLeft') prevImg(); 
      if (e.key === 'ArrowRight') nextImg(); 
      if (e.key === 'Escape') closeLightbox(); 
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, filtered.length]);

  return (
    <div className="min-h-screen pt-10 bg-church-cream">
      <PageHero title={<>{t('nav.gallery')}</>} subtitle={<>Visual Stories</>} />

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap justify-center mb-10">
            {CATEGORIES.map(c => (
              <button 
                key={c} 
                onClick={() => setCategory(c)} 
                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${category === c ? 'bg-church-gold text-white shadow-gold' : 'bg-white text-gray-500 hover:bg-gold-50'}`}
              >
                {c === 'all' ? <FiGrid className="inline mr-1" /> : null}{c}
              </button>
            ))}
          </div>

          {loading ? (
            <SectionLoader />
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200/80 shadow-md max-w-md mx-auto my-12">
              <GiChurch className="text-6xl text-gray-300 mx-auto mb-4" />
              <h3 className="font-display text-lg font-bold text-gray-700">No Gallery Photos Found</h3>
              <p className="text-gray-400 text-xs mt-1">
                {category !== 'all' ? `No photos uploaded under "${category}" category.` : 'No gallery photos uploaded yet.'}
              </p>
            </div>
          ) : (
            <motion.div layout className="columns-1 sm:columns-3 lg:columns-4 gap-4 space-y-4">
              {filtered.map((item, i) => (
                <motion.div
                  key={item._id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => openLightbox(i)}
                  className="break-inside-avoid cursor-pointer group rounded-2xl overflow-hidden shadow-card hover:shadow-gold-lg transition-all duration-300"
                >
                  <div className="relative overflow-hidden">
                    <img 
                      src={item.imageUrl.startsWith('http') ? item.imageUrl : `${UPLOADS_URL.replace('/uploads', '')}${item.imageUrl.startsWith('/') ? '' : '/'}${item.imageUrl}`} 
                      alt={item.title} 
                      className="w-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end">
                      <p className="text-white text-sm font-semibold p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">{item.title}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && filtered[lightbox] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="absolute top-4 right-4 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all">
              <FiX className="text-xl" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); prevImg(); }} className="absolute left-4 text-white bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all">
              <FiChevronLeft className="text-2xl" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); nextImg(); }} className="absolute right-4 text-white bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all">
              <FiChevronRight className="text-2xl" />
            </button>
            <div className="max-w-4xl max-h-[85vh] p-4 text-center" onClick={(e) => e.stopPropagation()}>
              <img 
                src={filtered[lightbox].imageUrl.startsWith('http') ? filtered[lightbox].imageUrl : `${UPLOADS_URL.replace('/uploads', '')}${filtered[lightbox].imageUrl.startsWith('/') ? '' : '/'}${filtered[lightbox].imageUrl}`} 
                alt={filtered[lightbox].title} 
                className="max-h-[75vh] mx-auto rounded-xl object-contain" 
              />
              <p className="text-white font-bold text-lg mt-3">{filtered[lightbox].title}</p>
              {filtered[lightbox].description && <p className="text-gray-300 text-xs mt-1">{filtered[lightbox].description}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
