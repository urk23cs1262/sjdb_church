import churchLogo from '../../assets/church_extirior.png';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GiChurch } from 'react-icons/gi';
import { FiPhone, FiMail, FiCalendar } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import api, { UPLOADS_URL, getMediaUrl } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import PageHero from '../../components/common/common_page_hero';

const PLACEHOLDER_PRIESTS = [
  { _id: '1', name: 'Rev. Fr. A. Arockiaraj', designation: 'Parish Priest', isCurrent: true, order: 1, phone: '+91 98765 XXXXX', email: 'priest@sjdb.in', bio: 'Currently serving as the Parish Priest of St. John de Britto\'s Church, Kalayarkoil. Dedicated to pastoral ministry and community service.' },
  { _id: '2', name: 'Rev. Fr. S. Raj Kumar', designation: 'Assistant Priest', isCurrent: true, order: 2, phone: '+91 87654 XXXXX', email: 'asst@sjdb.in', bio: 'Assisting the parish priest in all sacramental and pastoral activities of the parish.' },
  { _id: '3', name: 'Rev. Fr. M. Xavier', designation: 'Former Parish Priest', isCurrent: false, order: 3, startDate: '2010-01-01', endDate: '2018-12-31', bio: 'Served the parish faithfully for 8 years with great devotion and love.' },
  { _id: '4', name: 'Rev. Fr. P. Antony', designation: 'Former Parish Priest', isCurrent: false, order: 4, startDate: '2002-01-01', endDate: '2009-12-31', bio: 'Led the parish during a period of significant growth and community development.' },
];

function PriestCard({ priest, index }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="church-card text-center group"
    >
      {/* Photo */}
      <div className="relative mb-5">
        <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-gold-200 shadow-gold group-hover:border-church-gold transition-all duration-300">
          {priest.photo ? (
            <img 
              src={getMediaUrl(priest.photo)} 
              alt={priest.name} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="w-full h-full mx-auto flex items-center justify-center bg-church-gradient text-white">
              <GiChurch className="text-4xl" />
            </div>
          )}
        </div>
        {priest.isCurrent && (
          <span className="absolute bottom-0 right-1/2 translate-x-16 translate-y-2 badge badge-green text-xs">Current</span>
        )}
      </div>

      <h3 className="font-display text-lg font-bold text-church-royal-blue  mb-1">{priest.name}</h3>
      <p className="text-church-gold font-semibold text-sm mb-1">{priest.designation}</p>

      {(priest.startDate || priest.endDate) && (
        <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mb-3">
          <FiCalendar />
          {priest.startDate && <span>{new Date(priest.startDate).getFullYear()}</span>}
          {priest.endDate && <span>– {new Date(priest.endDate).getFullYear()}</span>}
          {!priest.endDate && priest.startDate && <span>– Present</span>}
        </div>
      )}

      {priest.bio && <p className="text-gray-500  text-sm leading-relaxed mb-4">{priest.bio}</p>}

      {/* Contact */}
      {priest.isCurrent && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {priest.phone && (
            <a href={`tel:${priest.phone}`} className="flex items-center gap-1 text-xs bg-blue-50  text-blue-600  px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
              <FiPhone /> {priest.phone}
            </a>
          )}
          {priest.phone && (
            <a href={`https://wa.me/${priest.phone?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs bg-green-50  text-green-600 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors">
              <FaWhatsapp /> WhatsApp
            </a>
          )}
          {priest.email && (
            <a href={`mailto:${priest.email}`} className="flex items-center gap-1 text-xs bg-gold-50  text-gold-700 px-3 py-1.5 rounded-full hover:bg-gold-100 transition-colors">
              <FiMail /> {priest.email}
            </a>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function Priests() {
  const { t } = useTranslation();
  const [priests, setPriests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/priests').then(r => setPriests(r.data.priests?.length ? r.data.priests : PLACEHOLDER_PRIESTS)).catch(() => setPriests(PLACEHOLDER_PRIESTS)).finally(() => setLoading(false));
  }, []);

  const current = priests.filter(p => p.isCurrent);
  const former = priests.filter(p => !p.isCurrent);

  return (
    <div className="min-h-screen pt-10 bg-church-cream ">
      <PageHero title={<>{t('nav.priests')}</>} subtitle={<>Our Clergy</>} />

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          {loading ? <SectionLoader /> : (
            <>
              {current.length > 0 && (
                <div className="mb-16">
                  <p className="section-subtitle text-center mb-2">Present</p>
                  <h2 className="section-title text-center mb-10">Current Clergy</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {current.map((p, i) => <PriestCard key={p._id} priest={p} index={i} />)}
                  </div>
                </div>
              )}
              {former.length > 0 && (
                <div>
                  <p className="section-subtitle text-center mb-2">Past Servants</p>
                  <h2 className="section-title text-center mb-10">Former Parish Priests</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {former.map((p, i) => <PriestCard key={p._id} priest={p} index={i} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
