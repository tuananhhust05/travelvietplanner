import { ObjectId, type Db } from 'mongodb';
import { getDb } from '../../db/mongo.js';

// Region mapping: province name -> region label
const REGION_MAP: Record<string, string> = {
  'Thành phố Hà Nội': 'Miền Bắc',
  'Thành phố Hải Phòng': 'Miền Bắc',
  'Tỉnh Hà Giang': 'Miền Bắc',
  'Tỉnh Cao Bằng': 'Miền Bắc',
  'Tỉnh Bắc Kạn': 'Miền Bắc',
  'Tỉnh Tuyên Quang': 'Miền Bắc',
  'Tỉnh Lào Cai': 'Miền Bắc',
  'Tỉnh Điện Biên': 'Miền Bắc',
  'Tỉnh Lai Châu': 'Miền Bắc',
  'Tỉnh Sơn La': 'Miền Bắc',
  'Tỉnh Yên Bái': 'Miền Bắc',
  'Tỉnh Hoà Bình': 'Miền Bắc',
  'Tỉnh Thái Nguyên': 'Miền Bắc',
  'Tỉnh Lạng Sơn': 'Miền Bắc',
  'Tỉnh Quảng Ninh': 'Miền Bắc',
  'Tỉnh Bắc Giang': 'Miền Bắc',
  'Tỉnh Phú Thọ': 'Miền Bắc',
  'Tỉnh Vĩnh Phúc': 'Miền Bắc',
  'Tỉnh Bắc Ninh': 'Miền Bắc',
  'Tỉnh Hải Dương': 'Miền Bắc',
  'Tỉnh Hưng Yên': 'Miền Bắc',
  'Tỉnh Thái Bình': 'Miền Bắc',
  'Tỉnh Hà Nam': 'Miền Bắc',
  'Tỉnh Nam Định': 'Miền Bắc',
  'Tỉnh Ninh Bình': 'Miền Bắc',
  'Thành phố Huế': 'Miền Trung',
  'Tỉnh Thanh Hoá': 'Miền Trung',
  'Tỉnh Nghệ An': 'Miền Trung',
  'Tỉnh Hà Tĩnh': 'Miền Trung',
  'Tỉnh Quảng Bình': 'Miền Trung',
  'Tỉnh Quảng Trị': 'Miền Trung',
  'Thành phố Đà Nẵng': 'Miền Trung',
  'Tỉnh Quảng Nam': 'Miền Trung',
  'Tỉnh Quảng Ngãi': 'Miền Trung',
  'Tỉnh Bình Định': 'Miền Trung',
  'Tỉnh Phú Yên': 'Miền Trung',
  'Tỉnh Khánh Hoà': 'Miền Trung',
  'Tỉnh Ninh Thuận': 'Miền Trung',
  'Tỉnh Bình Thuận': 'Miền Trung',
  'Tỉnh Kon Tum': 'Miền Trung',
  'Tỉnh Gia Lai': 'Miền Trung',
  'Tỉnh Đắk Lắk': 'Miền Trung',
  'Tỉnh Đắk Nông': 'Miền Trung',
  'Tỉnh Lâm Đồng': 'Miền Trung',
  'Thành phố Hồ Chí Minh': 'Miền Nam',
  'Thành phố Cần Thơ': 'Miền Nam',
  'Tỉnh Bình Phước': 'Miền Nam',
  'Tỉnh Tây Ninh': 'Miền Nam',
  'Tỉnh Bình Dương': 'Miền Nam',
  'Tỉnh Đồng Nai': 'Miền Nam',
  'Tỉnh Bà Rịa - Vũng Tàu': 'Miền Nam',
  'Tỉnh Long An': 'Miền Nam',
  'Tỉnh Tiền Giang': 'Miền Nam',
  'Tỉnh Bến Tre': 'Miền Nam',
  'Tỉnh Trà Vinh': 'Miền Nam',
  'Tỉnh Vĩnh Long': 'Miền Nam',
  'Tỉnh Đồng Tháp': 'Miền Nam',
  'Tỉnh An Giang': 'Miền Nam',
  'Tỉnh Kiên Giang': 'Miền Nam',
  'Tỉnh Hậu Giang': 'Miền Nam',
  'Tỉnh Sóc Trăng': 'Miền Nam',
  'Tỉnh Bạc Liêu': 'Miền Nam',
  'Tỉnh Cà Mau': 'Miền Nam',
};

export function getRegion(provinceName: string | null | undefined): string {
  if (!provinceName) return '';
  return REGION_MAP[provinceName] ?? '';
}

export interface PlaceListItem {
  id: string;
  slug: string;
  name: { vi: string; en: string };
  type: string;
  region: string;
  geo: { lat: number; lng: number } | null;
  media: { coverUrl: string | null };
  description: { vi: string };
  province: string;
}

export interface PlaceDetail extends PlaceListItem {
  boundingBox: unknown;
  name: { vi: string; en: string };
  description: { vi: string; en: string };
  media: { coverUrl: string | null; gallery: string[] };
  bestSeason: unknown[];
  stats: { postCount: number };
  article: { summary: string | null; sourceUrl: string | null };
}

