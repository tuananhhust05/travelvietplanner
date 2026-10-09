import { request } from 'undici';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface RagChunk {
  text: string;
  lang: string;
}

export async function ingestDocument(
  documentId: string,
  title: string,
  chunks: RagChunk[],
): Promise<void> {
  const res = await request(`${config.ragUrl}/internal/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.ragServiceToken}`,
    },
    body: JSON.stringify({
      chunks: chunks.map((c) => ({
        document_id: documentId,
        title,
        text: c.text,
        lang: c.lang,
      })),
    }),
  });
  if (res.statusCode >= 400) {
    const body = await res.body.text();
    logger.error({ status: res.statusCode, body }, 'rag ingest failed');
    throw new Error(`rag ingest failed: ${res.statusCode}`);
  }
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await request(
    `${config.ragUrl}/internal/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${config.ragServiceToken}` } },
  );
  if (res.statusCode >= 400) {
    const body = await res.body.text();
    logger.error({ status: res.statusCode, body }, 'rag delete failed');
    throw new Error(`rag delete failed: ${res.statusCode}`);
  }
}