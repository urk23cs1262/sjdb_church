import churchLogo from '../../assets/church_extirior.png';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GiChurch, GiCrucifix, GiFlame, GiLaurelCrown, GiBookAura, GiCandleFlame } from 'react-icons/gi';
import { FiMapPin, FiNavigation, FiExternalLink, FiUsers, FiCalendar, FiHeart, FiAward, FiCompass } from 'react-icons/fi';
import PageHero from '../../components/common/common_page_hero';

const STATIONS = [
  {
    name: 'St. John de Britto Church (Main Parish)',
    tamilName: 'புனித அருளானந்தர் ஆலயம் (தலைமைப் பங்கு)',
    type: 'Main Parish Center',
    location: 'Kalayarkoil, Sivaganga District, Tamil Nadu - 630551',
    mapUrl: 'https://maps.google.com/?q=St+John+de+Britto+Church+Kalayarkoil',
    families: '450+ Catholic Families',
    isMain: true
  },
  {
    name: 'Pallithammam Sub-Station',
    tamilName: 'பள்ளித்தம்மம் கிளைப் பங்கு',
    type: 'Sub-Station',
    location: 'Pallithammam, Kalayarkoil Region, Sivaganga District',
    mapUrl: 'https://maps.google.com/?q=Pallithammam+Sivaganga',
    families: '80+ Families',
    isMain: false
  },
  {
    name: 'Nedungulam Sub-Station',
    tamilName: 'நெடுங்குளம் கிளைப் பங்கு',
    type: 'Sub-Station',
    location: 'Nedungulam, Kalayarkoil Region, Sivaganga District',
    mapUrl: 'https://maps.google.com/?q=Nedungulam+Sivaganga',
    families: '65+ Families',
    isMain: false
  },
  {
    name: 'Kalluvazhy Sub-Station',
    tamilName: 'கல்லுவாழி கிளைப் பங்கு',
    type: 'Sub-Station',
    location: 'Kalluvazhy, Kalayarkoil Region, Sivaganga District',
    mapUrl: 'https://maps.google.com/?q=Kalluvazhy+Sivaganga',
    families: '90+ Families',
    isMain: false
  },
  {
    name: 'Natarajapuram Sub-Station',
    tamilName: 'நடராஜபுரம் கிளைப் பங்கு',
    type: 'Sub-Station',
    location: 'Natarajapuram, Kalayarkoil Region, Sivaganga District',
    mapUrl: 'https://maps.google.com/?q=Natarajapuram+Sivaganga',
    families: '50+ Families',
    isMain: false
  },
  {
    name: 'Susaiapparpattinam Sub-Station',
    tamilName: 'சூசையப்பர்பட்டினம் கிளைப் பங்கு',
    type: 'Sub-Station',
    location: 'Susaiapparpattinam, Kalayarkoil Region, Sivaganga District',
    mapUrl: 'https://maps.google.com/?q=Susaiapparpattinam+Sivaganga',
    families: '110+ Families',
    isMain: false
  },
  {
    name: 'Maravamangalam Sub-Station',
    tamilName: 'மறவமங்கலம் கிளைப் பங்கு',
    type: 'Sub-Station',
    location: 'Maravamangalam, Kalayarkoil Region, Sivaganga District',
    mapUrl: 'https://maps.google.com/?q=Maravamangalam+Sivaganga',
    families: '75+ Families',
    isMain: false
  }
];