export interface ListPlacesOptions {
  type?: string;
  province?: string;
  region?: string;
  limit?: number;
  offset?: number;
}

export async function listPlaces(opts: ListPlacesOptions): Promise<{ items: PlaceListItem[]; total: number }> {
  const db: Db = getDb();
  const { type, province, limit = 20, offset = 0 } = opts;
  const cap = Math.min(limit, 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { status: 'published' };

  // Default listing (no specific filter): only surface places with content —
  // featured destinations or those with a description. Hides raw OSM POIs that
  // have no description/cover.
  if (!type && !province && !opts.region) {
    filter.$or = [{ featured: true }, { 'description.vi': { $ne: '' } }];
  }

  if (type) filter['type'] = type;

  if (province) {
    // province can be a name string — find the province place and use its _id in ancestors
    const provDoc = await db.collection('places').findOne({ 'name.vi': province, type: 'province' });
    if (provDoc) {
      filter['ancestors'] = provDoc._id;
    } else {
      // fallback: match by embedded province field
      filter['province'] = province;
    }
  }

  if (opts.region) {
    // resolve province names for this region and filter by ancestors
    const provinceNames = Object.entries(REGION_MAP)
      .filter(([, r]) => r === opts.region)
      .map(([name]) => name);
    const provDocs = await db
      .collection('places')
      .find({ 'name.vi': { $in: provinceNames }, type: 'province' })
      .project({ _id: 1 })
      .toArray();
    if (provDocs.length > 0) {
      filter['ancestors'] = { $in: provDocs.map((p) => p._id) };
    } else {
      // No province-type places exist yet — fall back to the stored province name
      filter['province'] = { $in: provinceNames };
    }
  }

  const [docs, total] = await Promise.all([
    db
      .collection('places')
      .find(filter)
      .sort({ featured: -1, 'stats.postCount': -1, _id: 1 })
      .skip(offset)
      .limit(cap)
      .toArray(),
    db.collection('places').countDocuments(filter),
  ]);

  // fetch province names for each doc via ancestors
  const ancestorIds = [...new Set(docs.flatMap((d) => (d.ancestors as ObjectId[] | undefined) ?? []).map(String))];
  const provinceMap = new Map<string, string>();
  if (ancestorIds.length > 0) {
    const provDocs = await db
      .collection('places')
      .find({ _id: { $in: ancestorIds.map((id) => new ObjectId(id)) }, type: 'province' })
      .project({ _id: 1, 'name.vi': 1 })
      .toArray();
    for (const p of provDocs) {
      provinceMap.set(String(p._id), p.name?.vi ?? '');
    }
  }

  const items: PlaceListItem[] = docs.map((d) => {
    const firstAncestor = ((d.ancestors as ObjectId[] | undefined) ?? [])[0];
    const provinceName = firstAncestor ? (provinceMap.get(String(firstAncestor)) ?? '') : (d.province as string | undefined) ?? '';
    const coords = d.geo?.coordinates as [number, number] | undefined;
    return {
      id: String(d._id),
      slug: d.slug as string,
      name: { vi: d.name?.vi ?? '', en: d.name?.en ?? '' },
      type: d.type as string,
      region: getRegion(provinceName),
      geo: coords ? { lat: coords[1], lng: coords[0] } : null,
      media: { coverUrl: d.media?.coverUrl ?? null },
      description: { vi: d.description?.vi ?? '' },
      province: provinceName,
    };
  });

  return { items, total };
}

export async function getPlaceBySlug(slug: string): Promise<PlaceDetail | null> {
  const db: Db = getDb();

  const doc = await db.collection('places').findOne({ slug, status: 'published' });
  if (!doc) return null;

  // resolve province name
  const firstAncestor = ((doc.ancestors as ObjectId[] | undefined) ?? [])[0];
  let provinceName = '';
  if (firstAncestor) {
    const provDoc = await db.collection('places').findOne({ _id: firstAncestor, type: 'province' }, { projection: { 'name.vi': 1 } });
    provinceName = provDoc?.name?.vi ?? '';
  }
  if (!provinceName) provinceName = (doc.province as string | undefined) ?? '';

  // fetch article
  const article = await db.collection('place_articles').findOne({ placeId: doc._id, lang: 'vi', status: 'published' }, { projection: { summary: 1, sourceUrl: 1 } });

  const coords = doc.geo?.coordinates as [number, number] | undefined;

  return {
    id: String(doc._id),
    slug: doc.slug as string,
    name: { vi: doc.name?.vi ?? '', en: doc.name?.en ?? '' },
    type: doc.type as string,
    region: getRegion(provinceName),
    geo: coords ? { lat: coords[1], lng: coords[0] } : null,
    boundingBox: doc.boundingBox ?? null,
    description: { vi: doc.description?.vi ?? '', en: doc.description?.en ?? '' },
    media: { coverUrl: doc.media?.coverUrl ?? null, gallery: (doc.media?.gallery as string[]) ?? [] },
    bestSeason: (doc.bestSeason as unknown[]) ?? [],
    stats: { postCount: doc.stats?.postCount ?? 0 },
    province: provinceName,
    article: {
      summary: article?.summary ?? null,
      sourceUrl: article?.sourceUrl ?? null,
    },
  };
}
