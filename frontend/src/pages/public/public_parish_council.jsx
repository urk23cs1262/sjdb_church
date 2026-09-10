import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiShield, FiHeart, FiAward, FiCalendar, FiClock,
  FiMapPin, FiPhone, FiMail, FiMessageSquare, FiExternalLink,
  FiChevronRight, FiSearch, FiCheckCircle, FiFileText,
  FiArrowUp, FiInfo, FiSend, FiX, FiActivity, FiStar, FiBook, FiMusic, FiGlobe
} from 'react-icons/fi';
import {
  GiChurch, GiCrucifix, GiPrayerBeads,
  GiDove, GiScales, GiReceiveMoney, GiBread
} from 'react-icons/gi';
import { FaWhatsapp } from 'react-icons/fa';
import api, { getMediaUrl } from '../../services/api';
import PageHero from '../../components/common/common_page_hero';
import { SectionLoader } from '../../components/common/common_loader';

// Core Council Responsibilities
const RESPONSIBILITIES = [
  {
    icon: <GiChurch className="text-3xl text-church-gold" />,
    title: 'Parish Administration',
    titleTa: 'பங்கு நிர்வாகம்',
    desc: 'Assisting the Parish Priest in strategic planning, infrastructure maintenance, governance, and overall coordination of church affairs.',
    descTa: 'பங்குத்தந்தைக்கு நிர்வாக ஆலோசனைகள் வழங்குதல், உள்கட்டமைப்பு மற்றும் திட்டங்களை மேற்பார்வையிடுதல்.'
  },
  {
    icon: <GiCrucifix className="text-3xl text-church-royal-blue" />,
    title: 'Pastoral & Liturgical Life',
    titleTa: 'ஆன்மீகம் & திருவழிபாடு',
    desc: 'Deepening spirituality through Holy Masses, Eucharistic Adoration, choir coordination, alter service, and feast day planning.',
    descTa: 'திருப்பலிகள், ஆராதனைகள் மற்றும் திருவிழாக்களை பக்திப்பூர்வமாக ஒழுங்கமைத்து வழிநடத்துதல்.'
  },
  {
    icon: <GiReceiveMoney className="text-3xl text-emerald-600" />,
    title: 'Finance & Parish Transparency',
    titleTa: 'நிதி & வரவு செலவு மேலாண்மை',
    desc: 'Reviewing parish accounts, preparing annual budget reports, ensuring financial stewardship, and overseeing developmental contributions.',
    descTa: 'பங்கு நிதி நிலை அறிக்கைகளை வெளிப்படைத்தன்மையுடன் பரிசீலித்து பங்கு மக்களுக்கு சமர்ப்பித்தல்.'
  },
  {
    icon: <FiShield className="text-3xl text-red-600" />,
    title: 'Socio-Charitable Outreach',
    titleTa: 'சமூக நலப் பணிகள் & உதவி',
    desc: 'Extending compassion through education scholarships, medical aid, disaster relief, and monthly food provisions to underprivileged families.',
    descTa: 'ஏழை எளிய மக்களுக்கு மருத்துவ உதவி, கல்வி உதவித்தொகை மற்றும் உணவுப் பொருட்கள் வழங்குதல்.'
  },
  {
    icon: <FiUsers className="text-3xl text-amber-600" />,
    title: 'Youth & Family Care',
    titleTa: 'இளைஞர் & குடும்ப நலன்',
    desc: 'Fostering youth involvement, organizing sports/leadership camps, marriage counseling, and strengthening Christian family bonds.',
    descTa: 'இளைஞர் வழிகாட்டுதல் முகாம்கள், குடும்ப நல கருத்தரங்குகள் மற்றும் ஒற்றுமையை வளர்த்தல்.'
  },
  {
    icon: <GiScales className="text-3xl text-indigo-600" />,
    title: 'Anbiyam Network Coordination',
    titleTa: 'அன்பியங்களின் ஒருங்கிணைப்பு',
    desc: 'Connecting all Basic Christian Communities (Anbiyams) to promote fraternal unity, local prayer meetings, and parish participation.',
    descTa: 'அனைத்து அடிப்படை கிறிஸ்தவ சமூகங்களை (அன்பியங்கள்) ஒன்றிணைத்து பங்குப் பணிகளில் ஈடுபடுத்துதல்.'
  }
];

