# Thrillwaukee private admin dashboard

The private dashboard is available at `/admin.html`. The page itself contains no private data; signup and Stripe records are returned only by authenticated Netlify Functions.

## Required Netlify environment variables

Add these under **Project configuration → Environment variables** and make them available to **Functions**:

- `ADMIN_PASSWORD` — the founder-console password. Do not commit it to GitHub.
- `STRIPE_SECRET_KEY` — the Stripe live-mode secret key. It stays server-side and is used only to list completed Checkout Sessions.

You do **not** need a Netlify Personal Access Token. Verified signup events are copied into a private site-wide Netlify Blobs store, and Netlify automatically supplies the credentials Functions need to access that store.

Optional:

- `STRIPE_PAYMENT_LINK_ID` — the actual Stripe Payment Link object ID beginning with `plink_`. Set this to restrict the dashboard to purchases made through the Thrillwaukee Payment Link. If omitted or malformed, the dashboard safely falls back to all completed Checkout Sessions and shows a warning.

Redeploy after adding or changing environment variables.

## Authentication

The allowed login email is hard-coded server-side as the founder email. The password is read only from `ADMIN_PASSWORD`. A successful login creates a signed, HttpOnly, Secure, SameSite=Strict cookie lasting 12 hours. Dashboard API responses use `Cache-Control: no-store`.

## Signup storage

New verified `thrillwaukee-list` submissions are copied into the private `thrillwaukee-signups` Netlify Blobs store by `form-submitted.mjs`. Netlify Blobs encrypts stored data at rest and in transit.

Because this replaces the old Forms API/PAT approach, submissions that happened **before this Blob integration was deployed** remain in Netlify Forms but will not automatically appear in the new admin ledger. New submissions will.

## Data shown

The dashboard merges stored signup records and paid Stripe Checkout Sessions by normalized email address.

It displays:

- first/full name
- email
- phone
- campus
- birthday
- SMS opt-in
- paid/unpaid status
- total amount paid
- signup timestamp
- payment timestamp

If someone pays with a different email than they used on the signup form, they appear as a separate paid record.

## Limits

The dashboard reads up to 1,000 stored signup records and 1,000 recent completed Checkout Sessions per load. It will show a warning if a safety limit is reached.
