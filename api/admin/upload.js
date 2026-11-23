// Admin: upload a cover image (sent as a data URL, already resized in the browser).
import { send, requireAdmin } from '../_lib.js';
import { saveImage } from '../_blob.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX = 3 * 1024 * 1024;

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ''));
    if (!m) return send(res, 400, { error: 'Please upload a JPG, PNG or WebP image.' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX) return send(res, 413, { error: 'Image is too large (max 3 MB after resizing).' });
    const url = await saveImage(buf, m[1], TYPES[m[1]]);
    return send(res, 200, { url });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Upload failed. Is Vercel Blob connected? See README.' });
  }
}
