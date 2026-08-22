import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GiCrucifix, GiPrayerBeads } from 'react-icons/gi';
import { FiVolume2, FiBookOpen, FiHeadphones, FiCheckCircle } from 'react-icons/fi';
import PageHero from '../../components/common/common_page_hero';
import useRosaryAudio from '../../hooks/useRosaryAudio';
import RosaryAudioPlayer from '../../components/common/common_rosary_audio_player';
import { PRAYERS, MYSTERIES, ROSARY_INFO } from '../../data/rosary_prayers';

export default function Rosary() {
  const { audioUrl, isCustom, loading } = useRosaryAudio();

  // Determine today's mystery based on liturgical day of week
  const todayMystery = useMemo(() => {
    const day = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    if (day === 1 || day === 6) return MYSTERIES[0]; // Joyful (Mon, Sat)
    if (day === 2 || day === 5) return MYSTERIES[1]; // Sorrowful (Tue, Fri)
    if (day === 4) return MYSTERIES[3];              // Luminous (Thu)
    return MYSTERIES[2];                             // Glorious (Wed, Sun)
  }, []);

  return (
    <div className="min-h-screen pt-20 bg-church-cream">
      <PageHero 
        title={<>{ROSARY_INFO.title}</>} 
        subtitle={<>{ROSARY_INFO.subtitle}</>} 
      />

      <section className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4">

          {/* Audio Players Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            
            {/* English Audio Guide */}
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="glass-card p-6 h-full border-t-4 border-church-gold text-center shadow-gold-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h3 className="font-display text-base sm:text-lg font-bold text-church-royal-blue flex items-center gap-2">
                      <FiVolume2 className="text-church-gold" /> English Audio Guide
                    </h3>
                    <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Audio Guide
                    </span>
                  </div>
                  <div className="pt-1">
                    <RosaryAudioPlayer 
                      src="https://rosaryarmy.com/wp-content/uploads/2025/02/RosaryJoyful-1.mp3" 
                      title="English Audio Guide"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-4 italic uppercase tracking-wider font-semibold">
                  {todayMystery.name.split('(')[0].trim()}
                </p>
              </div>
            </motion.div>

            {/* Dynamic Tamil Audio Guide (Synchronized with Admin Uploads & Default Fallback) */}
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="glass-card p-6 h-full border-t-4 border-church-maroon text-center shadow-maroon-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h3 className="font-display text-base sm:text-lg font-bold text-church-royal-blue flex items-center gap-2 font-tamil">
                      <FiHeadphones className="text-church-maroon" /> தமிழ் ஜெபமாலை ஆடியோ
                    </h3>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                      isCustom 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-blue-50 text-church-royal-blue border-blue-200'
                    }`}>
                      {isCustom ? '● Parish Custom Audio' : '● Standard Audio'}
                    </span>
                  </div>

                  <div className="pt-1">
                    <RosaryAudioPlayer 
                      src={audioUrl} 
                      title="Tamil Rosary Audio"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs pt-2 border-t border-gray-100 font-tamil text-gray-600">
                  <span>இன்றைய மறை உண்மை:</span>
                  <span className="font-bold text-church-royal-blue">{todayMystery.tag}</span>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Mysteries Grid */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="section-title flex items-center justify-center gap-3">
                <FiBookOpen className="text-church-gold" /> Mysteries of the Rosary / மறை உண்மைகள்
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 font-tamil">
                நான்கு மறை உண்மைகள் மற்றும் அவற்றின் தியானப் பத்துகள்
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {MYSTERIES.map((m, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true }} 
                  transition={{ delay: i * 0.1 }} 
                  className="church-card p-5 hover:border-church-gold transition-all flex flex-col justify-between"
                >
                  <div>
                    <h3 className="font-display text-sm font-bold text-church-royal-blue mb-1 leading-snug">
                      {m.name}
                    </h3>
                    <span className="inline-block text-[10px] text-amber-800 bg-amber-50 border border-amber-200 font-bold uppercase px-2 py-0.5 rounded-md mb-3">
                      {m.days}
                    </span>
                    <ul className="space-y-2.5">
                      {m.items.map((item, j) => (
                        <li key={j} className="text-xs text-gray-700 border-l-2 border-church-gold/40 pl-2.5">
                          <p className="font-semibold text-gray-900">{item.en}</p>
                          <p className="font-tamil text-gray-600 mt-0.5 leading-relaxed">{item.ta}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 pt-2 border-t border-gray-100 text-[10px] font-bold text-gray-400 font-tamil text-right">
                    {m.tag}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Detailed Prayer Cards */}
          <div className="space-y-10">
            <div className="text-center">
              <h2 className="section-title">Order of Prayer / செபத்தின் வரிசை</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Follow the authentic text of Catholic prayers in English and Tamil</p>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 gap-6">
              {[
                { title: "1. Sign of the Cross / சிலுவை அடையாளம்", key: "SIGN_OF_CROSS" },
                { title: "2. Apostles' Creed / அப்போஸ்தலர்களின் விசுவாச அறிக்கை", key: "APOSTLES_CREED" },
                { title: "3. Our Father / பரலோகத்தில் இருக்கிற எங்கள் பிதாவே", key: "OUR_FATHER" },
                { title: "4. Hail Mary / அருள் நிறைந்த மரியே வாழ்க", key: "HAIL_MARY" },
                { title: "5. Glory Be / திரித்துவப் புகழ்", key: "GLORY_BE" },
                { title: "6. Fatima Prayer / பாத்திமா அன்னை மன்றாட்டு", key: "FATIMA_PRAYER" },
                { title: "7. Hail Holy Queen / சலேவே இராக்கினி", key: "HAIL_HOLY_QUEEN" }
              ].map((step, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-card overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-church-royal-blue to-blue-900 px-6 py-3.5 flex items-center justify-between">
                    <h3 className="text-white font-display font-bold text-base sm:text-lg flex items-center gap-2">
                      <FiCheckCircle className="text-church-gold text-sm" />
                      {step.title}
                    </h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-church-gold text-[10px] font-black uppercase tracking-wider mb-2">English Prayer</p>
                      <p className="text-gray-800 text-xs sm:text-sm leading-relaxed italic">{PRAYERS.EN[step.key]}</p>
                    </div>
                    <div className="border-t md:border-t-0 md:border-l border-gray-100 md:pl-6 pt-5 md:pt-0">
                      <p className="text-church-maroon text-[10px] font-black uppercase tracking-wider mb-2 font-tamil">தமிழ் செபம்</p>
                      <p className="text-gray-800 text-xs sm:text-sm leading-relaxed font-tamil">{PRAYERS.TA[step.key]}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bead Visualization Reminder */}
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="church-card bg-gradient-to-br from-church-royal-blue via-blue-950 to-indigo-950 text-white p-8 text-center border-none shadow-gold-lg rounded-3xl">
              <GiPrayerBeads className="text-church-gold text-5xl mx-auto mb-4" />
              <h3 className="text-xl sm:text-2xl font-display font-bold mb-2">The 53 Beads / 53 மணிகள்</h3>
              <div className="max-w-2xl mx-auto space-y-4 text-gray-200 text-xs sm:text-sm">
                <p>{ROSARY_INFO.description}</p>
                <div className="flex justify-center gap-1.5 sm:gap-2 flex-wrap py-2">
                  {[...Array(53)].map((_, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full bg-amber-400/70 shadow-xs ring-1 ring-amber-300/30"></div>
                  ))}
                </div>
                <p className="font-tamil text-amber-200">{ROSARY_INFO.descriptionTa}</p>
              </div>
            </motion.div>
          </div>

        </div>
      </section>
    </div>
  );
}
