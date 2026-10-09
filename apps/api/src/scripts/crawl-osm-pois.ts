/**
 * Crawl Vietnam POIs from OpenStreetMap Overpass API.
 *
 * Queries per-province bounding box to avoid global timeout.
 * Output: src/scripts/data/osm-pois-raw.json
 *
 * Usage: npx tsx src/scripts/crawl-osm-pois.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const RATE_LIMIT_MS = 2000;

// OSM tags to crawl and their mapping to places.type
const TAG_QUERIES = [
  { tag: 'tourism=attraction',  type: 'attraction' },
  { tag: 'tourism=museum',      type: 'landmark' },
  { tag: 'tourism=viewpoint',   type: 'attraction' },
  { tag: 'tourism=beach',       type: 'beach' },
  { tag: 'tourism=theme_park',  type: 'attraction' },
  { tag: 'natural=peak',        type: 'mountain' },
  { tag: 'natural=island',      type: 'island' },
  { tag: 'leisure=park',        type: 'park' },
  { tag: 'historic=monument',   type: 'landmark' },
  { tag: 'historic=memorial',   type: 'landmark' },
  { tag: 'historic=ruins',      type: 'landmark' },
  { tag: 'historic=castle',     type: 'landmark' },
];

// 34 canonical provinces with approximate bounding boxes [south, west, north, east]
const PROVINCES: { name: string; bbox: [number, number, number, number] }[] = [
  { name: 'Thành phố Hà Nội',       bbox: [20.56, 105.28, 21.39, 106.02] },
  { name: 'Thành phố Hải Phòng',    bbox: [20.52, 106.44, 21.11, 107.15] },
  { name: 'Thành phố Huế',          bbox: [15.97, 107.02, 16.83, 108.21] },
  { name: 'Thành phố Đà Nẵng',      bbox: [15.80, 107.85, 16.30, 108.27] },
  { name: 'Thành phố Hồ Chí Minh',  bbox: [10.35, 106.36, 11.16, 107.03] },
  { name: 'Thành phố Cần Thơ',      bbox: [9.72, 105.37, 10.42, 105.93] },
  { name: 'Tỉnh Hà Giang',          bbox: [22.14, 104.33, 23.39, 105.57] },
  { name: 'Tỉnh Cao Bằng',          bbox: [22.36, 105.27, 23.14, 106.81] },
  { name: 'Tỉnh Bắc Kạn',           bbox: [21.85, 105.29, 22.75, 106.15] },
  { name: 'Tỉnh Tuyên Quang',       bbox: [21.49, 104.78, 22.67, 105.64] },
  { name: 'Tỉnh Lào Cai',           bbox: [21.95, 103.47, 23.00, 104.75] },
  { name: 'Tỉnh Điện Biên',         bbox: [20.65, 102.14, 22.11, 103.67] },
  { name: 'Tỉnh Lai Châu',          bbox: [21.69, 102.11, 22.88, 103.54] },
  { name: 'Tỉnh Sơn La',            bbox: [20.39, 103.18, 21.84, 105.02] },
  { name: 'Tỉnh Yên Bái',           bbox: [21.38, 104.01, 22.34, 105.07] },
  { name: 'Tỉnh Hoà Bình',          bbox: [20.24, 104.67, 21.30, 105.75] },
  { name: 'Tỉnh Thái Nguyên',       bbox: [21.36, 105.48, 22.15, 106.34] },
  { name: 'Tỉnh Lạng Sơn',          bbox: [21.38, 106.08, 22.57, 107.21] },
  { name: 'Tỉnh Quảng Ninh',        bbox: [20.56, 106.27, 21.85, 108.42] },
  { name: 'Tỉnh Bắc Giang',         bbox: [21.14, 105.87, 21.77, 107.04] },
  { name: 'Tỉnh Phú Thọ',           bbox: [20.92, 104.65, 21.80, 105.48] },
  { name: 'Tỉnh Vĩnh Phúc',         bbox: [21.10, 105.30, 21.55, 105.89] },
  { name: 'Tỉnh Bắc Ninh',          bbox: [20.94, 105.97, 21.28, 106.27] },
  { name: 'Tỉnh Hải Dương',         bbox: [20.73, 106.22, 21.15, 106.65] },
  { name: 'Tỉnh Hưng Yên',          bbox: [20.59, 105.90, 21.05, 106.28] },
  { name: 'Tỉnh Thái Bình',         bbox: [20.24, 106.11, 20.72, 106.64] },
  { name: 'Tỉnh Hà Nam',            bbox: [20.32, 105.76, 20.75, 106.14] },
  { name: 'Tỉnh Nam Định',           bbox: [20.01, 106.04, 20.52, 106.52] },
  { name: 'Tỉnh Ninh Bình',         bbox: [19.87, 105.64, 20.46, 106.17] },
  { name: 'Tỉnh Thanh Hoá',         bbox: [19.28, 104.50, 20.67, 106.07] },
  { name: 'Tỉnh Nghệ An',           bbox: [18.35, 103.79, 20.12, 105.80] },
  { name: 'Tỉnh Hà Tĩnh',           bbox: [17.70, 105.13, 18.73, 106.56] },
  { name: 'Tỉnh Quảng Bình',        bbox: [17.04, 105.59, 18.24, 107.02] },
  { name: 'Tỉnh Quảng Trị',         bbox: [16.52, 106.36, 17.24, 107.47] },
  { name: 'Tỉnh Quảng Nam',         bbox: [15.10, 107.19, 16.25, 108.66] },
  { name: 'Tỉnh Quảng Ngãi',        bbox: [14.70, 108.28, 15.48, 109.32] },
  { name: 'Tỉnh Bình Định',         bbox: [13.52, 108.55, 14.73, 109.49] },
  { name: 'Tỉnh Phú Yên',           bbox: [12.74, 108.63, 13.68, 109.47] },
  { name: 'Tỉnh Khánh Hoà',         bbox: [11.77, 108.53, 13.00, 109.50] },
  { name: 'Tỉnh Ninh Thuận',        bbox: [11.21, 108.42, 12.17, 109.17] },
  { name: 'Tỉnh Bình Thuận',        bbox: [10.37, 107.39, 11.73, 108.96] },
  { name: 'Tỉnh Kon Tum',           bbox: [13.64, 107.20, 15.40, 108.41] },
  { name: 'Tỉnh Gia Lai',           bbox: [12.98, 107.27, 14.65, 108.96] },
  { name: 'Tỉnh Đắk Lắk',           bbox: [12.07, 107.56, 13.43, 109.00] },
  { name: 'Tỉnh Đắk Nông',          bbox: [11.49, 107.19, 12.62, 108.23] },
  { name: 'Tỉnh Lâm Đồng',          bbox: [11.19, 107.42, 12.79, 108.80] },
  { name: 'Tỉnh Bình Phước',        bbox: [11.23, 106.49, 12.41, 107.54] },
  { name: 'Tỉnh Tây Ninh',          bbox: [10.88, 105.76, 11.91, 106.75] },
  { name: 'Tỉnh Bình Dương',        bbox: [10.75, 106.43, 11.40, 107.01] },
  { name: 'Tỉnh Đồng Nai',          bbox: [10.62, 106.73, 11.58, 107.65] },
  { name: 'Tỉnh Bà Rịa - Vũng Tàu', bbox: [10.14, 107.03, 10.88, 107.78] },
  { name: 'Tỉnh Long An',           bbox: [10.22, 105.55, 11.21, 106.58] },
  { name: 'Tỉnh Tiền Giang',        bbox: [10.11, 105.74, 10.72, 106.76] },
  { name: 'Tỉnh Bến Tre',           bbox: [9.73, 106.14, 10.41, 106.83] },
  { name: 'Tỉnh Trà Vinh',          bbox: [9.58, 105.97, 10.22, 106.69] },
  { name: 'Tỉnh Vĩnh Long',         bbox: [9.87, 105.56, 10.39, 106.17] },
  { name: 'Tỉnh Đồng Tháp',         bbox: [10.16, 105.20, 10.97, 106.03] },
  { name: 'Tỉnh An Giang',          bbox: [10.20, 104.86, 11.06, 105.68] },
  { name: 'Tỉnh Kiên Giang',        bbox: [9.25, 103.85, 10.69, 105.55] },
  { name: 'Tỉnh Hậu Giang',         bbox: [9.59, 105.30, 10.14, 106.10] },
  { name: 'Tỉnh Sóc Trăng',         bbox: [9.19, 105.52, 9.94, 106.42] },
  { name: 'Tỉnh Bạc Liêu',          bbox: [8.95, 105.22, 9.68, 105.96] },
  { name: 'Tỉnh Cà Mau',            bbox: [8.33, 104.59, 9.39, 105.39] },
];

export interface OsmPoi {
  osmId: number;
  osmType: 'node' | 'way' | 'relation';
  name: string;
  nameEn: string;
  type: string;
  lat: number;
  lng: number;
  provinceName: string;
  tags: Record<string, string>;
}

const VN_NAME = /^(Tỉnh|Thành phố|Đặc khu|Huyện|Quận|Thị xã|Thị trấn|Xã|Phường)\s/;

function isVietnamese(name: string): boolean {
  // Heuristic: contains Vietnamese diacritics or known VN admin prefix
  if (VN_NAME.test(name)) return true;
  return /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(name);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOverpass(query: string, retries = 4): Promise<unknown[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const mirror of MIRRORS) {
      try {
        const res = await fetch(mirror, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { elements?: unknown[] };
        if (Array.isArray(json.elements)) return json.elements;
        throw new Error('no elements in response');
      } catch (err) {
        lastErr = err;
        console.warn(`  mirror ${mirror} failed: ${String(err)}`);
      }
    }
    const backoff = 3000 * (attempt + 1);
    console.warn(`  retry ${attempt + 1}/${retries}, waiting ${backoff}ms...`);
    await sleep(backoff);
  }
  throw new Error(`Overpass fetch failed: ${String(lastErr)}`);
}

function getCentroid(el: Record<string, unknown>): { lat: number; lng: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && typeof (el.center as Record<string, unknown>).lat === 'number') {
    const c = el.center as Record<string, unknown>;
    return { lat: c.lat as number, lng: c.lon as number };
  }
  // compute centroid from bounds for ways
  if (el.bounds) {
    const b = el.bounds as Record<string, number>;
    return {
      lat: (b.minlat + b.maxlat) / 2,
      lng: (b.minlon + b.maxlon) / 2,
    };
  }
  return null;
}

async function crawlProvince(
  province: { name: string; bbox: [number, number, number, number] },
): Promise<OsmPoi[]> {
  const [s, w, n, e] = province.bbox;
  const bbox = `${s},${w},${n},${e}`;

  // Build union query for all tag types
  const tagFilters = TAG_QUERIES.map(({ tag }) => {
    const [k, v] = tag.split('=');
    return `  node["${k}"="${v}"](${bbox});\n  way["${k}"="${v}"](${bbox});\n  relation["${k}"="${v}"](${bbox});`;
  }).join('\n');

  const query = `[out:json][timeout:90];\n(\n${tagFilters}\n);\nout center tags;`;

  const elements = await fetchOverpass(query) as Record<string, unknown>[];

  const pois: OsmPoi[] = [];
  const seenIds = new Set<string>();

  for (const el of elements) {
    const tags = (el.tags ?? {}) as Record<string, string>;
    const name = tags['name:vi'] ?? tags['name'] ?? '';
    if (!name) continue;
    if (!isVietnamese(name)) continue;

    const centroid = getCentroid(el);
    if (!centroid) continue;

    // Determine type from tags
    let placeType = 'attraction';
    for (const { tag, type } of TAG_QUERIES) {
      const [k, v] = tag.split('=');
      if (tags[k] === v) { placeType = type; break; }
    }

    const osmType = el.type as 'node' | 'way' | 'relation';
    const osmId = el.id as number;
    const key = `${osmType}-${osmId}`;
    if (seenIds.has(key)) continue;
    seenIds.add(key);

    pois.push({
      osmId,
      osmType,
      name,
      nameEn: tags['name:en'] ?? '',
      type: placeType,
      lat: centroid.lat,
      lng: centroid.lng,
      provinceName: province.name,
      tags,
    });
  }

  return pois;
}

async function main() {
  const outDir = join(__dirname, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'osm-pois-raw.json');

  const allPois: OsmPoi[] = [];
  let totalProvinces = 0;

  console.log(`Starting OSM crawl for ${PROVINCES.length} provinces...`);

  for (const province of PROVINCES) {
    totalProvinces++;
    process.stdout.write(`[${totalProvinces}/${PROVINCES.length}] ${province.name}... `);
    try {
      const pois = await crawlProvince(province);
      allPois.push(...pois);
      console.log(`${pois.length} POIs`);
    } catch (err) {
      console.error(`FAILED: ${String(err)}`);
    }
    // Rate limit between provinces
    if (totalProvinces < PROVINCES.length) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Dedup by (name + approximate coordinates rounded to 3 decimal places)
  const dedupMap = new Map<string, OsmPoi>();
  for (const poi of allPois) {
    const key = `${poi.name}|${poi.lat.toFixed(3)}|${poi.lng.toFixed(3)}`;
    if (!dedupMap.has(key)) {
      dedupMap.set(key, poi);
    }
  }
  const deduped = Array.from(dedupMap.values());

  writeFileSync(outPath, JSON.stringify(deduped, null, 2), 'utf-8');
  console.log(`\nDone. ${allPois.length} raw → ${deduped.length} after dedup`);
  console.log(`Output: ${outPath}`);
}

main().catch((err) => {
  console.error('Crawl failed:', err);
  process.exit(1);
});
