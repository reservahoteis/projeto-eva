import crypto from 'crypto';
import { env } from '@/config/env';

// Algoritmo de criptografia
const ALGORITHM = 'aes-256-gcm';

// Derivar salt único do JWT_SECRET (primeiros 16 bytes do hash SHA256)
// Isso garante que cada instalação tem um salt único baseado na sua chave
const DERIVED_SALT = crypto.createHash('sha256').update(env.JWT_SECRET).digest().slice(0, 16);

// Derivar chave de criptografia usando scrypt com salt derivado
const KEY = crypto.scryptSync(env.JWT_SECRET, DERIVED_SALT, 32);

/**
 * Criptografar dados sensíveis (ex: WhatsApp Access Token)
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Retornar: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografar dados
 */
export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Gerar token aleatório seguro
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash SHA256 (para validar webhooks)
 */
export function sha256(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}
