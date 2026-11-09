const BREVO_API = 'https://api.brevo.com/v3';

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

let ensureAttributesPromise;
async function ensureThrillwaukeeAttributes() {
  if (!ensureAttributesPromise) {
    ensureAttributesPromise = (async () => {
      const required = [
        ['THRILL_PHONE', 'text'],
        ['THRILL_CAMPUS', 'text'],
        ['THRILL_BIRTHDAY', 'text'],
        ['THRILL_SMS_OPT_IN', 'text'],
      ];

      const current = await brevo('/contacts/attributes');
      const existing = new Set(
        (current?.attributes || [])
          .filter(attribute => attribute.category === 'normal')
          .map(attribute => attribute.name)
      );

      for (const [name, type] of required) {
        if (existing.has(name)) continue;
        try {
          await brevo(`/contacts/attributes/normal/${name}`, {
            method: 'POST',
            body: JSON.stringify({ type }),
          });
        } catch (error) {
          // A parallel warm function may have created it after the list call.
          if (!String(error?.message || '').includes('400')) throw error;
        }
      }
    })().catch(error => {
      ensureAttributesPromise = null;
      throw error;
    });
  }

  return ensureAttributesPromise;
}

async function syncContact(data) {
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return;

  const primaryListId = Number(process.env.BREVO_LIST_ID);
  if (!Number.isFinite(primaryListId)) throw new Error('BREVO_LIST_ID is not configured');

  await ensureThrillwaukeeAttributes();

  const smsOptIn = asBoolean(data.sms_opt_in);
  const rawPhone = String(data.phone || '').trim();
  const smsPhone = smsOptIn ? normalizeUsPhone(rawPhone) : '';
  const listIds = [primaryListId];

  const attributes = {
    FIRSTNAME: String(data.first_name || '').trim(),
    THRILL_PHONE: rawPhone,
    THRILL_CAMPUS: String(data.campus || '').trim(),
    THRILL_BIRTHDAY: String(data.birthday || '').trim(),
    THRILL_SMS_OPT_IN: smsOptIn ? 'yes' : 'no',
  };

  if (smsPhone) attributes.SMS = smsPhone;

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

    try {
      await syncContact(data);
      console.log('Thrillwaukee signup synced to Brevo', {
        email: data.email,
        smsOptIn: asBoolean(data.sms_opt_in),
      });
    } catch (error) {
      // Netlify Forms remains the durable original submission if Brevo is unavailable.
      console.error('Thrillwaukee signup Brevo sync failed', error);
    }
  },
};
