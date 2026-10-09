// One-time import of Vietnam admin boundaries from OpenStreetMap into MongoDB.
// Runs with plain `node` (no tsx needed) inside the api container.
// OSM: admin_level=4 -> province, admin_level=6 -> commune/ward. ODbL license.
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/travelvietplaner?replicaSet=rs0';
const MONGO_DB = process.env.MONGO_DB || 'travelvietplaner';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Vietnamese administrative unit designations, used as a last-resort identity check. */
const VN_NAME = /^(Tỉnh|Thành phố|Đặc khu|Huyện|Quận|Thị xã|Thị trấn|Xã|Phường)\s/;

/** Only Tỉnh/Thành phố are first-level units; must match geo.service.ts. */
const VN_PROVINCE = /^(Tỉnh|Thành phố)\s/;

/** The only six 'thành phố trực thuộc trung ương' (Resolution 202/2025/QH15). */
const MUNICIPALITIES = ['Hà Nội', 'Hải Phòng', 'Huế', 'Đà Nẵng', 'Hồ Chí Minh', 'Cần Thơ'];

/**
 * Correct province designations that OSM gets wrong.
 *
 * OSM returned Bắc Ninh, Quảng Ninh and Đồng Nai as "Thành phố X" at admin_level=4,
 * but all three are provinces. The 2025 reform abolished the district tier and with
 * it provincial cities (thành phố thuộc tỉnh), so at first level only the six
 * centrally-governed municipalities may carry "Thành phố". Showing a wrong
 * designation on a legal administrative name is a correctness problem, and the name
 * is denormalised onto communes and posts, so fix it at import time.
 */
function normalizeProvinceName(name) {
  const bare = name.replace(/^Thành phố\s+/, '');
  if (bare === name) return name;
  return MUNICIPALITIES.includes(bare) ? name : `Tỉnh ${bare}`;
}

/**
 * Reject relations that are not Vietnamese.
 *
 * Overpass `area["ISO3166-1"="VN"]` matches any relation that merely shares a way
 * with Vietnam, so a neighbouring first-level division comes back as
 * admin_level=4 too — Guangxi (osmId 286342) shares the northern border and was
 * imported as a Vietnamese province, which then captured the border commune
 * Xã Hoành Mô via the centroid join. Storing foreign units as Vietnamese
 * administrative divisions is a sovereignty problem, so require positive evidence
 * of Vietnamese identity rather than trusting the area filter.
 */
function isVietnamese(tags) {
  const iso = tags['ISO3166-2'] ?? tags['ISO3166-1'] ?? '';
  if (iso) return iso.toUpperCase().startsWith('VN');
  const country = tags['is_in:country_code'] ?? tags['addr:country'] ?? '';
  if (country) return country.toUpperCase() === 'VN';
  return VN_NAME.test(tags.name ?? '');
}