const timeline = [
  {
    era: 'Early Heritage',
    title: 'Missionary Foundation in Kalayarkoil',
    description: 'Catholic presence established in the Kalayarkoil region under the pastoral inspiration of the Jesuit mission in South India.'
  },
  {
    era: 'Centuries of Faith',
    title: 'Growth of the Local Catholic Community',
    description: 'Construction and dedication of the central church structure to serve the growing family of local faithful.'
  },
  {
    era: 'Patronal Heritage',
    title: 'Dedicated to St. John de Britto (Arulanandar)',
    description: 'The parish officially honors St. John de Britto, celebrating his life of selfless missionary inculturation and martyrdom at Oriur.'
  },
  {
    era: 'Pastoral Expansion',
    title: 'Network of Sub-Stations Established',
    description: 'Establishment and expansion of village sub-stations across Pallithammam, Nedungulam, Kalluvazhy, Natarajapuram, Susaiapparpattinam, and Maravamangalam.'
  },
  {
    era: 'Sanctuary Enhancements',
    title: 'Renovation and Altar Consecration',
    description: 'Comprehensive beautification of the sanctuary, expansion of seating, and installation of liturgical stained glass.'
  },
  {
    era: 'Modern Era',
    title: 'Community Empowerment & Digital Services',
    description: 'Development of youth ministry, pious associations, community welfare outreach, and the SJDB Connect digital parish portal.'
  }
];

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen pt-10 bg-church-cream">
      {/* 1. Hero & Our Story */}
      <PageHero
        title={<>{t('nav.about')}</>}
        subtitle={<>Our Story</>}
        description={<>Rich in faith, rooted in history, growing in love</>}
      />

      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          
          {/* 2 & 3. About Church & Our History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="section-subtitle mb-2 inline-block">Our History</span>
              <h2 className="section-title mb-6">A Church with Deep Roots</h2>
              <div className="space-y-4 text-gray-700 leading-relaxed text-sm sm:text-base">
                <p>
                  St. John de Britto's Church, situated in Kalayarkoil, Tamil Nadu, is a vibrant beacon of faith in the Sivaganga Diocese. Named after <strong>St. John de Britto (Arulanandar)</strong>, the Jesuit missionary and martyr, the parish stands as a spiritual home for generations of devout Catholic families.
                </p>
                <p>
                  Our parish community is rooted in prayer, the celebration of the Holy Eucharist, and dedicated service to the community. Guided by the missionary zeal of our patron saint, we strive to live out the Gospel message of love, reconciliation, and hope.
                </p>
                <p>
                  Today, the parish encompasses a wide network of sub-stations across the Kalayarkoil region, uniting over 900 Catholic families in fellowship, sacramental life, and pastoral care.
                </p>
              </div>
            </motion.div>

            {/* 4 & 5. Mission, Vision & Parish Information */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card p-8 space-y-6 shadow-xl border border-white/60"
            >
              <div>
                <h3 className="font-display text-xl font-bold text-church-royal-blue mb-2 flex items-center gap-2">
                  <FiCompass className="text-church-gold" /> Mission
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  To proclaim the Gospel of Jesus Christ, celebrate the sacraments reverently, nurture a vibrant faith community, and reach out to the poor and marginalized in the missionary spirit of St. John de Britto.
                </p>
              </div>

              <div>
                <h3 className="font-display text-xl font-bold text-church-royal-blue mb-2 flex items-center gap-2">
                  <FiHeart className="text-church-gold" /> Vision
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  To be a living communion of disciples rooted in the Eucharist, distinguished by Christian charity, mutual respect, and active participation across the entire Kalayarkoil parish network.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                {[
                  ['Diocese', 'Sivaganga Diocese'],
                  ['Parish', 'Kalayarkoil Parish'],
                  ['Patron', 'St. John de Britto'],
                  ['Sub-stations', '6 Village Stations']
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50/80 p-3 rounded-xl">
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{k}</p>
                    <p className="font-bold text-church-royal-blue text-sm">{v}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* 4. Our Patron Saint — Positioned right with Our History */}
          <div className="mb-24">
            <div className="text-center mb-10">
              <GiCrucifix className="text-church-gold text-5xl mx-auto mb-3" />
              <span className="section-subtitle mb-2 inline-block">Our Patron Saint</span>
              <h2 className="section-title text-3xl md:text-4xl text-church-royal-blue font-display">St. John de Britto</h2>
              <p className="text-xl md:text-2xl text-church-gold font-bold font-tamil mt-1">புனித அருளானந்தர்</p>
            </div>

            <div className="bg-white rounded-3xl p-6 sm:p-10 md:p-12 shadow-xl border border-amber-100 space-y-10">
              
              {/* Introduction & Life */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-b border-gray-100 pb-8">
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  <h3 className="text-xl font-bold text-church-royal-blue flex items-center gap-2">
                    <GiCandleFlame className="text-church-gold text-2xl flex-shrink-0" />
                    A Missionary Who Became One with the People
                  </h3>
                  <p>
                    St. John de Britto was a Portuguese Jesuit priest and missionary who came to South India in the 17th century to proclaim the Gospel. Born in Lisbon on March 1, 1647, he entered the Society of Jesus and dedicated his life wholeheartedly to missionary service.
                  </p>
                  <p>
                    Coming to Tamil Nadu, he made a remarkable and pioneering effort to understand the language, culture, customs, and way of life of the people he served. He adopted local dress, lived as an ascetic (Pandaraswami), and became affectionately known as <strong>Arulanandar</strong>. His missionary life continues to inspire generations of Tamil Catholics.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-6 sm:p-8 rounded-2xl border border-amber-200/60">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FiAward className="text-church-gold text-base" /> Quick Facts
                  </h4>
                  <div className="space-y-3 text-xs sm:text-sm">
                    <div className="flex justify-between border-b border-amber-200/40 pb-2">
                      <span className="text-gray-600 font-medium">Born:</span>
                      <span className="font-bold text-church-royal-blue">March 1, 1647 (Lisbon, Portugal)</span>
                    </div>
                    <div className="flex justify-between border-b border-amber-200/40 pb-2">
                      <span className="text-gray-600 font-medium">Tamil Name:</span>
                      <span className="font-bold text-church-royal-blue font-tamil">புனித அருளானந்தர் (Arulanandar)</span>
                    </div>
                    <div className="flex justify-between border-b border-amber-200/40 pb-2">
                      <span className="text-gray-600 font-medium">Martyrdom:</span>
                      <span className="font-bold text-church-royal-blue">February 4, 1693 (Oriur, Tamil Nadu)</span>
                    </div>
                    <div className="flex justify-between border-b border-amber-200/40 pb-2">
                      <span className="text-gray-600 font-medium">Canonization:</span>
                      <span className="font-bold text-church-royal-blue">June 22, 1947 by Pope Pius XII</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-gray-600 font-medium">Feast Day:</span>
                      <span className="font-bold text-church-gold text-base">February 4</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mission & Martyrdom Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-lg font-bold text-church-royal-blue flex items-center gap-2">
                    <GiBookAura className="text-church-gold text-xl" /> His Mission in Tamil Nadu
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    St. John de Britto believed that the Gospel should be proclaimed with deep respect for the people and their culture. He travelled extensively across the Madurai mission, lived simply, taught the Christian faith, celebrated the sacraments, and encouraged communities to remain steadfast in Christ.
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    His life was marked by courage, simplicity, constant prayer, sacrifice, and an unwavering pastoral commitment to the people entrusted to his care.
                  </p>
                </div>

                <div className="p-6 bg-red-50/50 rounded-2xl border border-red-100 space-y-3">
                  <h4 className="text-lg font-bold text-church-royal-blue flex items-center gap-2">
                    <GiFlame className="text-red-600 text-xl" /> His Martyrdom
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Because of his fruitful missionary work and uncompromising commitment to Christ and Christian morals, St. John de Britto faced intense opposition and persecution. He was beheaded at Oriur in the Ramanathapuram region on <strong>February 4, 1693</strong>.
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    His martyrdom became a luminous, timeless witness to his heroic faith and profound love for the people of South India.
                  </p>
                </div>
              </div>

              {/* Canonization, Legacy & Feast Day */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                <div className="p-6 bg-amber-50/60 rounded-2xl border border-amber-200/70 space-y-2">
                  <h5 className="font-bold text-church-royal-blue text-base flex items-center gap-2">
                    <GiLaurelCrown className="text-church-gold text-xl" /> Canonization
                  </h5>
                  <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                    St. John de Britto was formally canonized by <strong>Pope Pius XII on June 22, 1947</strong>. His life and martyrdom hold a sacred place in the spiritual heritage of the Catholic Church in Tamil Nadu and across the universal Church.
                  </p>
                </div>

                <div className="p-6 bg-blue-50/60 rounded-2xl border border-blue-200/70 space-y-2">
                  <h5 className="font-bold text-church-royal-blue text-base flex items-center gap-2">
                    <FiHeart className="text-church-royal-blue text-lg" /> His Living Legacy
                  </h5>
                  <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                    For the parish community of Kalayarkoil, he is our guiding patron. His life inspires us to remain deeply rooted in Christ, to serve others with compassion, and to live our faith boldly through word and good example.
                  </p>
                </div>

                <div className="p-6 bg-emerald-50/60 rounded-2xl border border-emerald-200/70 space-y-2">
                  <h5 className="font-bold text-church-royal-blue text-base flex items-center gap-2">
                    <FiCalendar className="text-emerald-700 text-lg" /> Feast Day — February 4
                  </h5>
                  <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                    Every year on <strong>February 4th</strong>, the parish family and pilgrims gather in prayer, thanksgiving, and solemn Eucharistic celebration, remembering his heroic witness and seeking his powerful intercession.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* 5. Parish Network (Main Parish & Sub-Stations) */}
          <div className="mb-24">
            <div className="text-center mb-10">
              <span className="section-subtitle mb-2 inline-block">Parish Network</span>
              <h2 className="section-title">Main Parish & Sub-Stations</h2>
              <p className="text-gray-600 text-sm max-w-2xl mx-auto mt-2">
                Serving the faithful across Kalayarkoil and surrounding village communities with weekly masses, sacraments, and pastoral programs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {STATIONS.map((station, index) => (
                <motion.div
                  key={station.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className={`church-card flex flex-col justify-between p-6 ${
                    station.isMain ? 'border-2 border-church-gold shadow-gold bg-amber-50/40' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        station.isMain ? 'bg-church-gold text-white' : 'bg-church-royal-blue/10 text-church-royal-blue'
                      }`}>
                        {station.type}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                        <FiUsers className="text-church-gold" /> {station.families}
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-lg text-church-royal-blue mb-1">
                      {station.name}
                    </h3>
                    <p className="text-sm font-semibold text-church-gold mb-3">{station.tamilName}</p>

                    <p className="text-xs text-gray-600 flex items-start gap-2 mb-4 leading-relaxed">
                      <FiMapPin className="text-red-500 flex-shrink-0 mt-0.5 text-sm" />
                      <span>{station.location}</span>
                    </p>
                  </div>

                  <a
                    href={station.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-white border border-gray-200 text-church-royal-blue hover:bg-church-gold hover:text-white hover:border-church-gold shadow-sm"
                  >
                    <FiNavigation className="text-sm" /> View Location on Maps <FiExternalLink className="text-[10px]" />
                  </a>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 6. Through the Years & Church Milestones */}
          <div>
            <div className="text-center mb-12">
              <span className="section-subtitle mb-2 inline-block">Through the Years</span>
              <h2 className="section-title">Church Milestones & Heritage</h2>
              <p className="text-gray-600 text-sm max-w-xl mx-auto mt-2">
                A journey of continuous faith, community solidarity, and spiritual growth in Kalayarkoil.
              </p>
            </div>

            <div className="relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-church-gold via-church-royal-blue to-church-gold hidden md:block" />
              <div className="space-y-8">
                {timeline.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className={`flex items-center gap-6 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                  >
                    <div className={`flex-1 ${i % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                      <div className="church-card inline-block text-left p-5 hover:shadow-md transition-shadow">
                        <span className="text-xs font-bold text-church-gold uppercase tracking-wider block mb-1">
                          {item.era}
                        </span>
                        <h4 className="font-bold text-church-royal-blue text-base mb-1">
                          {item.title}
                        </h4>
                        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:flex w-10 h-10 rounded-full bg-church-gradient items-center justify-center flex-shrink-0 shadow-gold z-10">
                      <GiCrucifix className="text-white text-sm" />
                    </div>
                    <div className="flex-1 hidden md:block" />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
