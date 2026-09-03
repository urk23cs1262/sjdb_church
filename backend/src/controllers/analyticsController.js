const PageView = require('../models/PageView');
const Ticket = require('../models/Ticket');
const PrayerRequest = require('../models/PrayerRequest');
const Event = require('../models/Event');
const User = require('../models/User');

// Helper to determine device type from User-Agent
const detectDevice = (userAgent = '') => {
  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet';
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
};

// Helper to determine browser
const detectBrowser = (userAgent = '') => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('firefox')) return 'Firefox';
  return 'Other';
};

// Map URL routes to readable Page Names
const PAGE_NAME_MAP = {
  '/': 'Home',
  '/about': 'About Us',
  '/priests': 'Our Priests',
  '/mass-timings': 'Mass Timings',
  '/events': 'Events & Feasts',
  '/gallery': 'Photo Gallery',
  '/live': 'Live Stream',
  '/contact': 'Contact Us',
  '/donate': 'Donations',
  '/bible-verse': 'Daily Scripture',
  '/prayers': 'Prayer Requests',
  '/prayer-requests': 'Prayer Requests',
  '/announcements': 'Announcements',
  '/rosary': 'Daily Rosary',
  '/calendar': 'Parish Calendar',
  '/faq': 'FAQ & Guide',
  '/parish-council': 'Parish Council',
  '/nearby-parishes': 'Nearby Parishes',
  '/team': 'Church Team',
  '/anbiyams': 'Anbiyams (BCC)',
  '/dashboard': 'Member Dashboard',
  '/dashboard/booking': 'Mass Booking',
  '/dashboard/documents': 'Certificates',
  '/dashboard/tickets': 'Helpdesk Tickets'
};

// Parse date range helper
const getPeriodDateRange = (period = '7d', startDate, endDate) => {
  const now = new Date();
  let start, end;

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period === '7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
  } else if (period === '30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
  } else if (period === '90d' || period === '3m') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
  } else if (period === 'custom' && startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    // Default to 7 days
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
  }

  return { start, end };
};

