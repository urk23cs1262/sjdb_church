import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiMail, FiPhone, FiSearch, FiUser, FiHeart, FiShield,
  FiUsers, FiClock, FiMessageSquare, FiExternalLink, FiChevronRight,
  FiFacebook, FiInstagram, FiLinkedin, FiAward, FiMusic, FiCode, FiBookOpen,
  FiSmile, FiVideo, FiCalendar
} from 'react-icons/fi';
import { GiChurch, GiCrucifix, GiMusicalNotes, GiPrayerBeads } from 'react-icons/gi';
import api, { getMediaUrl } from '../../services/api';
import PageHero from '../../components/common/common_page_hero';
import { SectionLoader } from '../../components/common/common_loader';

const DEPARTMENTS = [
  { id: 'All', label: 'All Members', icon: <FiUsers /> },
  { id: 'Leadership', label: 'Parish Leadership', icon: <GiCrucifix /> },
  { id: 'Administration', label: 'Administration', icon: <FiShield /> },
  { id: 'Parish Council', label: 'Parish Council', icon: <GiChurch /> },
  { id: 'Catechism', label: 'Catechism Team', icon: <FiBookOpen /> },
  { id: 'Youth Ministry', label: 'Youth Ministry', icon: <FiHeart /> },
  { id: 'Altar Servers', label: 'Altar Servers', icon: <GiCrucifix /> },
  { id: 'Choir Team', label: 'Choir Team', icon: <FiMusic /> },
  { id: 'Society of St. Vincent de Paul (SSVP)', label: 'St. Vincent de Paul Team', icon: <FiHeart /> },
  { id: 'Volunteers', label: 'Volunteers', icon: <FiAward /> },
  { id: 'Website Technical Team', label: 'Tech Team', icon: <FiCode /> }
];

const VOLUNTEER_MINISTRIES = [
  { name: 'Hospitality', desc: 'Greeting parishioners, ushering Mass, and welcoming visitors.', icon: <FiSmile className="text-2xl text-amber-300" /> },
  { name: 'Decoration & Altar', desc: 'Decorating sanctuary for feasts, flower arrangements, and vestments.', icon: <GiChurch className="text-2xl text-amber-300" /> },
  { name: 'Media & Tech Team', desc: 'Live streaming Mass, sound management, website & social media.', icon: <FiVideo className="text-2xl text-blue-300" /> },
  { name: 'Social Service & Outreach', desc: 'Helping the needy, food drives, medical camps, and community support.', icon: <FiHeart className="text-2xl text-rose-300" /> },
  { name: 'Prayer Groups & Novenas', desc: 'Organizing rosary circles, adoration hours, and intercessory prayer.', icon: <GiPrayerBeads className="text-2xl text-purple-300" /> },
  { name: 'Event Management', desc: 'Feast celebrations, cultural programs, processions, and youth meets.', icon: <FiCalendar className="text-2xl text-emerald-300" /> }
];

