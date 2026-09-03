/**
 * Canonical Single Source of Truth for Website Routes & URLs
 * Used across Frontend, Backend Bot Handlers, RAG Engine, Schedulers, and Notification Formatter.
 */

function getBaseClientUrl() {
  const envUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || '';
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '');
  }
  return 'https://st-jb-church.vercel.app';
}

const SITE_ROUTES = {
  // Public Core Pages
  HOME: '/',
  ABOUT: '/about',
  PRIESTS: '/priests',
  MASS_TIMINGS: '/mass-timings',
  EVENTS: '/events',
  GALLERY: '/gallery',
  LIVE: '/live',
  CONTACT: '/contact',
  DONATE: '/donate',

  // Scripture, Liturgy & Devotions
  BIBLE_VERSE: '/bible-verse',
  DAILY_READINGS: '/bible-verse#readings',
  DAILY_VERSE: '/bible-verse#verse',
  DAILY_REFLECTION: '/bible-verse#reflection',
  SAINT_OF_THE_DAY: '/bible-verse#saint-of-the-day',
  ROSARY: '/rosary',
  CALENDAR: '/calendar',
  PRAYERS: '/prayers',
  PRAYER_REQUESTS: '/prayer-requests',

  // Parish Community & Ministries
  ANBIYAMS: '/anbiyams',
  PARISH_COUNCIL: '/parish-council',
  TEAM: '/team',
  NEARBY_PARISHES: '/nearby-parishes',
  DOCUMENTS: '/documents',
  ANNOUNCEMENTS: '/announcements',
  FAQ: '/faq',

  // Auth & Account
  LOGIN: '/login',
  REGISTER: '/register',
  PROFILE: '/dashboard/profile',
  DASHBOARD: '/dashboard',
  BOOKINGS: '/dashboard/booking',
  TICKETS: '/dashboard/tickets',
  SETTINGS: '/dashboard/settings',
  NOTIFICATIONS: '/dashboard/notifications',

  // Admin Routes
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_PRIESTS: '/admin/priests',
  ADMIN_EVENTS: '/admin/events',
  ADMIN_ANNOUNCEMENTS: '/admin/announcements',
  ADMIN_BOOKINGS: '/admin/bookings',
  ADMIN_DOCUMENTS: '/admin/documents',
  ADMIN_DONATIONS: '/admin/donations',
  ADMIN_TICKETS: '/admin/tickets',
  ADMIN_PRAYERS: '/admin/prayers',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_WHATSAPP: '/admin/whatsapp',
  ADMIN_NOTIFICATIONS: '/admin/notifications'
};

const EXTERNAL_LINKS = {
  GOOGLE_MAPS: 'https://maps.google.com/?q=St.+John+de+Britto+Church+Kalayarkoil+Tamil+Nadu+630551',
  WHATSAPP_BOT: 'https://wa.me/919655639144?text=Hi'
};

/**
 * Build exact absolute URL for any route
 * @param {string} routePath - Relative path or route key from SITE_ROUTES
 * @returns {string} Fully qualified HTTPS URL
 */
function getSiteUrl(routePath = '') {
  const base = getBaseClientUrl();
  if (!routePath || routePath === '/' || routePath === '') {
    return base;
  }
  
  // If already an absolute URL or external link, return as is
  if (routePath.startsWith('http://') || routePath.startsWith('https://')) {
    return routePath;
  }

  const cleanPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${base}${cleanPath}`;
}

module.exports = {
  getBaseClientUrl,
  SITE_ROUTES,
  EXTERNAL_LINKS,
  getSiteUrl
};
