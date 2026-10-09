import fs from 'node:fs';

function readSecret(file: string | undefined, fallback = ''): string {
  if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  return fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 4000),
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://mongodb:27017/travelvietplaner?replicaSet=rs0',
  mongoDb: process.env.MONGO_DB ?? 'travelvietplaner',
  redisUrl: process.env.REDIS_URL ?? 'redis://redis:6379',
  esNode: process.env.ES_NODE ?? 'http://elasticsearch:9200',
  qdrantUrl: process.env.QDRANT_URL ?? 'http://qdrant:6333',
  ragUrl: process.env.RAG_URL ?? 'http://rag:8000',
  ragServiceToken: process.env.RAG_SERVICE_TOKEN ?? 'change-me-internal-hmac-secret',
  jwt: {
    privateKey: readSecret(process.env.JWT_PRIVATE_KEY_FILE, process.env.JWT_PRIVATE_KEY ?? ''),
    publicKey: readSecret(process.env.JWT_PUBLIC_KEY_FILE, process.env.JWT_PUBLIC_KEY ?? ''),
    accessTtl: Number(process.env.ACCESS_TOKEN_TTL ?? 900),
    refreshTtl: Number(process.env.REFRESH_TOKEN_TTL ?? 2592000),
    issuer: 'travelvietplaner',
    audience: 'travelvietplaner-web',
  },
  uploads: {
    // Absolute path on host where uploaded files are stored (outside source repo).
    dir: process.env.UPLOAD_DIR ?? '/data/uploads',
    // URL prefix used to build public file URLs returned to clients.
    publicPath: '/file',
  },
} as const;

export type AppConfig = typeof config;