// Track Page View Beacon (Client beacon endpoint)
const trackPageView = async (req, res) => {
  try {
    const { path = '/', pageTitle, visitorId, referrer = '' } = req.body;
    if (!visitorId) {
      return res.status(400).json({ success: false, message: 'visitorId required' });
    }

    const userAgent = req.headers['user-agent'] || '';
    const device = detectDevice(userAgent);
    const browser = detectBrowser(userAgent);
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userId = req.user ? req.user._id : (req.body.userId || null);

    const readableTitle = pageTitle || PAGE_NAME_MAP[path] || (path.startsWith('/admin') ? 'Admin Panel' : 'Church Portal');

    // Insert real page view record
    await PageView.create({
      path: path.split('?')[0] || '/',
      pageTitle: readableTitle,
      visitorId,
      userId,
      ip,
      device,
      browser,
      referrer,
      createdAt: new Date()
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Analytics tracking error:', err.message);
    res.status(200).json({ success: false, error: err.message });
  }
};

// Core Analytics Query Engine — 100% Calculated strictly from Database Records
const getAnalyticsStats = async (req, res) => {
  try {
    const { period = '7d', startDate, endDate } = req.query;
    const { start, end } = getPeriodDateRange(period, startDate, endDate);
    const matchQuery = { createdAt: { $gte: start, $lte: end } };

    // Fetch live collections concurrently
    const [
      pageViewsData,
      ticketsData,
      prayersData,
      eventsData,
      usersData,
      totalUsersCount,
      allTimePageViewsCount
    ] = await Promise.all([
      PageView.find(matchQuery).select('path pageTitle visitorId device browser createdAt').lean(),
      Ticket.find(matchQuery).select('category status priority createdAt').lean(),
      PrayerRequest.find(matchQuery).select('intention prayerLocation type status language createdAt').lean(),
      Event.find().select('title category registrations isPublished date').lean(),
      User.find().select('name role createdAt lastLogin lastSuccessfulLogin isActive').lean(),
      User.countDocuments(),
      PageView.countDocuments()
    ]);

    // 1. Calculate Real Summary KPIs
    const uniqueVisitorsSet = new Set(pageViewsData.map(p => p.visitorId));
    const totalVisitors = uniqueVisitorsSet.size;
    const totalPageViews = pageViewsData.length;

    // Active users: Users with activity or created within the period
    const activeUsersInPeriod = usersData.filter(u => {
      const last = u.lastSuccessfulLogin || u.lastLogin || u.createdAt;
      return last && new Date(last) >= start && new Date(last) <= end;
    }).length;

    // Real event registrations within date range
    let totalEventRegsInPeriod = 0;
    const eventRegsByEventMap = {};

    eventsData.forEach(ev => {
      let regCount = 0;
      if (Array.isArray(ev.registrations)) {
        ev.registrations.forEach(r => {
          const rDate = r.registeredAt ? new Date(r.registeredAt) : (ev.date ? new Date(ev.date) : null);
          if (rDate && rDate >= start && rDate <= end) {
            totalEventRegsInPeriod++;
            regCount++;
          }
        });
      }
      if (regCount > 0) {
        eventRegsByEventMap[ev.title] = regCount;
      }
    });

    const totalSubmissions = ticketsData.length + prayersData.length + totalEventRegsInPeriod;
    const avgPagesPerVisitor = totalVisitors > 0 ? (totalPageViews / totalVisitors).toFixed(1) : '0';

    // 2. Build Real Time-Series Data
    const timeBuckets = [];
    const isHourly = (period === 'today');

    if (isHourly) {
      // 24 Hour Buckets for 'today'
      for (let h = 0; h < 24; h++) {
        const hourLabel = `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
        timeBuckets.push({
          key: h,
          label: hourLabel,
          visitors: 0,
          pageViews: 0,
          submissions: 0,
          prayers: 0,
          userActivity: 0,
          visitorSet: new Set()
        });
      }

      pageViewsData.forEach(pv => {
        const h = new Date(pv.createdAt).getHours();
        if (timeBuckets[h]) {
          timeBuckets[h].pageViews++;
          timeBuckets[h].visitorSet.add(pv.visitorId);
        }
      });

      ticketsData.forEach(t => {
        const h = new Date(t.createdAt).getHours();
        if (timeBuckets[h]) timeBuckets[h].submissions++;
      });

      prayersData.forEach(p => {
        const h = new Date(p.createdAt).getHours();
        if (timeBuckets[h]) {
          timeBuckets[h].prayers++;
          timeBuckets[h].submissions++;
        }
      });

      usersData.forEach(u => {
        const d = u.lastLogin || u.createdAt;
        if (d && new Date(d) >= start && new Date(d) <= end) {
          const h = new Date(d).getHours();
          if (timeBuckets[h]) timeBuckets[h].userActivity++;
        }
      });

      timeBuckets.forEach(b => {
        b.visitors = b.visitorSet.size;
        delete b.visitorSet;
      });

    } else {
      // Daily Buckets
      const dayDiff = Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
      const daysCount = Math.min(dayDiff, period === '90d' || period === '3m' ? 90 : period === '30d' ? 30 : 7);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dateMap = {};

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayLabel = dayNames[d.getDay()];
        const shortDate = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;

        dateMap[dateKey] = {
          dateKey,
          label: daysCount <= 7 ? dayLabel : shortDate,
          fullDate: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          visitors: 0,
          pageViews: 0,
          submissions: 0,
          prayers: 0,
          userActivity: 0,
          visitorSet: new Set()
        };
      }

      pageViewsData.forEach(pv => {
        const d = new Date(pv.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dateMap[key]) {
          dateMap[key].pageViews++;
          dateMap[key].visitorSet.add(pv.visitorId);
        }
      });

      ticketsData.forEach(t => {
        const d = new Date(t.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dateMap[key]) dateMap[key].submissions++;
      });

      prayersData.forEach(p => {
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dateMap[key]) {
          dateMap[key].prayers++;
          dateMap[key].submissions++;
        }
      });

      usersData.forEach(u => {
        const d = u.lastLogin || u.createdAt;
        if (d && new Date(d) >= start && new Date(d) <= end) {
          const dt = new Date(d);
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          if (dateMap[key]) dateMap[key].userActivity++;
        }
      });

      Object.values(dateMap).forEach(b => {
        b.visitors = b.visitorSet.size;
        delete b.visitorSet;
        timeBuckets.push(b);
      });
    }

    // 3. Real Page Views breakdown by Page
    const pageStatsMap = {};
    pageViewsData.forEach(pv => {
      const p = pv.path || '/';
      const title = pv.pageTitle || PAGE_NAME_MAP[p] || p;
      if (!pageStatsMap[p]) {
        pageStatsMap[p] = { path: p, page: title, views: 0, visitorSet: new Set() };
      }
      pageStatsMap[p].views++;
      pageStatsMap[p].visitorSet.add(pv.visitorId);
    });

    const pageViewsByPage = Object.values(pageStatsMap)
      .map(item => ({
        path: item.path,
        page: item.page,
        views: item.views,
        visitors: item.visitorSet.size,
        percentage: totalPageViews > 0 ? Math.round((item.views / totalPageViews) * 100) : 0
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    // 4. Real Contact Submissions by Category
    const ticketCategoryMap = {
      enquiry: { name: 'General Enquiries', count: 0 },
      meeting_request: { name: 'Meeting Requests', count: 0 },
      complaint: { name: 'Feedback & Complaints', count: 0 },
      other: { name: 'Other Messages', count: 0 }
    };

    ticketsData.forEach(t => {
      const cat = t.category || 'other';
      if (ticketCategoryMap[cat]) {
        ticketCategoryMap[cat].count++;
      } else {
        ticketCategoryMap.other.count++;
      }
    });

    const contactSubmissionsBreakdown = Object.values(ticketCategoryMap);

    // 5. Real Prayer Requests Breakdown by Location / Type
    const prayerTypeMap = {
      personal: { name: 'Personal Intention', count: 0 },
      church: { name: 'Church Community', count: 0 },
      confession: { name: 'Confession / Counseling', count: 0 }
    };

    prayersData.forEach(p => {
      const loc = p.prayerLocation || 'personal';
      if (prayerTypeMap[loc]) {
        prayerTypeMap[loc].count++;
      } else {
        prayerTypeMap.personal.count++;
      }
    });

    const prayerRequestsBreakdown = Object.values(prayerTypeMap);

    // 6. Real Event Registrations by Event
    const eventRegistrationsList = Object.entries(eventRegsByEventMap)
      .map(([title, count]) => ({
        event: title.length > 22 ? title.slice(0, 20) + '...' : title,
        fullTitle: title,
        registrations: count
      }))
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 6);

    // 7. Real Device Breakdown
    const deviceMap = { Desktop: 0, Mobile: 0, Tablet: 0 };
    pageViewsData.forEach(pv => {
      const dev = pv.device || 'Desktop';
      if (deviceMap[dev] !== undefined) deviceMap[dev]++;
      else deviceMap.Desktop++;
    });

    const totalDevHits = Object.values(deviceMap).reduce((a, b) => a + b, 0);
    const deviceBreakdown = [
      {
        name: 'Mobile',
        value: totalDevHits > 0 ? Math.round((deviceMap.Mobile / totalDevHits) * 100) : 0,
        count: deviceMap.Mobile
      },
      {
        name: 'Desktop',
        value: totalDevHits > 0 ? Math.round((deviceMap.Desktop / totalDevHits) * 100) : 0,
        count: deviceMap.Desktop
      },
      {
        name: 'Tablet',
        value: totalDevHits > 0 ? Math.round((deviceMap.Tablet / totalDevHits) * 100) : 0,
        count: deviceMap.Tablet
      }
    ];

    res.json({
      success: true,
      period,
      startDate: start,
      endDate: end,
      summary: {
        totalVisitors,
        totalPageViews,
        activeUsers: activeUsersInPeriod,
        totalSubmissions,
        totalRegisteredMembers: totalUsersCount,
        allTimePageViews: allTimePageViewsCount,
        avgPagesPerVisitor
      },
      timeSeries: timeBuckets,
      pageViewsByPage,
      contactSubmissionsBreakdown,
      prayerRequestsBreakdown,
      eventRegistrations: eventRegistrationsList,
      deviceBreakdown
    });

  } catch (err) {
    console.error('Analytics Fetch Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Modular Sub-Endpoints for REST architecture
const getAnalyticsSummary = async (req, res) => {
  req.query.onlySummary = 'true';
  return getAnalyticsStats(req, res);
};

const getAnalyticsVisitors = async (req, res) => {
  return getAnalyticsStats(req, res);
};

const getAnalyticsPageViews = async (req, res) => {
  return getAnalyticsStats(req, res);
};

const getAnalyticsDevices = async (req, res) => {
  return getAnalyticsStats(req, res);
};

const getAnalyticsSubmissions = async (req, res) => {
  return getAnalyticsStats(req, res);
};

module.exports = {
  trackPageView,
  getAnalyticsStats,
  getAnalyticsSummary,
  getAnalyticsVisitors,
  getAnalyticsPageViews,
  getAnalyticsDevices,
  getAnalyticsSubmissions
};
