# FlightScanner contact Worker

The Worker receives the contact form at `/api/contact`, verifies Cloudflare Turnstile, and sends the message to one verified destination through Cloudflare Email Service. The destination address and Turnstile keys are never stored in the repository or returned to the browser.

## One-time Cloudflare setup

1. In **Compute > Email Service > Email Routing > Destination Addresses**, add the destination Gmail address and confirm the verification email.
2. Enable Email Routing for the dedicated `notify.rodulab.com` subdomain. The Worker sends from `contact@notify.rodulab.com` to the verified destination without changing the apex domain's existing mail routing.
3. In **Turnstile**, create a Managed widget restricted to `btsflightscaner.rodulab.com`.
4. Install the local tooling:

   ```bash
   cd contact-worker
   npm install
   npx wrangler login
   ```

5. Create a local secret file that is ignored by Git:

   ```bash
   cp .env.example .env.production
   ```

   Fill in `CONTACT_EMAIL`, `TURNSTILE_SECRET`, and `TURNSTILE_SITE_KEY`.

6. Deploy the code and secrets together:

   ```bash
   npm run deploy -- --secrets-file .env.production
   ```

The route in `wrangler.jsonc` intercepts only `btsflightscaner.rodulab.com/api/contact*`; the rest of the website continues to be served by GitHub Pages.

## Local checks

```bash
npm test
```

The public form intentionally stays disabled when the Worker or Turnstile configuration is unavailable.

## Statistics API

The same Worker serves `/api/statistics`. GitHub Actions metadata is public. Cloudflare traffic data requires a secret named `CLOUDFLARE_ANALYTICS_TOKEN` with **Account Analytics: Read** permission.

Anonymous active-time measurement and aggregate clicks on flight details, airline booking links, and Booking.com use the following Analytics Engine binding:

```json
"analytics_engine_datasets": [
  {
    "binding": "ENGAGEMENT",
    "dataset": "flightscanner_engagement"
  }
]
```

The Cloudflare account must have Workers Analytics Engine enabled before deployment. No IP address, cookie, email address, or browser fingerprint is written to this dataset. Click statistics follow the selected 24-hour, 7-day, 30-day, or 90-day period and may be delayed by the five-minute statistics cache.
