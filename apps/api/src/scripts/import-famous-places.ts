/**
 * Import famous places from famous-places-raw.json into MongoDB.
 *
 * - Upserts places (matched by slug) with description, cover, region, ancestors.
 * - Marks them `featured: true` so explore prioritizes them.
 * - Writes place_articles for each.
 *
 * Usage: npx tsx src/scripts/import-famous-places.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { connectMongo, getDb } from '../db/mongo.js';
import type { FamousPlace } from './crawl-famous-places.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function main() {
  await connectMongo();
  const db = getDb();

  const inPath = join(__dirname, 'data', 'famous-places-raw.json');
  const places: FamousPlace[] = JSON.parse(readFileSync(inPath, 'utf-8'));
  console.log(`Loaded ${places.length} famous places from ${inPath}`);

  const placesCol = db.collection('places');
  const articlesCol = db.collection('place_articles');

  // Province lookup: name -> _id
  const provinceDocs = await placesCol
    .find({ type: 'province', status: 'published' })
    .project({ _id: 1, 'name.vi': 1 })
    .toArray();
  const provinceByName = new Map<string, ObjectId>();
  for (const p of provinceDocs) {
    provinceByName.set(p.name?.vi as string, p._id as ObjectId);
  }
  console.log(`Found ${provinceByName.size} province places in DB`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const place of places) {
    try {
      const slug = slugify(place.name);
      if (!slug) { errors++; continue; }

      const provinceId = provinceByName.get(place.province) ?? null;
      const ancestors: ObjectId[] = provinceId ? [provinceId] : [];
      const now = new Date();

      const result = await placesCol.findOneAndUpdate(
        { slug },
        {
          $set: {
            slug,
            name: { vi: place.name, en: '' },
            aliases: [slugify(place.name)],
            type: place.type,
            parentId: provinceId,
            ancestors,
            province: place.province,
            geo: { type: 'Point', coordinates: [place.lng, place.lat] },
            boundingBox: null,
            description: { vi: place.summary, en: '' },
            media: { coverUrl: place.coverUrl, gallery: place.coverUrl ? [place.coverUrl] : [] },
            bestSeason: [],
            stats: { postCount: 0, reviewCount: 0, ratingAvg: 0, plannerMentions: 0 },
            source: 'wikipedia',
            status: 'published',
            featured: true,
            mergedInto: null,
            createdBy: null,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );

      if (result) {
        // Determine if it was inserted or updated
        const existing = await placesCol.findOne({ slug });
        if (existing?.createdAt?.getTime() === now.getTime()) inserted++;
        else updated++;
      }

      // Write place_article. The collection has a unique index on
      // (communeSlug, lang), so set communeSlug to the place slug to avoid
      // duplicate-key collisions (null communeSlug collides for every row).
      await articlesCol.findOneAndUpdate(
        { communeSlug: slug, lang: 'vi' },
        {
          $set: {
            placeId: result?._id,
            communeSlug: slug,
            lang: 'vi',
            source: 'wikipedia',
            sourceUrl: place.sourceUrl,
            title: place.wikiTitle,
            summary: place.summary,
            content: place.content,
            fetchedAt: now,
            status: 'published',
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );
    } catch (err) {
      errors++;
      if (errors <= 5) console.error(`  Error on ${place.name}: ${String(err)}`);
    }
  }

  console.log(`\nDone. inserted=${inserted} updated=${updated} errors=${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});