// Parish Ministries & Wings
const MINISTRIES = [
  {
    name: 'Youth Ministry (ICYM)',
    nameTa: 'இளைஞர் இயக்கம்',
    icon: <FiStar className="text-2xl text-amber-500" />,
    coordinator: 'Mr. F. John',
    phone: '+91 94432 XXXXX',
    desc: 'Empowering young Catholics through faith formation, music, social outreach, and leadership development.'
  },
  {
    name: "Women's Commission",
    nameTa: 'மகளிர் ஆணையம்',
    icon: <FiHeart className="text-2xl text-pink-600" />,
    coordinator: 'Mrs. E. Rose',
    phone: '+91 98421 XXXXX',
    desc: 'Nurturing Christian mothers and women in family prayer, self-help initiatives, and parish hospitality.'
  },
  {
    name: 'Catechism & Faith Formation',
    nameTa: 'மறைக்கல்வி மன்றம்',
    icon: <FiBook className="text-2xl text-blue-600" />,
    coordinator: 'Mrs. G. Elizabeth',
    phone: '+91 97890 XXXXX',
    desc: 'Guiding parish children from Kindergarten to 12th grade in Bible teachings and sacramental preparation.'
  },
  {
    name: 'Parish Choir (Tamil & English)',
    nameTa: 'பங்கு பாடகர் குழு',
    icon: <FiMusic className="text-2xl text-purple-600" />,
    coordinator: 'Mr. S. Daniel',
    phone: '+91 96554 XXXXX',
    desc: 'Elevating Holy Mass liturgies with devotional hymns, orchestral accompaniment, and festive choir training.'
  },
  {
    name: 'Altar Servers Guild',
    nameTa: 'பலிபீட சிறுவர்கள் சங்கம்',
    icon: <GiDove className="text-2xl text-amber-600" />,
    coordinator: 'Master K. Paul',
    phone: '+91 94883 XXXXX',
    desc: 'Training disciplined boys and girls to assist the priest reverently at the altar during liturgical services.'
  },
  {
    name: 'Society of St. Vincent de Paul (SSVP)',
    nameTa: 'தூய வின்சென்ட் தே பவுல் சபை',
    icon: <GiBread className="text-2xl text-amber-700" />,
    coordinator: 'Mr. V. Anthony',
    phone: '+91 94441 XXXXX',
    desc: 'Providing monthly food provisions, medical assistance, and educational aid to marginalized families.'
  },
  {
    name: 'Family & Marriage Commission',
    nameTa: 'குடும்ப நல இயக்கம்',
    icon: <FiUsers className="text-2xl text-rose-600" />,
    coordinator: 'Mr. & Mrs. Joseph',
    phone: '+91 93610 XXXXX',
    desc: 'Offering pre-marital guidance, family renewal retreats, and pastoral support for married couples.'
  },
  {
    name: 'Media & Digital Communications',
    nameTa: 'ஊடக & தொழில்நுட்ப குழு',
    icon: <FiGlobe className="text-2xl text-cyan-600" />,
    coordinator: 'Church Media Team',
    phone: '+91 98940 XXXXX',
    desc: 'Managing live broadcasts, website updates, audio/visual systems, and digital announcement bulletins.'
  }
];

