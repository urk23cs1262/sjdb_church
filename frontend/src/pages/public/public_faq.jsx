import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSearch, FiHelpCircle, FiChevronDown, FiBookOpen, FiFileText, 
  FiMessageSquare, FiCalendar, FiGlobe, FiArrowRight, FiCheckCircle, 
  FiClock, FiShield, FiUsers, FiLock, FiVolume2, FiHeart
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { GiChurch, GiCrucifix, GiPrayer, GiDove } from 'react-icons/gi';
import { FaDonate, FaHandHoldingHeart, FaWhatsapp } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import PageHero from '../../components/common/common_page_hero';

const FAQ_CATEGORIES = [
  { id: 'all', name: 'All Questions', icon: FiHelpCircle },
  { id: 'mass', name: 'Mass Bookings', icon: GiCrucifix },
  { id: 'events', name: 'Events & Registration', icon: FiCalendar },
  { id: 'whatsapp', name: 'WhatsApp Bot & Daily Content', icon: FaWhatsapp },
  { id: 'sacraments', name: 'Sacraments & Pastoral Care', icon: GiChurch },
  { id: 'anbiyams', name: 'Anbiyams & Community', icon: FiUsers },
  { id: 'documents', name: 'Certificates & Documents', icon: FiFileText },
  { id: 'prayer', name: 'Prayer Requests', icon: GiPrayer },
  { id: 'donations', name: 'Donations & Receipts', icon: FaDonate },
  { id: 'tickets', name: 'Support & Tickets', icon: FiMessageSquare },
  { id: 'account', name: 'Account & Family Ledger', icon: FiShield },
  { id: 'general', name: 'Parish Life & Voice AI', icon: HiSparkles },
];

