/**
 * Import Wikipedia articles from wiki-communes-raw.json into MongoDB place_articles collection.
 *
 * Usage: npx tsx src/scripts/import-place-articles.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMongo, getDb } from '../db/mongo.js';
import type { WikiArticle } from './crawl-wikipedia-communes.js';

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

  const inPath = join(__dirname, 'data', 'wiki-communes-raw.json');
  const articles: WikiArticle[] = JSON.parse(readFileSync(inPath, 'utf-8'));
  console.log(`Loaded ${articles.length} Wikipedia articles from ${inPath}`);

  const articlesCol = db.collection('place_articles');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const article of articles) {
    try {
      const communeSlug = slugify(article.communeName);
      const now = new Date();

      const result = await articlesCol.findOneAndUpdate(
        { communeSlug, lang: 'vi' },
        {
          $set: {
            communeName: article.communeName,
            provinceName: article.provinceName,
            communeSlug,
            lang: 'vi',
            source: 'wikipedia',
            sourceUrl: article.sourceUrl,
            title: article.title,
            summary: article.summary,
            content: article.content,
            fetchedAt: new Date(),
            status: 'published',
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );

      if (result) {
        updated++;
      } else {
        inserted++;
      }

      if ((inserted + updated) % 100 === 0) {
        console.log(`  ${inserted + updated} processed...`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) console.error(`  Error on ${article.communeName}: ${String(err)}`);
    }
  }

  const total = articles.length;
  const matched = inserted + updated;
  const coverage = ((matched / total) * 100).toFixed(1);

  console.log(`\nDone.`);
  console.log(`  inserted=${inserted} updated=${updated}`);
  console.log(`  errors=${errors}`);
  console.log(`  coverage=${coverage}% (${matched}/${total})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
