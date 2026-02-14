import crypto from 'node:crypto';

/**
 * 服务端加密逻辑 (用于 API Routes)
 * 使用与 Web Crypto 兼容的算法 (AES-256-GCM)
 * 结构: IV(12 bytes) + Ciphertext + Tag(16 bytes)
 */
export const serverEncrypt = (data: string, password: string): string => {
  const salt = Buffer.from('git-cloud-pan-salt');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // GCM tag is 16 bytes by default
  
  // 结构: IV + Ciphertext + Tag (匹配 Web Crypto AES-GCM 默认行为)
  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined.toString('base64');
};

/**
 * 服务端解密逻辑
 */
export const serverDecrypt = (base64Data: string, password: string): string => {
  const combined = Buffer.from(base64Data, 'base64');
  const iv = combined.subarray(0, 12);
  // Tag 在最后 16 字节
  const tag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(12, combined.length - 16);
  
  const salt = Buffer.from('git-cloud-pan-salt');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};
