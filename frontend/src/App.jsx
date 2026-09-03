import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/context_auth_context';
import { NotificationProvider } from './context/context_notification_context';
import { PWAProvider } from './context/context_pwa';

import './i18n';
import PageLoader from './components/common/common_loader';
import Layout from './components/common/common_layout';
import ScrollToTop from './components/common/common_scroll_to_top';
import WhatsAppWidget from './components/common/common_whatsapp_widget';
import PWAInstallModal from './components/common/common_pwa_install_modal';

// Lazy-loaded pages
const Home = lazy(() => import('./pages/public/public_home'));
const About = lazy(() => import('./pages/public/public_about'));
const Priests = lazy(() => import('./pages/public/public_priests'));
const MassTimings = lazy(() => import('./pages/public/public_mass_timings'));
const Events = lazy(() => import('./pages/public/public_events'));
const Gallery = lazy(() => import('./pages/public/public_gallery'));
const LiveStream = lazy(() => import('./pages/public/public_live_stream'));
const Contact = lazy(() => import('./pages/public/public_contact'));
const Donate = lazy(() => import('./pages/public/public_donate'));
const BibleVerse = lazy(() => import('./pages/public/public_bible_verse'));
const PrayerRequests = lazy(() => import('./pages/user/user_prayer_requests'));
const Announcements = lazy(() => import('./pages/public/public_announcements'));
const Rosary = lazy(() => import('./pages/public/public_rosary'));
const CatholicCalendar = lazy(() => import('./pages/public/public_catholic_calendar'));
const FAQ = lazy(() => import('./pages/public/public_faq'));
const ParishCouncil = lazy(() => import('./pages/public/public_parish_council'));
const NearbyParishes = lazy(() => import('./pages/public/public_nearby_parishes'));
const Team = lazy(() => import('./pages/public/public_our_team'));
const MemberReport = lazy(() => import('./pages/public/public_member_report'));
const Anbiyams = lazy(() => import('./pages/public/public_anbiyams'));
const PublicDocuments = lazy(() => import('./pages/public/public_documents'));

import AdminLayout from './components/admin/admin_layout';

// Auth & Security pages
const Login = lazy(() => import('./pages/auth/auth_login'));
const Register = lazy(() => import('./pages/auth/auth_register'));
const ReportUnauthorized = lazy(() => import('./pages/security/security_report_unauthorized'));

// User dashboard
const UserDashboard = lazy(() => import('./pages/user/user_dashboard'));
const UserBooking = lazy(() => import('./pages/user/user_mass_bookings'));
const UserDocuments = lazy(() => import('./pages/user/user_documents'));
const UserTickets = lazy(() => import('./pages/user/user_tickets'));
const UserProfile = lazy(() => import('./pages/user/user_profile'));
const UserSettings = lazy(() => import('./pages/user/user_settings'));
const UserNotifications = lazy(() => import('./pages/user/user_notifications'));

// Admin dashboard
const AdminDashboard = lazy(() => import('./pages/admin/admin_dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/admin_users'));
const AdminPriests = lazy(() => import('./pages/admin/admin_priests'));
const AdminEvents = lazy(() => import('./pages/admin/admin_events'));
const AdminGallery = lazy(() => import('./pages/admin/admin_gallery'));
const AdminAnnouncements = lazy(() => import('./pages/admin/admin_announcements'));
const AdminBookings = lazy(() => import('./pages/admin/admin_bookings'));
const AdminDocuments = lazy(() => import('./pages/admin/admin_documents'));
const AdminDonations = lazy(() => import('./pages/admin/admin_donations'));
const AdminTickets = lazy(() => import('./pages/admin/admin_tickets'));
const AdminPrayers = lazy(() => import('./pages/admin/admin_prayers'));
const AdminSettings = lazy(() => import('./pages/admin/admin_site_settings'));
const AdminWhatsApp = lazy(() => import('./pages/admin/admin_whatsapp'));
const AdminNotifications = lazy(() => import('./pages/admin/admin_notifications'));
const AdminTeam = lazy(() => import('./pages/admin/admin_team'));
const AdminAnbiyam = lazy(() => import('./pages/admin/admin_anbiyams'));

