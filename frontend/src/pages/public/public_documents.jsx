import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiFileText, FiDownload, FiSearch, FiExternalLink, FiChevronRight,
  FiCalendar, FiCheckCircle, FiInfo, FiLayers, FiShield,
  FiBookOpen, FiPrinter, FiUserCheck, FiClock, FiX
} from 'react-icons/fi';
import { GiChurch, GiScrollUnfurled, GiRibbonMedal } from 'react-icons/gi';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import PageHero from '../../components/common/common_page_hero';
import { useAuth } from '../../context/context_auth_context';

// Categories of Parish Documents & Reports
const DOCUMENT_CATEGORIES = [
  { id: 'All', label: 'All Documents', labelTa: 'அனைத்து ஆவணங்கள்', icon: <FiLayers /> },
  { id: 'Council', label: 'Council & Reports', labelTa: 'பேரவை & அறிக்கைகள்', icon: <GiChurch /> },
  { id: 'Certificates', label: 'Certificate Forms', labelTa: 'சான்றிதழ் விண்ணப்பங்கள்', icon: <GiRibbonMedal /> },
  { id: 'Faith', label: 'Faith & Liturgy', labelTa: 'மறைக்கல்வி & திருவழிபாடு', icon: <FiBookOpen /> },
  { id: 'Constitution', label: 'Rules & Guidelines', labelTa: 'விதிமுறைகள்', icon: <FiShield /> }
];

