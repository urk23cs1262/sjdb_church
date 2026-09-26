import churchLogo from '../../assets/church_extirior.png';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiFacebook, FiYoutube, FiInstagram } from 'react-icons/fi';
import PageHero from '../../components/common/common_page_hero';

export default function LiveStream() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen pt-10 bg-church-cream">
      <PageHero title={<>Live Stream</>} subtitle={<>Watch Online</>} />

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* YouTube Live */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="church-card overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <FiYoutube className="text-red-500 text-2xl shrink-0" />
                  <h2 className="font-display text-xl font-bold text-gray-800">YouTube Live</h2>
                </div>
                <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 border border-red-500/20 shadow-inner flex flex-col items-center justify-center p-4 text-center group">
                    <img
                      src={churchLogo}
                      alt="St. John de Britto Church"
                      className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                    />
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 p-[2px] shadow-lg mb-2">
                        <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-white">
                          <FiYoutube className="text-xl text-red-500" />
                        </div>
                      </div>
                      <span className="text-white font-bold text-sm tracking-wide">@sjdbchurch</span>
                      <p className="text-red-200/80 text-xs mt-1 max-w-[220px] line-clamp-2">
                        Sunday Holy Mass, Homilies & Special Feast Services
                      </p>
                    </div>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-bold tracking-wider uppercase shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> Live
                    </div>
                  </div>
                </div>
              </div>
              <a
                href="https://www.youtube.com/@yourchannelhandle"
                target="_blank"
                rel="noreferrer"
                className="w-full justify-center mt-5 text-sm flex items-center gap-2 py-2.5 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-red-600 to-rose-700 hover:opacity-90 shadow-md transition-all"
              >
                <FiYoutube className="text-base" /> Visit YouTube Channel
              </a>
            </motion.div>

            {/* Facebook Live */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="church-card overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <FiFacebook className="text-blue-600 text-2xl shrink-0" />
                  <h2 className="font-display text-xl font-bold text-gray-800">Facebook Live</h2>
                </div>
                <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-blue-500/20 shadow-inner flex flex-col items-center justify-center p-4 text-center group">
                    <img
                      src={churchLogo}
                      alt="St. John de Britto Church"
                      className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                    />
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-sky-400 p-[2px] shadow-lg mb-2">
                        <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-white">
                          <FiFacebook className="text-xl text-blue-400" />
                        </div>
                      </div>
                      <span className="text-white font-bold text-sm tracking-wide">@sjdbchurch</span>
                      <p className="text-blue-200/80 text-xs mt-1 max-w-[220px] line-clamp-2">
                        Live Mass Broadcasts, Parish Feasts & Community Updates
                      </p>
                    </div>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-bold tracking-wider uppercase shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> Live
                    </div>
                  </div>
                </div>
              </div>
              <a
                href="https://www.facebook.com/YourPageName"
                target="_blank"
                rel="noreferrer"
                className="w-full justify-center mt-5 text-sm flex items-center gap-2 py-2.5 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:opacity-90 shadow-md transition-all"
              >
                <FiFacebook className="text-base" /> Visit Facebook Page
              </a>
            </motion.div>

            {/* Instagram Live */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="church-card overflow-hidden flex flex-col justify-between md:col-span-2 lg:col-span-1"
            >
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <FiInstagram className="text-pink-600 text-2xl shrink-0" />
                  <h2 className="font-display text-xl font-bold text-gray-800">Instagram Live</h2>
                </div>
                <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 border border-pink-500/20 shadow-inner flex flex-col items-center justify-center p-4 text-center group">
                    <img
                      src={churchLogo}
                      alt="St. John de Britto Church"
                      className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                    />
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 p-[2px] shadow-lg mb-2">
                        <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-white">
                          <FiInstagram className="text-xl text-pink-400" />
                        </div>
                      </div>
                      <span className="text-white font-bold text-sm tracking-wide">@sjdbchurch</span>
                      <p className="text-pink-200/80 text-xs mt-1 max-w-[220px] line-clamp-2">
                        Live Feast Celebrations, Stories & Holy Mass Reels
                      </p>
                    </div>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-bold tracking-wider uppercase shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> Live
                    </div>
                  </div>
                </div>
              </div>
              <a
                href="https://www.instagram.com/YourPageName"
                target="_blank"
                rel="noreferrer"
                className="w-full justify-center mt-5 text-sm flex items-center gap-2 py-2.5 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 hover:opacity-90 shadow-md transition-all"
              >
                <FiInstagram className="text-base" /> Visit Instagram Page
              </a>
            </motion.div>
          </div>

          {/* Sunday Mass Timings & Quick Social Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-8 text-center max-w-4xl mx-auto"
          >
            <h3 className="section-title mb-3">Sunday Mass Timings</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Live streaming is available every Sunday at <strong className="text-church-gold">6:30 AM and 8:30 AM</strong>. Follow and subscribe to our social channels to get notified whenever we go live.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://www.youtube.com/@yourchannelhandle"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all shadow-sm hover:scale-105"
              >
                <FiYoutube className="text-lg" /> YouTube Live
              </a>
              <a
                href="https://www.facebook.com/YourPageName"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:scale-105"
              >
                <FiFacebook className="text-lg" /> Facebook Live
              </a>
              <a
                href="https://www.instagram.com/YourPageName"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 text-white text-sm font-semibold hover:opacity-95 transition-all shadow-sm hover:scale-105"
              >
                <FiInstagram className="text-lg" /> Instagram Live
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
