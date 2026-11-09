# Thrillwaukee private admin dashboard

The private dashboard is available at `/admin.html`. The page itself contains no private data; signup and Stripe records are returned only by authenticated Netlify Functions.

## Required Netlify environment variables

Add these under **Project configuration → Environment variables** and make them available to **Functions**:

- `ADMIN_PASSWORD` — the founder-console password. Do not commit it to GitHub.
- `BREVO_API_KEY` — already used by the signup integration. The admin dashboard uses it server-side to read the Thrillwaukee Brevo list.
- `BREVO_LIST_ID` — numeric Brevo list ID for the Thrillwaukee signup list.
- `STRIPE_SECRET_KEY` — the Stripe live-mode secret key used server-side to list completed Checkout Sessions.

You do **not** need a Netlify Personal Access Token.

Optional:

- `STRIPE_PAYMENT_LINK_ID` — the actual Stripe Payment Link object ID beginning with `plink_`. Set this to restrict the dashboard to purchases made through the Thrillwaukee Payment Link. If omitted or malformed, the dashboard safely falls back to all completed Checkout Sessions and shows a warning.

Redeploy after adding or changing environment variables.

## Authentication

The allowed login email is hard-coded server-side as the founder email. The password is read only from `ADMIN_PASSWORD`. A successful login creates a signed, HttpOnly, Secure, SameSite=Strict cookie lasting 12 hours. Dashboard API responses use `Cache-Control: no-store`.

## Signup source

The admin ledger reads contacts directly from the Brevo list identified by `BREVO_LIST_ID`.

The signup event function automatically maintains four Thrillwaukee-specific Brevo contact attributes for new submissions:

- `THRILL_PHONE`
- `THRILL_CAMPUS`
- `THRILL_BIRTHDAY`
- `THRILL_SMS_OPT_IN`

Existing Brevo contacts remain visible immediately. Older contacts created before these attributes existed may have blanks for campus, birthday, or the raw phone number until they submit again.

## Data shown

The dashboard merges Brevo signup contacts and paid Stripe Checkout Sessions by normalized email address.

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

The dashboard reads up to 1,000 Brevo contacts and 1,000 recent completed Checkout Sessions per load. It shows a warning if a safety limit is reached.