// Document database
const PARISH_DOCUMENTS = [
  {
    id: 'doc-1',
    title: 'Parish Pastoral Council Constitution & Guidelines',
    titleTa: 'பங்கு அருள்பணி பேரவை விதிமுறைகள் & வழிகாட்டு நெறிமுறைகள்',
    category: 'Constitution',
    description: 'Official constitution, bylaws, membership roles, and meeting protocols governing the Parish Pastoral Council of St. John de Britto Church.',
    type: 'PDF',
    size: '1.2 MB',
    date: '2026 Edition',
    badge: 'Official Bylaws',
    content: [
      'ST. JOHN DE BRITTO CHURCH - PARISH PASTORAL COUNCIL CONSTITUTION',
      'Article 1: Nature and Purpose of the Parish Pastoral Council',
      '1.1 The Parish Pastoral Council is a consultative body in accordance with Canon 536 of the Code of Canon Law.',
      '1.2 The Council assists the Parish Priest in fostering pastoral activities, evangelization, and spiritual communion.',
      'Article 2: Membership & Executive Office Bearers',
      '2.1 Ex-Officio President: The Parish Priest.',
      '2.2 Elected Officers: President, Vice President, Secretary, and Treasurer.',
      '2.3 Representatives: Youth Wing, Women Commission, Catechism, SSVP, and Anbiyam leaders.',
      'Article 3: Meeting Schedules & Resolutions',
      '3.1 General meetings are conducted on the first Sunday of every month.',
      '3.2 Minutes are officially recorded and preserved by the Secretary.'
    ]
  },
  {
    id: 'doc-2',
    title: 'Annual Parish Pastoral & Financial Report 2025-2026',
    titleTa: 'ஆண்டு பங்கு அருள்பணி & நிதி அறிக்கை 2025-2026',
    category: 'Council',
    description: 'Comprehensive annual summary of sacramental statistics, pastoral milestones, development projects, and financial transparency accounts.',
    type: 'PDF',
    size: '2.4 MB',
    date: 'March 2026',
    badge: 'Annual Report',
    content: [
      'ANNUAL PARISH PASTORAL & FINANCIAL REPORT 2025-2026',
      'St. John de Britto Church, Kalayarkoil',
      '1. Sacramental Statistics for the Pastoral Year:',
      '   - Holy Baptisms Administered: 48 infants & catechumens',
      '   - First Holy Communions Received: 62 children',
      '   - Sacrament of Confirmation: 54 youth',
      '   - Holy Matrimonies Celebrated: 28 marriages',
      '2. Major Community Outreach & SSVP Charity Actions:',
      '   - Monthly groceries and medical aid distributed to 45 marginalized families.',
      '   - Education scholarship aid sanctioned for 25 school and college students.',
      '3. Church Infrastructure & Renovation Works:',
      '   - Upgraded sanctuary lighting, digital live streaming system, and parish hall acoustics.'
    ]
  },
  {
    id: 'doc-3',
    title: 'Parish Council Recent Resolutions & Minutes Summary',
    titleTa: 'சமீபத்திய பேரவைக் கூட்ட தீர்மானங்கள் சுருக்கம்',
    category: 'Council',
    description: 'Summary of executive decisions approved in recent monthly meetings including feast preparations, youth initiatives, and charitable funds.',
    type: 'PDF',
    size: '850 KB',
    date: 'February 2026',
    badge: 'Meeting Minutes',
    content: [
      'PARISH COUNCIL RECENT RESOLUTIONS SUMMARY',
      'St. John de Britto Church - Executive Decisions',
      'Resolution 1: Annual Parish Feast Novena and Procession',
      '- Approved the 10-day Novena schedule, flag-hoisting ceremony, and cultural procession route.',
      'Resolution 2: Youth Leadership Camp & Sports Meet',
      '- Approved the 2-day ICYM leadership seminar and inter-anbiyam sports tournament.',
      'Resolution 3: Audio & Live Broadcast Infrastructure',
      '- Upgraded high-clarity microphones and official YouTube live broadcast setup.'
    ]
  },
  {
    id: 'doc-4',
    title: 'Baptism Certificate Application Form & Guidelines',
    titleTa: 'திருமுழுக்கு சான்றிதழ் விண்ணப்பப் படிவம்',
    category: 'Certificates',
    description: 'Guidelines and printable application form for requesting official Baptism Certificates and record extracts from the parish register.',
    type: 'PDF',
    size: '620 KB',
    date: 'Active Form',
    badge: 'Sacramental Form',
    content: [
      'BAPTISM CERTIFICATE APPLICATION GUIDELINES',
      'St. John de Britto Church, Kalayarkoil',
      'Requirements for Requesting Baptism Certificate:',
      '1. Name of the Child / Person baptized.',
      '2. Date of Birth and approximate Date of Baptism.',
      '3. Father\'s Name and Mother\'s Name (including maiden name).',
      '4. Names of Godparents (Sponsors) if known.',
      '5. Name of Officiating Priest.',
      'Processing Time: 2 - 3 business days from submission.',
      'Official seal and signature will be attested by the Parish Priest.'
    ]
  },
  {
    id: 'doc-5',
    title: 'Holy Matrimony Preparation & NOC Guidelines',
    titleTa: 'திருமண தயாரிப்பு & தடையில்லா சான்றிதழ் வழிகாட்டுதல்',
    category: 'Certificates',
    description: 'Checklist, Pre-Cana marriage preparation course requirements, and No Objection Certificate (NOC) guidelines for Christian marriage.',
    type: 'PDF',
    size: '950 KB',
    date: 'Active Guidelines',
    badge: 'Marriage Guidelines',
    content: [
      'CHRISTIAN MARRIAGE PREPARATION GUIDELINES (HOLY MATRIMONY)',
      'St. John de Britto Church, Kalayarkoil',
      'Mandatory Requirements:',
      '1. Fresh Baptism Certificate issued with "For Marriage Purpose" note (valid 6 months).',
      '2. Confirmation Certificate photocopy.',
      '3. Attendance Certificate of Diocesan Pre-Cana / Marriage Preparation Course.',
      '4. Marriage Banns publication in both the bride\'s and groom\'s home parishes.',
      '5. Personal pre-marital interview with the Parish Priest at least 1 month prior to wedding date.'
    ]
  },
  {
    id: 'doc-6',
    title: 'Sunday Catechism Curriculum & Faith Formation Handbook',
    titleTa: 'ஞாயிறு மறைக்கல்வி பாடத்திட்டம் & கையேடு',
    category: 'Faith',
    description: 'Curriculum structure, exam schedules, and sacramental preparation milestones for parish Sunday School children from Grade 1 to 12.',
    type: 'PDF',
    size: '1.8 MB',
    date: 'Academic Year 2025-26',
    badge: 'Faith Handbook',
    content: [
      'SUNDAY CATECHISM HANDBOOK & FAITH FORMATION GUIDELINES',
      'St. John de Britto Church, Kalayarkoil',
      '1. Academic Schedule: Sunday 08:30 AM to 09:30 AM (followed by Children\'s Mass).',
      '2. Sacramental Milestones:',
      '   - Grade 4: First Confession & First Holy Communion Preparation.',
      '   - Grade 10: Sacrament of Confirmation Catechesis.',
      '3. Bible Quiz, Scripture Recitation, and Annual Catechism Day celebrations.'
    ]
  },
  {
    id: 'doc-7',
    title: 'Altar Servers Guild Liturgical Manual',
    titleTa: 'பலிபீட சிறுவர்கள் திருப்பலி பணி கையேடு',
    category: 'Faith',
    description: 'Liturgical reverence handbook, Latin/Tamil liturgical responses, altar preparation steps, and vestment guidelines for altar servers.',
    type: 'PDF',
    size: '1.1 MB',
    date: 'Liturgical Guide',
    badge: 'Altar Guide',
    content: [
      'ALTAR SERVERS GUILD - LITURGICAL MANUAL',
      'St. John de Britto Church, Kalayarkoil',
      'Core Principles of Altar Serving:',
      '1. Reverence and Prayerful Demeanor in the Sanctuary.',
      '2. Duties during Holy Mass: Processional cross, incense boat, bell ringing, cruet presentation.',
      '3. Punctuality: Reporting at the Sacristy at least 15 minutes before Holy Mass.'
    ]
  },
  {
    id: 'doc-8',
    title: 'Parish Family Card & Membership Registration Form',
    titleTa: 'பங்கு குடும்ப அட்டை & உறுப்பினர் பதிவு படிவம்',
    category: 'Certificates',
    description: 'Family registry update form for newly settled families, anbiyam enrollment, and annual church subscription records.',
    type: 'PDF',
    size: '540 KB',
    date: 'Parish Registry',
    badge: 'Family Record',
    content: [
      'PARISH FAMILY ENROLLMENT & MEMBERSHIP FORM',
      'St. John de Britto Church, Kalayarkoil',
      'Information required:',
      '1. Head of the Family Name, Occupation, and Mobile Number.',
      '2. Residential Address and Anbiyam Name / Number.',
      '3. Complete details of family members (Baptism, Communion, Confirmation status).',
      '4. Previous parish Transfer Certificate (TC) if newly moved to the parish.'
    ]
  }
];