const FAQS = [
  // Mass Bookings
  {
    category: 'mass',
    q: 'How do I book a Holy Mass Intention online?',
    a: 'You can book a Holy Mass intention by logging into your account and navigating to Dashboard > Book a Holy Mass. Select your preferred Mass Date, Mass Time (e.g., 6:00 AM, 7:30 AM, Evening Mass, or Feast Day Mass), Intention Type, and Person/Family Name. You can also use our AI Prayer Generator to auto-write custom intention details.',
    tags: ['mass', 'booking', 'intention', 'ai']
  },
  {
    category: 'mass',
    q: 'What types of Mass Intentions can I request?',
    a: 'We offer 12 intention categories: Thanksgiving, Birthday Blessing, Wedding Anniversary, Good Health & Healing, Special Intention, For the Souls of the Departed (RIP), RIP Anniversary Mass, Safe Journey, Exam Success, New House Blessing, and Others.',
    tags: ['intentions', 'categories', 'rip', 'thanksgiving']
  },
  {
    category: 'mass',
    q: 'How do I track my Mass Booking status and reference ID?',
    a: 'Once submitted, each Mass booking receives a unique reference ID (e.g., MB-2026-XXXXXX). You can track its status (Pending Review, Approved, Mass Scheduled, or Completed) inside your Dashboard under "My Mass Bookings". You will also receive email notifications upon parish office review.',
    tags: ['status', 'tracking', 'reference id', 'email']
  },
  {
    category: 'mass',
    q: 'Is there a fee or voluntary offering for Mass Intentions?',
    a: 'Mass Intentions are spiritual offerings. The voluntary offering field is completely optional and does not affect the approval of your Mass request by the parish office.',
    tags: ['offering', 'stipend', 'voluntary']
  },
  {
    category: 'mass',
    q: 'What happens if my requested Mass Date is unavailable?',
    a: 'If the parish schedule requires a change, the parish priest or office will suggest an alternative date or time. You can view the proposed reschedule suggestion inside your "My Mass Bookings" drawer.',
    tags: ['reschedule', 'suggested date', 'approval']
  },

  // Parish Events & Registration
  {
    category: 'events',
    q: 'How do I register for an upcoming Parish Event or Pilgrimage?',
    a: 'Navigate to the "Events" page from the main menu. Browse our upcoming parish events, retreats, youth conventions, and feast celebrations. For events that require registration, click "Register Now", enter your participant details, and submit. You will immediately receive a digital confirmation pass and an instant email and WhatsApp confirmation.',
    tags: ['event', 'registration', 'pilgrimage', 'retreat', 'feast', 'pass']
  },
  {
    category: 'events',
    q: 'Can I withdraw my event registration if I am unable to attend?',
    a: 'Yes, absolutely. Open the Events page, locate the event you registered for, and click "Withdraw Registration". The system will immediately cancel your registration, free up the participant spot for another parishioner, and send you and the parish office an instant confirmation notice.',
    tags: ['withdraw', 'cancel registration', 'event spot', 'attendance']
  },
  {
    category: 'events',
    q: 'Do I need to carry a printed ticket or pass for parish events?',
    a: 'No printed paper is required! When you register, a digital event pass with a verification QR code is generated in your account. You can simply display this QR code on your mobile phone upon arrival at the church venue for seamless check-in.',
    tags: ['qr code', 'digital pass', 'entry', 'mobile check-in']
  },

  // WhatsApp Bot & Daily Catholic Devotions
  {
    category: 'whatsapp',
    q: 'How does the St. John de Britto WhatsApp Bot work?',
    a: 'Our church has an interactive AI-powered WhatsApp Bot available 24/7. You can send a message to check today\'s Mass timings, read the daily Scripture reading, query saint feast days, check event dates, or request prayer intentions directly through WhatsApp.',
    tags: ['whatsapp', 'bot', 'chat', 'mobile', 'interactive']
  },
  {
    category: 'whatsapp',
    q: 'What is the 4:00 AM Daily Catholic Content on WhatsApp?',
    a: 'Parishioners can receive our blessed morning spiritual package delivered to their WhatsApp daily at 4:00 AM IST. It includes the Daily Bible Verse with liturgical reflection, the Saint of the Day memorial biography, and daily Catholic prayer points.',
    tags: ['daily catholic', '4am', 'morning devotion', 'saint of the day', 'reflection']
  },
  {
    category: 'whatsapp',
    q: 'How do I change my WhatsApp notification language (Tamil or English)?',
    a: 'Your saved Bot Language determines the language of all WhatsApp notifications. You can change your preferred language between Tamil (தமிழ்), English, or Both anytime by going to User Dashboard > Profile Settings > WhatsApp Preferences, or by texting the language command directly to our WhatsApp bot.',
    tags: ['bot language', 'tamil', 'english', 'notifications', 'bilingual']
  },
  {
    category: 'whatsapp',
    q: 'How can I follow the official Parish WhatsApp Newsletter Channel?',
    a: 'Click the green WhatsApp Channel icon in our website footer or visit the Social Media page to join our official broadcast channel. The channel publishes official diocese circulars, novena schedules, festive feast photos, and live Mass streaming links.',
    tags: ['whatsapp channel', 'newsletter', 'circular', 'announcements']
  },

  // Sacraments & Pastoral Care
  {
    category: 'sacraments',
    q: 'How do I arrange for the Sacrament of Baptism for a newborn or child?',
    a: 'Parents should contact the Parish Office or Priest at least 15 days in advance. Please bring the child\'s birth certificate and the family parish registration record. Godparents must be practicing Catholic parishioners in good standing. A short pre-baptism catechesis session is held for parents and godparents before the celebration.',
    tags: ['baptism', 'sacrament', 'newborn', 'godparents', 'catechesis']
  },
  {
    category: 'sacraments',
    q: 'What are the requirements for Holy Matrimony (Marriage) in the parish?',
    a: 'Couples must meet with the Parish Priest at least three months prior to the proposed wedding date. The mandatory requirements include: 1) Recent Baptism Certificate with "Free to Marry" notation issued within the last 6 months, 2) Confirmation Certificate, 3) Completion Certificate of the Diocesan Pre-Cana Marriage Preparation Course, and 4) Publication of Marriage Banns in respective parishes.',
    tags: ['marriage', 'matrimony', 'wedding', 'pre-cana', 'banns', 'certificate']
  },
  {
    category: 'sacraments',
    q: 'When is the Sacrament of Reconciliation (Confession) available?',
    a: 'Confessions are regularly heard 30 minutes before every weekday Mass, every Saturday from 4:30 PM to 5:00 PM, and on Sundays between morning Masses. You can also request Confession privately with the priest at the rectory at any time.',
    tags: ['confession', 'reconciliation', 'penance', 'schedule']
  },
  {
    category: 'sacraments',
    q: 'How do I request Anointing of the Sick or Holy Communion for a homebound elderly person?',
    a: 'For urgent medical emergencies or Anointing of the Sick, call our 24/7 parish telephone immediately. For routine home visits and First Friday Holy Communion to the elderly or sick, submit a ticket under Support or inform your neighborhood Anbiyam leader.',
    tags: ['sick call', 'anointing of the sick', 'elderly', 'homebound', 'first friday']
  },
  {
    category: 'anbiyams',
    q: 'What is an Anbiyam (Basic Christian Community / அன்பியம்)?',
    a: 'An Anbiyam is a neighborhood prayer group and basic Christian community within our parish. Families gather weekly for scripture reading, rosary, mutual support, and charitable works under a designated patron saint.',
    tags: ['anbiyam', 'community', 'prayer group', 'neighborhood']
  },
  {
    category: 'anbiyams',
    q: 'How do I find or join my family\'s designated Anbiyam?',
    a: 'Go to the "Anbiyams" page from the main menu. Browse through our parish\'s active Anbiyams (such as St. Joseph Anbiyam, St. Jude Anbiyam, Holy Family Anbiyam, etc.) to see leader contact details, street boundaries, meeting times, and patron saint feast days.',
    tags: ['find anbiyam', 'join', 'leaders', 'streets']
  },
  {
    category: 'anbiyams',
    q: 'How do I update my family\'s registered Anbiyam unit?',
    a: 'During registration or inside User Dashboard > Profile Settings, you can select or update your designated Anbiyam. Your Anbiyam leader will receive your family details in their parish roster.',
    tags: ['update anbiyam', 'profile', 'roster']
  },

  // Certificates & Documents
  {
    category: 'documents',
    q: 'How do I request an official Parish Certificate (Baptism, Marriage, etc.)?',
    a: 'Log in to your account and go to Dashboard > Request Documents. Select the certificate type (Baptism Certificate, First Holy Communion, Confirmation, Marriage Certificate, or Parish Membership Certificate), fill in the family details, and submit your request.',
    tags: ['certificate', 'baptism', 'marriage', 'documents']
  },
  {
    category: 'documents',
    q: 'How long does document verification and issuance take?',
    a: 'Document requests are reviewed against parish baptism and family register records. Once verified by the parish office (typically within 2-4 working days), a digital PDF copy is uploaded directly to your portal for instant download.',
    tags: ['verification', 'download', 'pdf']
  },

  // Prayer Requests
  {
    category: 'prayer',
    q: 'What is the difference between Mass Intentions and Prayer Requests?',
    a: 'A Mass Intention is offered during the celebration of Holy Mass by the Priest. A Prayer Request is added to the parish community prayer list and remembered during daily community rosary and devotions.',
    tags: ['prayer', 'community', 'rosary']
  },
  {
    category: 'prayer',
    q: 'Can I submit a private prayer request?',
    a: 'Yes. When submitting a prayer request, you can choose "Private Intention" so it is only visible to the parish priest and administrative team.',
    tags: ['privacy', 'confidential', 'priest']
  },

  // Donations & Receipts
  {
    category: 'donations',
    q: 'How do I donate online to parish projects, festival feast, or church maintenance?',
    a: 'Navigate to the "Donate" page in the navigation bar. Select your donation category (e.g., Church Maintenance, Annual Feast Celebration, Poor & Needy Relief, or General Offering), enter your amount, and pay securely via UPI, Credit/Debit Card, or Net Banking.',
    tags: ['donate', 'upi', 'payment', 'maintenance', 'feast']
  },
  {
    category: 'donations',
    q: 'Will I receive an official payment receipt for my donation?',
    a: 'Yes! Immediately after a successful transaction, an official parish donation receipt with a unique transaction reference ID is generated. You can download your PDF receipt anytime under Dashboard > Donation History.',
    tags: ['receipt', 'tax', 'pdf', 'history']
  },
  {
    category: 'donations',
    q: 'Can I make an anonymous donation?',
    a: 'Yes. Check the "Keep my donation anonymous" box during checkout if you prefer your name not to appear in public donor lists.',
    tags: ['anonymous', 'privacy', 'donor list']
  },

  // Support & Tickets
  {
    category: 'tickets',
    q: 'How do I contact the Parish Office or submit an inquiry?',
    a: 'Navigate to Support Tickets or Contact page. You can raise a ticket for Enquiries, Complaints, Meeting Requests, or Pastoral Guidance. Our office reviews tickets and responds directly with email updates.',
    tags: ['support', 'ticket', 'enquiry', 'contact']
  },
  {
    category: 'tickets',
    q: 'How will I know when my inquiry or ticket is resolved?',
    a: 'You will receive an instant email notification titled "Your Inquiry Has Been Resolved and closed — St. John de Britto\'s Church" containing the resolution response from the parish office.',
    tags: ['resolution', 'notification', 'email']
  },

  // Account & Registration
  {
    category: 'account',
    q: 'How long does new member account approval take?',
    a: 'New parishioner registrations are reviewed by the parish administrative team to ensure accurate family register records. Approvals are generally completed within 12-24 hours.',
    tags: ['approval', 'registration', 'pending']
  },
  {
    category: 'account',
    q: 'What should I do if my account status shows "Pending Approval"?',
    a: 'You can still log in and view public announcements, Mass timings, and devotions. Once approved by the parish office, you will unlock full access to Mass bookings, document requests, and tickets.',
    tags: ['pending approval', 'access', 'dashboard']
  },
  {
    category: 'account',
    q: 'What is a Parish Family ID and Member ID?',
    a: 'Every registered household in St. John de Britto Parish has a permanent Family ID (e.g., SJDB_FAM-01) tied to their Anbiyam unit, and each individual has a Parish Member ID (e.g., SJDB_M01). This ID unifies your baptismal records, census ledger, Mass intentions, and contribution receipts.',
    tags: ['family id', 'member id', 'census', 'ledger', 'family register']
  },
  {
    category: 'account',
    q: 'Can I add my spouse, children, or parents under my family account?',
    a: 'Yes! Inside User Dashboard > Family Members, you can register and update details for all members of your household including dates of birth, sacraments received, and blood groups. This ensures accurate family records for parish certificates and pastoral care.',
    tags: ['family members', 'spouse', 'children', 'household', 'census']
  },

  // General & Devotions
  {
    category: 'general',
    q: 'What is "Hey Connect" (Voice Assistant) in the navigation bar?',
    a: '"Hey Connect" is our interactive parish AI assistant. Click the microphone button at the top of the website to speak or type in English or Tamil. You can ask questions about the life and martyrdom of St. John de Britto, church history, catechism, feast calendars, or how to use portal services.',
    tags: ['hey connect', 'voice assistant', 'ai', 'saint john de britto', 'bilingual']
  },
  {
    category: 'general',
    q: 'Is the website available in Tamil?',
    a: 'Yes! Click the language switcher (English / தமிழ்) in the top navigation bar at any time to translate the entire portal, daily readings, prayers, and forms into Tamil.',
    tags: ['tamil', 'language', 'translate']
  },
  {
    category: 'general',
    q: 'Where can I find Daily Mass Readings, Saint of the Day, and Audio Rosary?',
    a: 'Our home page and devotions section feature live Daily Mass Readings, the Saint of the Day with biography, an interactive Audio Rosary player, and the Catholic Liturgical Calendar.',
    tags: ['saint', 'readings', 'rosary', 'calendar']
  },
  {
    category: 'general',
    q: 'Where can I watch the Live Stream of Holy Mass?',
    a: 'Visit the "Live Stream" section in the navigation menu to watch live broadcasts of Sunday Holy Mass, Novenas, and annual feast celebrations.',
    tags: ['live stream', 'youtube', 'broadcast', 'feast']
  },
  {
    category: 'general',
    q: 'How do I report unauthorized account activity or security issues?',
    a: 'Visit the "Report Unauthorized Activity" link in the website footer or settings. You can report security concerns or unauthorized attempts to the parish technical safety team immediately.',
    tags: ['security', 'unauthorized', 'safety']
  }
];

