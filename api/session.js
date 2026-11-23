import { send, getSession } from './_lib.js';
export default function handler(req, res) {
  try {
    const s = getSession(req);
    return send(res, 200, s ? { signedIn: true, user: s.u } : { signedIn: false });
  } catch (e) {
    return send(res, 200, { signedIn: false, configError: true });
  }
}
