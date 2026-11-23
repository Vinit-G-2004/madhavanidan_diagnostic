// Public: published posts only.
import { allPosts } from './_lib.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const posts = (await allPosts()).filter(p => p.status === 'published')
      .map(({ created, updated, status, ...p }) => p);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    return res.status(200).json({ posts });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Posts are unavailable right now.' });
  }
}