// Fallback Default Council Members if DB has none
const FALLBACK_COUNCIL = [
  {
    name: 'Mr. A. Xavier',
    role: 'President',
    department: 'Parish Council',
    badge: 'Council President',
    phone: '+91 98765 43210',
    email: 'council.president@sjdbchurch.org',
    description: 'Elected Parish Council President overseeing strategic decisions, pastoral coordination, and parish development initiatives.',
    image: ''
  },
  {
    name: 'Mr. B. Raj',
    role: 'Vice President',
    department: 'Parish Council',
    badge: 'Vice President',
    phone: '+91 87654 32109',
    email: 'council.vp@sjdbchurch.org',
    description: 'Assists the President in parish council administration and leads infrastructure development committees.',
    image: ''
  },
  {
    name: 'Mrs. C. Mary',
    role: 'Secretary',
    department: 'Parish Council',
    badge: 'Council Secretary',
    phone: '+91 76543 21098',
    email: 'council.secretary@sjdbchurch.org',
    description: 'Maintains official parish council records, minutes of monthly meetings, and communication with diocesan offices.',
    image: ''
  },
  {
    name: 'Mr. D. Peter',
    role: 'Treasurer',
    department: 'Parish Council',
    badge: 'Council Treasurer',
    phone: '+91 65432 10987',
    email: 'council.treasurer@sjdbchurch.org',
    description: 'Supervises financial accounts, parish annual budget allocations, and development project funding.',
    image: ''
  },
  {
    name: 'Mrs. E. Rose',
    role: "Women's Wing Representative",
    department: 'Parish Council',
    badge: "Women's Commission",
    phone: '+91 54321 09876',
    email: 'women.wing@sjdbchurch.org',
    description: "Represents parish women's commission, coordinating family prayer groups and charity endeavors.",
    image: ''
  },
  {
    name: 'Mr. F. John',
    role: 'Youth Wing Representative',
    department: 'Parish Council',
    badge: 'Youth Ministry',
    phone: '+91 43210 98765',
    email: 'youth.wing@sjdbchurch.org',
    description: 'Leads the Indian Catholic Youth Movement (ICYM) unit, engaging parish youth in liturgical and social projects.',
    image: ''
  },
  {
    name: 'Mrs. G. Elizabeth',
    role: 'Catechism Superintendent',
    department: 'Parish Council',
    badge: 'Catechism Head',
    phone: '+91 32109 87654',
    email: 'catechism@sjdbchurch.org',
    description: 'Oversees Sunday school teachers, children faith formation, and First Holy Communion preparations.',
    image: ''
  },
  {
    name: 'Mr. V. Anthony',
    role: 'Social Service In-charge (SSVP)',
    department: 'Parish Council',
    badge: 'SSVP Representative',
    phone: '+91 94441 22334',
    email: 'ssvp@sjdbchurch.org',
    description: 'Coordinates weekly charity visits, medical emergency assistance, and welfare programs for the underprivileged.',
    image: ''
  }
];

