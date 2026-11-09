# Thrillwaukee private admin dashboard

The private dashboard is available at `/admin.html`. The page itself contains no private data; signup and Stripe records are returned only by authenticated Netlify Functions.

## Required Netlify environment variables

Add these under **Project configuration → Environment variables**. Keep all three secret and available to Functions:

- `ADMIN_PASSWORD` — the founder-console password. Do not commit it to GitHub.
- `NETLIFY_AUTH_TOKEN` — a Netlify Personal Access Token with access to this project. The dashboard uses it server-side to read verified `thrillwaukee-list` form submissions.
- `STRIPE_SECRET_KEY` — the Stripe live-mode secret key. It stays server-side and is used only to list completed Checkout Sessions.

Optional:

- `STRIPE_PAYMENT_LINK_ID` — the Stripe `plink_...` ID behind the Thrillwaukee Buy Button. Set this to restrict the dashboard to payments made through that specific payment link. Without it, the dashboard warns that it is showing all completed Checkout payments on the Stripe account.

Redeploy after adding or changing environment variables.

## Authentication

The allowed login email is hard-coded server-side as the founder email. The password is read only from `ADMIN_PASSWORD`. A successful login creates a signed, HttpOnly, Secure, SameSite=Strict cookie lasting 12 hours. Dashboard API responses use `Cache-Control: no-store`.

## Data shown

The dashboard merges Netlify form submissions and paid Stripe Checkout Sessions by normalized email address.

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

The dashboard reads up to 1,000 recent form submissions and 1,000 recent completed Checkout Sessions per load. It will show a warning if a safety limit is reached.
