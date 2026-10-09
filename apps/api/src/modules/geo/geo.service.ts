import { getDb } from '../../db/mongo.js';
import { getRedis } from '../../db/redis.js';
import { ApiError } from '../../lib/http.js';

export interface AdminAddress {
  commune: string;
  province: string;
  label: string;
}

const CACHE_TTL_SEC = 7 * 24 * 3600; // 7 days

// Every Vietnamese province is named "Tỉnh X" or "Thành phố X". The OSM import
// also pulled in cross-border relations (e.g. Guangxi), which must never surface
// in a Vietnam-only picker or be stored as a post address.
const VN_PROVINCE = /^(Tỉnh|Thành phố)\s/;

function cacheKey(lat: number, lng: number): string {
  // Round to ~11m precision so nearby posts share a cache entry.
  return `geo:addr:${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Resolve a lat/lng point to a Vietnam admin address (commune + province).
 * Boundaries are stored in the `admin_boundaries` collection (2dsphere index),
 * sourced from OpenStreetMap (ODbL). Result is cached in Redis keyed by the
 * rounded coordinate so repeated lookups for the same area are cheap.
 */
export async function resolveAddress(
  lat: number,
  lng: number,
): Promise<AdminAddress | null> {
  const redis = getRedis();
  const key = cacheKey(lat, lng);

  const cached = await redis.get(key);
  if (cached) {
    try {
      return JSON.parse(cached) as AdminAddress;
    } catch {
      // ignore corrupt cache entry, fall through to lookup
    }
  }

  const db = getDb();
  // Constrain to Vietnamese provinces in the query itself: a border point can sit
  // inside both a Vietnamese commune and an imported foreign relation, and we want
  // the Vietnamese one to win rather than losing the lookup entirely.
  const commune = await db.collection('admin_boundaries').findOne({
    level: 'commune',
    provinceName: VN_PROVINCE,
    geometry: {
      $geoIntersects: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
      },
    },
  });

  if (!commune) return null;

  const result: AdminAddress = {
    commune: commune.name,
    province: commune.provinceName,
    label: `${commune.name}, ${commune.provinceName}`,
  };

  await redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL_SEC);
  return result;
}

// Boundary data is static between imports, so lists can be cached hard.
const LIST_TTL_SEC = 24 * 3600;

async function cachedList(key: string, load: () => Promise<string[]>): Promise<string[]> {
  const redis = getRedis();
  const cached = await redis.get(key);
  if (cached) {
    try {
      return JSON.parse(cached) as string[];
    } catch {
      // ignore corrupt cache entry
    }
  }
  const names = await load();
  await redis.set(key, JSON.stringify(names), 'EX', LIST_TTL_SEC);
  return names;
}

/** All province names, sorted for Vietnamese collation. */
export async function listProvinces(): Promise<string[]> {
  return cachedList('geo:provinces', async () => {
    const names = (await getDb()
      .collection('admin_boundaries')
      .distinct('name', { level: 'province' })) as string[];
    return names
      .filter((n) => n && VN_PROVINCE.test(n))
      .sort((a, b) => a.localeCompare(b, 'vi'));
  });
}

/** Commune names inside one province. Empty when the province is unknown. */
export async function listCommunes(province: string): Promise<string[]> {
  if (!VN_PROVINCE.test(province)) return [];
  return cachedList(`geo:communes:${province}`, async () => {
    const names = (await getDb()
      .collection('admin_boundaries')
      .distinct('name', { level: 'commune', provinceName: province })) as string[];
    return names.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
  });
}

/**
 * Validate a province/commune pair against the boundary data and return the
 * canonical address. Returns null when the pair does not exist, so callers can
 * reject client-supplied names instead of trusting them.
 */
export async function resolveByNames(
  province: string,
  commune: string,
): Promise<AdminAddress | null> {
  if (!VN_PROVINCE.test(province)) return null;
  const doc = await getDb().collection('admin_boundaries').findOne(
    { level: 'commune', name: commune, provinceName: province },
    { projection: { name: 1, provinceName: 1 } },
  );
  if (!doc) return null;
  return {
    commune: doc.name,
    province: doc.provinceName,
    label: `${doc.name}, ${doc.provinceName}`,
  };
}

// Communes are named "Xã X", "Phường X" or "Đặc khu X" after the 2025 reform.
const VN_COMMUNE = /^(Xã|Phường|Đặc khu)\s/;

function invalidAddress(field: string, claimed: string): ApiError {
  return new ApiError(
    422,
    'invalid_address',
    `Địa chỉ không hợp lệ: "${claimed}" không phải là đơn vị hành chính có thật. ` +
      'Vui lòng chọn lại tỉnh/thành phố và xã/phường từ danh sách.',
    { field, claimed },
  );
}

/**
 * Validate a composed address string of the form `[street, ]commune, province`
 * against the boundary data, returning the value that should be stored.
 *
 * The web form builds these from the cascading picker, but the API must not
 * trust that: a crafted request could otherwise persist an administrative unit
 * that does not exist, which is a legal exposure. At the same time the database
 * still holds legacy free text ("Hà Nội, Việt Nam", "Đà Nẵng") typed before the
 * picker existed, and those users must stay able to edit the rest of their
 * profile — so we only reject strings that *claim* to be canonical:
 *
 *  - trailing segment province-shaped and the one before it commune-shaped
 *      -> the pair must exist in `admin_boundaries`
 *  - trailing segment province-shaped only (no commune-shaped segment)
 *      -> the province alone must exist
 *  - anything else -> legacy free text, returned untouched
 *
 * A validated value is recomposed from the canonical names, which normalises
 * separators/spacing. The street part is always carried through, never dropped.
 */
export async function validateAddressString(raw: string, field: string): Promise<string> {
  const whole = raw.trim();
  if (!whole) return whole;

  const parts = whole
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  // A shape check on the trailing segment alone can be evaded by appending any
  // non-province-shaped suffix ("Tỉnh Đài Loan, Việt Nam"), which would smuggle a
  // fabricated unit name through as "legacy free text". So every province-shaped
  // segment, wherever it sits, has to name a real province. Legacy values carry no
  // "Tỉnh "/"Thành phố " prefix at all ("Hà Nội, Việt Nam") and are unaffected.
  for (const part of parts.slice(0, -1)) {
    if (!VN_PROVINCE.test(part)) continue;
    if (!(await listProvinces()).includes(part)) throw invalidAddress(field, part);
  }

  const province = parts[parts.length - 1] ?? '';
  // No province-shaped tail: legacy free text, leave exactly as the user typed it.
  if (!VN_PROVINCE.test(province)) return whole;

  const commune = (parts.length >= 2 ? parts[parts.length - 2] : '') ?? '';
  if (commune && VN_COMMUNE.test(commune)) {
    const resolved = await resolveByNames(province, commune);
    if (!resolved) throw invalidAddress(field, `${commune}, ${province}`);
    const street = parts.slice(0, -2).join(', ');
    return [street, resolved.commune, resolved.province].filter(Boolean).join(', ');
  }

  // Province-shaped tail with no commune (e.g. "Thành phố Đà Nẵng", or a street
  // followed by a province). The province name itself is still an assertion
  // about a real administrative unit, so it has to check out.
  const provinces = await listProvinces();
  if (!provinces.includes(province)) throw invalidAddress(field, province);
  const street = parts.slice(0, -1).join(', ');
  return [street, province].filter(Boolean).join(', ');
}