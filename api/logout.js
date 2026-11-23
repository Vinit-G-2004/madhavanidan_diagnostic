import { send, clearSession } from './_lib.js';
export default function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  clearSession(res);
  return send(res, 200, { ok: true });
}