export default function PublicDocuments() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return PARISH_DOCUMENTS.filter(doc => {
      const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
      const matchesSearch = searchQuery === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.titleTa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Generate and download a real formatted PDF
  const handleDownloadPDF = (doc) => {
    try {
      const pdf = new jsPDF();
      
      // Header Banner
      pdf.setFillColor(27, 54, 93); // Royal Blue
      pdf.rect(0, 0, 210, 38, 'F');
      
      pdf.setFillColor(212, 160, 23); // Church Gold
      pdf.rect(0, 38, 210, 3, 'F');

      // Header Text
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text("ST. JOHN DE BRITTO'S CHURCH", 105, 16, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Kalayarkoil, Sivagangai District - 630 551 | Diocese of Sivagangai', 105, 24, { align: 'center' });
      pdf.text('Official Parish Document & Administrative Record', 105, 31, { align: 'center' });

      // Document Title Section
      pdf.setTextColor(27, 54, 93);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      const splitTitle = pdf.splitTextToSize(doc.title.toUpperCase(), 180);
      pdf.text(splitTitle, 14, 52);

      // Metadata Info Box
      pdf.setDrawColor(220, 220, 220);
      pdf.setFillColor(248, 249, 250);
      pdf.roundedRect(14, 60, 182, 18, 2, 2, 'FD');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Category: ${doc.category}`, 20, 71);
      pdf.text(`Document Version: ${doc.date}`, 85, 71);
      pdf.text(`Status: Official Attested`, 150, 71);

      // Body Content
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 40);

      let currentY = 88;
      doc.content.forEach((line) => {
        if (line.startsWith('Article') || line.startsWith('ANNUAL') || line.startsWith('ST. JOHN') || line.startsWith('CHRISTIAN') || line.startsWith('BAPTISM') || line.startsWith('PARISH') || line.startsWith('SUNDAY') || line.startsWith('ALTAR')) {
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(27, 54, 93);
          pdf.setFontSize(11);
          currentY += 3;
        } else if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('Resolution') || line.startsWith('Requirements') || line.startsWith('Mandatory')) {
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(50, 50, 50);
          pdf.setFontSize(10);
          currentY += 2;
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(70, 70, 70);
          pdf.setFontSize(9.5);
        }

        const lines = pdf.splitTextToSize(line, 180);
        pdf.text(lines, 14, currentY);
        currentY += (lines.length * 5.5) + 2;

        if (currentY > 260) {
          pdf.addPage();
          currentY = 20;
        }
      });

      // Footer
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(212, 160, 23);
        pdf.line(14, 280, 196, 280);
        
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text("St. John de Britto Church, Kalayarkoil • Official Publication", 14, 286);
        pdf.text(`Page ${i} of ${pageCount}`, 196, 286, { align: 'right' });
      }

      // Trigger Download
      const safeFilename = doc.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 35);
      pdf.save(`${safeFilename}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
    }
  };

  return (
    <div className="min-h-screen pt-12 sm:pt-16 bg-slate-50 text-gray-800">
      
      {/* 1. Page Hero */}
      <PageHero 
        title={<>Parish Documents & Reports</>} 
        subtitle={<>பங்கு ஆவணங்கள் & அறிக்கைகள் • Official Constitution, Reports & Guidelines</>} 
      />

      {/* Breadcrumbs */}
      <div className="bg-white border-b border-gray-200 py-2.5 px-4 sm:px-8 text-xs font-semibold text-gray-500">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Link to="/" className="hover:text-church-royal-blue transition-colors">Home</Link>
          <FiChevronRight className="text-gray-400" />
          <Link to="/parish-council" className="hover:text-church-royal-blue transition-colors">Parish Council</Link>
          <FiChevronRight className="text-gray-400" />
          <span className="text-church-royal-blue font-bold">Documents & Reports</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        
        {/* 2. Top Info Banner & Certificate Portal Callout */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-bold uppercase tracking-wider">
              <FiShield className="text-church-gold" /> Official Church Records
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 leading-tight">
              Parish Publications, Council Reports & Forms
            </h2>
            <p className="text-xs font-tamil text-church-royal-blue font-bold">
              பங்கின் சட்டவிதிகள், ஆண்டு அறிக்கைகள் மற்றும் சான்றிதழ் படிவங்கள்
            </p>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed text-justify">
              Access official publications of <strong>St. John de Britto's Church</strong>, including the Parish Pastoral Council Constitution, annual pastoral reports, sacramental guidelines, catechism handbooks, and downloadable application forms. All documents reflect diocesan norms and parish council resolutions.
            </p>
          </div>

          <div className="lg:col-span-4 bg-gradient-to-br from-church-royal-blue via-blue-900 to-indigo-950 rounded-3xl p-6 text-white shadow-md flex flex-col justify-between border border-blue-800">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs text-church-gold font-bold uppercase tracking-wider">
                <FiFileText /> Certificate Desk
              </div>
              <h3 className="text-lg font-bold font-display leading-snug">
                Need an Official Certificate?
              </h3>
              <p className="text-xs text-blue-100 leading-relaxed">
                Parishioners can request official Baptism, Marriage, or Membership Certificates online via the Member Dashboard.
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-white/15">
              {user ? (
                <Link
                  to="/dashboard/documents"
                  className="w-full py-2.5 px-4 rounded-xl bg-church-gold hover:bg-amber-400 text-amber-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <FiFileText /> Request Certificate Online →
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-church-royal-blue font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <FiUserCheck /> Login to Request Certificate →
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* 3. Search Bar & Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {DOCUMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-church-royal-blue text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports or documents..."
              className="pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-church-gold/50 w-full sm:w-64"
            />
          </div>
        </div>

        {/* 4. Document Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map((doc, idx) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/60 px-2.5 py-0.5 rounded-full">
                    {doc.badge}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {doc.size} • {doc.type}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-church-royal-blue transition-colors">
                    {doc.title}
                  </h3>
                  <p className="text-xs font-tamil text-church-royal-blue font-bold mt-1">
                    {doc.titleTa}
                  </p>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-600 leading-relaxed text-justify">
                  {doc.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewDoc(doc)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-church-royal-blue transition-colors cursor-pointer"
                >
                  <FiInfo className="text-xs" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPDF(doc)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-church-royal-blue hover:bg-blue-900 text-white text-xs font-bold shadow-2xs hover:shadow-sm transition-all cursor-pointer active:scale-98"
                >
                  <FiDownload className="text-xs text-church-gold" />
                  <span>Download PDF</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 5. Document Issuance & Guidelines Section */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <FiInfo className="text-church-gold text-lg" />
            <h3 className="text-lg font-bold font-display text-gray-900">
              Parish Office Document Guidelines
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-600 leading-relaxed">
            <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100 space-y-1.5">
              <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <FiClock className="text-church-royal-blue" /> Processing Timeline
              </p>
              <p>Certificate requests are verified with original baptism registers and processed within 2 to 3 working days.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100 space-y-1.5">
              <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <FiCheckCircle className="text-emerald-600" /> Attestation & Seal
              </p>
              <p>All issued certificates carry the authentic Parish Seal and official signature of Rev. Fr. Parish Priest.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100 space-y-1.5">
              <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <GiChurch className="text-church-gold" /> Office Verification Desk
              </p>
              <p>Visit the Parish Office (Mon - Sun, 09:00 AM - 12:30 PM & 04:30 PM - 08:30 PM) for physical document collection.</p>
            </div>
          </div>
        </section>

      </div>

      {/* 6. Document Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewDoc(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl z-10 border border-gray-100 max-h-[90vh] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-amber-50 rounded-xl text-church-gold font-bold">
                      <FiFileText className="text-base" />
                    </span>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{previewDoc.title}</h3>
                      <p className="text-xs text-gray-400">{previewDoc.category} • {previewDoc.date}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <FiX className="text-lg" />
                  </button>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-2 text-xs text-gray-700 leading-relaxed">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                    <p className="font-tamil font-bold text-church-royal-blue text-sm mb-1">{previewDoc.titleTa}</p>
                    <p>{previewDoc.description}</p>
                  </div>

                  <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 font-mono text-[11px] space-y-1.5">
                    {previewDoc.content.map((line, i) => (
                      <p key={i} className={line.startsWith('Article') || line.startsWith('ST. JOHN') || line.startsWith('ANNUAL') ? 'font-bold text-church-royal-blue pt-1 font-sans' : ''}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Close Preview
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleDownloadPDF(previewDoc);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-church-royal-blue hover:bg-blue-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <FiDownload className="text-church-gold" />
                  <span>Download Formatted PDF</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
