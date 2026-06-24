import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.API_KEY_ENCRYPTION_SECRET || process.env.SESSION_SECRET || 'default-encryption-key-change-in-production';
  return crypto.scryptSync(key, 'salt', 32);
}

export function encryptApiKey(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptApiKey(encryptedData: string): string | null {
  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
    
    if (!ivHex || !authTagHex || !encryptedHex) {
      return null;
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null;
  }
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '****';
  }
  const prefix = apiKey.substring(0, 7);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}...${suffix}`;
}

export function getLastFourChars(apiKey: string): string {
  if (!apiKey || apiKey.length < 4) {
    return '****';
  }
  return apiKey.substring(apiKey.length - 4);
}

export function isValidApiKeyFormat(apiKey: string, provider: string): boolean {
  switch (provider) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
    case 'google':
      return apiKey.length >= 20;
    default:
      return apiKey.length >= 10;
  }
}
