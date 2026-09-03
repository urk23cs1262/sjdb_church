import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiClock } from 'react-icons/fi';
import { GiChurch, GiCrucifix, GiCandleLight } from 'react-icons/gi';
import PageHero from '../../components/common/common_page_hero';

const MASS_SCHEDULE = [
  { day: 'Sunday', time: '6:30 AM & 8:30 AM', lang: 'Tamil', type: 'sunday' },
  { day: 'Wednesday – Saturday', time: '5:00 PM', lang: 'Tamil', type: 'weekday' },
];

const OTHER_TIMINGS = [
  { icon: <GiCrucifix />, title: 'Confession', details: ['Only on Weekdays after mass'] },
  { icon: <GiCandleLight />, title: 'Adoration', details: ['Thursday: Before Evening Mass', 'First Friday: After Evening Mass'] },
  { icon: <FiClock />, title: 'Office Hours', details: ['Sunday: 10:00AM - 8:00PM', 'Monday – Saturday: ', '8:00 AM – 12:00 PM', '3:00 PM – 10:00 PM'] },
];

const colorMap = { sunday: 'border-church-gold bg-gold-50 ', weekday: 'border-church-royal-blue bg-blue-50 ', saturday: 'border-purple-500 bg-purple-50 ', special: 'border-church-maroon bg-red-50 ', holiday: 'border-green-600 bg-green-50 ' };

export default function MassTimings() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen pt-10 bg-church-cream ">
      <PageHero title={<>{t('mass.title')}</>} subtitle={<>Worship Schedule</>} description={<>Join us for Holy Mass and other devotions</>} />

      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          {/* Mass Schedule */}
          <div className="mb-16">
            <p className="section-subtitle text-center mb-2">Holy Mass</p>
            <h2 className="section-title text-center mb-10">Mass Timings</h2>
            <div className="space-y-4">
              {MASS_SCHEDULE.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6 p-4 sm:p-5 rounded-2xl border-l-4 ${colorMap[m.type]}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 text-sm sm:text-base">{m.day}</p>
                    {m.note && <p className="text-xs text-gray-500 mt-0.5">{m.note}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-church-gold font-display text-lg sm:text-2xl font-bold">
                    <FiClock className="text-base flex-shrink-0" /> <span>{m.time}</span>
                  </div>
                  <span className="badge badge-blue self-end sm:self-auto">{m.lang}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Note */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-10 p-6 rounded-2xl bg-gold-50  border border-gold-200  text-center"
          >
            <p className="text-gray-600  text-sm">
              <span className="font-semibold text-church-gold">Note:</span> Mass timings may change on feast days and special occasions. Please check our announcements page or contact the parish office for updates.
            </p>
          </motion.div>

          {/* Other services */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {OTHER_TIMINGS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="church-card text-center mt-8"
              >
                <div className="text-church-gold text-4xl mb-3 flex justify-center">{s.icon}</div>
                <h3 className="font-display text-xl font-bold text-church-royal-blue  mb-3">{s.title}</h3>
                <div className="space-y-1">
                  {s.details.map((d, j) => <p key={j} className="text-gray-600  text-sm">{d}</p>)}
                </div>
              </motion.div>
            ))}
          </div>

          
        </div>
      </section>
    </div>
  );
}
