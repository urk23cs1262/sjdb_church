# SJDB Connect — 24/7 WhatsApp Production Runbook

## What was fixed

The WhatsApp lifecycle is now owned by the Node.js backend, not the React Admin page.

- `backend/src/server.js` waits for MongoDB, then starts the API and WhatsApp daemon.
- `backend/server.js` is a compatibility entry point that always delegates to `src/server.js`.
- `backend/src/bot/whatsapp.js` restores authentication from MongoDB and automatically reconnects after transient failures.
- Reconnects use backoff and are protected from stale socket events.
- SIGTERM/SIGINT close the WhatsApp socket cleanly.
- `backend/src/test_247_daemon_architecture.js` verifies the always-on lifecycle wiring.
- The 12:00 AM IST daily notification scheduler remains server-side and does not depend on the website being open.

## One-time WhatsApp linking

If MongoDB does not already contain the Baileys credentials, an administrator must link the WhatsApp account once using the Admin → WhatsApp Bot page (QR or pairing code).

After the session is stored in MongoDB:

**Do not open the website for the bot to work.**

The backend reconnects and runs independently.

## Render

Use an **always-on paid web service**. A sleeping/free service cannot provide a true 24/7 WhatsApp daemon or exact 12:00 AM scheduler.

The included `render.yaml` configures:

- Root directory: `backend`
- Build: `npm ci --omit=dev`
- Start: `npm start`
- Health check: `/api/health`
- Production Node environment
- MongoDB/JWT/Client URL as provider-managed secrets

Set `CLIENT_URL` to the real production frontend URL.

## VM / VPS / Linux server

```bash
cd backend
npm ci
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

Make sure the server itself has automatic restart enabled.

## Health monitoring

Monitor:

`GET /api/health`

A healthy response reports:

- MongoDB state
- WhatsApp live state
- background-worker status
- process uptime
- memory usage

Use an external uptime/monitoring service and alert when `whatsappBot.isLive` becomes false for an extended period.

## Important operational limitation

“24×7×365” cannot be guaranteed by application code alone. WhatsApp, the hosting provider, MongoDB, DNS, or the internet can fail. This implementation removes the admin-page dependency and adds automatic recovery, but the production host must remain online and be monitored.
