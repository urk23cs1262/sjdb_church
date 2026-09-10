import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSearch, FiShield, FiLock, FiFileText, FiCheckCircle, FiInfo, FiAlertCircle } from 'react-icons/fi';
import { GiChurch } from 'react-icons/gi';

export const POLICY_DATA = {
  terms: {
    id: 'terms',
    title: 'Terms & Conditions',
    icon: <FiFileText className="text-blue-500" />,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        content: `By registering an account, accessing, or using the St. John de Britto's Church Parish Management Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions and all applicable laws and regulations. If you do not agree, please do not use our services.`
      },
      {
        heading: '2. User Accounts & Responsibilities',
        content: `Users must provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your credentials and for all activities occurring under your account. You agree to notify administrators immediately of any unauthorized access.`
      },
      {
        heading: '3. Community Conduct & Usage Guidelines',
        content: `Members agree to interact with honesty, respect, and dignity. Prohibited activities include submitting fake document requests, posting offensive content, harassing other parishioners, impersonating church administrators, or attempting unauthorized access to parish databases.`
      },
      {
        heading: '4. Service Availability & Modifications',
        content: `The parish administration reserves the right to modify, suspend, or discontinue any feature, service, or booking function at any time without prior notice for maintenance, security reviews, or pastoral needs.`
      },
      {
        heading: '5. Account Suspension & Termination',
        content: `Accounts that violate community policies, exceed security failure thresholds, or engage in suspicious login activities will be automatically deactivated. Reactivation requires explicit administrator approval and audit verification.`
      }
    ]
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    icon: <FiLock className="text-emerald-500" />,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        content: `We collect essential personal information required for parish records and authentication: Full Name, Email Address, Phone Number, Parish Sub-station, Family/Member ID, and technical access logs (IP address, browser type, device details).`
      },
      {
        heading: '2. How Your Data Is Used',
        content: `Your data is processed strictly for: Member authentication, Mass booking confirmations, Certificate & Document issuance, Pastoral prayer requests, Automated security notifications, and Parish administrative communication.`
      },
      {
        heading: '3. Data Security & Encryption',
        content: `We employ industry-standard encryption protocols. Passwords are salted and hashed using bcrypt; sensitive data transfers use SSL/TLS encryption. Passwords are NEVER stored in plain text.`
      },
      {
        heading: '4. Zero Third-Party Selling Guarantee',
        content: `We NEVER sell, rent, or trade your personal information to third parties, commercial advertisers, or data brokers under any circumstances.`
      },
      {
        heading: '5. Your Rights & Account Deletion',
        content: `You have the right to inspect, update, or request the deletion of your personal records. Contact the parish administrator to process record updates or account deletion requests.`
      }
    ]
  },
  security: {
    id: 'security',
    title: 'Security & Trust Policy',
    icon: <FiShield className="text-red-500" />,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Multi-Tier Progressive Security Guard',
        content: `To defend against brute-force and credential-stuffing attacks:
- 1–3 Failed Attempts: Soft error alert.
- 4th Failed Attempt: Warning of imminent lockout.
- 5th Failed Attempt: 15-minute temporary lockout with OTP security verification.
- 10th Attempt / Repeated Lockouts: Automatic account deactivation and high-priority admin alert.`
      },
      {
        heading: '2. Administrative Review & Reactivation',
        content: `When an account is deactivated for security, the user remains locked until an authorized administrator reviews the incident log, verifies identity, and manually reactivates access.`
      },
      {
        heading: '3. Security Environment Logging & Audit Trails',
        content: `Every security incident logs IP address, browser user-agent, operating system, timestamp, and geolocation data. Administrative reactivations are recorded permanently in audit registries.`
      },
      {
        heading: '4. Instant Security Alert Emails',
        content: `Users and administrators receive real-time email notifications for new device sign-ins, password resets, account lockouts, automatic deactivations, and manual reactivations.`
      }
    ]
  },
  cookies: {
    id: 'cookies',
    title: 'Cookie Policy',
    icon: <FiInfo className="text-amber-500" />,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Essential Operational Cookies',
        content: `We use essential cookies and local storage tokens solely for keeping you securely logged in (JWT session state) and saving your selected language preference (Tamil / English).`
      },
      {
        heading: '2. No Tracking or Advertising Cookies',
        content: `We do NOT use tracking cookies, behavioral profiling tools, or third-party advertising scripts on this platform.`
      }
    ]
  },
  guidelines: {
    id: 'guidelines',
    title: 'Community Guidelines',
    icon: <GiChurch className="text-purple-500" />,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Respectful Communication',
        content: `Treat all fellow parishioners and pastoral staff with Christian kindness, reverence, and respect.`
      },
      {
        heading: '2. Genuine Submissions',
        content: `Submit truthful details for document requests, certificates, and prayer requests. Misleading or fraudulent submissions are prohibited.`
      }
    ]
  }
};

