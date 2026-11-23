import { send, checkCredentials, setSession, clientIp, tooManyAttempts, recordFailure, clearFailures, sameOrigin } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'Request blocked.' });
  try {
    const ip = clientIp(req);
    if (await tooManyAttempts(ip)) return send(res, 429, { error: 'Too many failed attempts. Please try again in 15 minutes.' });
    const { username, password } = req.body || {};
    if (!checkCredentials(username, password)) {
      await recordFailure(ip);
      await new Promise(r => setTimeout(r, 600)); // slow down guessing
      return send(res, 401, { error: 'Incorrect username or password.' });
    }
    await clearFailures(ip);
    setSession(res, String(username).trim());
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Server is not configured. See README.' });
  }
}
