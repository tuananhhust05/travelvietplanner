import { createRequire } from 'node:module';
import pino from 'pino';
import { config } from './config.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
];

// Pretty transport is a dev-only convenience and is absent from the production
// image (installed with --omit=dev). Only enable it if it can be resolved.
function prettyAvailable(): boolean {
  if (config.env === 'production') return false;
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

export const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  transport: prettyAvailable()
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
