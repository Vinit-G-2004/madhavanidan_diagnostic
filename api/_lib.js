// Shared helpers for the API routes (files starting with "_" are not deployed as routes).
import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

const COOKIE = 'md_admin';
const SESSION_HOURS = 8;
const MAX_ATTEMPTS = 5;          // failed logins allowed…
const LOCK_SECONDS = 15 * 60;    // …per IP in this window

let _redis;
export function redis() {
  if (globalThis.__testRedis) return globalThis.__testRedis; // used only by local tests
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) throw new Error('storage_not_configured');
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

/* ---------- passwords ---------- */
// Hash format: scrypt$<saltHex>$<hashHex>  (create one with: npm run hash-password)
export function verifyPassword(password, stored) {
  const [alg, salt, hex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hex) return false;
  const want = Buffer.from(hex, 'hex');
  const got = crypto.scryptSync(String(password), Buffer.from(salt, 'hex'), want.length);
  return want.length > 0 && crypto.timingSafeEqual(want, got);
}
function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
export function checkCredentials(username, password) {
  const u = process.env.ADMIN_USERNAME, h = process.env.ADMIN_PASSWORD_HASH;
  if (!u || !h) throw new Error('auth_not_configured');
  const userOk = safeEqual(String(username || '').trim().toLowerCase(), u.trim().toLowerCase());
  const passOk = verifyPassword(password, h); // always run, so timing doesn't reveal the username
  return userOk && passOk;
}

/* ---------- sessions (signed, HttpOnly cookie) ---------- */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('auth_not_configured');
  return s;
}
const b64 = s => Buffer.from(s).toString('base64url');
function sign(data) { return crypto.createHmac('sha256', secret()).update(data).digest('base64url'); }

export function setSession(res, username) {
  const payload = b64(JSON.stringify({ u: username, exp: Date.now() + SESSION_HOURS * 3600e3 }));
  const token = payload + '.' + sign(payload);
  // Safari refuses Secure cookies on http://localhost, so the local preview leaves the flag off.
  const secure = globalThis.__testBlob ? '' : ' Secure;';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`);
}
export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
export function getSession(req) {
  const raw = String(req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return null;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

// Every admin write must come from our own admin page: custom header (blocked cross-site
// without CORS) + same-origin check, on top of the SameSite=Strict cookie.
export function sameOrigin(req) {
  if (req.headers['x-admin'] !== '1') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
export function requireAdmin(req, res) {
  let s = null;
  try { s = getSession(req); } catch (e) { send(res, 500, { error: 'Server is not configured. See README.' }); return null; }
  if (!s) { send(res, 401, { error: 'Please sign in again.' }); return null; }
  if (req.method !== 'GET' && !sameOrigin(req)) { send(res, 403, { error: 'Request blocked.' }); return null; }
  return s;
}

/* ---------- login rate limit ---------- */
export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}
export async function tooManyAttempts(ip) {
  const n = Number(await redis().get('login:fail:' + ip)) || 0;
  return n >= MAX_ATTEMPTS;
}
export async function recordFailure(ip) {
  const k = 'login:fail:' + ip;
  const n = await redis().incr(k);
  if (n === 1) await redis().expire(k, LOCK_SECONDS);
}
export async function clearFailures(ip) { await redis().del('login:fail:' + ip); }

/* ---------- posts ---------- */
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
export function cleanPost(input, existing) {
  const p = input || {};
  const type = p.type === 'launch' ? 'launch' : 'blog';
  const title = clip(p.title, 140);
  const body = clip(p.body, 20000);
  if (!title || !body) return { error: 'Please add a title and some content.' };
  const image = clip(p.image, 500);
  const localImg = globalThis.__testBlob && /^\/_img\/[\w./-]+$/.test(image);
  if (image && !localImg && !/^https:\/\/[^\s"'<>]+$/.test(image)) return { error: 'Invalid image.' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : new Date().toISOString().slice(0, 10);
  return {
    post: {
      id: existing?.id || slugId(title),
      type, title, body, image, date,
      category: clip(p.category, 60),
      summary: clip(p.summary, 220),
      price: type === 'launch' ? clip(p.price, 60) : '',
      status: p.status === 'draft' ? 'draft' : 'published',
      featured: !!p.featured,
      created: existing?.created || Date.now(),
      updated: Date.now(),
    },
  };
}
function slugId(title) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'post';
  return base + '-' + crypto.randomBytes(3).toString('hex');
}
export const validId = id => /^[a-z0-9-]{1,80}$/.test(String(id || ''));

export async function allPosts() {
  const h = (await redis().hgetall('posts')) || {};
  return Object.values(h).map(v => (typeof v === 'string' ? JSON.parse(v) : v))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updated || 0) - (a.updated || 0));
}
