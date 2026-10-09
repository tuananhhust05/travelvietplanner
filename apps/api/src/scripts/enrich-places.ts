/**
 * Enrich published+featured places in MongoDB:
 *   1. Download HD cover image from Wikimedia → save to /data/uploads/places/<slug>.jpg
 *   2. Paraphrase Wikipedia content into a Vietnamese travel blog via Gemini API
 *
 * Updates:
 *   - places.media.coverUrl / places.media.gallery
 *   - places.description.vi (first 500 chars of paraphrased text)
 *   - place_articles.content (full paraphrased text)
 *
 * Usage: npx tsx src/scripts/enrich-places.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { connectMongo, getDb } from '../db/mongo.js';
import { config } from '../config.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

const WIKI_REST     = 'https://vi.wikipedia.org/api/rest_v1/page/summary';
const WIKI_RATE_MS  = 1_000;   // 1 req/s for Wikimedia
const GEMINI_RATE_MS = 2_000;  // 2 s between Gemini calls

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function encodeWikiTitle(title: string): string {
  return encodeURIComponent(title.replace(/ /g, '_'));
}

// ---------------------------------------------------------------------------
// Wikimedia: fetch originalimage.source (HD)
// ---------------------------------------------------------------------------
interface WikiSummary {
  type?: string;
  originalimage?: { source?: string };
}

async function fetchWikiOriginalImage(title: string): Promise<string | null> {
  try {
    const url = `${WIKI_REST}/${encodeWikiTitle(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TravelVietPlaner/1.0 (https://waki.autos)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as WikiSummary;
    if (data.type === 'disambiguation') return null;
    return data.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Download image binary
// ---------------------------------------------------------------------------
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TravelVietPlaner/1.0 (https://waki.autos)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gemini REST: paraphrase Wikipedia content → Vietnamese travel blog
// ---------------------------------------------------------------------------
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

async function paraphraseWithGemini(content: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const systemInstruction =
    'Bạn là travel writer người Việt. Viết lại đoạn văn sau thành bài giới thiệu ' +
    'địa điểm du lịch hấp dẫn, gần gũi, truyền cảm hứng. Khoảng 300-400 chữ tiếng Việt. ' +
    'Không dùng cấu trúc Wikipedia. Không đề cập nguồn. Không bịa thông tin mới.';

  const prompt = `${systemInstruction}\n\n${content}`;

  try {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      process.stdout.write(`[Gemini ${res.status}] ${errText.slice(0, 120)}\n`);
      return null;
    }

    const data = (await res.json()) as GeminiResponse;
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) {
    process.stdout.write(`[Gemini error] ${String(err).slice(0, 120)}\n`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!GEMINI_API_KEY) {
    console.warn('Warning: GEMINI_API_KEY not set — Gemini paraphrase will be skipped.');
  }

  await connectMongo();
  const db = getDb();

  const placesCol   = db.collection('places');
  const articlesCol = db.collection('place_articles');

  // Load all published + featured places
  const places = await placesCol
    .find({ status: 'published', featured: true })
    .project({ _id: 1, slug: 1 })
    .toArray();

  console.log(`Found ${places.length} published+featured places`);

  // Ensure upload directory exists
  const uploadDir = join(config.uploads.dir, 'places');
  mkdirSync(uploadDir, { recursive: true });

  let success = 0;
  let skipped = 0;
  let errors  = 0;

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const slug  = place.slug as string;

    process.stdout.write(`[${i + 1}/${places.length}] ${slug}... `);

    try {
      // Fetch matching article (communeSlug = place slug, vi)
      const article = await articlesCol.findOne({ communeSlug: slug, lang: 'vi' });
      if (!article?.title) {
        process.stdout.write('✗ (no article)\n');
        skipped++;
        continue;
      }

      const wikiTitle = article.title as string;
      const content   = (article.content as string | null | undefined) ?? '';

      const updates: string[] = [];

      // ------------------------------------------------------------------
      // Step 1: Wikimedia HD image → download → save to disk → update DB
      // ------------------------------------------------------------------
      const imageUrl = await fetchWikiOriginalImage(wikiTitle);
      await sleep(WIKI_RATE_MS);

      if (imageUrl) {
        const imgBuffer = await downloadImage(imageUrl);
        if (imgBuffer) {
          const filePath   = join(uploadDir, `${slug}.jpg`);
          const publicPath = `/file/places/${slug}.jpg`;

          writeFileSync(filePath, imgBuffer);

          await placesCol.updateOne(
            { slug },
            { $set: { 'media.coverUrl': publicPath, 'media.gallery': [publicPath] } },
          );
          updates.push('img');
        }
      }

      // ------------------------------------------------------------------
      // Step 2: Gemini paraphrase → update description + article content
      // ------------------------------------------------------------------
      if (content.trim().length > 50) {
        const paraphrased = await paraphraseWithGemini(content);
        await sleep(GEMINI_RATE_MS);

        if (paraphrased) {
          const summary = paraphrased.slice(0, 500);
          const now     = new Date();

          await placesCol.updateOne(
            { slug },
            { $set: { 'description.vi': summary, updatedAt: now } },
          );
          await articlesCol.updateOne(
            { communeSlug: slug, lang: 'vi' },
            { $set: { content: paraphrased, updatedAt: now } },
          );
          updates.push('desc');
        }
      }

      if (updates.length > 0) {
        process.stdout.write(`✓ (${updates.join(', ')})\n`);
        success++;
      } else {
        process.stdout.write('~ (no updates — no image and content too short or Gemini skipped)\n');
        skipped++;
      }
    } catch (err) {
      process.stdout.write(`✗ (${String(err).slice(0, 100)})\n`);
      errors++;
    }
  }

  console.log(`\nDone. success=${success} skipped=${skipped} errors=${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Enrich failed:', err);
  process.exit(1);
});
