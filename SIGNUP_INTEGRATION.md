# Thrillwaukee signup integration

The public signup form remains a Netlify Form. After Netlify verifies a `thrillwaukee-list` submission, `netlify/functions/form-submitted.mjs` syncs the contact into Brevo.

## Required Netlify environment variables

Set these under **Project configuration → Environment variables** and make them available to **Functions**:

- `BREVO_API_KEY` — Brevo API key. Keep this secret and never commit it.
- `BREVO_LIST_ID` — numeric Brevo contact-list ID for the main Thrillwaukee list.

Optional:

- `BREVO_BLACK_CARD_LIST_ID` — numeric Brevo list ID for people who check Black Card interest.
- `BREVO_WELCOME_TEMPLATE_ID` — numeric Brevo transactional email template ID. If present, a welcome email is sent after contact sync.

Redeploy after changing environment variables.

## What gets synced

- Email: always, because the email field is required.
- First name: synced to Brevo `FIRSTNAME`.
- Phone: synced to Brevo `SMS` only when the visitor explicitly checks **SMS SIGNAL**.
- Black Card interest: if configured, adds the contact to the separate Black Card list.
- Campus, birthday, and the complete submission remain available in Netlify Forms even if they are not mirrored into Brevo.

## SMS compliance / activation

The form now separates SMS consent from ordinary list signup and links to public Privacy and Terms pages. Do not send US marketing SMS until the sending number/sender has completed the registration/compliance process required by the SMS provider and carriers.

## Failure behavior

Netlify stores the verified form submission first. If Brevo is unavailable or misconfigured, the event function logs the sync failure instead of deleting the lead.
