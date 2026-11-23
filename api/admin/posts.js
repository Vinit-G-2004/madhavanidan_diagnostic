// Admin: list all posts (incl. drafts), create/update, delete.
import { send, requireAdmin, redis, allPosts, cleanPost, validId } from '../_lib.js';
import { deleteImage } from '../_blob.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') return send(res, 200, { posts: await allPosts() });

    if (req.method === 'POST') {
      const input = req.body?.post || {};
      let existing = null;
      if (input.id) {
        if (!validId(input.id)) return send(res, 400, { error: 'Invalid post.' });
        const raw = await redis().hget('posts', input.id);
        existing = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
        if (!existing) return send(res, 404, { error: 'This post no longer exists.' });
      }
      const { post, error } = cleanPost(input, existing);
      if (error) return send(res, 400, { error });
      await redis().hset('posts', { [post.id]: JSON.stringify(post) });
      if (existing?.image && existing.image !== post.image) await deleteImage(existing.image);
      return send(res, 200, { post });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!validId(id)) return send(res, 400, { error: 'Invalid post.' });
      const raw = await redis().hget('posts', id);
      const p = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      await redis().hdel('posts', id);
      if (p?.image) await deleteImage(p.image);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
