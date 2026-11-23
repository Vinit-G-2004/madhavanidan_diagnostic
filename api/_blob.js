import { put, del } from '@vercel/blob';
const api = () => globalThis.__testBlob || { put, del }; // test hook for local runs

export async function saveImage(buffer, contentType, ext) {
  const name = `posts/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = await api().put(name, buffer, { access: 'public', contentType });
  return r.url;
}
export async function deleteImage(url) {
  try { if (/\.public\.blob\.vercel-storage\.com\//.test(url) || globalThis.__testBlob) await api().del(url); }
  catch (e) { console.warn('image delete failed', e?.message); }
}
