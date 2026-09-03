# Razorpay Live Donations — SJDB Church

The donation integration is configured for secure server-side Razorpay verification and webhooks.

## Before production

1. Rotate the Razorpay test secret that was present in the uploaded project and rotate any other credentials that were exposed in that upload.
2. In Razorpay Dashboard, activate Live Mode and obtain a Live Key ID/Secret.
3. Set the backend environment variables in your hosting provider (not in frontend code):
   - `NODE_ENV=production`
   - `RAZORPAY_MODE=live`
   - `RAZORPAY_KEY_ID=rzp_live_...`
   - `RAZORPAY_KEY_SECRET=...`
   - `RAZORPAY_WEBHOOK_SECRET=...`
4. Configure a Razorpay webhook pointing to:
   `https://YOUR-PRODUCTION-BACKEND-DOMAIN/api/donations/webhook`
5. Subscribe to at least:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
6. Make one small genuine live donation and verify:
   payment -> backend verification -> MongoDB -> receipt -> email.

## Security behavior

- The server no longer creates simulated orders when Razorpay credentials are missing.
- Payment signature is mandatory.
- The backend fetches the payment from Razorpay and checks order ID, amount and currency.
- Webhook signatures are mandatory and use the raw request body.
- Duplicate webhook/callback processing does not create a second donation.
- Live mode requires a `rzp_live_` key.
