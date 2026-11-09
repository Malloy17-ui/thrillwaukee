import {
  ADMIN_EMAIL,
  clearSessionCookie,
  createSessionToken,
  credentialsConfigured,
  credentialsMatch,
  json,
  sessionCookie,
  verifySession,
} from '../lib/admin-session.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async request => {
  if (request.method === 'GET') {
    const session = verifySession(request);
    if (!session) return json({ authenticated: false }, 401);
    return json({ authenticated: true, email: session.email });
  }

  if (request.method === 'DELETE') {
    return json(
      { ok: true },
      200,
      { 'set-cookie': clearSessionCookie() },
    );
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { allow: 'GET, POST, DELETE' });
  }

  if (!credentialsConfigured()) {
    return json({ error: 'Admin login is not configured.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  if (!credentialsMatch(body?.email, body?.password)) {
    await pause(500);
    return json({ error: 'Invalid email or password.' }, 401);
  }

  const token = createSessionToken();
  return json(
    { authenticated: true, email: ADMIN_EMAIL },
    200,
    { 'set-cookie': sessionCookie(token) },
  );
};