export default function ParishCouncil() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [priests, setPriests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCouncilData();
  }, []);

  const fetchCouncilData = async () => {
    try {
      setLoading(true);
      const [teamRes, priestsRes] = await Promise.allSettled([
        api.get('/team'),
        api.get('/priests')
      ]);

      if (teamRes.status === 'fulfilled' && teamRes.value.data?.members) {
        const councilList = teamRes.value.data.members.filter(m => 
          m.department === 'Parish Council' || 
          m.role?.toLowerCase().includes('council') ||
          m.role?.toLowerCase().includes('president') ||
          m.role?.toLowerCase().includes('secretary') ||
          m.role?.toLowerCase().includes('treasurer')
        );
        setTeamMembers(councilList.length > 0 ? councilList : teamRes.value.data.members.filter(m => m.department === 'Leadership' || m.department === 'Parish Council'));
      }

      if (priestsRes.status === 'fulfilled' && priestsRes.value.data?.priests) {
        setPriests(priestsRes.value.data.priests);
      }
    } catch (err) {
      console.error('Error loading parish council data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Primary Parish Priest (Ex-officio President)
  const parishPriest = useMemo(() => {
    if (priests.length > 0) {
      const current = priests.find(p => p.type === 'current' || p.role?.toLowerCase().includes('parish priest'));
      return current || priests[0];
    }
    return {
      name: 'Rev. Fr. Parish Priest',
      role: 'Parish Priest & Ex-Officio President',
      phone: '+91 98400 12345',
      email: 'parishpriest@sjdbchurch.org',
      description: 'Spiritual Leader and Ex-Officio President of the Parish Council, guiding the parish community in faith, pastoral care, and administrative governance.',
      image: ''
    };
  }, [priests]);

  // Merged Council Members list (DB + Fallback)
  const allMembers = useMemo(() => {
    if (teamMembers.length > 0) {
      return teamMembers;
    }
    return FALLBACK_COUNCIL;
  }, [teamMembers]);

  // Executive Officers (President, VP, Secretary, Treasurer)
  const executiveOfficers = useMemo(() => {
    return allMembers.filter(m => {
      const r = (m.role || '').toLowerCase();
      return r.includes('president') || r.includes('secretary') || r.includes('treasurer');
    });
  }, [allMembers]);

  // Filtered Council Members
  const filteredMembers = useMemo(() => {
    return allMembers.filter(m => {
      const matchesSearch = searchQuery === '' || 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.role && m.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.badge && m.badge.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterCategory === 'All') return true;
      if (filterCategory === 'Executive') {
        const r = (m.role || '').toLowerCase();
        return r.includes('president') || r.includes('secretary') || r.includes('treasurer');
      }
      if (filterCategory === 'Ministries') {
        const r = (m.role || '').toLowerCase();
        return !r.includes('president') && !r.includes('secretary') && !r.includes('treasurer');
      }
      return true;
    });
  }, [allMembers, filterCategory, searchQuery]);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.phone || !contactForm.message) return;
    try {
      setSubmittingContact(true);
      await api.post('/contact', contactForm).catch(() => {});
      setContactSuccess(true);
      setContactForm({
        name: '',
        phone: '',
        email: '',
        subject: 'Parish Council Inquiry',
        message: ''
      });
      setTimeout(() => setContactSuccess(false), 6000);
    } catch (_) {
      setContactSuccess(true);
    } finally {
      setSubmittingContact(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen pt-12 sm:pt-16 bg-slate-50 text-gray-800">
      
      {/* 1. Page Hero Banner */}
      <PageHero 
        title={<>Parish Pastoral Council</>} 
        subtitle={<>பங்கு அருள்பணி பேரவை • Governance & Pastoral Leadership</>} 
      />

      
      {loading ? (
        <div className="py-24">
          <SectionLoader text="Loading Parish Council records..." />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
          
          {/* 2. Introduction & Purpose Overview */}
          <section className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-200/80 shadow-xs relative overflow-hidden">
            {/* <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" /> */}
            
            <div className="w-full">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 text-xs font-bold uppercase tracking-wider mb-3">
                <FiInfo className="text-church-gold" /> Parish Governance & Co-Responsibility
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 leading-tight">
                About the Parish Pastoral Council
              </h2>
              <p className="mt-1 text-sm sm:text-base font-tamil text-church-royal-blue font-bold">
                பங்கின் ஆன்மீக, நிர்வாக மற்றும் சமூக வளர்ச்சிக்கான வழிகாட்டுதல் சபை
              </p>
              <p className="mt-4 text-sm sm:text-base text-gray-600 leading-relaxed text-justify w-full">
                The Parish Pastoral Council of <strong>St. John de Britto's Church</strong> serves as a consultative body to the Parish Priest. Rooted in Catholic Canon Law and Vatican II teachings, the council brings together dedicated lay representatives, religious, and ministry coordinators to foster spiritual growth, oversee administrative integrity, and coordinate all parish ministries for the greater glory of God.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-gray-100">
              <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100 text-center">
                <p className="text-2xl sm:text-3xl font-bold font-display text-church-royal-blue">{allMembers.length + 1}</p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Council Members</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100 text-center">
                <p className="text-2xl sm:text-3xl font-bold font-display text-church-gold">{MINISTRIES.length}</p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Parish Wings</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100 text-center">
                <p className="text-2xl sm:text-3xl font-bold font-display text-emerald-600">12</p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Monthly Meetings</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100 text-center">
                <p className="text-2xl sm:text-3xl font-bold font-display text-indigo-600">100%</p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Parish Co-op</p>
              </div>
            </div>
          </section>

          {/* 3. Council Leadership — Featured Parish Priest Card */}
          <section className="space-y-6">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-church-gold">Council Presidency</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-gray-900">Parish Priest & Spiritual Leader</h2>
              <p className="text-xs font-tamil text-gray-500 font-bold mt-0.5">பங்குத்தந்தை மற்றும் பேரவைத் தலைவர்</p>
            </div>

            <div className="bg-gradient-to-br from-church-royal-blue via-blue-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl max-w-4xl mx-auto relative overflow-hidden border border-blue-800">
              <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative z-10">
                {/* Priest Photo / Avatar */}
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-2 border-church-gold flex-shrink-0 bg-blue-950 shadow-lg relative">
                  {parishPriest.image ? (
                    <img 
                      src={getMediaUrl(parishPriest.image)} 
                      alt={parishPriest.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-church-gold bg-blue-900">
                      <GiCrucifix className="text-5xl" />
                      <span className="text-[10px] font-bold tracking-widest uppercase mt-1">Parish Priest</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div className="inline-flex items-center gap-1.5 bg-church-gold/20 border border-church-gold/40 text-church-gold text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                    <GiCrucifix className="text-xs" /> Ex-Officio President
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">
                    {parishPriest.name}
                  </h3>
                  <p className="text-xs text-blue-200 font-medium leading-relaxed max-w-xl">
                    {parishPriest.description || 'Guides all council committees and spiritual wings in serving the church community.'}
                  </p>

                  {/* Quick Action Contact Links */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-2">
                    {parishPriest.phone && (
                      <a
                        href={`tel:${parishPriest.phone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20"
                      >
                        <FiPhone className="text-xs text-church-gold" />
                        <span>{parishPriest.phone}</span>
                      </a>
                    )}
                    {parishPriest.phone && (
                      <a
                        href={`https://wa.me/${parishPriest.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold transition-all"
                      >
                        <FaWhatsapp className="text-xs" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    {parishPriest.email && (
                      <a
                        href={`mailto:${parishPriest.email}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20"
                      >
                        <FiMail className="text-xs text-amber-300" />
                        <span>{parishPriest.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>


          
          {/* 5. All Council Members & Ministry Heads with Search / Filter */}
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-church-gold">Council Members</span>
                <h2 className="text-2xl sm:text-3xl font-bold font-display text-gray-900">Members & Ministry Heads</h2>
                <p className="text-xs font-tamil text-gray-500 font-bold mt-0.5">பேரவை உறுப்பினர்கள் & இயக்கப் பொறுப்பாளர்கள்</p>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search member or role..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-church-gold/50 w-44 sm:w-56"
                  />
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs font-bold">
                  {['All', 'Executive', 'Ministries'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterCategory(cat)}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        filterCategory === cat
                          ? 'bg-white text-church-royal-blue shadow-2xs font-black'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Members Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMembers.map((member, idx) => (
                <motion.div
                  key={member._id || idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-church-royal-blue to-indigo-900 text-white flex items-center justify-center font-bold text-base flex-shrink-0 shadow-xs">
                      {member.image ? (
                        <img 
                          src={getMediaUrl(member.image)} 
                          alt={member.name}
                          className="w-full h-full object-cover object-top rounded-xl"
                        />
                      ) : (
                        <span>{member.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-gray-900 text-sm truncate">{member.name}</h4>
                      <p className="text-xs font-bold text-church-royal-blue truncate">{member.role}</p>
                      {member.badge && (
                        <span className="inline-block text-[10px] bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded-md mt-1 border border-amber-200/60">
                          {member.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {member.description && (
                    <p className="text-xs text-gray-600 mt-3 line-clamp-2 leading-relaxed">
                      {member.description}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {member.phone && (
                        <a
                          href={`tel:${member.phone.replace(/\s+/g, '')}`}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-church-gold hover:text-white text-gray-700 transition-colors"
                          title="Call"
                        >
                          <FiPhone className="text-xs" />
                        </a>
                      )}
                      {member.phone && (
                        <a
                          href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 transition-colors"
                          title="WhatsApp"
                        >
                          <FaWhatsapp className="text-xs" />
                        </a>
                      )}
                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-church-royal-blue hover:text-white text-gray-700 transition-colors"
                          title="Email"
                        >
                          <FiMail className="text-xs" />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedMember(member)}
                      className="text-[11px] font-bold text-church-royal-blue hover:text-blue-900 cursor-pointer"
                    >
                      View Profile →
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 6. Council Responsibilities Grid */}
          <section className="space-y-6">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-church-gold">Pillars of Governance</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-gray-900">Key Council Responsibilities</h2>
              <p className="text-xs font-tamil text-gray-500 font-bold mt-0.5">பேரவையின் முக்கிய கடமைகள் & பொறுப்புகள்</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {RESPONSIBILITIES.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md transition-all space-y-2.5"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">{item.title}</h3>
                  <p className="text-xs font-tamil text-church-royal-blue font-bold">{item.titleTa}</p>
                  <p className="text-xs text-gray-600 leading-relaxed pt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 7. Parish Ministries & Wings Directory */}
          <section className="space-y-6">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-church-gold">Active Parish Bodies</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-gray-900">Parish Ministries & Wings</h2>
              <p className="text-xs font-tamil text-gray-500 font-bold mt-0.5">பங்கு அமைப்புகள் & இயக்கங்கள்</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {MINISTRIES.map((min, idx) => (
                <div 
                  key={idx}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-2xs hover:border-church-gold transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center mb-2 shadow-2xs">
                      {min.icon}
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm mt-2">{min.name}</h4>
                    <p className="text-xs font-tamil text-church-royal-blue font-bold">{min.nameTa}</p>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">{min.desc}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 text-xs">
                    <p className="text-[11px] text-gray-500">
                      <strong>Head:</strong> {min.coordinator}
                    </p>
                    {min.phone && (
                      <a 
                        href={`tel:${min.phone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1 text-[11px] text-church-royal-blue font-bold mt-1 hover:underline"
                      >
                        <FiPhone className="text-[10px]" /> {min.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 8. Council Meetings, Resolutions & Annual Schedule */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Meeting Card */}
            <div className="bg-gradient-to-br from-church-royal-blue to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-church-gold/20 text-church-gold text-xs font-bold uppercase tracking-wider">
                  <FiCalendar /> Next Council Meeting
                </span>
                <h3 className="text-2xl font-bold font-display leading-snug">
                  Monthly Pastoral Council Meeting
                </h3>
                <p className="text-xs font-tamil text-blue-200 font-bold">மாதாந்திர பங்கு அருள்பணி பேரவைக் கூட்டம்</p>
                <div className="space-y-2 pt-2 text-xs text-blue-100">
                  <div className="flex items-center gap-2">
                    <FiCalendar className="text-church-gold" />
                    <span>First Sunday of Every Month / ஒவ்வொரு மாத முதல் ஞாயிறு</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FiClock className="text-church-gold" />
                    <span>05:30 PM (After Evening Mass)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FiMapPin className="text-church-gold" />
                    <span>Parish Hall / St. John de Britto Pastoral Centre</span>
                  </div>
                </div>
                <div className="p-3 bg-white/10 rounded-xl text-xs text-blue-50 border border-white/10 mt-3">
                  <strong>Agenda:</strong> Feast preparations, catechism evaluation, anbiyam reports, and financial review.
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-blue-200">
                <span>Chaired by: Rev. Fr. Parish Priest</span>
                <span className="font-bold text-church-gold">All Members Must Attend</span>
              </div>
            </div>

            {/* Recent Decisions & Resolutions */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  <FiCheckCircle className="text-emerald-600" /> Recent Resolutions
                </span>
                <h3 className="text-xl sm:text-2xl font-bold font-display text-gray-900">
                  Recent Key Council Decisions
                </h3>
                <p className="text-xs font-tamil text-gray-500 font-bold">சமீபத்திய பேரவை முடிவுகள்</p>

                <ul className="space-y-2.5 pt-2 text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span><strong>Parish Feast Planning:</strong> Approved the Novena schedule and cultural procession routes for the upcoming Annual Feast.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span><strong>Education Aid Fund:</strong> Sanctioned scholarship provisions for 25 underprivileged school students.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <span><strong>Audio-Visual Upgrade:</strong> Approved the installation of new high-clarity microphones and digital streaming cameras.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Minutes maintained by Secretary</span>
                <Link to="/documents" className="font-bold text-church-royal-blue hover:underline flex items-center gap-1">
                  <FiFileText /> View Reports & PDFs →
                </Link>
              </div>
            </div>
          </section>

          {/* 9. Contact the Parish Council & Leadership */}
          <section className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-gold-200/70">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8">
                <span className="text-church-gold font-bold text-xs uppercase tracking-wider">NEED ASSISTANCE?</span>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-church-royal-blue mt-1 mb-1">
                  Contact the Parish Council & Leadership
                </h2>
                <p className="text-xs font-tamil text-church-royal-blue font-bold mb-3">
                  பங்கு பேரவை மற்றும் பொறுப்பாளர்களைத் தொடர்பு கொள்ள
                </p>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-6">
                  Our parish pastoral council members and ministry coordinators are always available to assist you with pastoral concerns, community suggestions, and ministry coordination.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                    <p className="text-gray-500 font-medium">Official Council Email:</p>
                    <a href="mailto:council@sjdbchurch.org" className="font-bold text-church-royal-blue text-sm mt-0.5 block hover:underline">
                      council@sjdbchurch.org
                    </a>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                    <p className="text-gray-500 font-medium">Council Desk Phone:</p>
                    <a href="tel:+919876543210" className="font-bold text-church-royal-blue text-sm mt-0.5 block hover:underline">
                      +91 98765 43210
                    </a>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                    <p className="text-gray-500 font-medium">Council Office Hours:</p>
                    <p className="font-bold text-church-royal-blue text-sm mt-0.5">
                      Mon - Sun: 9:00 AM - 12:30 PM <br />
                      4:30 PM - 8:30 PM
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col items-center justify-center text-center p-6 bg-church-cream rounded-2xl border border-gold-300/50">
                <GiChurch className="text-5xl text-church-gold mb-3" />
                <h3 className="font-bold text-church-royal-blue text-base">Visit Our Parish</h3>
                <p className="text-gray-500 text-xs my-2">St. John de Britto's Church, Kalayarkoil, Sivagangai District</p>
                <Link to="/contact" className="btn-gold w-full justify-center text-center py-2.5 text-xs font-bold shadow-md mt-2">
                  Contact us
                </Link>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* Profile Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl z-10 border border-gray-100"
            >
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <FiX className="text-lg" />
              </button>

              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-2xl mx-auto overflow-hidden bg-gradient-to-br from-church-royal-blue to-indigo-900 text-white flex items-center justify-center text-2xl font-bold border-2 border-church-gold shadow-md">
                  {selectedMember.image ? (
                    <img 
                      src={getMediaUrl(selectedMember.image)} 
                      alt={selectedMember.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <span>{selectedMember.name.charAt(0)}</span>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedMember.name}</h3>
                  <p className="text-xs font-bold text-church-royal-blue">{selectedMember.role}</p>
                  {selectedMember.badge && (
                    <span className="inline-block text-[10px] bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded-md mt-1 border border-amber-200">
                      {selectedMember.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-600 leading-relaxed text-left p-3 bg-gray-50 rounded-xl border border-gray-100">
                  {selectedMember.description || 'Active council member serving the parish community.'}
                </p>

                <div className="pt-2 flex flex-col gap-2 text-xs">
                  {selectedMember.phone && (
                    <a
                      href={`tel:${selectedMember.phone.replace(/\s+/g, '')}`}
                      className="flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
                    >
                      <FiPhone className="text-xs text-church-gold" />
                      <span>Call: {selectedMember.phone}</span>
                    </a>
                  )}
                  {selectedMember.phone && (
                    <a
                      href={`https://wa.me/${selectedMember.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                    >
                      <FaWhatsapp className="text-xs" />
                      <span>Chat on WhatsApp</span>
                    </a>
                  )}
                  {selectedMember.email && (
                    <a
                      href={`mailto:${selectedMember.email}`}
                      className="flex items-center justify-center gap-2 py-2 rounded-xl bg-church-royal-blue hover:bg-blue-900 text-white font-bold transition-colors"
                    >
                      <FiMail className="text-xs" />
                      <span>Email: {selectedMember.email}</span>
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
