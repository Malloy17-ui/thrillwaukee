import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_EMAIL = 'noah@malloylabs.net';
export const COOKIE_NAME = 'thrill_admin';
const SESSION_SECONDS = 60 * 60 * 12;

const encode = value => Buffer.from(value).toString('base64url');
const decode = value => Buffer.from(value, 'base64url').toString('utf8');

const safeEqual = (left = '', right = '') => {
  const a = createHash('sha256').update(String(left)).digest();
  const b = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(a, b);
};

const readEnv = name => {
  const fromProcess = process.env?.[name];
  if (typeof fromProcess === 'string' && fromProcess.length) return fromProcess;

  const fromNetlify = globalThis.Netlify?.env?.get?.(name);
  if (typeof fromNetlify === 'string' && fromNetlify.length) return fromNetlify;

  return '';
};

const adminPassword = () => readEnv('ADMIN_PASSWORD');

const sessionKey = () => {
  const password = adminPassword();
  return createHash('sha256').update(`thrillwaukee-admin-session:${password}`).digest();
};

const sign = payload =>
  createHmac('sha256', sessionKey()).update(payload).digest('base64url');

export const credentialsConfigured = () => Boolean(adminPassword());

export const credentialsMatch = (email, password) =>
  credentialsConfigured() &&
  safeEqual(String(email || '').trim().toLowerCase(), ADMIN_EMAIL) &&
  safeEqual(String(password || ''), adminPassword());

export const createSessionToken = () => {
  const payload = encode(JSON.stringify({
    email: ADMIN_EMAIL,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  }));
  return `${payload}.${sign(payload)}`;
};

export const sessionCookie = token =>
  `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;

export const clearSessionCookie = () =>
  `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

const getCookie = (request, name) => {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
};

export const verifySession = request => {
  if (!credentialsConfigured()) return null;

  const token = getCookie(request, COOKIE_NAME);
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (!safeEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(decode(payload));
    if (data.email !== ADMIN_EMAIL) return null;
    if (!Number.isFinite(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
};

export const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      ...extraHeaders,
    },
  });
