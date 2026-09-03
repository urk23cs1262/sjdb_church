# St. John de Britto's Church — Parish Management System
### *புனித அருளானந்தர் ஆலயம், காளையார்கோவில் / Kalayarkoil*

[![Live Website](https://img.shields.io/badge/Live_Website-st--jb--church.vercel.app-blue?style=for-the-badge&logo=vercel)](https://st-jb-church.vercel.app/)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A modern, full-stack Catholic Parish Management and Community Web Application built for **St. John de Britto's Church**. The system connects parishioners, priests, and administrators with online Mass intention bookings, certificate requests, daily liturgical readings, Saint of the Day calendar, interactive Holy Rosary audio prayer, WhatsApp broadcast automation, event registrations, and parishioner record management.

**Production Website:** [https://st-jb-church.vercel.app/](https://st-jb-church.vercel.app/) — *(Official Parish Portal)*

---

## System Architecture

```text
[ React 19 Frontend (Vercel) ]
             │ (HTTPS / REST)
             ▼
[ Express.js API Server (Render) ]
             │
 ┌───────────┴───────────┐
 │                       │
 ▼                       ▼
[ Middleware & Security ] [ Automated Background Cron Services ]
 ├── JWT Auth Guard       ├── 12:00 AM IST Daily Tamil Mass Readings Sync
 ├── Maintenance Filter   ├── 12:00 AM IST Daily Bible Verse Rotation
 ├── Rate Limiters        ├── 12:00 AM IST Daily Catholic Spiritual Broadcast (Email & WhatsApp)
 └── Helmet & CORS        ├── Automated Event & Announcement Reminders
 │                        ├── Automated Birthday Blessings Dispatcher
 ▼                        └── 60s Expired OTP Cleanup Scanner
[ REST API Controllers ]
 ├── Auth & Security
 ├── Users & Family Records
 ├── Mass Bookings & Offerings
 ├── Documents & Certificates
 └── Analytics & Maintenance
 │
 ▼
[ MongoDB Atlas Database ]
 (Persistent Schema Models, GridFS File Storage, Security Audit Logs)
```

---

## Key Features

### 1. Public Parish Portal
* **Daily Mass Readings & Liturgical Calendar:** Automated daily Tamil & English Mass readings synced at midnight IST, liturgical color badges, and reflection prayers.
* **Daily Bible Verse Rotation:** Automated 12:00 AM daily verse rotation with categorization (Faith, Hope, Love, Strength, Peace) and custom administrator overrides.
* **Saint of the Day & Ticker:** Dynamic saint calendar with feast day details, biography, prayer, and patronages.
* **Interactive Holy Rosary Audio Player:** Complete audio recitations with Joyful, Luminous, Sorrowful, and Glorious mysteries in Tamil & English with synchronized prayers.
* **Event Registrations & Reporting:** Browse church feasts, retreats, and festivals. Parishioners can register online; administrators can export attendee rosters to customized PDF and CSV formats.
* **Mass Timings & Priests Directory:** Regular, Sunday, and Novena mass schedules with complete history and contact details of Parish Priests and Assistant Priests.
* **Basic Christian Communities (Anbiyam / அன்பியம்):** Unit listings, meeting schedules, coordinators, and member directory.
* **Parish Council & Ministries:** Committee members, administrative team, and ministry leaders showcase.
* **Online Donations & Receipts:** Transparent contribution channels for church renovations, feast celebrations, and charity.
* **Live Streaming & Photo Gallery:** Embedded Sunday mass live streams and responsive photo galleries with lightbox preview.
* **Multilingual UI (i18n):** Native support for Tamil (தமிழ்) and English with instant language toggling.

---

### 2. Parishioner / Member Dashboard
* **Password + OTP Security Verification:** Secure password authentication paired with 5-minute time-limited, bcrypt-hashed OTP verification.
* **30-Day OTP Security Re-verification:** The 30-day security verification cycle validates the existing parishioner account while preserving the member's profile, family hierarchy, sacrament records, IDs, and historical data completely intact.
* **Mass Intentions Booking:** Online Mass booking for Thanksgiving, Soul Repose, Birthday, Wedding Anniversary, and Healing intentions with approval tracking.
* **Certificate & Document Requests:** Apply for Baptism, First Communion, Confirmation, and Marriage certificates online with status updates.
* **Helpdesk & Support Tickets:** Submit inquiries or support tickets directly to the parish office.
* **Family & Profile Management:** View Parish Member ID, Family ID, sacrament records, family hierarchy, and download official registration reports.
* **Automated Birthday Blessings:** Personalized birthday greeting notifications and blessings on members' birthdays.

---

### 3. Administrator Management Panel
* **Visitor & Engagement Analytics:** Visitor analytics, page view counts, device metrics, submission statistics, and parish registration trends.
* **Member & Family ID System:** Dynamic ID generation engine with customizable prefix (e.g., `SJDB_M01`) and zero-padding configurations.
* **Mass Bookings & Document Processing:** Approve or reject intentions, assign priests, and issue document approvals.
* **WhatsApp Automation Bot (Baileys):** Automated 12:00 AM daily spiritual broadcasts, event reminders, and WhatsApp bot assistance via a Baileys multi-device socket.
* **Automated Scheduled Reminders:** Automated background reminder notifications via Email, WhatsApp bot, and In-App for upcoming events and announcements.
* **Site Maintenance Control System:**
  * One-click emergency maintenance mode activation.
  * Automated scheduled maintenance windows with countdown banners.
  * Whitelist bypass for Administrators and Technical Team.
* **Security Incidents & Audit Logs:**
  * Monitoring of failed login attempts, lockout events, and suspicious activity.
  * Automatic account suspension on 10 failed attempts or 2 lockouts within 24 hours.
  * One-click account reactivation workflow with automated email dispatch.
  * Emergency **"Wasn't You?"** security report links in login alert emails with instant session invalidation.

---

## Technology Stack

### Frontend
* **Framework:** React 19, Vite, React Router DOM
* **Styling & UI:** Tailwind CSS, Framer Motion, React Icons
* **Forms & Validation:** React Hook Form, Zod
* **Charts & Analytics:** Recharts, React CountUp
* **PDF & Exports:** jsPDF, jsPDF-AutoTable, HTML-to-Image, Download.js
* **Internationalization:** i18next, react-i18next (Tamil & English)
* **Notifications:** React Hot Toast, Canvas Confetti

### Backend
* **Runtime & Framework:** Node.js, Express.js
* **Database & ODM:** MongoDB, Mongoose
* **Security & Auth:** JWT (JSON Web Tokens), Bcrypt.js, Helmet, Express Rate Limit, CORS
* **Automation & Cron:** Node-Cron, Cheerio (Liturgical content parsing)
* **Messaging & Communication:**
  * **WhatsApp:** `@whiskeysockets/baileys` (Multi-device socket)
  * **Email:** Nodemailer (SMTP), Resend API
  * **SMS:** Twilio (where configured)
* **Document Generation:** PDFKit, QRCode

---

## Security Architecture Highlights

* **30-Day OTP Security Cycle:** Validates active sessions periodically without modifying existing parishioner profiles, sacrament dates, or assigned IDs.
* **Cryptographic Protection:** Passwords are protected using salted Bcrypt (cost factor 12); OTP session codes are stored and compared using Bcrypt (cost factor 10) with 5-minute expiry windows and maximum 5 attempts per session.
* **Brute-Force Shield:** Automatic progressive cooldowns, temporary 15-minute lockout on repeated failures, and automatic account suspension on 10 failed login attempts or 2 lockouts in 24 hours.
* **Emergency "Wasn't You?" Flow:** One-click security revocation links delivered in login security alerts to immediately terminate suspicious sessions and invalidate access tokens.
* **Role-Based Access Control (RBAC):** Strict permission separation between `admin`, `priest`, `staff`, `technical_team`, and `user` roles.

---

## Project Structure

```text
st-jb-church/
├── backend/
│   ├── src/
│   │   ├── bot/                 # WhatsApp Baileys socket connection & handlers
│   │   ├── config/              # Database (MongoDB), Mailer, Twilio & ID configs
│   │   ├── controllers/         # REST API Controllers (Auth, Security, Bookings, Users, etc.)
│   │   ├── data/                # Catholic Saints Calendar & Liturgical datasets
│   │   ├── middleware/          # JWT auth, adminOnly, maintenanceGuard & upload
│   │   ├── models/              # Mongoose Schemas (User, Booking, Incident, Notification, etc.)
│   │   ├── routes/              # Express API Routes
│   │   ├── services/            # Automated cron services, OTP service, mailer & broadcasts
│   │   └── server.js            # Express server entry point & socket initialization
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── assets/              # Church emblems, images & audio assets
│   │   ├── components/
│   │   │   ├── admin/           # Admin layouts, settings modal, analytics charts
│   │   │   ├── common/          # Navbar, Footer, Rosary player, Maintenance guard
│   │   │   └── user/            # Member dashboard components
│   │   ├── context/             # AuthContext, NotificationContext
│   │   ├── data/                # Rosary mysteries & Catholic calendar data
│   │   ├── hooks/               # Custom hooks (e.g., useRosaryAudio)
│   │   ├── i18n/                # English & Tamil translation dictionaries
│   │   ├── pages/
│   │   │   ├── admin/           # Admin dashboard, users, registrations, notifications
│   │   │   ├── auth/            # Login, registration, OTP verification
│   │   │   ├── public/          # Home, Bible verses, Rosary, Anbiyams, Events, Donate
│   │   │   ├── security/        # Emergency unauthorized report page
│   │   │   └── user/            # Parishioner dashboard, mass bookings, tickets
│   │   ├── services/            # Axios API client
│   │   ├── App.jsx              # Main routing & protected route guards
│   │   └── main.jsx
│   └── package.json
└── README.md
```

---

## Environment Configuration

> **Security Notice:** Never commit `.env` files, MongoDB connection strings, JWT secrets, SMTP passwords, API keys, or WhatsApp session files (`baileys_auth_info/`) to Git. Use the secure environment variable management provided by your deployment platforms (Vercel & Render).

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/sjdb_church?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=https://st-jb-church.vercel.app

# SMTP Mailer Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_parish_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=your_parish_email@gmail.com

# AI Content Assistant (Optional)
GEMINI_API_KEY=your_gemini_api_key

# SMS / Optional Delivery Channels (Optional)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=https://your-backend-api.onrender.com/api
```

---

## Getting Started Locally

### Prerequisites
* **Node.js** (v18.x or higher)
* **MongoDB** (Local instance or MongoDB Atlas cluster)
* **npm** or **yarn**

### 1. Clone the repository
```bash
git clone https://github.com/urk23cs1262/st_jb_church.git
cd st_jb_church
```

### 2. Setup and Run Backend
```bash
cd backend
npm install
# Configure backend/.env with your MongoDB and SMTP credentials
npm run dev
```
Backend will start on `http://localhost:5000`.

### 3. Setup and Run Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Frontend will be accessible on `http://localhost:5173`.

---

## Deployment Architecture

* **Frontend:** Hosted on [Vercel](https://vercel.com/) with automatic continuous deployments and global edge delivery.
* **Backend:** Node.js Express REST API hosted on [Render](https://render.com/).
* **Database:** Cloud-managed [MongoDB Atlas](https://www.mongodb.com/atlas) database with configured backup and recovery options.

---

## License & Attribution

Developed for **St. John de Britto's Church** — *"Serving God, Serving People."*  
All rights reserved © 2026. Dedicated to the parish community and administration.


## 24/7 WhatsApp Bot — Production Requirement

The WhatsApp bot is a **backend daemon**. The React/Admin WhatsApp page must never be required to keep the bot alive.

At backend startup:

1. MongoDB is connected and ready.
2. Background workers are registered.
3. The Baileys WhatsApp socket is started automatically.
4. Saved MongoDB authentication credentials are restored.
5. Incoming `messages.upsert` events are handled server-side.
6. Unexpected WhatsApp disconnects are automatically retried with backoff.
7. SIGTERM/SIGINT shut the socket down cleanly so the hosting platform can restart it safely.

The Admin → WhatsApp Bot page is only an administration/monitoring UI. Opening it must not be necessary for receiving or replying to messages.

### Deployment

For Render, deploy `render.yaml` from the repository root or configure the backend service manually with:

- Root directory: `backend`
- Build command: `npm ci --omit=dev`
- Start command: `npm start`
- Health check: `/api/health`
- **Always-on paid instance required** for 24/7 WhatsApp and cron execution.

For a VM/server using PM2:

```bash
cd backend
npm ci
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

Do not deploy `backend/.env`, WhatsApp session files, `node_modules`, or frontend `dist` as source artifacts. Configure secrets in the hosting provider.

### Important limitation

No application can truthfully guarantee 365/365 availability from code alone. WhatsApp can disconnect, a host can fail, MongoDB can become unavailable, or the internet can fail. This project therefore uses persistent MongoDB auth state, automatic reconnects, health checks, and a process manager/always-on host. The hosting environment must also be configured for continuous operation.
