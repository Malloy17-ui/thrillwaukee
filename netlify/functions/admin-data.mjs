import { json, verifySession } from '../lib/admin-session.mjs';

const BREVO_API = 'https://api.brevo.com/v3';
const STRIPE_API = 'https://api.stripe.com/v1';

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const yes = value => ['yes', 'true', '1', 'on'].includes(String(value || '').toLowerCase());
const money = amount => Number.isFinite(amount) ? amount : null;

async function brevoFetch(path) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');

  const response = await fetch(`${BREVO_API}${path}`, {
    headers: {
      accept: 'application/json',
      'api-key': key,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo API ${response.status}: ${text.slice(0, 180)}`);
  }

  return response.json();
}

async function stripeFetch(path, params = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');

  const url = new URL(`${STRIPE_API}${path}`);
  Object.entries(params).forEach(([keyName, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(keyName, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${key}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe API ${response.status}: ${text.slice(0, 180)}`);
  }
  return response.json();
}

async function getSignups() {
  const listId = Number(process.env.BREVO_LIST_ID);
  if (!Number.isFinite(listId)) throw new Error('BREVO_LIST_ID is not configured');

  const rows = [];
  let offset = 0;
  let total = 0;

  for (let page = 0; page < 2; page += 1) {
    const result = await brevoFetch(
      `/contacts/lists/${listId}/contacts?limit=500&offset=${offset}&sort=desc`
    );

    const contacts = Array.isArray(result.contacts) ? result.contacts : [];
    total = Number(result.count) || contacts.length;
    rows.push(...contacts);

    if (rows.length >= total || contacts.length < 500) break;
    offset += 500;
  }

  return { rows, truncated: total > rows.length };
}

async function getPayments() {
  const rows = [];
  let startingAfter = '';
  const configuredPaymentLink = String(process.env.STRIPE_PAYMENT_LINK_ID || '').trim();
  const paymentLink = /^plink_[A-Za-z0-9]+$/.test(configuredPaymentLink)
    ? configuredPaymentLink
    : '';

  for (let page = 0; page < 10; page += 1) {
    const result = await stripeFetch('/checkout/sessions', {
      limit: 100,
      status: 'complete',
      starting_after: startingAfter,
      payment_link: paymentLink,
    });

    rows.push(...result.data);
    if (!result.has_more || !result.data.length) break;
    startingAfter = result.data[result.data.length - 1].id;
  }

  return {
    rows: rows.filter(item => item.payment_status === 'paid' || item.payment_status === 'no_payment_required'),
    truncated: rows.length >= 1000,
    filteredToPaymentLink: Boolean(paymentLink),
    invalidPaymentLinkConfigured: Boolean(configuredPaymentLink && !paymentLink),
  };
}

function signupRecord(contact) {
  const attributes = contact.attributes || {};
  const email = normalizeEmail(contact.email);
  const firstName = String(attributes.FIRSTNAME || '').trim();
  const lastName = String(attributes.LASTNAME || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  return {
    key: email || `signup:${contact.id}`,
    signupId: contact.id,
    firstName,
    fullName,
    email,
    phone: String(attributes.THRILL_PHONE || attributes.SMS || '').trim(),
    campus: String(attributes.THRILL_CAMPUS || '').trim(),
    birthday: String(attributes.THRILL_BIRTHDAY || '').trim(),
    smsOptIn: yes(attributes.THRILL_SMS_OPT_IN) || Boolean(attributes.SMS),
    signedUpAt: contact.createdAt || null,
    paid: false,
    paymentCount: 0,
    amountPaid: 0,
    currency: null,
    paidAt: null,
    stripeSessionIds: [],
    source: 'signup',
  };
}

function paymentRecord(session) {
  const details = session.customer_details || {};
  const email = normalizeEmail(details.email || session.customer_email);
  const name = String(details.name || '').trim();

  return {
    key: email || `payment:${session.id}`,
    signupId: null,
    firstName: name ? name.split(/\s+/)[0] : '',
    fullName: name,
    email,
    phone: String(details.phone || '').trim(),
    campus: '',
    birthday: '',
    smsOptIn: false,
    signedUpAt: null,
    paid: true,
    paymentCount: 1,
    amountPaid: money(session.amount_total) || 0,
    currency: session.currency || null,
    paidAt: session.created ? new Date(session.created * 1000).toISOString() : null,
    stripeSessionIds: [session.id],
    source: 'payment',
  };
}

function mergeRecords(signups, payments) {
  const map = new Map();

  for (const signup of signups.map(signupRecord)) {
    map.set(signup.key, signup);
  }

  for (const payment of payments.map(paymentRecord)) {
    const existing = map.get(payment.key);

    if (!existing) {
      map.set(payment.key, payment);
      continue;
    }

    existing.paid = true;
    existing.paymentCount += 1;
    existing.amountPaid += payment.amountPaid || 0;
    existing.currency = existing.currency || payment.currency;
    existing.paidAt = !existing.paidAt || (payment.paidAt && payment.paidAt > existing.paidAt)
      ? payment.paidAt
      : existing.paidAt;
    existing.stripeSessionIds.push(...payment.stripeSessionIds);
    existing.source = 'signup+payment';
    if (!existing.fullName && payment.fullName) existing.fullName = payment.fullName;
    if (!existing.firstName && payment.firstName) existing.firstName = payment.firstName;
    if (!existing.phone && payment.phone) existing.phone = payment.phone;
  }

  return [...map.values()].sort((a, b) => {
    const aDate = a.signedUpAt || a.paidAt || '';
    const bDate = b.signedUpAt || b.paidAt || '';
    return bDate.localeCompare(aDate);
  });
}

export default async request => {
  const session = verifySession(request);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, { allow: 'GET' });
  }

  const warnings = [];
  let signupResult = { rows: [], truncated: false };
  let paymentResult = {
    rows: [],
    truncated: false,
    filteredToPaymentLink: false,
    invalidPaymentLinkConfigured: false,
  };

  try {
    signupResult = await getSignups();
  } catch (error) {
    console.error('Admin Brevo signup load failed', error);
    warnings.push(error.message);
  }

  try {
    paymentResult = await getPayments();
  } catch (error) {
    console.error('Admin Stripe data load failed', error);
    warnings.push(error.message);
  }

  if (paymentResult.invalidPaymentLinkConfigured) {
    warnings.push('STRIPE_PAYMENT_LINK_ID is not a valid Stripe Payment Link ID. It must be the actual plink_... value. Showing all completed Checkout payments instead.');
  } else if (!paymentResult.filteredToPaymentLink && process.env.STRIPE_SECRET_KEY) {
    warnings.push('Stripe results currently include all completed Checkout payments on this Stripe account. Set STRIPE_PAYMENT_LINK_ID to the actual plink_... value to isolate the Thrillwaukee payment link.');
  }

  if (signupResult.truncated) warnings.push('Brevo signup results reached the 1,000-record safety limit.');
  if (paymentResult.truncated) warnings.push('Stripe results reached the 1,000-record safety limit.');

  const people = mergeRecords(signupResult.rows, paymentResult.rows);
  const summary = {
    total: people.length,
    signedUp: people.filter(person => person.signedUpAt).length,
    paid: people.filter(person => person.paid).length,
    unpaid: people.filter(person => person.signedUpAt && !person.paid).length,
    smsOptIn: people.filter(person => person.smsOptIn).length,
    paidWithoutSignup: people.filter(person => person.paid && !person.signedUpAt).length,
  };

  return json({
    generatedAt: new Date().toISOString(),
    signedInAs: session.email,
    summary,
    warnings,
    people,
  });
};
