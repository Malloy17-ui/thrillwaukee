import { json, verifySession } from '../lib/admin-session.mjs';

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const STRIPE_API = 'https://api.stripe.com/v1';

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const yes = value => ['yes', 'true', '1', 'on'].includes(String(value || '').toLowerCase());

const money = amount => Number.isFinite(amount) ? amount : null;

async function netlifyFetch(path) {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN is not configured');

  const response = await fetch(`${NETLIFY_API}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      'user-agent': 'Thrillwaukee Admin Dashboard',
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Netlify API ${response.status}: ${text.slice(0, 180)}`);
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
  const siteId = process.env.SITE_ID;
  if (!siteId) throw new Error('SITE_ID is unavailable');

  const forms = await netlifyFetch(`/sites/${encodeURIComponent(siteId)}/forms`);
  const form = forms.find(item => item.name === 'thrillwaukee-list');
  if (!form) return { rows: [], truncated: false };

  const rows = [];
  let page = 1;
  const perPage = 100;

  while (page <= 10) {
    const batch = await netlifyFetch(
      `/forms/${encodeURIComponent(form.id)}/submissions?per_page=${perPage}&page=${page}`
    );
    rows.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return { rows, truncated: rows.length >= 1000 };
}

async function getPayments() {
  const rows = [];
  let startingAfter = '';
  const paymentLink = process.env.STRIPE_PAYMENT_LINK_ID || '';

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
  };
}

function signupRecord(submission) {
  const data = submission.data || {};
  const email = normalizeEmail(data.email || submission.email);
  return {
    key: email || `signup:${submission.id}`,
    signupId: submission.id,
    firstName: String(data.first_name || submission.first_name || '').trim(),
    fullName: String(data.name || submission.name || '').trim(),
    email,
    phone: String(data.phone || '').trim(),
    campus: String(data.campus || '').trim(),
    birthday: String(data.birthday || '').trim(),
    smsOptIn: yes(data.sms_opt_in),
    signedUpAt: submission.created_at || null,
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
  let paymentResult = { rows: [], truncated: false, filteredToPaymentLink: false };

  try {
    signupResult = await getSignups();
  } catch (error) {
    console.error('Admin Netlify data load failed', error);
    warnings.push(error.message);
  }

  try {
    paymentResult = await getPayments();
  } catch (error) {
    console.error('Admin Stripe data load failed', error);
    warnings.push(error.message);
  }

  if (!paymentResult.filteredToPaymentLink && process.env.STRIPE_SECRET_KEY) {
    warnings.push('Stripe results currently include all completed Checkout payments on this Stripe account. Set STRIPE_PAYMENT_LINK_ID to isolate the Thrillwaukee payment link.');
  }
  if (signupResult.truncated) warnings.push('Signup results reached the 1,000-record safety limit.');
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
