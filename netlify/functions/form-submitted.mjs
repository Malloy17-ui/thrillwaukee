import { getStore } from '@netlify/blobs';

const BREVO_API = 'https://api.brevo.com/v3';
const SIGNUP_STORE = 'thrillwaukee-signups';

const normalizeUsPhone = (value = '') => {
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
};

const asBoolean = value => ['yes', 'true', '1', 'on'].includes(String(value || '').toLowerCase());

async function brevo(path, options = {}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const response = await fetch(`${BREVO_API}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo ${response.status}: ${body}`);
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

async function persistSignup(data) {
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return;

  const store = getStore(SIGNUP_STORE);
  const key = `people/${encodeURIComponent(email)}`;
  const existing = await store.get(key, { type: 'json', consistency: 'strong' }).catch(() => null);
  const now = new Date().toISOString();

  await store.setJSON(key, {
    id: key,
    email,
    data: {
      first_name: String(data.first_name || '').trim(),
      email,
      phone: String(data.phone || '').trim(),
      campus: String(data.campus || '').trim(),
      birthday: String(data.birthday || '').trim(),
      sms_opt_in: asBoolean(data.sms_opt_in) ? 'yes' : '',
    },
    created_at: existing?.created_at || now,
    updated_at: now,
  });
}

async function syncContact(data) {
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return;

  const primaryListId = Number(process.env.BREVO_LIST_ID);
  if (!Number.isFinite(primaryListId)) throw new Error('BREVO_LIST_ID is not configured');

  const smsOptIn = asBoolean(data.sms_opt_in);
  const phone = smsOptIn ? normalizeUsPhone(data.phone) : '';
  const listIds = [primaryListId];

  const attributes = {
    FIRSTNAME: String(data.first_name || '').trim(),
  };

  if (phone) attributes.SMS = phone;

  await brevo('/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email,
      attributes,
      listIds: [...new Set(listIds)],
      updateEnabled: true,
    }),
  });

  const welcomeTemplateId = Number(process.env.BREVO_WELCOME_TEMPLATE_ID);
  if (Number.isFinite(welcomeTemplateId)) {
    await brevo('/smtp/email', {
      method: 'POST',
      body: JSON.stringify({
        to: [{ email, name: String(data.first_name || '').trim() || undefined }],
        templateId: welcomeTemplateId,
        params: {
          FIRSTNAME: String(data.first_name || '').trim(),
          CAMPUS: String(data.campus || '').trim(),
        },
      }),
    });
  }
}

export default {
  async formSubmitted(event) {
    const data = event?.data || {};
    if (String(data['form-name'] || '') !== 'thrillwaukee-list') return;

    const results = await Promise.allSettled([
      persistSignup(data),
      syncContact(data),
    ]);

    if (results[0].status === 'rejected') {
      console.error('Thrillwaukee signup Blob persistence failed', results[0].reason);
    }

    if (results[1].status === 'rejected') {
      console.error('Thrillwaukee signup Brevo sync failed', results[1].reason);
    }

    console.log('Thrillwaukee signup processed', {
      email: data.email,
      smsOptIn: asBoolean(data.sms_opt_in),
      blobStored: results[0].status === 'fulfilled',
      brevoSynced: results[1].status === 'fulfilled',
    });
  },
};
