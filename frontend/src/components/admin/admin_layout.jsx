import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { FiUsers, FiBriefcase, FiBookOpen, FiCalendar, FiFileText, FiMessageSquare, FiVolume2, FiDollarSign, FiImage, FiBell, FiMenu, FiX, FiLogOut, FiArrowLeft, FiSettings, FiTool } from 'react-icons/fi';
import { SiWhatsapp } from 'react-icons/si';
import { GiChurch, GiCrucifix, GiPrayer } from 'react-icons/gi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/context_auth_context';
import { useNotifications } from '../../context/context_notification_context';
import PreMaintenanceBanner from '../common/common_pre_maintenance_banner';
import churchLogo from '../../assets/church_extirior.png';

const NAV_ITEMS = [
  { icon: <FiUsers />, label: 'Users', path: '/admin/users', color: 'bg-blue-500' },
  { icon: <GiChurch />, label: 'Anbiyams', path: '/admin/anbiyam', color: 'bg-indigo-700' },
  { icon: <FiBriefcase />, label: 'Manage Team', path: '/admin/team', color: 'bg-emerald-600' },
  { icon: <GiChurch />, label: 'Priests', path: '/admin/priests', color: 'bg-amber-600' },
  { icon: <FiCalendar />, label: 'Events', path: '/admin/events', color: 'bg-green-600' },
  { icon: <FiVolume2 />, label: 'Announcements', path: '/admin/announcements', color: 'bg-orange-500' },
  { icon: <FiImage />, label: 'Gallery', path: '/admin/gallery', color: 'bg-purple-600' },
  { icon: <FiBookOpen />, label: 'Bookings', path: '/admin/bookings', color: 'bg-indigo-600' },
  { icon: <FiFileText />, label: 'Documents', path: '/admin/documents', color: 'bg-teal-600' },
  { icon: <FiDollarSign />, label: 'Donations', path: '/admin/donations', color: 'bg-yellow-600' },
  { icon: <FiMessageSquare />, label: 'Tickets', path: '/admin/tickets', color: 'bg-rose-600' },
  { icon: <GiPrayer />, label: 'Prayers', path: '/admin/prayers', color: 'bg-church-gold' },
  { icon: <SiWhatsapp />, label: 'WhatsApp Bot', path: '/admin/whatsapp', color: 'bg-[#25D366]' },
  { icon: <FiSettings />, label: 'Site Settings', path: '/admin/settings', color: 'bg-gray-600' },
];

