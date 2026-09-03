import churchLogo from '../../assets/church_extirior.png';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiFacebook, FiYoutube } from 'react-icons/fi';
import { GiChurch } from 'react-icons/gi';
import PageHero from '../../components/common/common_page_hero';

export default function LiveStream() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen pt-10 bg-church-cream ">
      <PageHero title={<>Live Stream</>} subtitle={<>Watch Online</>} />

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* YouTube */}
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="church-card overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <FiYoutube className="text-red-500 text-2xl" />
                <h2 className="font-display text-xl font-bold text-gray-800 ">YouTube Live</h2>
              </div>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full rounded-xl"
                  src="https://www.youtube.com/embed/live_stream?channel=YOUR_CHANNEL_ID"
                  title="YouTube Live Stream"
                  frameBorder="0"
                  allowFullScreen
                />
              </div>
              <a href="https://www.youtube.com/@yourchannelhandle" target="_blank" rel="noreferrer" className="btn-maroon w-full justify-center mt-4 text-sm">
                <FiYoutube /> Visit YouTube Channel
              </a>
            </motion.div>

            {/* Facebook */}
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="church-card overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <FiFacebook className="text-blue-600 text-2xl" />
                <h2 className="font-display text-xl font-bold text-gray-800 ">Facebook Live</h2>
              </div>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full rounded-xl"
                  src="https://www.facebook.com/plugins/video.php?href=https://www.facebook.com/YourPageName/videos/live"
                  title="Facebook Live Stream"
                  frameBorder="0"
                  allowFullScreen
                />
              </div>
              <a href="https://www.facebook.com/YourPageName" target="_blank" rel="noreferrer" className="btn-royal w-full justify-center mt-4 text-sm">
                <FiFacebook /> Visit Facebook Page
              </a>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="glass-card p-8 text-center">
            <h3 className="section-title mb-3">Sunday Mass Timings</h3>
            <p className="text-gray-600 ">Live streaming is available every Sunday at <strong className="text-church-gold">6:00 AM, 8:00 AM, and 10:00 AM</strong>. Subscribe to our YouTube channel and follow our Facebook page to get notified when we go live.</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
