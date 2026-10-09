/**
 * Import OSM POIs from osm-pois-raw.json into MongoDB places collection.
 *
 * Usage: npx tsx src/scripts/import-places.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { connectMongo, getDb } from '../db/mongo.js';
import type { OsmPoi } from './crawl-osm-pois.js';

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

  const inPath = join(__dirname, 'data', 'osm-pois-raw.json');
  const pois: OsmPoi[] = JSON.parse(readFileSync(inPath, 'utf-8'));
  console.log(`Loaded ${pois.length} POIs from ${inPath}`);

  // Build province lookup: name -> _id
  const provinceDocs = await db
    .collection('places')
    .find({ type: 'province', status: 'published' })
    .project({ _id: 1, 'name.vi': 1 })
    .toArray();
  const provinceByName = new Map<string, ObjectId>();
  for (const p of provinceDocs) {
    provinceByName.set(p.name?.vi as string, p._id as ObjectId);
  }
  console.log(`Found ${provinceByName.size} province places in DB`);

  // Also look up admin_boundaries to resolve province for POIs
  // when province places aren't seeded yet, use geo intersection
  const placesCol = db.collection('places');
  const adminCol = db.collection('admin_boundaries');

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const poi of pois) {
    try {
      // Generate unique slug
      let baseSlug = slugify(poi.name);
      if (!baseSlug) { skipped++; continue; }

      // Check for province in places collection first
      let provinceId: ObjectId | null = null;
      let provinceName = poi.provinceName;

      const provPlace = await placesCol.findOne({ 'name.vi': provinceName, type: 'province' });
      if (provPlace) {
        provinceId = provPlace._id as ObjectId;
      } else {
        // Try geo intersection with admin_boundaries
        const provBoundary = await adminCol.findOne({
          level: 'province',
          geometry: {
            $geoIntersects: {
              $geometry: { type: 'Point', coordinates: [poi.lng, poi.lat] },
            },
          },
        });
        if (provBoundary) {
          provinceName = provBoundary.name as string;
        }
      }

      // Ensure slug is unique (append province suffix if needed)
      let slug = baseSlug;
      const existing = await placesCol.findOne({ slug });
      if (existing) {
        const provSlug = slugify(provinceName.replace(/^(Tỉnh|Thành phố)\s+/, ''));
        slug = `${baseSlug}-${provSlug}`;
        // If still conflicts, skip
        const existing2 = await placesCol.findOne({ slug });
        if (existing2) { skipped++; continue; }
      }

      const now = new Date();
      const ancestors: ObjectId[] = provinceId ? [provinceId] : [];

      await placesCol.insertOne({
        slug,
        name: { vi: poi.name, en: poi.nameEn || '' },
        aliases: [slugify(poi.name)],
        type: poi.type,
        parentId: provinceId,
        ancestors,
        geo: { type: 'Point', coordinates: [poi.lng, poi.lat] },
        boundingBox: null,
        description: { vi: '', en: '' },
        media: { coverUrl: null, gallery: [] },
        bestSeason: [],
        stats: { postCount: 0, reviewCount: 0, ratingAvg: 0, plannerMentions: 0 },
        source: 'seed',
        status: 'published',
        mergedInto: null,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        _osmId: poi.osmId,
        _osmType: poi.osmType,
      });
      inserted++;

      if (inserted % 500 === 0) {
        console.log(`  ${inserted} inserted...`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) console.error(`  Error on ${poi.name}: ${String(err)}`);
    }
  }

  console.log(`\nDone. inserted=${inserted} skipped=${skipped} errors=${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