export default function Team() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const res = await api.get('/team');
      setMembers(res.data.members || []);
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDeptMembers = (deptName) => {
    return members.filter(m => {
      if (deptName === 'Society of St. Vincent de Paul (SSVP)') {
        return m.department === 'Society of St. Vincent de Paul (SSVP)' || m.department === 'St. Vincent de Paul Sabai';
      }
      return m.department === deptName;
    });
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchDept = selectedDept === 'All' ||
        m.department === selectedDept ||
        (selectedDept === 'Society of St. Vincent de Paul (SSVP)' && m.department === 'St. Vincent de Paul Sabai');
      const matchSearch = !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.role.toLowerCase().includes(search.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(search.toLowerCase()));
      return matchDept && matchSearch;
    });
  }, [members, selectedDept, search]);

  const leadershipMembers = useMemo(() => getDeptMembers('Leadership'), [members]);
  const adminMembers = useMemo(() => getDeptMembers('Administration'), [members]);
  const councilMembers = useMemo(() => getDeptMembers('Parish Council'), [members]);
  const catechismMembers = useMemo(() => getDeptMembers('Catechism'), [members]);
  const youthMembers = useMemo(() => getDeptMembers('Youth Ministry'), [members]);
  const altarMembers = useMemo(() => getDeptMembers('Altar Servers'), [members]);
  const choirMembers = useMemo(() => getDeptMembers('Choir Team'), [members]);
  const ssvpMembers = useMemo(() => getDeptMembers('Society of St. Vincent de Paul (SSVP)'), [members]);
  const techMembers = useMemo(() => getDeptMembers('Website Technical Team'), [members]);

  const renderCardGrid = (deptMembers, categoryName, defaultDesc) => {
    if (deptMembers.length === 0) {
      return (
        <div className="bg-white/80 rounded-2xl p-10 text-center border-2 border-dashed border-gray-200 my-4 shadow-sm">
          <FiUsers className="text-4xl text-gray-300 mx-auto mb-3" />
          <h3 className="font-display font-bold text-gray-700 text-lg">No Members Added Yet</h3>
          <p className="text-gray-500 text-xs mt-1">There are currently no active team members added under {categoryName}.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {deptMembers.map(member => (
          <motion.div
            key={member._id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-xl hover:border-church-gold/50 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="relative w-full h-44 rounded-xl overflow-hidden bg-church-royal-blue/5 mb-4 border border-gray-100">
                {member.image ? (
                  <img src={getMediaUrl(member.image)} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-church-royal-blue text-white font-bold text-3xl">
                    {member.name?.[0]}
                  </div>
                )}
                {member.badge && (
                  <span className="absolute top-2 right-2 bg-church-royal-blue/90 text-church-gold text-[10px] font-bold px-2 py-0.5 rounded-full border border-church-gold/40 shadow-sm">
                    {member.badge}
                  </span>
                )}
              </div>

              <h3 className="font-bold text-gray-900 text-base">{member.name}</h3>
              <p className="text-xs text-church-gold font-bold mb-2">{member.role}</p>
              <p className="text-gray-600 text-xs leading-relaxed mb-4 line-clamp-3">
                {member.description || defaultDesc}
              </p>
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
              {member.email && (
                <a href={`mailto:${member.email}`} className="text-gray-600 hover:text-church-royal-blue font-medium flex items-center gap-1.5 truncate">
                  <FiMail className="text-church-gold flex-shrink-0" /> {member.email}
                </a>
              )}
              {member.phone && (
                <a href={`tel:${member.phone}`} className="text-gray-600 hover:text-church-royal-blue font-medium flex items-center gap-1.5">
                  <FiPhone className="text-church-gold flex-shrink-0" /> {member.phone}
                </a>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">{categoryName}</span>
                <Link to="/contact" className="text-church-royal-blue font-bold hover:underline flex items-center gap-1">
                  Contact <FiChevronRight />
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-church-cream pb-10 pt-10">
      {/* Hero Section */}
      <PageHero
        title="Meet Our Team"
        subtitle="Serving God and our church community with faith, love, and dedication."
        badge="PARISH LEADERSHIP & MINISTRIES"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">

        {/* Department Filter Tabs */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl border border-gold-200/60 mb-12">
          <div className="flex items-center gap-2 overflow-x-auto w-full pb-2.5 scrollbar-thin scrollbar-thumb-amber-300 snap-x">
            {DEPARTMENTS.map(dept => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 snap-start ${selectedDept === dept.id
                  ? 'bg-church-gold text-white shadow-gold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
              >
                <span>{dept.icon}</span>
                <span>{dept.label}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SectionLoader />
        ) : (
          <div className="space-y-16">

            {/* 1. PARISH LEADERSHIP SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Leadership') && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-church-royal-blue text-church-gold flex items-center justify-center text-xl shadow-md">
                    <GiCrucifix />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-church-royal-blue">Parish Leadership</h2>
                    <p className="text-gray-500 text-xs sm:text-sm">Guiding our spiritual growth and pastoral care</p>
                  </div>
                </div>

                {leadershipMembers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {leadershipMembers.map(member => (
                      <motion.div
                        key={member._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl p-6 shadow-xl border-2 border-church-gold/30 hover:border-church-gold transition-all flex flex-col sm:flex-row items-center sm:items-start gap-6 group"
                      >
                        {/* Photo */}
                        <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-church-royal-blue/10 flex-shrink-0 border-2 border-church-gold/50 shadow-md">
                          {member.image ? (
                            <img
                              src={getMediaUrl(member.image)}
                              alt={member.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-church-royal-blue text-white font-bold text-4xl">
                              {member.name?.[0]}
                            </div>
                          )}
                          {member.badge && (
                            <span className="absolute bottom-2 left-2 right-2 bg-church-gold text-white text-[10px] font-extrabold uppercase py-0.5 px-2 rounded-full text-center shadow">
                              {member.badge}
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 text-center sm:text-left">
                          <h3 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue">{member.name}</h3>
                          <p className="text-church-gold font-semibold text-sm mb-2">{member.role}</p>

                          <p className="text-gray-600 text-xs sm:text-sm italic mb-4 leading-relaxed bg-amber-50/60 p-3 rounded-xl border border-amber-100">
                            "{member.description || 'Serving our parish community with faith, hope, and charity.'}"
                          </p>

                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                            {member.email && (
                              <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-church-gold hover:text-white text-gray-700 text-xs font-bold transition-all shadow-xs">
                                <FiMail /> {member.email}
                              </a>
                            )}
                            {member.phone && (
                              <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-church-gold hover:text-white text-gray-700 text-xs font-bold transition-all shadow-xs">
                                <FiPhone /> {member.phone}
                              </a>
                            )}
                            <Link to="/contact" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-church-royal-blue text-white text-xs font-bold hover:bg-blue-900 transition-all shadow-sm">
                              <FiMessageSquare /> Contact
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/80 rounded-2xl p-10 text-center border-2 border-dashed border-gray-200 my-4 shadow-sm">
                    <FiUsers className="text-4xl text-gray-300 mx-auto mb-3" />
                    <h3 className="font-display font-bold text-gray-700 text-lg">No Members Added Yet</h3>
                    <p className="text-gray-500 text-xs mt-1">There are currently no active team members added under Parish Leadership.</p>
                  </div>
                )}
              </section>
            )}

            {/* 2. ADMINISTRATION SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Administration') && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-church-royal-blue text-church-gold flex items-center justify-center text-xl shadow-md">
                    <FiShield />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-church-royal-blue">Administration</h2>
                    <p className="text-gray-500 text-xs sm:text-sm">Managing parish operations, records, and office support</p>
                  </div>
                </div>
                {renderCardGrid(adminMembers, 'Administration', 'Handles daily parish operations, office administration, and record keeping.')}
              </section>
            )}

            {/* 3. PARISH COUNCIL SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Parish Council') && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-church-royal-blue text-church-gold flex items-center justify-center text-xl shadow-md">
                    <GiChurch />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-church-royal-blue">Parish Council</h2>
                    <p className="text-gray-500 text-xs sm:text-sm">Elected parish representatives and executive office bearers</p>
                  </div>
                </div>
                {renderCardGrid(councilMembers, 'Parish Council', 'Parish governance, advisory, and pastoral planning.')}
              </section>
            )}

            {/* 4. CATECHISM TEAM SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Catechism') && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center text-xl shadow-md">
                    <FiBookOpen />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-church-royal-blue">Catechism Team</h2>
                    <p className="text-gray-500 text-xs sm:text-sm">Nurturing Catholic faith, scripture education, and First Communion/Confirmation prep</p>
                  </div>
                </div>
                {renderCardGrid(catechismMembers, 'Catechism Team', 'Teaching scripture, Sunday school, and sacrament preparation for children.')}
              </section>
            )}

            {/* 5. YOUTH MINISTRY SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Youth Ministry') && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-pink-600 text-white flex items-center justify-center text-xl shadow-md">
                    <FiHeart />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-church-royal-blue">Youth Ministry</h2>
                    <p className="text-gray-500 text-xs sm:text-sm">Empowering young parishioners through retreats, fellowship, and social action</p>
                  </div>
                </div>
                {renderCardGrid(youthMembers, 'Youth Ministry', 'Organizing parish youth retreats, sports events, and community service.')}
              </section>
            )}

            {/* 6. ALTAR SERVERS SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Altar Servers') && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center text-xl shadow-md">
                    <GiCrucifix />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-church-royal-blue">Altar Servers</h2>
                    <p className="text-gray-500 text-xs sm:text-sm">Assisting priests during Eucharistic celebrations and holy sacraments</p>
                  </div>
                </div>
                {renderCardGrid(altarMembers, 'Altar Servers', 'Assisting clergy at the altar during Holy Mass, sacraments, and processions.')}
              </section>
            )}

            {/* 7. CHOIR TEAM SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Choir Team') && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-900 text-purple-300 flex items-center justify-center text-xl shadow-md">
                    <FiMusic />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-church-royal-blue">Choir Team</h2>
                    <p className="text-gray-500 text-xs sm:text-sm">Leading liturgical music, organ, keyboard, guitars, and parish singing</p>
                  </div>
                </div>
                {renderCardGrid(choirMembers, 'Choir Team', 'Leading liturgical singing, hymns, and musical instruments for Sunday Mass.')}
              </section>
            )}

            {/* 8. SOCIETY OF ST. VINCENT DE PAUL (SSVP) SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Society of St. Vincent de Paul (SSVP)') && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-800 text-amber-300 flex items-center justify-center text-xl shadow-md">
                    <FiHeart />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-church-royal-blue">Society of St. Vincent de Paul (SSVP)</h2>
                    <p className="text-gray-500 text-xs sm:text-sm">Providing charitable assistance, education aid, and food support to the needy</p>
                  </div>
                </div>
                {renderCardGrid(ssvpMembers, 'SSVP Team', 'Charitable assistance, education support, and medical relief for families.')}
              </section>
            )}

            {/* 9. WEBSITE TECHNICAL TEAM SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Website Technical Team') && (
              <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden border border-blue-500/20">
                <div className="relative z-10">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 border-b border-white/10 pb-6">
                    <div>
                      <span className="bg-blue-500/20 text-blue-400 border border-blue-400/40 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit">
                        <FiCode /> IT & Digital Ministry
                      </span>
                      <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-2 flex items-center gap-2">
                        Website Technical Team
                      </h2>
                      <p className="text-gray-300 text-xs sm:text-sm mt-2 w-full leading-relaxed text-justify">
                        The Website Technical Team is responsible for developing, maintaining, securing, and continuously improving the parish website and digital services. They ensure that parishioners can easily access announcements, Mass bookings, events, registrations, donations, and online services across all devices.
                      </p>
                    </div>
                  </div>

                  {techMembers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {techMembers.map(member => (
                        <motion.div
                          key={member._id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 hover:bg-white/20 transition-all flex flex-col justify-between group"
                        >
                          <div>
                            <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-800 mb-4 border border-white/20">
                              {member.image ? (
                                <img src={getMediaUrl(member.image)} alt={member.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-church-royal-blue text-white font-bold text-3xl">
                                  {member.name?.[0]}
                                </div>
                              )}
                              {member.badge && (
                                <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-300/40">
                                   {member.badge}
                                </span>
                              )}
                            </div>

                            <h3 className="font-bold text-white text-base">{member.name}</h3>
                            <p className="text-xs text-blue-400 font-bold mb-2">{member.role}</p>
                            <p className="text-gray-300 text-xs leading-relaxed mb-4 line-clamp-3">
                              {member.description || 'Full Stack development, parish web maintenance, server infrastructure, and security.'}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                            {member.email && (
                              <a href={`mailto:${member.email}`} className="text-gray-300 hover:text-white font-medium flex items-center gap-1.5 truncate">
                                <FiMail className="text-blue-400 flex-shrink-0" /> {member.email}
                              </a>
                            )}
                            {member.phone && (
                              <a href={`tel:${member.phone}`} className="text-gray-300 hover:text-white font-medium flex items-center gap-1.5">
                                <FiPhone className="text-blue-400 flex-shrink-0" /> {member.phone}
                              </a>
                            )}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] font-bold text-blue-300 uppercase">IT Department</span>
                              <Link to="/contact" className="text-blue-400 font-bold hover:underline flex items-center gap-1">
                                Contact <FiChevronRight />
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/10 rounded-2xl p-10 text-center border-2 border-dashed border-white/20 my-4">
                      <FiCode className="text-4xl text-blue-400 mx-auto mb-3" />
                      <h3 className="font-display font-bold text-white text-lg">No Members Added Yet</h3>
                      <p className="text-gray-300 text-xs mt-1">There are currently no active team members added under Website Technical Team.</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 10. VOLUNTEERS SECTION */}
            {(selectedDept === 'All' || selectedDept === 'Volunteers') && (
              <section>
                <div className="bg-gradient-to-r from-church-royal-blue to-blue-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                      <div>
                        <span className="bg-church-gold/20 text-church-gold border border-church-gold/40 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          Community Service
                        </span>
                        <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-2">
                          Volunteers & Faithful Servants
                        </h2>
                        <p className="text-gray-200 text-xs sm:text-sm mt-1 max-w-2xl">
                          More than <strong>50+ active volunteers</strong> faithfully serve in various parish ministries and community outreach programs every week.
                        </p>
                      </div>

                      <Link to="/contact" className="btn-gold py-3 px-6 text-xs sm:text-sm font-bold shadow-gold whitespace-nowrap self-start sm:self-auto">
                        Become a Volunteer
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {VOLUNTEER_MINISTRIES.map((v, i) => (
                        <div key={i} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 hover:bg-white/20 transition-all">
                          <div className="text-2xl mb-2">{v.icon}</div>
                          <h3 className="font-bold text-church-gold text-base mb-1">{v.name}</h3>
                          <p className="text-gray-200 text-xs leading-relaxed">{v.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* CONTACT THE TEAM CARD */}
            <section className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-gold-200/70">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8">
                  <span className="text-church-gold font-bold text-xs uppercase tracking-wider">NEED ASSISTANCE?</span>
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-church-royal-blue mt-1 mb-3">
                    Contact the Parish Office & Team
                  </h2>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-6">
                    Our parish office and ministry leaders are always available to help you with Mass intentions, sacraments, certificates, or spiritual guidance.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                      <p className="text-gray-500 font-medium">Official Email:</p>
                      <p className="font-bold text-church-royal-blue text-sm mt-0.5">[EMAIL_ADDRESS]</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                      <p className="text-gray-500 font-medium">Parish Office Phone:</p>
                      <p className="font-bold text-church-royal-blue text-sm mt-0.5">[+91 Phone_number]</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                      <p className="text-gray-500 font-medium">Office Hours:</p>
                      <p className="font-bold text-church-royal-blue text-sm mt-0.5">Mon-Sat: 8:00 AM - 12:00PM <br />3:00 PM - 10:00 PM</p>
                      <p className="font-bold text-church-royal-blue text-sm mt-0.5">Sun: 9:00 AM - 5:00 PM</p>
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
      </div>
    </div>
  );
}