async function fetchOverpass(query, retries = 5) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const mirror of MIRRORS) {
      try {
        const res = await fetch(mirror, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(150_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const json = JSON.parse(text);
        if (Array.isArray(json.elements)) return json.elements;
        throw new Error('no elements');
      } catch (err) {
        lastErr = err;
      }
    }
    console.log(`  retry ${attempt + 1}/${retries} after ${lastErr?.message || 'error'}`);
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Overpass fetch failed: ${String(lastErr)}`);
}

function centroid(ring) {
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  return [sx / ring.length, sy / ring.length];
}

function toGeoJson(rel) {
  const outerWays = (rel.members || []).filter((m) => m.role === 'outer' && m.geometry?.length);
  if (!outerWays.length) return null;

  // OSM returns outer ways in arbitrary order, so assemble rings by connecting
  // segments that share an endpoint (reversing a segment when needed).
  const segments = outerWays.map((way) => way.geometry.map((p) => [p.lon, p.lat]));
  const used = new Array(segments.length).fill(false);
  const rings = [];

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let ring = segments[i].slice();

    let extended = true;
    while (extended) {
      extended = false;
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const seg = segments[j];
        const ringStart = ring[0];
        const ringEnd = ring[ring.length - 1];
        const segStart = seg[0];
        const segEnd = seg[seg.length - 1];
        const eq = (a, b) => a[0] === b[0] && a[1] === b[1];

        if (eq(segStart, ringEnd)) { ring.push(...seg.slice(1)); used[j] = true; extended = true; break; }
        if (eq(segEnd, ringEnd)) { ring.push(...seg.slice(0, -1).reverse()); used[j] = true; extended = true; break; }
        if (eq(segEnd, ringStart)) { ring = seg.slice(0, -1).concat(ring); used[j] = true; extended = true; break; }
        if (eq(segStart, ringStart)) { ring = seg.slice().reverse().slice(0, -1).concat(ring); used[j] = true; extended = true; break; }
      }
    }

    // Close the ring if not already closed.
    if (ring.length > 1 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
      ring.push([ring[0][0], ring[0][1]]);
    }
    // A valid GeoJSON linear ring needs at least 4 points; skip degenerate ones.
    if (ring.length >= 4) rings.push(ring);
  }

  if (!rings.length) return null;
  if (rings.length === 1) return { type: 'Polygon', coordinates: rings };
  return { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) };
}

async function importLevel(col, level, levelName) {
  const query = `[out:json][timeout:120];area["ISO3166-1"="VN"]->.vn;relation["boundary"="administrative"]["admin_level"="${level}"](area.vn);out geom;`;
  console.log(`[${levelName}] fetching...`);
  const relations = await fetchOverpass(query);
  console.log(`[${levelName}] fetched ${relations.length} relations`);
  const docs = [];
  let skipped = 0;
  let foreign = 0;
  for (const rel of relations) {
    const name = rel.tags?.name;
    if (!name) { skipped++; continue; }
    if (!isVietnamese(rel.tags)) {
      console.warn(`[${levelName}] rejected non-Vietnamese: ${name} (osmId ${rel.id})`);
      foreign++;
      continue;
    }
    const geometry = toGeoJson(rel);
    if (!geometry) { skipped++; continue; }
    const finalName = levelName === 'province' ? normalizeProvinceName(name) : name;
    if (finalName !== name) console.log(`[${levelName}] designation fixed: ${name} -> ${finalName}`);
    docs.push({ level: levelName, name: finalName, provinceName: null, osmId: rel.id, geometry });
  }
  if (docs.length) await col.insertMany(docs, { ordered: false });
  console.log(
    `[${levelName}] inserted ${docs.length}, skipped ${skipped}, rejected-foreign ${foreign}`,
  );
  return docs.length;
}

async function main() {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(MONGO_DB);
  const col = db.collection('admin_boundaries');

  // Keep hand-authored records: OSM has no relation for some sovereign VN territory
  // (e.g. Đặc khu Hoàng Sa). OSM docs have no `source`, and { $ne: 'manual' } matches
  // a missing field, so they are still deleted.
  const del = await col.deleteMany({ source: { $ne: 'manual' } });
  const preserved = await col.countDocuments({ source: 'manual' });
  console.log(`[wipe] deleted ${del.deletedCount}, preserved ${preserved} manual record(s)`);
  await col.createIndex({ geometry: '2dsphere' });

  await importLevel(col, 4, 'province');
  await importLevel(col, 6, 'commune');

  // Backfill provinceName for each commune via centroid containment. Restricted to
  // Vietnamese provinces: a border commune's centroid can land inside a
  // neighbouring country's polygon, which is how Xã Hoành Mô was attributed to
  // Guangxi.
  const communes = await col.find({ level: 'commune', provinceName: null }).toArray();
  let filled = 0;
  const unresolved = [];
  for (const c of communes) {
    // Polygon -> coordinates[0] is the ring; MultiPolygon -> coordinates[0][0].
    const ring = c.geometry.type === 'MultiPolygon'
      ? c.geometry.coordinates[0]?.[0]
      : c.geometry.coordinates[0];
    if (!ring?.length) continue;
    const [cx, cy] = centroid(ring);
    let prov = await col.findOne({
      level: 'province',
      name: VN_PROVINCE,
      geometry: { $geoIntersects: { $geometry: { type: 'Point', coordinates: [cx, cy] } } },
    });
    // A mean-of-vertices centroid can fall outside a concave or coastal commune,
    // so fall back to intersecting the commune outline itself.
    if (!prov) {
      prov = await col.findOne({
        level: 'province',
        name: VN_PROVINCE,
        geometry: { $geoIntersects: { $geometry: c.geometry } },
      });
    }
    if (prov) {
      await col.updateOne({ _id: c._id }, { $set: { provinceName: prov.name } });
      filled++;
    } else {
      unresolved.push(`${c.name} (osmId ${c.osmId})`);
    }
  }
  console.log(`[commune] backfilled provinceName for ${filled}/${communes.length}`);
  // Surface gaps rather than leaving silent nulls: an unresolved commune is
  // invisible in the picker, so it must be diagnosable.
  if (unresolved.length) {
    console.warn(`[commune] UNRESOLVED province for ${unresolved.length}:`);
    for (const u of unresolved) console.warn(`  ${u}`);
  }

  const counts = await col.aggregate([{ $group: { _id: '$level', n: { $sum: 1 } } }]).toArray();
  console.log('Final counts:', JSON.stringify(counts));
  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});