// Route guards
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
    const fullPath = location.pathname + location.search + location.hash;
    sessionStorage.setItem("redirectAfterLogin", fullPath);
    return <Navigate to={`/login?redirect=${encodeURIComponent(fullPath)}`} replace />;
  }
  return children;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) {
    const fullPath = location.pathname + location.search + location.hash;
    sessionStorage.setItem("redirectAfterLogin", fullPath);
    return <Navigate to={`/login?redirect=${encodeURIComponent(fullPath)}`} replace />;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

const Maintenance = lazy(() => import('./pages/public/public_maintenance'));
const AdminMaintenance = lazy(() => import('./pages/admin/admin_maintenance'));

import MaintenanceGuard from './components/common/common_maintenance_guard';
import PageTracker from './components/common/common_page_tracker';

function AppRoutes() {
  return (
    <BrowserRouter>
      <PageTracker />
      <ScrollToTop />
      <WhatsAppWidget />
      <PWAInstallModal />
      <MaintenanceGuard>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes with layout */}
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/priests" element={<Priests />} />
              <Route path="/mass-timings" element={<MassTimings />} />
              <Route path="/events" element={<Events />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/live" element={<LiveStream />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/donate" element={<Donate />} />
              <Route path="/bible-verse" element={<BibleVerse />} />
              <Route path="/daily-mass-readings" element={<BibleVerse />} />
              <Route path="/readings" element={<BibleVerse />} />
              <Route path="/reflection" element={<BibleVerse />} />
              <Route path="/saint-of-the-day" element={<BibleVerse />} />
              <Route path="/prayers" element={<PrayerRequests />} />
              <Route path="/prayer-requests" element={<PrayerRequests />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/rosary" element={<Rosary />} />
              <Route path="/calendar" element={<CatholicCalendar />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/parish-council" element={<ParishCouncil />} />
              <Route path="/nearby-parishes" element={<NearbyParishes />} />
              <Route path="/team" element={<Team />} />
              <Route path="/anbiyams" element={<Anbiyams />} />
              <Route path="/documents" element={<PublicDocuments />} />
              <Route path="/member-report/:token" element={<MemberReport />} />

              {/* User dashboard routes & direct aliases */}
              <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/booking" element={<ProtectedRoute><UserBooking /></ProtectedRoute>} />
              <Route path="/dashboard/documents" element={<ProtectedRoute><UserDocuments /></ProtectedRoute>} />
              <Route path="/dashboard/tickets" element={<ProtectedRoute><UserTickets /></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><UserSettings /></ProtectedRoute>} />
              <Route path="/dashboard/profile" element={<ProtectedRoute><UserSettings /></ProtectedRoute>} />
              <Route path="/dashboard/notifications" element={<ProtectedRoute><UserNotifications /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Navigate to="/dashboard/profile" replace /></ProtectedRoute>} />
              <Route path="/tickets" element={<ProtectedRoute><Navigate to="/dashboard/tickets" replace /></ProtectedRoute>} />
              <Route path="/bookings" element={<ProtectedRoute><Navigate to="/dashboard/booking" replace /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Navigate to="/dashboard/notifications" replace /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Navigate to="/dashboard/settings" replace /></ProtectedRoute>} />

            </Route>

            {/* Public Maintenance Page */}
            <Route path="/maintenance" element={<Maintenance />} />

            {/* Auth & Security routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/security/report-unauthorized" element={<ReportUnauthorized />} />

            {/* Admin dashboard routes */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="priests" element={<AdminPriests />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="gallery" element={<AdminGallery />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="documents" element={<AdminDocuments />} />
              <Route path="donations" element={<AdminDonations />} />
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="prayers" element={<AdminPrayers />} />
              <Route path="anbiyam" element={<AdminAnbiyam />} />
              <Route path="maintenance" element={<AdminMaintenance />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="whatsapp" element={<AdminWhatsApp />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="team" element={<AdminTeam />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </MaintenanceGuard>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <PWAProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#1e3a8a', color: '#fff', borderRadius: '12px' },
              success: { iconTheme: { primary: '#d4a017', secondary: '#fff' } },
            }}
          />
        </PWAProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
