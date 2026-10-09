import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../../config.js';

let privateKey = config.jwt.privateKey;
let publicKey = config.jwt.publicKey;

// Dev fallback: generate an ephemeral RS256 keypair if none provided.
if (!privateKey || !publicKey) {
  const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = priv;
  publicKey = pub;
}

export interface AccessClaims {
  sub: string;
  roles: string[];
  orgId?: string;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, privateKey, {
    algorithm: 'RS256',
    expiresIn: config.jwt.accessTtl,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

export function verifyAccessToken(token: string): AccessClaims & jwt.JwtPayload {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  }) as AccessClaims & jwt.JwtPayload;
}

export function newRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
