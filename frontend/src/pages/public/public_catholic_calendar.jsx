import churchLogo from '../../assets/church_extirior.png';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GiChurch } from 'react-icons/gi';
import { FiCalendar, FiList } from 'react-icons/fi';
import PageHero from '../../components/common/common_page_hero';
import { useAuth } from '../../context/context_auth_context';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const FEASTS = [
  { month: 0, day: 1, name: 'Mary, Mother of God' }, { month: 0, day: 6, name: 'Epiphany of the Lord' },
  { month: 1, day: 2, name: 'Presentation of the Lord' }, { month: 1, day: 4, name: 'Feast of St. John de Britto ' },
  { month: 1, day: 11, name: 'Our Lady of Lourdes' }, { month: 2, day: 19, name: 'St. Joseph' },
  { month: 2, day: 25, name: 'Annunciation of the Lord' }, { month: 3, day: 23, name: 'St. George' },
  { month: 4, day: 1, name: 'St. Joseph the Worker' }, { month: 4, day: 13, name: 'Our Lady of Fatima' },
  { month: 5, day: 24, name: 'Birth of St. John the Baptist' }, { month: 5, day: 29, name: 'Sts. Peter & Paul' },
  { month: 6, day: 16, name: 'Our Lady of Mount Carmel' }, { month: 7, day: 15, name: 'Assumption of Mary' },
  { month: 7, day: 28, name: 'St. Augustine' }, { month: 8, day: 8, name: 'Birth of Mary' },
  { month: 9, day: 4, name: 'St. Francis of Assisi' }, { month: 9, day: 7, name: 'Our Lady of the Rosary' },
  { month: 9, day: 18, name: 'St. Luke the Evangelist' }, { month: 10, day: 1, name: 'All Saints Day' },
  { month: 10, day: 2, name: 'All Souls Day' }, { month: 11, day: 8, name: 'Immaculate Conception' },
  { month: 11, day: 25, name: 'Christmas — Birth of Jesus' }, { month: 11, day: 26, name: 'St. Stephen' },
];

export default function CatholicCalendar() {
  const { user } = useAuth();
  const now = new Date();
  const initialView = user?.settings?.appPreferences?.calendarView?.toLowerCase().includes('list') ? 'list' : 'month';
  const [viewMode, setViewMode] = useState(initialView);

  useEffect(() => {
    if (user?.settings?.appPreferences?.calendarView) {
      const pref = user.settings.appPreferences.calendarView;
      setViewMode(pref.toLowerCase().includes('list') ? 'list' : 'month');
    }
  }, [user]);

  return (
    <div className="min-h-screen pt-10 bg-church-cream ">
      <PageHero title={<>Catholic Calendar</>} subtitle={<>Liturgical Year</>} />
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4">
          
          {/* View Toggle Bar */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm gap-1">
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'month'
                    ? 'bg-church-gold text-white shadow-gold'
                    : 'text-gray-600 hover:text-church-royal-blue hover:bg-gray-50'
                }`}
              >
                <FiCalendar className="text-sm" /> Month View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-church-gold text-white shadow-gold'
                    : 'text-gray-600 hover:text-church-royal-blue hover:bg-gray-50'
                }`}
              >
                <FiList className="text-sm" /> List View
              </button>
            </div>
          </div>

          {viewMode === 'month' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {MONTHS.map((month, mi) => {
                const monthFeasts = FEASTS.filter(f => f.month === mi);
                return (
                  <motion.div key={mi} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: mi * 0.04 }}
                    className={`church-card ${mi === now.getMonth() ? 'border-church-gold shadow-gold' : ''}`}>
                    <h3 className={`font-display text-lg font-bold mb-3 ${mi === now.getMonth() ? 'text-church-gold' : 'text-church-royal-blue '}`}>
                      {mi === now.getMonth() && ' '}{month}
                    </h3>
                    {monthFeasts.length === 0 ? <p className="text-gray-400 text-sm">No major feast days</p> : (
                      <ul className="space-y-2">
                        {monthFeasts.map((f, fi) => (
                          <li key={fi} className="flex items-start gap-2 text-sm">
                            <span className={`font-bold flex-shrink-0 ${f.name.includes('') ? 'text-church-gold' : 'text-church-maroon'} w-6`}>{f.day}</span>
                            <span className="text-gray-600 ">{f.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {FEASTS.map((f, fi) => (
                <motion.div
                  key={fi}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: fi * 0.02 }}
                  className="church-card flex items-center justify-between p-4 hover:border-church-gold transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-church-gold/10 text-church-royal-blue flex flex-col items-center justify-center font-bold">
                      <span className="text-[10px] uppercase tracking-wider text-church-gold">{MONTHS[f.month].slice(0, 3)}</span>
                      <span className="text-lg leading-none font-display">{f.day}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                        {f.name}
                      </h4>
                      <p className="text-gray-400 text-xs mt-0.5">{MONTHS[f.month]} {f.day}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                    f.name.includes('') ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-50 text-church-royal-blue'
                  }`}>
                    {f.name.includes('') ? 'Parish Feast' : 'Feast Day'}
                  </span>
                </motion.div>
              ))}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}

