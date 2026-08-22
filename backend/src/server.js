require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
app.set('trust proxy', 1); // Trust the reverse proxy on Render/Heroku

// Connect DB
connectDB();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Allow localhost, exact CLIENT_URL, AND all *.vercel.app preview URLs
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
      /^https:\/\/.*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// Rate limiting (generous limits to prevent admin polling throttling)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  skip: (req) => 
    req.path.startsWith('/bot/status') || 
    req.path.startsWith('/bot/qr') || 
    req.path === '/health' ||
    req.path.startsWith('/daily-saint') ||
    req.path.startsWith('/saint-of-the-day') ||
    req.path.startsWith('/mass-reading') ||
    req.path.startsWith('/daily-reading') ||
    req.path.startsWith('/daily-verse') ||
    req.path.startsWith('/settings') ||
    req.path.startsWith('/rosary-songs'),
  message: { success: false, message: 'Too many requests, please try again in a few minutes.' }
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { success: false, message: 'Too many auth attempts' } });
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes — Exempt Auth & Maintenance Control Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/maintenance', require('./routes/maintenance'));

// Maintenance Interception Middleware
app.use(require('./middleware/maintenanceMiddleware'));
app.use('/api/users', require('./routes/users'));
app.use('/api/team', require('./routes/team'));
app.use('/api/priests', require('./routes/priests'));
app.use('/api/events', require('./routes/events'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/prayers', require('./routes/prayers'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/anbiyam', require('./routes/anbiyam'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/permission-requests', require('./routes/permissionRequests'));
app.use('/api/security', require('./routes/security'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/upload', require('./routes/upload'));


app.use('/api/mass-readings', require('./routes/dailyMassReading'));
app.use('/api/mass-reading', require('./routes/dailyMassReading'));
app.use('/api/daily-reading', require('./routes/dailyReading'));
app.use('/api/daily-saint', require('./routes/saint'));
app.use('/api/saint-of-the-day', require('./routes/saint'));
app.use('/api/daily-notifications', require('./routes/dailyNotificationRoutes'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/rosary-songs', require('./routes/rosarySongs'));
app.get('/api/daily-verse', require('./controllers/dailyVerseController').getTodayVerse);
app.post('/api/daily-verse/change', require('./middleware/auth').protect, require('./middleware/auth').adminOnly, require('./controllers/dailyVerseController').changeTodayVerse);
app.use('/api/bot', require('./routes/bot'));

// Background Services
require('./services/saintService');
require('./services/birthdayService');
require('./services/dailyBroadcastService'); // 6:00 AM spiritual content broadcast
require('./services/reminderSchedulerService'); // Automated Event & Announcement reminders via Email, WhatsApp bot & In-App
require('./services/maintenanceSchedulerService'); // Automated Maintenance start/end scheduler
require('./services/bibleVerseService'); // 12:00 AM Daily Bible Verse automated rotation scheduler
require('./services/dailyMassReadingService').initMidnightCron(); // 12:00 AM IST Daily Tamil Mass Readings automated sync scheduler
require('./services/dailyNotificationService'); // 12:00 AM IST Daily Automated Catholic Notification System (Email Broadcast)
require('./services/accountVerificationService'); // 8:00 AM IST Daily Account Verification & Admin Alert System

// Background Monitor: Scan for expired/abandoned unverified OTPs every 60s
const { checkAndNotifyExpiredOTPs } = require('./services/otpService');
setInterval(() => {
  checkAndNotifyExpiredOTPs().catch(err => console.error('Expired OTP scanner error:', err.message));
}, 60 * 1000);

// Health check (used by cron-job.org to prevent cold starts)
app.get('/api/health', (req, res) => res.json({
  success: true,
  message: "St. John de Britto's Church API is running",
  timestamp: new Date(),
  uptime: process.uptime(),
}));

// Root route (stops Render showing "Cannot GET /")
app.get('/', (req, res) => res.json({
  success: true,
  message: "St. John de Britto's Church API",
}));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n St. John de Britto's Church API`);
  console.log(` Server running on port ${PORT}`);
  console.log(` Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(` Health: /api/health\n`);

  // Initialize Baileys WhatsApp connection
  // Runs after server starts so a WA failure doesn't prevent API from starting
  const { connectToWhatsApp } = require('./bot/whatsapp');
  connectToWhatsApp().catch(err => {
    console.error(' WhatsApp (Baileys) connection failed:', err.message);
  });
});


module.exports = app;