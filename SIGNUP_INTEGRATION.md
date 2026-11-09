# Thrillwaukee signup integration

The public signup form remains a Netlify Form. After Netlify verifies a `thrillwaukee-list` submission, `netlify/functions/form-submitted.mjs` performs two independent server-side actions:

1. stores the full signup record in the private `thrillwaukee-signups` Netlify Blobs store for the founder admin dashboard
2. syncs the marketing contact into Brevo

No Netlify Personal Access Token is required for Blob access from Netlify Functions.

## Required Netlify environment variables

Set these under **Project configuration → Environment variables** and make them available to **Functions**:

- `BREVO_API_KEY` — Brevo API key. Keep this secret and never commit it.
- `BREVO_LIST_ID` — numeric Brevo contact-list ID for the main Thrillwaukee list.

Optional:

- `BREVO_WELCOME_TEMPLATE_ID` — numeric Brevo transactional email template ID. If present, a welcome email is sent after contact sync.

Redeploy after changing environment variables.

## What gets stored

The private Blob record keeps:

- first name
- email
- phone
- campus
- birthday
- SMS opt-in
- first signup timestamp
- last update timestamp

Brevo receives the email and first name, plus the phone in its SMS field only when the visitor explicitly checks **SMS SIGNAL**.

## SMS compliance / activation

The form separates SMS consent from ordinary list signup and links to public Privacy and Terms pages. Do not send US marketing SMS until the sending number/sender has completed the registration/compliance process required by the SMS provider and carriers.

## Failure behavior

Netlify Forms still keeps the verified original submission. Blob storage and Brevo sync run independently; failure of one does not intentionally erase the other.