export default function AdminLayout() {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState(null); // { label: string, top: number }
  const { logout } = useAuth();
  const { adminUnreadCount } = useNotifications();
  const location = useLocation();

  const handleMouseEnter = (label, e) => {
    if (desktopOpen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({ label, top: rect.top + rect.height / 2 });
  };

  const handleMouseLeave = () => {
    setHoveredTooltip(null);
  };

  return (
    <div className="min-h-screen bg-church-cream flex">
      {/* Dynamic Sidebar Hover Tooltip */}
      {!desktopOpen && hoveredTooltip && (
        <div
          style={{ top: `${hoveredTooltip.top}px` }}
          className="fixed left-20 -translate-y-1/2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xl border border-white/20 z-[999] pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
        >
          {hoveredTooltip.label}
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex fixed inset-y-0 left-0 ${desktopOpen ? 'w-64' : 'w-20'} bg-church-royal-blue z-50 transition-all duration-300 ease-in-out flex-col`}>
        <div className="px-3 py-2.5 border-b border-white/10 flex items-center relative bg-white/5 h-[65px]">
          <Link to="/admin" title="Admin Dashboard" className="flex items-center cursor-pointer hover:opacity-90 transition-opacity">
            <div className="w-11 h-11 rounded-full bg-white ring-2 ring-church-gold/40 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md hover:ring-church-gold transition-all">
              <img src={churchLogo} alt="Admin Dashboard" className="w-full h-full object-cover object-[center_15%] rounded-full" />
            </div>
            <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${desktopOpen ? 'max-w-[170px] opacity-100 ml-2.5' : 'max-w-0 opacity-0 ml-0'}`}>
              <p className="text-white font-bold text-sm leading-tight">St. John de Britto Church</p>
              <p className="text-church-gold text-[10px] leading-tight font-medium">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Desktop Toggle Button */}
        <button
          onClick={() => { setDesktopOpen(!desktopOpen); setHoveredTooltip(null); }}
          className="hidden lg:flex absolute top-4 -right-3 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center text-church-royal-blue z-50 hover:bg-gray-50 shadow-md transition-transform duration-300"
        >
          <FiArrowLeft className={`transition-transform duration-300 ${!desktopOpen ? 'rotate-180' : ''}`} size={12} />
        </button>

        <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-1.5 admin-sidebar-scroll">
          <Link
            to="/admin"
            onMouseEnter={(e) => handleMouseEnter('Dashboard', e)}
            onMouseLeave={handleMouseLeave}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold text-xs transition-colors duration-200 ${location.pathname === '/admin' ? 'bg-church-gold text-white shadow-md' : 'text-gray-200 hover:bg-white/10 hover:text-white'} group relative`}
          >
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs flex-shrink-0 ${location.pathname === '/admin' ? 'bg-white/20' : 'bg-church-gold'}`}>
              <GiCrucifix className="text-sm" />
            </span>
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${desktopOpen ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'}`}>
              Dashboard
            </span>
          </Link>

          {NAV_ITEMS.map((item, i) => (
            <Link
              key={i}
              to={item.path}
              onMouseEnter={(e) => handleMouseEnter(item.label, e)}
              onMouseLeave={handleMouseLeave}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold text-xs transition-colors duration-200 ${location.pathname === item.path ? 'bg-church-gold text-white shadow-md' : 'text-gray-200 hover:bg-white/10 hover:text-white'} group relative`}
            >
              <span className={`w-7 h-7 rounded-lg ${location.pathname === item.path ? 'bg-white/20' : item.color} flex items-center justify-center text-white text-xs flex-shrink-0`}>{item.icon}</span>
              <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${desktopOpen ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'}`}>
                {item.label}
              </span>
            </Link>
          ))}

          {/* Notifications Nav Item with Badge */}
          <Link
            to="/admin/notifications"
            onMouseEnter={(e) => handleMouseEnter(`Notifications${adminUnreadCount > 0 ? ` (${adminUnreadCount})` : ''}`, e)}
            onMouseLeave={handleMouseLeave}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold text-xs transition-colors duration-200 ${location.pathname === '/admin/notifications' ? 'bg-church-gold text-white shadow-md' : 'text-gray-200 hover:bg-white/10 hover:text-white'
              } group relative`}
          >
            <span className={`w-7 h-7 rounded-lg ${location.pathname === '/admin/notifications' ? 'bg-white/20' : 'bg-red-500'} flex items-center justify-center text-white text-xs flex-shrink-0 relative`}>
              <FiBell />
              {adminUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-church-gold text-white text-[7px] rounded-full flex items-center justify-center font-black border border-church-royal-blue">
                  {adminUnreadCount > 9 ? '9+' : adminUnreadCount}
                </span>
              )}
            </span>
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out flex items-center gap-2 ${desktopOpen ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'}`}>
              Notifications
              {adminUnreadCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{adminUnreadCount}</span>
              )}
            </span>
          </Link>
        </nav>

        <div className="px-2.5 py-2 border-t border-white/10 flex flex-col gap-1.5 flex-shrink-0">
          <Link
            to="/"
            onMouseEnter={(e) => handleMouseEnter('Back to Website', e)}
            onMouseLeave={handleMouseLeave}
            className="flex items-center gap-2.5 px-3 bg-church-gold hover:brightness-110 text-white text-xs font-bold transition-all py-2 rounded-lg w-full shadow-gold-sm group relative"
          >
            <span className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              <FiArrowLeft className="text-sm" />
            </span>
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${desktopOpen ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'}`}>
              Back to Website
            </span>
          </Link>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            onMouseEnter={(e) => handleMouseEnter('Logout', e)}
            onMouseLeave={handleMouseLeave}
            className="flex items-center gap-2.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors py-2 rounded-lg w-full shadow-sm group relative"
          >
            <span className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              <FiLogOut className="text-sm" />
            </span>
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${desktopOpen ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'}`}>
              Logout
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-300 ease-in-out ${desktopOpen ? 'lg:ml-64' : 'lg:ml-20'} flex flex-col min-h-screen relative w-full`}>
        {/* Mobile Header Navbar */}
        <div className="lg:hidden bg-church-royal-blue text-white p-3.5 px-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
          {/* Top Left: Church logo image linking to Admin Dashboard */}
          <Link to="/admin" className="w-11 h-11 rounded-full bg-white ring-2 ring-church-gold/60 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
            <img src={churchLogo} alt="Admin Dashboard" className="w-full h-full object-cover object-[center_15%]" />
          </Link>

          {/* Top Right: Back to Website & Logout */}
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-1.5 bg-church-gold hover:brightness-110 text-white text-xs sm:text-sm font-extrabold px-3.5 py-2.5 rounded-xl shadow-md transition-all">
              <FiArrowLeft className="text-sm sm:text-base" /> Back to Website
            </Link>
            <button onClick={() => setShowLogoutConfirm(true)} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold px-3.5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer">
              <FiLogOut className="text-sm sm:text-base" /> Logout
            </button>
          </div>
        </div>

        {/* Scheduled Maintenance Notice Banner for Admin Panel */}
        <PreMaintenanceBanner />

        {/* Outlet Content */}
        <div className="flex-1 overflow-x-hidden">
          <Outlet />
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowLogoutConfirm(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 w-full max-w-[360px] sm:max-w-sm text-center shadow-2xl relative"
            >
              {/* Circular Red Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#fff1f2] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5">
                <svg
                  className="w-7 h-7 sm:w-8 sm:h-8 text-[#dc2626]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>

              {/* Title */}
              <h2 className="font-serif text-2xl sm:text-[26px] font-bold text-church-royal-blue tracking-wide mb-2">LOG OUT</h2>

              {/* Description */}
              <p className="text-gray-500 text-sm sm:text-[15px] leading-relaxed mb-6 px-1">Are you sure you want to Log out of the Admin Panel?</p>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3.5 w-full">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full py-3 sm:py-3.5 rounded-2xl font-bold text-gray-700 bg-[#f1f5f9] hover:bg-slate-200 transition-colors text-sm sm:text-base cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-3 sm:py-3.5 rounded-2xl font-bold text-white bg-[#dc2626] hover:bg-red-700 transition-all shadow-md active:scale-95 text-sm sm:text-base cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
