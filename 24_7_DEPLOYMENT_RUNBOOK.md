# SJDB Connect — 24/7 WhatsApp & 04:00 AM IST Daily Catholic Notification Runbook

## What was fixed

### 1. Root Cause of the 08:24 AM Delivery Bug
- Previously, `dailyNotificationService.js` had a `setTimeout(checkAndSendOnStartup, 90 * 1000)`.
- When the backend service woke up or restarted upon an admin opening the site in the morning (around 08:22 AM), 90 seconds later it ran the startup check, saw that today had 0 delivered logs, and triggered the full broadcast at **08:24 AM**.
- **Fix**: The startup timer and legacy `checkAndSendOnStartup()` function have been **completely eliminated**. Server boot and page load never trigger broadcasts.

### 2. Autonomous 04:00 AM IST Schedule (Asia/Kolkata)
- The daily Catholic notification system is scheduled strictly at **04:00 AM IST** (`0 4 * * *` with timezone `Asia/Kolkata`).
- Dispatches across 4 channels independently:
  1. **WhatsApp Bot**: Clean devotional message (0 URLs) + Saint of the Day photo + Saint details + optional clickable links.
  2. **Email Broadcast**: Personalized bilingual HTML email with inline Saint CID image attachment.
  3. **In-App Notifications**: Notification feed items for parishioners.
  4. **Mobile / Web Push**: WebPush broadcast to subscribed devices.

### 3. Database Job System & Distributed Locking
- **`DailyNotificationJob`**: Tracks the daily job with atomic locking (`lockedBy`, `lockedAt`), status (`pending`, `running`, `completed`, `partial`, `failed`), recipient counters, and timestamped audit logs.
- **`NotificationDelivery`**: Records recipient-level deliveries with a compound unique index `{ notificationDate: 1, recipient: 1, channel: 1 }`. Ensures that even if the scheduler runs multiple times or multiple server instances boot concurrently, duplicate messages are mathematically impossible.
- **Automatic Retries**: Implements 3 attempts with exponential backoff on transient delivery failures before marking status as failed.

### 4. Complete Admin Dashboard Decoupling
- Navigating to **Admin → WhatsApp Bot** is strictly a read-only monitoring view.
- Page mount makes pure `GET` requests (`/bot/status`, `/bot/stats`, `/bot/history`, `/daily-notifications/job-status`).
- It displays live connection health, QR/pairing code, and today's 04:00 AM job status without triggering any worker or broadcast.
- The "Broadcast Now" button remains only as a manual emergency/test tool protected behind a confirmation modal.

---

## Autonomous Downtime Recovery & Morning Watchdog

If the production backend experiences temporary infrastructure downtime during 04:00 AM IST (e.g., cloud host maintenance, network outage, or container reboot), the system **automatically recovers and delivers without administrator intervention**:

1. **Server Boot Catch-up**:
   - When the backend boots up after downtime, a 25-second stabilization timer runs.
   - If current time in Asia/Kolkata is between **04:05 AM and 08:00 PM IST** and today's `DailyNotificationJob` is missing or incomplete, the backend autonomously executes a catch-up broadcast (`triggerType: 'downtime_recovery'`).
   - If today's job was already `completed` on schedule, it exits in 2 milliseconds with zero side effects.

2. **Hourly Morning Watchdog**:
   - An autonomous watchdog runs every hour on the hour between **05:00 AM and 12:00 PM IST** (`0 5,6,7,8,9,10,11,12 * * *`).
   - Checks if today's broadcast succeeded; if any disruption occurred at 04:00 AM, the very first watchdog tick after recovery dispatches the missed broadcast automatically.

3. **Stale Crash Recovery**:
   - If a crash occurred midway through a broadcast, jobs in `running` state with locks older than 20 minutes are resumed (`triggerType: 'crash_recovery'`).
   - Thanks to `NotificationDelivery` compound unique indexes, recipients who already received messages are skipped — only pending or failed recipients are delivered.

4. **Zero Administrator Dependency**:
   - Does NOT require opening the website.
   - Does NOT require opening Admin → WhatsApp Bot.
   - Does NOT require clicking "Recover Missed" or "Broadcast Now".

---

## One-time WhatsApp linking

If MongoDB does not already contain the Baileys credentials, an administrator links the WhatsApp account once using the Admin → WhatsApp Bot page (QR scan or 8-digit Pairing Code).

After the session is stored in MongoDB:
- **Do not open the website for the bot to work.**
- The backend daemon reconnects and maintains connection independently.

---

## Health Monitoring

Monitor:
`GET /api/health`

Reports:
- `database`: MongoDB state
- `whatsappBot`: live connection status and mode
- `dailyCatholicScheduler`: 04:00 AM IST cron registration, last run time, next run IST
- `backgroundWorkers`: active worker states
- `uptimeSeconds`: process uptime