export default function PolicyModal({ isOpen, onClose, initialTab = 'terms' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  const currentPolicy = POLICY_DATA[activeTab] || POLICY_DATA.terms;
  const filteredSections = currentPolicy.sections.filter(s =>
    s.heading.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
      >
        {/* Top Accent Header */}
        <div className="bg-gradient-to-r from-church-royal-blue via-blue-900 to-indigo-900 text-white px-4 sm:px-6 py-3.5 sm:py-5 flex items-center justify-between relative overflow-hidden flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 relative z-10">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center text-lg sm:text-xl text-gold-300 border border-white/10 shadow-inner flex-shrink-0">
              {currentPolicy.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-black text-sm sm:text-xl text-white leading-tight uppercase tracking-tight sm:tracking-wide truncate">
                {currentPolicy.title}
              </h2>
              <p className="text-[10px] sm:text-xs text-blue-200/90 font-medium truncate mt-0.5">
                Official Policy • Updated: {currentPolicy.lastUpdated}
              </p>
            </div>
          </div>
        </div>

        {/* Policy Tab Bar without ugly browser scrollbar */}
        <div 
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-100/90 border-b border-slate-200 overflow-x-auto flex-shrink-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {Object.values(POLICY_DATA).map(p => (
            <button
              key={p.id}
              onClick={() => { setActiveTab(p.id); setSearchTerm(''); }}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 ${
                activeTab === p.id
                  ? 'bg-church-royal-blue text-white shadow-md shadow-blue-900/20 scale-[1.02]'
                  : 'bg-white text-gray-700 hover:bg-gray-200/80 border border-gray-200'
              }`}
            >
              <span>{p.icon}</span>
              <span>{p.title}</span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-gray-100 bg-white flex items-center gap-2 flex-shrink-0">
          <FiSearch className="text-gray-400 text-sm flex-shrink-0" />
          <input
            type="text"
            placeholder={`Search within ${currentPolicy.title}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-xs text-gray-400 hover:text-gray-600 font-bold px-1">
              Clear
            </button>
          )}
        </div>

        {/* Scrollable Policy Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-gray-700 text-xs sm:text-sm leading-relaxed">
          {filteredSections.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No matching sections found for "{searchTerm}"
            </div>
          ) : (
            filteredSections.map((sec, idx) => (
              <div key={idx} className="bg-slate-50/80 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <h3 className="font-bold text-church-royal-blue text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-2">
                  <FiCheckCircle className="text-emerald-600 text-xs sm:text-sm flex-shrink-0" />
                  {sec.heading}
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                  {sec.content}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 flex-shrink-0">
          <p className="text-[10px] sm:text-[11px] text-gray-500 text-center sm:text-left">
            Questions? Contact <span className="font-bold text-gray-700">sjdbchurch@gmail.com</span>
          </p>
          <button
            onClick={onClose}
            className="btn-gold w-full sm:w-auto px-6 py-2.5 text-xs font-bold shadow-md rounded-xl justify-center"
          >
            Yes, i Understood
          </button>
        </div>
      </motion.div>
    </div>
  );
}
