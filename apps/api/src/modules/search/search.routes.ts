import { Router } from 'express';
import { Client } from '@elastic/elasticsearch';
import { asyncHandler } from '../../lib/http.js';
import { authenticate } from '../auth/middleware.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { getDb } from '../../db/mongo.js';

const router = Router();
const es = new Client({ node: config.esNode });

/** Escape special regex characters in a user-supplied string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get(
  '/',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const type = typeof req.query.type === 'string' ? req.query.type : 'posts';
    if (!q.trim()) {
      res.json({ items: [], total: 0 });
      return;
    }
    const index = ({ posts: 'tvp_posts', places: 'tvp_places', tours: 'tvp_tours', listings: 'tvp_listings' } as Record<string, string>)[type] ?? 'tvp_posts';
    try {
      const result = await es.search({
        index,
        size: 20,
        query: {
          multi_match: {
            query: q,
            fields: ['body^2', 'title^3', 'name^3', 'description'],
            fuzziness: 'AUTO',
          },
        },
      });
      const hits = result.hits.hits.map((h) => ({ id: h._id, score: h._score, ...(h._source as object) }));
      res.json({ items: hits, total: typeof result.hits.total === 'object' ? result.hits.total.value : hits.length });
    } catch (err) {
      // ES may not be indexed yet; degrade gracefully rather than 500.
      logger.warn({ err }, 'search failed; returning empty');
      res.json({ items: [], total: 0, degraded: true });
    }
  }),
);

router.get(
  '/places',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.json({ items: [] });
      return;
    }

    const db = getDb();
    const regex = new RegExp(escapeRegex(q), 'i');

    // Search both sources in parallel: tourist places (with slug) + admin boundaries (provinces/communes)
    const [placeDocs, boundaryDocs] = await Promise.all([
      db
        .collection('places')
        .find(
          { status: 'published', $or: [{ 'name.vi': regex }, { 'name.en': regex }, { aliases: regex }] },
          { projection: { _id: 1, slug: 1, 'name.vi': 1, 'name.en': 1, type: 1, province: 1, 'media.coverUrl': 1 } },
        )
        .limit(7)
        .toArray(),
      db
        .collection('admin_boundaries')
        .find(
          { name: regex },
          { projection: { _id: 1, name: 1, level: 1, provinceName: 1 } },
        )
        .limit(5)
        .toArray(),
    ]);

    // Tourist places first (have slug → deep link to /places/[slug])
    const placeItems = placeDocs.map((d) => ({
      _id: String(d._id),
      slug: d.slug as string,
      name: (d.name?.vi as string) ?? '',
      nameEn: (d.name?.en as string) ?? '',
      type: d.type as string,
      province: (d.province as string) ?? '',
      coverUrl: (d.media?.coverUrl as string) ?? null,
    }));

    // Admin boundaries (no slug → fall back to /explore in frontend)
    const boundaryItems = boundaryDocs.map((b) => ({
      _id: String(b._id),
      slug: '',
      name: b.name as string,
      nameEn: '',
      type: (b.level as string) === 'province' ? 'province' : 'area',
      province: (b.provinceName as string) ?? '',
      coverUrl: null,
    }));

    // Deduplicate: skip boundary entries whose name already appears in placeItems
    const placeNames = new Set(placeItems.map((p) => p.name.toLowerCase()));
    const uniqueBoundaries = boundaryItems.filter((b) => !placeNames.has(b.name.toLowerCase()));

    res.json({ items: [...placeItems, ...uniqueBoundaries].slice(0, 10) });
  }),
);

router.get(
  '/all',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.json({ posts: [], users: [], places: [] });
      return;
    }

    const db = getDb();
    const regex = new RegExp(escapeRegex(q), 'i');

    const [postHits, users, places] = await Promise.all([
      // 1. Elasticsearch posts
      (async () => {
        try {
          const result = await es.search({
            index: 'tvp_posts',
            size: 3,
            query: {
              multi_match: {
                query: q,
                fields: ['body^2', 'title^3', 'name^3', 'description'],
                fuzziness: 'AUTO',
              },
            },
          });
          return result.hits.hits.map((h) => ({ id: h._id, score: h._score, ...(h._source as object) }));
        } catch (err) {
          logger.warn({ err }, 'search/all ES query failed; returning empty posts');
          return [];
        }
      })(),

      // 2. MongoDB users — match displayName, handle, or email
      db
        .collection('users')
        .find(
          {
            status: 'active',
            $or: [{ displayName: regex }, { handle: regex }, { email: regex }],
          },
          { projection: { _id: 1, displayName: 1, handle: 1, avatarUrl: 1, accountType: 1 } },
        )
        .limit(3)
        .toArray(),

      // 3. MongoDB places
      db
        .collection('places')
        .find(
          { status: 'published', $or: [{ 'name.vi': regex }, { 'name.en': regex }, { aliases: regex }] },
          { projection: { _id: 1, slug: 1, 'name.vi': 1, type: 1, province: 1, 'media.coverUrl': 1 } },
        )
        .limit(3)
        .toArray()
        .then((docs) =>
          docs.map((d) => ({
            _id: String(d._id),
            slug: d.slug as string,
            name: (d.name?.vi as string) ?? '',
            type: d.type as string,
            province: (d.province as string) ?? '',
            coverUrl: (d.media?.coverUrl as string) ?? null,
          })),
        ),
    ]);

    res.json({ posts: postHits, users, places });
  }),
);

export default router;

