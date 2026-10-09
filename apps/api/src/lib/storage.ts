import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export async function uploadFile(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
  const dest = path.join(config.uploads.dir, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
  return `${config.uploads.publicPath}/${key}`;
}
