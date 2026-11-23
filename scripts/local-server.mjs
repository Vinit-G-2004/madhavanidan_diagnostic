// LOCAL PREVIEW ONLY — runs the website + /admin on your computer with no accounts needed.
// Posts and images are kept in memory and disappear when you stop the server (Ctrl+C).
// For the real site, deploy to Vercel (see README).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const USER = process.env.LOCAL_ADMIN_USER || 'admin';
const PASS = process.env.LOCAL_ADMIN_PASSWORD || 'local-preview-123';

// Local login settings (never used on Vercel)
const salt = crypto.randomBytes(16);
process.env.ADMIN_USERNAME = USER;
process.env.ADMIN_PASSWORD_HASH = `scrypt$${salt.toString('hex')}$${crypto.scryptSync(PASS, salt, 64).toString('hex')}`;
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');

// In-memory stand-ins for Upstash Redis and Vercel Blob
const kv = new Map(), hashes = new Map(), blobs = new Map();
globalThis.__testRedis = {
  async get(k) { return kv.get(k) ?? null }, async incr(k) { const n = (Number(kv.get(k)) || 0) + 1; kv.set(k, n); return n },
  async expire(k, s) { setTimeout(() => kv.delete(k), s * 1000).unref(); return 1 }, async del(k) { kv.delete(k); return 1 },
  async hgetall(k) { const h = hashes.get(k); return h ? Object.fromEntries(h) : null }, async hget(k, f) { return hashes.get(k)?.get(f) ?? null },
  async hset(k, o) { const h = hashes.get(k) || new Map(); for (const [f, v] of Object.entries(o)) h.set(f, v); hashes.set(k, h); return 1 },
  async hdel(k, f) { hashes.get(k)?.delete(f); return 1 },
};
globalThis.__testBlob = {
  async put(name, buf, o) { blobs.set(name, { buf, type: o.contentType }); return { url: `/_img/${name}` } },
  async del(u) { blobs.delete(String(u).replace(/^.*\/_img\//, '')) },
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const REWRITES = [/^\/blog$/, /^\/launches$/, /^\/post\/[^/]+$/];

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`); let p = decodeURIComponent(u.pathname);
    if (p.startsWith('/api/')) {
      const file = path.join(ROOT, p.replace(/\/$/, '') + '.js');
      if (!file.startsWith(path.join(ROOT, 'api')) || path.basename(file).startsWith('_') || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
      let raw = ''; for await (const c of req) raw += c;
      req.body = raw && /json/.test(req.headers['content-type'] || '') ? JSON.parse(raw) : {};
      req.query = Object.fromEntries(u.searchParams);
      res.status = c => { res.statusCode = c; return res }; res.json = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)) };
      return (await import(pathToFileURL(file).href)).default(req, res);
    }
    if (p.startsWith('/_img/')) { const b = blobs.get(p.slice(6)); if (!b) { res.writeHead(404); return res.end() } res.writeHead(200, { 'content-type': b.type }); return res.end(b.buf) }
    if (p === '/' || REWRITES.some(r => r.test(p))) p = '/index.html';
    if (p === '/admin' || p === '/admin/') p = '/admin/index.html';
    const f = path.join(ROOT, 'public', p);
    if (!f.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found') }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); res.end('Server error') }
}).listen(PORT, () => {
  console.log(`\n  Madhavanidan Diagnostic — local preview\n`);
  console.log(`  Website:  http://localhost:${PORT}`);
  console.log(`  Admin:    http://localhost:${PORT}/admin`);
  console.log(`  Login:    ${USER} / ${PASS}\n`);
  console.log(`  Posts are kept in memory only and reset when you stop (Ctrl+C).\n`);
});
