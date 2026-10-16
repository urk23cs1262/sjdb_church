import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiX, FiChevronLeft, FiChevronRight, FiGrid, FiLayers } from 'react-icons/fi';
import { GiChurch } from 'react-icons/gi';
import api, { getMediaUrl } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import PageHero from '../../components/common/common_page_hero';

const CATEGORIES = ['all', 'church', 'feast', 'events', 'priests', 'community', 'other'];

/**
 * WhatsApp-style Collage Card for multi-image gallery items
 */
function WhatsAppCollage({ item, onOpenPhoto }) {
  const images = (item.images && item.images.length > 0) ? item.images : (item.imageUrl ? [item.imageUrl] : []);
  const count = images.length;

  // Single Image Mode
  if (count <= 1) {
    return (
      <div 
        className="relative overflow-hidden group cursor-pointer"
        onClick={() => onOpenPhoto(0)}
      >
        <img 
          src={getMediaUrl(images[0] || item.imageUrl)} 
          alt={item.title} 
          loading="lazy"
          className="w-full object-cover group-hover:scale-105 transition-transform duration-500 rounded-xl sm:rounded-2xl" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end">
          <p className="text-white text-xs sm:text-sm font-semibold p-2.5 sm:p-3 truncate w-full">{item.title}</p>
        </div>
      </div>
    );
  }

  // 2 Photos: Side-by-side split (WhatsApp style)
  if (count === 2) {
    return (
      <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-card group bg-gray-900 aspect-square sm:aspect-[4/3]">
        <div className="grid grid-cols-2 gap-0.5 h-full w-full">
          {images.map((img, idx) => (
            <div 
              key={idx} 
              className="relative h-full w-full overflow-hidden cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onOpenPhoto(idx); }}
            >
              <img 
                src={getMediaUrl(img)} 
                alt="" 
                loading="lazy" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
            </div>
          ))}
        </div>
        <div className="absolute top-2 right-2 bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm pointer-events-none z-10">
          <FiLayers size={11} /> <span>2</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end pointer-events-none">
          <p className="text-white text-xs sm:text-sm font-semibold p-2.5 truncate w-full">{item.title}</p>
        </div>
      </div>
    );
  }

  // 3 Photos: 1 tall on left + 2 stacked on right (WhatsApp style)
  if (count === 3) {
    return (
      <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-card group bg-gray-900 aspect-square">
        <div className="grid grid-cols-2 gap-0.5 h-full w-full">
          <div 
            className="relative h-full w-full overflow-hidden cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onOpenPhoto(0); }}
          >
            <img 
              src={getMediaUrl(images[0])} 
              alt="" 
              loading="lazy" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            />
          </div>
          <div className="grid grid-rows-2 gap-0.5 h-full w-full">
            <div 
              className="relative h-full w-full overflow-hidden cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onOpenPhoto(1); }}
            >
              <img 
                src={getMediaUrl(images[1])} 
                alt="" 
                loading="lazy" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
            </div>
            <div 
              className="relative h-full w-full overflow-hidden cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onOpenPhoto(2); }}
            >
              <img 
                src={getMediaUrl(images[2])} 
                alt="" 
                loading="lazy" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              />
            </div>
          </div>
        </div>
        <div className="absolute top-2 right-2 bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm pointer-events-none z-10">
          <FiLayers size={11} /> <span>3</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end pointer-events-none">
          <p className="text-white text-xs sm:text-sm font-semibold p-2.5 truncate w-full">{item.title}</p>
        </div>
      </div>
    );
  }

  // 4 or more photos: 2x2 grid (WhatsApp 4-photo collage style)
  return (
    <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-card group bg-gray-900 aspect-square">
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-full w-full">
        {images.slice(0, 3).map((img, idx) => (
          <div 
            key={idx} 
            className="relative h-full w-full overflow-hidden cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onOpenPhoto(idx); }}
          >
            <img 
              src={getMediaUrl(img)} 
              alt="" 
              loading="lazy" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            />
          </div>
        ))}
        {/* Quadrant 4 (with +N overlay if more than 4 photos) */}
        <div 
          className="relative h-full w-full overflow-hidden cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onOpenPhoto(3); }}
        >
          <img 
            src={getMediaUrl(images[3])} 
            alt="" 
            loading="lazy" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
          {count > 4 && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center text-white font-bold text-lg sm:text-2xl hover:bg-black/70 transition-colors">
              +{count - 3}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-2 right-2 bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm pointer-events-none z-10">
        <FiLayers size={11} /> <span>{count}</span>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end pointer-events-none">
        <p className="text-white text-xs sm:text-sm font-semibold p-2.5 truncate w-full">{item.title}</p>
      </div>
    </div>
  );
}

export default function Gallery() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [lightbox, setLightbox] = useState(null); // { itemIndex: number, photoIndex: number } | null

  useEffect(() => {
    setLoading(true);
    const params = category !== 'all' ? `?category=${category}` : '';
    api.get(`/gallery${params}`)
      .then(r => setItems(r.data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [category]);

  const filtered = category === 'all' ? items : items.filter(i => i.category === category);

  const openLightbox = (itemIndex, photoIndex = 0) => {
    setLightbox({ itemIndex, photoIndex });
  };
  const closeLightbox = () => setLightbox(null);

  const currentItem = lightbox !== null ? filtered[lightbox.itemIndex] : null;
  const currentImages = currentItem 
    ? ((currentItem.images && currentItem.images.length > 0) ? currentItem.images : (currentItem.imageUrl ? [currentItem.imageUrl] : []))
    : [];

  const prevImg = () => {
    if (!lightbox || filtered.length === 0) return;
    if (lightbox.photoIndex > 0) {
      setLightbox({ ...lightbox, photoIndex: lightbox.photoIndex - 1 });
    } else {
      const prevItemIndex = (lightbox.itemIndex - 1 + filtered.length) % filtered.length;
      const prevItem = filtered[prevItemIndex];
      const prevImgs = (prevItem.images && prevItem.images.length > 0) ? prevItem.images : (prevItem.imageUrl ? [prevItem.imageUrl] : []);
      setLightbox({ itemIndex: prevItemIndex, photoIndex: Math.max(0, prevImgs.length - 1) });
    }
  };

  const nextImg = () => {
    if (!lightbox || filtered.length === 0) return;
    if (lightbox.photoIndex < currentImages.length - 1) {
      setLightbox({ ...lightbox, photoIndex: lightbox.photoIndex + 1 });
    } else {
      const nextItemIndex = (lightbox.itemIndex + 1) % filtered.length;
      setLightbox({ itemIndex: nextItemIndex, photoIndex: 0 });
    }
  };

  useEffect(() => {
    const onKey = (e) => { 
      if (lightbox === null) return; 
      if (e.key === 'ArrowLeft') prevImg(); 
      if (e.key === 'ArrowRight') nextImg(); 
      if (e.key === 'Escape') closeLightbox(); 
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, filtered.length, currentImages.length]);

  return (
    <div className="min-h-screen pt-10 bg-church-cream">
      <PageHero title={<>{t('gallery')}</>} subtitle={<>Visual Stories</>} />

      <section className="py-8 sm:py-16">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-4">
          {/* Categories */}
          <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center mb-6 sm:mb-10">
            {CATEGORIES.map(c => (
              <button 
                key={c} 
                onClick={() => setCategory(c)} 
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${category === c ? 'bg-church-gold text-white shadow-gold' : 'bg-white text-gray-500 hover:bg-gold-50 border border-gray-200/60'}`}
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
            <motion.div layout className="columns-2 sm:columns-3 lg:columns-4 gap-2.5 sm:gap-4">
              {filtered.map((item, i) => (
                <motion.div
                  key={item._id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="break-inside-avoid mb-2.5 sm:mb-4 rounded-xl sm:rounded-2xl overflow-hidden shadow-card hover:shadow-gold-lg transition-all duration-300 bg-white"
                >
                  <WhatsAppCollage 
                    item={item} 
                    onOpenPhoto={(photoIdx) => openLightbox(i, photoIdx)} 
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && currentItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-between p-3 sm:p-6"
            onClick={closeLightbox}
          >
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between text-white z-10" onClick={(e) => e.stopPropagation()}>
              <div className="truncate max-w-[70%]">
                <p className="font-bold text-sm sm:text-base truncate">{currentItem.title}</p>
                {currentItem.album && (
                  <p className="text-church-gold text-xs font-medium truncate">{currentItem.album}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {currentImages.length > 1 && (
                  <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-gray-300 font-mono">
                    {lightbox.photoIndex + 1} / {currentImages.length}
                  </span>
                )}
                <button 
                  onClick={closeLightbox} 
                  className="text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
                  title="Close"
                >
                  <FiX className="text-xl" />
                </button>
              </div>
            </div>

            {/* Main Image Stage */}
            <div className="relative flex-1 w-full flex items-center justify-center my-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={prevImg} 
                className="absolute left-1 sm:left-4 text-white bg-black/50 hover:bg-black/80 p-2.5 sm:p-3 rounded-full transition-all z-20 cursor-pointer"
                title="Previous photo"
              >
                <FiChevronLeft className="text-2xl" />
              </button>
              
              <motion.img 
                key={`${lightbox.itemIndex}-${lightbox.photoIndex}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                src={getMediaUrl(currentImages[lightbox.photoIndex] || currentItem.imageUrl)} 
                alt={currentItem.title} 
                className="max-h-[72vh] max-w-[95vw] rounded-xl object-contain shadow-2xl select-none" 
              />

              <button 
                onClick={nextImg} 
                className="absolute right-1 sm:right-4 text-white bg-black/50 hover:bg-black/80 p-2.5 sm:p-3 rounded-full transition-all z-20 cursor-pointer"
                title="Next photo"
              >
                <FiChevronRight className="text-2xl" />
              </button>
            </div>

            {/* Bottom Bar: Thumbnails strip & Description */}
            <div className="w-full max-w-2xl text-center z-10 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {currentItem.description && (
                <p className="text-gray-300 text-xs sm:text-sm line-clamp-2 px-4">{currentItem.description}</p>
              )}

              {/* Thumbnails strip for multi-photo albums */}
              {currentImages.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full px-2 py-1 scrollbar-none">
                  {currentImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLightbox({ ...lightbox, photoIndex: idx })}
                      className={`relative w-11 h-11 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                        idx === lightbox.photoIndex 
                          ? 'border-church-gold scale-105 shadow-gold' 
                          : 'border-transparent opacity-50 hover:opacity-100'
                      }`}
                    >
                      <img src={getMediaUrl(img)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
