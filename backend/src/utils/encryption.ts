import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Get encryption key from environment or derive from password
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  return Buffer.from(key.slice(0, 32), 'utf-8');
}

/**
 * Encrypt sensitive data
 */
export function encrypt(data: string): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf-8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const tag = cipher.getAuthTag();
  
  // Combine: salt + iv + tag + encrypted
  const result = Buffer.concat([iv, tag, encrypted]);
  return result;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: Buffer): string {
  const key = getEncryptionKey();
  
  // Extract components
  const iv = encryptedData.slice(0, IV_LENGTH);
  const tag = encryptedData.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = encryptedData.slice(IV_LENGTH + TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf-8');
}

/**
 * Hash data for anonymization (one-way)
 */
export function anonymize(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}