export default function FAQ() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState(null);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter(faq => {
      const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
      const qText = faq.q.toLowerCase();
      const aText = faq.a.toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || qText.includes(query) || aText.includes(query) || faq.tags.some(t => t.includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen pt-20 bg-church-cream pb-20">
      <PageHero title="Frequently Asked Questions" subtitle="Parish Help Center & Guidance Portal" />

      <section className="max-w-5xl mx-auto px-4 py-10">
        
        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto mb-10">
          <div className="relative flex items-center">
            <FiSearch className="absolute left-4 text-church-gold text-xl pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Mass bookings, certificates, prayer requests, timings..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-amber-200 shadow-md text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-church-gold/40 focus:border-church-gold transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 text-xs font-bold text-gray-400 hover:text-gray-600 bg-gray-100 px-2 py-1 rounded-lg"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-center text-[11px] text-gray-500 mt-2 font-medium">
            Showing {filteredFaqs.length} answered questions
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {FAQ_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setOpenIndex(null); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-xs ${
                  isActive
                    ? 'bg-church-royal-blue text-white shadow-gold border border-church-gold/40 scale-105'
                    : 'bg-white text-gray-700 hover:bg-amber-50 border border-gray-200'
                }`}
              >
                <Icon className={isActive ? 'text-church-gold' : 'text-gray-400'} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Accordion FAQ List */}
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 p-8 max-w-md mx-auto shadow-xs">
            <FiHelpCircle className="text-4xl text-amber-400 mx-auto mb-3 animate-bounce" />
            <h3 className="font-bold text-gray-800 text-base mb-1">No matching questions found</h3>
            <p className="text-xs text-gray-500 mb-4">Try searching for keywords like "Mass", "Certificate", or "Prayer".</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="btn-gold text-xs px-4 py-2"
            >
              Reset Search Filter
            </button>
          </div>
        ) : (
          <div className="space-y-3.5 max-w-3xl mx-auto">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <motion.div
                  key={faq.q}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isOpen
                      ? 'bg-white border-church-gold/60 shadow-md ring-1 ring-church-gold/20'
                      : 'bg-white border-gray-200/80 hover:border-amber-300 shadow-xs'
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-4 sm:p-5 text-left gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                        isOpen ? 'bg-church-gold text-white shadow-xs' : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {idx + 1}
                      </span>
                      <h3 className="font-bold text-gray-800 text-sm sm:text-base leading-snug">
                        {faq.q}
                      </h3>
                    </div>
                    <FiChevronDown
                      className={`text-church-gold text-lg flex-shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-amber-50 ml-2 sm:ml-9">
                          <p>{faq.a}</p>
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-2">
                            {faq.tags.map(t => (
                              <span key={t} className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Bottom Help Banner */}
        <div className="mt-16 bg-gradient-to-br from-church-royal-blue to-blue-950 text-white rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden shadow-xl max-w-3xl mx-auto">
          <div className="relative z-10 space-y-3">
            <GiChurch className="text-church-gold text-4xl mx-auto" />
            <h3 className="font-display text-xl sm:text-2xl font-bold">Have a specific question or request?</h3>
            <p className="text-xs sm:text-sm text-gray-200 max-w-xl mx-auto leading-relaxed">
              Our parish administrative team and priests are always available to help you with mass intention requests, certificates, or pastoral assistance.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <Link to="/contact" className="btn-gold px-6 py-3 text-xs sm:text-sm font-bold flex items-center gap-2">
                <FiMessageSquare /> Contact Parish Office <FiArrowRight />
              </Link>
              {/* <Link to="/mass-timings" className="btn-outline-gold px-6 py-3 text-xs sm:text-sm font-bold flex items-center gap-2">
                <FiClock /> View Mass Timings
              </Link> */}
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
