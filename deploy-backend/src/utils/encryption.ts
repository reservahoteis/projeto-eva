/**
 * Encryption utility for sensitive data
 * Uses AES-256-CBC for symmetric encryption
 *
 * IMPORTANTE: Gerar ENCRYPTION_KEY com:
 * openssl rand -hex 32
 */

import crypto from 'crypto';
import { env } from '@/config/env';

// Validate encryption key exists and is proper length
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const isKeyValid = ENCRYPTION_KEY && ENCRYPTION_KEY.length === 64;

// Log warning but don't crash - allows app to start for non-crypto operations
if (!isKeyValid && process.env.NODE_ENV !== 'test') {
  console.warn('[WARN] ENCRYPTION_KEY not configured or invalid. WhatsApp token encryption will fail.');
  console.warn('[WARN] Generate a key with: openssl rand -hex 32');
}

const IV_LENGTH = 16; // For AES, this is always 16
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts a string using AES-256-CBC
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: iv:encryptedData (both hex encoded)
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot encrypt empty text');
  }

  if (!isKeyValid) {
    throw new Error('ENCRYPTION_KEY not configured. Generate with: openssl rand -hex 32');
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts a string encrypted with encrypt()
 * @param text - Encrypted string in format: iv:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot decrypt empty text');
  }

  if (!isKeyValid) {
    throw new Error('ENCRYPTION_KEY not configured. Generate with: openssl rand -hex 32');
  }

  try {
    const parts = text.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0]!, 'hex');
    const encryptedText = Buffer.from(parts[1]!, 'hex');

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Hashes a string using SHA-256 (one-way, cannot be decrypted)
 * Use for data that needs to be verified but not retrieved (like API keys for comparison)
 * @param text - Text to hash
 * @returns SHA-256 hash
 */
export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generates a cryptographically secure random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns Random token as hex string
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Constant-time comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(a),
    Buffer.from(b)
  );
}

/**
 * Encrypts an object as JSON
 * @param obj - Object to encrypt
 * @returns Encrypted string
 */
export function encryptObject(obj: any): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypts a JSON object
 * @param text - Encrypted string
 * @returns Decrypted object
 */
export function decryptObject<T = any>(text: string): T {
  return JSON.parse(decrypt(text));
}

// Export utility for validating webhook signatures
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return secureCompare(signature, expectedSignature);
}