/**
 * Crawl Wikipedia article summaries for Vietnam communes.
 *
 * Reads communes from MongoDB admin_boundaries collection,
 * attempts to find a matching Vietnamese Wikipedia page using
 * 3-strategy fallback search.
 *
 * Output: src/scripts/data/wiki-communes-raw.json
 *
 * Usage: npx tsx src/scripts/crawl-wikipedia-communes.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMongo, getDb } from '../db/mongo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RATE_LIMIT_MS = 100; // 10 req/s = 100ms between requests
const WIKI_REST = 'https://vi.wikipedia.org/api/rest_v1/page/summary';
const WIKI_API = 'https://vi.wikipedia.org/w/api.php';

export interface WikiArticle {
  communeName: string;
  provinceName: string;
  title: string;
  summary: string;
  content: string;
  sourceUrl: string;
  strategy: number; // which strategy found it (1, 2, or 3)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function encodeWikiTitle(title: string): string {
  // Wikipedia uses underscore-separated titles
  return encodeURIComponent(title.replace(/ /g, '_'));
}

interface WikiSummaryResponse {
  type?: string;
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

async function fetchSummary(title: string): Promise<WikiSummaryResponse | null> {
  try {
    const url = `${WIKI_REST}/${encodeWikiTitle(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TravelVietPlaner/1.0 (https://waki.autos)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as WikiSummaryResponse;
    // Reject disambiguation pages
    if (data.type === 'disambiguation') return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchExtract(title: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      titles: title,
      format: 'json',
      redirects: '1',
    });
    const res = await fetch(`${WIKI_API}?${params}`, {
      headers: { 'User-Agent': 'TravelVietPlaner/1.0 (https://waki.autos)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { query?: { pages?: Record<string, { extract?: string }> } };
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    if (!page || !page.extract || page.extract.trim().length < 50) return null;
    return page.extract.trim();
  } catch {
    return null;
  }
}

// Strip "Xã ", "Phường ", "Thị trấn " prefix for bare name search
function bareName(name: string): string {
  return name.replace(/^(Xã|Phường|Thị trấn|Thị xã)\s+/, '');
}

// Strip "Tỉnh " / "Thành phố " prefix from province
function bareProvince(name: string): string {
  return name.replace(/^(Tỉnh|Thành phố)\s+/, '');
}

async function findWikiArticle(
  communeName: string,
  provinceName: string,
): Promise<WikiArticle | null> {
  const bare = bareName(communeName);
  const prov = bareProvince(provinceName);

  // Strategy 1: "Tên_xã,_Tỉnh" format
  const title1 = `${bare}, ${prov}`;
  const s1 = await fetchSummary(title1);
  if (s1?.extract && s1.extract.length > 100) {
    const content = await fetchExtract(title1) ?? s1.extract;
    return {
      communeName,
      provinceName,
      title: s1.title ?? title1,
      summary: s1.extract.slice(0, 500),
      content,
      sourceUrl: s1.content_urls?.desktop?.page ?? `https://vi.wikipedia.org/wiki/${encodeWikiTitle(title1)}`,
      strategy: 1,
    };
  }
  await sleep(RATE_LIMIT_MS);

  // Strategy 2: "Tên_xã_(xã)" / "(phường)" disambiguation format
  const adminType = communeName.match(/^(Xã|Phường|Thị trấn)/)?.[1]?.toLowerCase() ?? 'xã';
  const title2 = `${bare} (${adminType})`;
  const s2 = await fetchSummary(title2);
  if (s2?.extract && s2.extract.length > 100) {
    const content = await fetchExtract(title2) ?? s2.extract;
    return {
      communeName,
      provinceName,
      title: s2.title ?? title2,
      summary: s2.extract.slice(0, 500),
      content,
      sourceUrl: s2.content_urls?.desktop?.page ?? `https://vi.wikipedia.org/wiki/${encodeWikiTitle(title2)}`,
      strategy: 2,
    };
  }
  await sleep(RATE_LIMIT_MS);

  // Strategy 3: bare name only (risky but catches some cases)
  const s3 = await fetchSummary(bare);
  if (s3?.extract && s3.extract.length > 100 && s3.type !== 'disambiguation') {
    // Extra validation: summary should mention province name to avoid false matches
    if (s3.extract.includes(prov) || s3.extract.includes(bare)) {
      const content = await fetchExtract(bare) ?? s3.extract;
      return {
        communeName,
        provinceName,
        title: s3.title ?? bare,
        summary: s3.extract.slice(0, 500),
        content,
        sourceUrl: s3.content_urls?.desktop?.page ?? `https://vi.wikipedia.org/wiki/${encodeWikiTitle(bare)}`,
        strategy: 3,
      };
    }
  }

  return null;
}

async function main() {
  await connectMongo();
  const db = getDb();
  const outDir = join(__dirname, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'wiki-communes-raw.json');

  // Load all communes from admin_boundaries
  const communes = await db
    .collection('admin_boundaries')
    .find({ level: 'commune' }, { projection: { name: 1, provinceName: 1 } })
    .toArray();

  console.log(`Found ${communes.length} communes to process`);

  const articles: WikiArticle[] = [];
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < communes.length; i++) {
    const commune = communes[i];
    const communeName = commune.name as string;
    const provinceName = commune.provinceName as string;

    if (i > 0 && i % 100 === 0) {
      const pct = ((found / (found + notFound)) * 100).toFixed(1);
      console.log(`[${i}/${communes.length}] found=${found} miss=${notFound} coverage=${pct}%`);
    }

    process.stdout.write(`  ${communeName} (${provinceName})... `);

    const article = await findWikiArticle(communeName, provinceName);
    if (article) {
      articles.push(article);
      found++;
      console.log(`✓ (strategy ${article.strategy})`);
    } else {
      notFound++;
      process.stdout.write('✗\n');
    }

    // Rate limit: 100ms between communes (each commune does up to 3 requests internally)
    await sleep(RATE_LIMIT_MS);
  }

  writeFileSync(outPath, JSON.stringify(articles, null, 2), 'utf-8');

  const coverage = ((found / communes.length) * 100).toFixed(1);
  console.log(`\nDone. ${found}/${communes.length} communes found (${coverage}% coverage)`);
  console.log(`Output: ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Wikipedia crawl failed:', err);
  process.exit(1);
});
