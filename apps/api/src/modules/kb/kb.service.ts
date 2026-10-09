import fs from 'node:fs/promises';
import path from 'node:path';
import { ObjectId } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { config } from '../../config.js';
import { ingestDocument, deleteDocument as deleteRagDocument } from '../../lib/rag.js';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export interface CreateDocumentInput {
  title: string;
  fileUrl: string;
  mimeType: string;
  lang: 'vi' | 'en';
}

export async function createDocument(input: CreateDocumentInput) {
  const db = getDb();
  const now = new Date();
  const r = await db.collection('kbDocuments').insertOne({
    title: input.title,
    fileUrl: input.fileUrl,
    mimeType: input.mimeType,
    lang: input.lang,
    status: 'uploaded',
    chunkCount: 0,
    published: false,
    createdAt: now,
    updatedAt: now,
  });
  return { id: r.insertedId.toString() };
}

function chunkText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks.length ? chunks : [''];
}

export async function processDocument(id: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid document id');
  const doc = await db.collection('kbDocuments').findOne({ _id: new ObjectId(id) });
  if (!doc) throw new ApiError(404, 'not_found', 'Document not found');

  const filePath = path.join(config.uploads.dir, doc.fileUrl.replace('/file/', ''));
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    throw new ApiError(500, 'read_failed', 'Could not read file');
  }

  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
  await ingestDocument(id, doc.title, chunks.map((c) => ({ text: c, lang: doc.lang })));

  await db.collection('kbDocuments').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: 'processed', chunkCount: chunks.length, updatedAt: new Date() } },
  );
  return { chunks: chunks.length };
}

export async function listDocuments() {
  const db = getDb();
  const items = await db
    .collection('kbDocuments')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return items.map((d) => ({
    id: d._id.toString(),
    title: d.title,
    fileUrl: d.fileUrl,
    mimeType: d.mimeType,
    lang: d.lang,
    status: d.status,
    chunkCount: d.chunkCount,
    published: d.published,
    createdAt: d.createdAt,
  }));
}

export async function deleteDocument(id: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid document id');
  const doc = await db.collection('kbDocuments').findOne({ _id: new ObjectId(id) });
  if (!doc) throw new ApiError(404, 'not_found', 'Document not found');
  await deleteRagDocument(id);
  await db.collection('kbDocuments').deleteOne({ _id: new ObjectId(id) });
}

export async function setPublished(id: string, published: boolean) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid document id');
  const r = await db.collection('kbDocuments').updateOne(
    { _id: new ObjectId(id) },
    { $set: { published, updatedAt: new Date() } },
  );
  if (r.matchedCount === 0) throw new ApiError(404, 'not_found', 'Document not found');
}