import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const secret =
    process.env.AI_KEY_ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    'local-dev-ai-key-secret';

  return createHash('sha256').update(secret).digest();
}

export function encryptAiApiKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted]
    .map((part) => part.toString('base64'))
    .join(':');
}

export function decryptAiApiKey(value?: string | null) {
  if (!value) {
    return '';
  }

  const [ivText, authTagText, encryptedText] = value.split(':');
  if (!ivText || !authTagText || !encryptedText) {
    return '';
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivText, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagText, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskAiApiKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return '****';
  }

  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}
