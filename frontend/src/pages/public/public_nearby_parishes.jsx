import { motion } from 'framer-motion';
import { FiMapPin, FiNavigation, FiExternalLink, FiCompass, FiStar } from 'react-icons/fi';
import { GiChurch, GiCrucifix } from 'react-icons/gi';
import PageHero from '../../components/common/common_page_hero';

const NEARBY_SHRINES = [
  {
    name: 'St. John de Britto Martyrdom Shrine',
    tamilName: 'ஓரியூர் புனித அருளானந்தர் இரத்தசாட்சி திருத்தலம்',
    location: 'Oriur, Ramanathapuram District (~60 km from Kalayarkoil)',
    distance: '60 km',
    famousFor: 'Sacred place of martyrdom of St. John de Britto (Arulanandar) in 1693. Famous for the miraculous Red Sand dunes where his blood spilled, providing physical and spiritual healing to pilgrims.',
    highlights: ['Miraculous Red Sand Dune', 'Martyrdom Rock & Shrine', 'Annual Feast on Feb 4th', 'Healing Mass & Prayers'],
    mapUrl: 'https://maps.google.com/?q=St+John+de+Britto+Shrine+Oriur',
    badge: 'Martyrdom Shrine'
  },
  {
    name: 'Sacred Heart of Jesus Church',
    tamilName: 'இடைக்காட்டூர் திரு இருதய ஆண்டவர் திருத்தலம்',
    location: 'Idaikattur, Sivaganga District (~35 km from Kalayarkoil)',
    distance: '35 km',
    famousFor: 'Famous for its Gothic-style architecture built in 1894 by French missionary Fr. Ferdinand Celle SJ, which is a replica of Rheims Cathedral in France. Renowned for architectural beauty and spiritual significance attracting pilgrims. Idaikattur is also historically linked to Tamil Siddhar Idaikaadar who hosted Navagrahas during a famine.',
    highlights: ['Replica of Rheims Cathedral', 'French Gothic Architecture', '40 French Angel Statues', 'Siddhar Idaikaadar Historical Link'],
    mapUrl: 'https://maps.google.com/?q=Sacred+Heart+Church+Idaikattur',
    badge: 'Heritage Shrine'
  },

  {
    name: "St. Anthony's Shrine",
    tamilName: 'புலியால் புனித அந்தோனியார் திருத்தலம்',
    location: 'Pulial, Sivaganga District (~28 km from Kalayarkoil)',
    distance: '28 km',
    famousFor: 'A major regional pilgrimage center dedicated to St. Anthony of Padua. Renowned for Tuesday Novena prayers, oil and bread blessings, and numerous documented healing miracles.',
    highlights: ['Tuesday Novena Prayers', 'Blessing of Oil & Bread', 'Deliverance Prayers', 'Grand Feast in June'],
    mapUrl: 'https://maps.google.com/?q=Pulial+St+Anthony+Church+Sivaganga',
    badge: 'Miracle Shrine'
  },
  {
    name: "St. Mary's Cathedral (Madurai Archdiocese)",
    tamilName: 'மதுரை மறைமாவட்ட முதன்மை பேராலயம்',
    location: 'East Veli Street, Madurai (~65 km from Kalayarkoil)',
    distance: '65 km',
    famousFor: 'The seat of the Roman Catholic Archdiocese of Madurai. Constructed in 1841 with magnificent 42-meter twin spires combining Roman, Gothic, and Continental European architecture.',
    highlights: ['Archdiocesan Seat', '42-Meter Twin Spires', '180+ Years Sacred Heritage', 'Stained Glass Art'],
    mapUrl: 'https://maps.google.com/?q=St+Marys+Cathedral+Madurai',
    badge: 'Archdiocesan Cathedral'
  },
  {
    name: 'Our Lady of Snows Shrine',
    tamilName: 'கல்லுகட்டி பனிமய மாதா திருத்தலம்',
    location: 'Kallukatti, Karaikudi, Sivaganga District (~42 km from Kalayarkoil)',
    distance: '42 km',
    famousFor: 'Historic Marian shrine in Karaikudi famous for its annual August Car Festival (தேர் பவனி) pulling massive decorated chariots with thousands of faithful devotees participating.',
    highlights: ['August Grand Car Festival', 'Marian Shrine & Novena', 'Daily Adoration', 'Historic Chariots'],
    mapUrl: 'https://maps.google.com/?q=Our+Lady+of+Snows+Church+Karaikudi',
    badge: 'Marian Shrine'
  }
];

export default function NearbyParishes() {
  return (
    <div className="min-h-screen pt-10 bg-church-cream">
      <PageHero
        title={<>Famous Nearby Shrines & Parishes</>}
        subtitle={<>Regional Pilgrimage Sites</>}
        description={<>Historic Catholic shrines and sacred pilgrimage destinations in the Sivaganga & Ramnad region</>}
      />

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="section-subtitle">Pilgrim Guide</p>
            <h2 className="section-title">Sacred Destinations Near Kalayarkoil</h2>
            <p className="text-gray-600 text-sm max-w-2xl mx-auto mt-2">
              Explore famous shrines and historical parishes surrounding St. John de Britto Church, renowned for miracles, architecture, and spiritual heritage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {NEARBY_SHRINES.map((shrine, index) => (
              <motion.div
                key={shrine.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="church-card flex flex-col justify-between p-7 relative overflow-hidden hover:shadow-gold-lg border border-gray-100 transition-all"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-church-gold/15 text-amber-900 border border-gold-300 uppercase tracking-wider flex items-center gap-1">
                      <FiStar className="text-church-gold" /> {shrine.badge}
                    </span>
                    <span className="text-xs font-bold text-church-royal-blue bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1">
                      <FiCompass className="text-church-gold" /> {shrine.distance}
                    </span>
                  </div>

                  {/* Title & Tamil Name */}
                  <h3 className="font-display font-bold text-xl text-church-royal-blue mb-1">
                    {shrine.name}
                  </h3>
                  <p className="text-sm font-semibold text-church-gold mb-3 font-tamil">
                    {shrine.tamilName}
                  </p>

                  {/* Famous For */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">What it is Famous for:</p>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">{shrine.famousFor}</p>
                  </div>

                  {/* Key Highlights */}
                  <div className="mb-5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Key Highlights & Features:</p>
                    <div className="flex flex-wrap gap-2">
                      {shrine.highlights.map(h => (
                        <span key={h} className="text-[11px] font-semibold bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-lg">
                          • {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Location address */}
                  <p className="text-xs text-gray-500 flex items-start gap-2 mb-5 leading-relaxed">
                    <FiMapPin className="text-red-500 flex-shrink-0 mt-0.5 text-sm" />
                    <span>{shrine.location}</span>
                  </p>
                </div>

                {/* Map Link */}
                <a
                  href={shrine.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-royal w-full justify-center text-xs py-3 rounded-xl shadow-sm hover:shadow-royal transition-all"
                >
                  <FiNavigation className="text-sm" /> View Location & Directions <FiExternalLink className="text-xs" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
