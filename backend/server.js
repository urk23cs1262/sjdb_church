require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// Connect DB
connectDB();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { success: false, message: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many auth attempts' } });
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
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
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/mass-reading', require('./routes/massReading'));
app.use('/api/daily-reading', require('./routes/dailyReading'));
app.use('/api/daily-saint', require('./routes/saint'));

// Initialize Background Services
require('./services/saintService');
require('./services/birthdayService');

// Health check
app.get('/api/health', (req, res) => res.json({ success: true, message: "St. John de Britto's Church API is running", timestamp: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nSt. John de Britto's Church API`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
