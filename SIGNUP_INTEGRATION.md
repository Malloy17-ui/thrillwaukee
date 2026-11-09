# Thrillwaukee signup integration

The public signup form remains a Netlify Form. After Netlify verifies a `thrillwaukee-list` submission, `netlify/functions/form-submitted.mjs` syncs the contact into Brevo.

The same Brevo list is the signup source for the private founder admin dashboard, so no Netlify Personal Access Token is required.

## Required Netlify environment variables

Set these under **Project configuration → Environment variables** and make them available to **Functions**:

- `BREVO_API_KEY` — Brevo API key. Keep this secret and never commit it.
- `BREVO_LIST_ID` — numeric Brevo contact-list ID for the main Thrillwaukee list.

Optional:

- `BREVO_WELCOME_TEMPLATE_ID` — numeric Brevo transactional email template ID. If present, a welcome email is sent after contact sync.

Redeploy after changing environment variables.

## What gets synced

The function automatically ensures these custom Brevo contact attributes exist for new signups:

- `THRILL_PHONE` — raw phone entered on the website
- `THRILL_CAMPUS` — optional campus selection
- `THRILL_BIRTHDAY` — optional birthday
- `THRILL_SMS_OPT_IN` — yes/no

Brevo also receives the standard `FIRSTNAME` attribute, and the standard `SMS` field is populated only when the visitor explicitly checks **SMS SIGNAL**.

## SMS compliance / activation

The form separates SMS consent from ordinary list signup and links to public Privacy and Terms pages. Do not send US marketing SMS until the sending number/sender has completed the registration/compliance process required by the SMS provider and carriers.

## Failure behavior

Netlify Forms remains the durable original submission. If Brevo is unavailable or misconfigured, the function logs the sync failure instead of deleting the Netlify lead.
