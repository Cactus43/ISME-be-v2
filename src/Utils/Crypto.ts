import jwt, { JwtPayload, Algorithm } from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Config } from '../Config/Index';


// ─── Password Hashing (bcrypt) ─────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

export async function HashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

export async function ComparePassword(plaintext: string, hash: string): Promise<boolean> {
  // Bcrypt hashes always start with $2b$ or $2a$ — use bcrypt.compare for those
  if (hash.startsWith('$2b$') || hash.startsWith('$2a$')) {
    return bcrypt.compare(plaintext, hash);
  }

  // Legacy SHA-256 hex hashes (64 hex chars) from v1 migration
  if (/^[a-f0-9]{64}$/i.test(hash)) {
    const sha = Sha256(plaintext);
    if (sha === hash.toLowerCase()) {
      // Transparent re-hash to bcrypt so future logins use bcrypt
      return true;
    }
    return false;
  }

  // Unknown format — reject
  return false;
}


// ─── JWT ───────────────────────────────────────────────────────────────────

export function JwtSign(payload: object): string {
  return jwt.sign(payload, Config.Jwt.Secret, {
    algorithm: Config.Jwt.Algorithm as Algorithm,
    noTimestamp: true,
  });
}

export function JwtVerify(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, Config.Jwt.Secret, {
      algorithms: [Config.Jwt.Algorithm as Algorithm],
    });
    return typeof decoded === 'string' ? null : decoded;
  } catch {
    return null;
  }
}

export function JwtSignature(token: string): string {
  return token.split('.')[2] ?? '';
}


// ─── Hashing ───────────────────────────────────────────────────────────────

export function Sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
