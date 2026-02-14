/**
 * 使用 Web Crypto API 进行加解密
 * 解决 crypto-js 处理大文件时的 RangeError (Invalid array length)
 */

// 派生密钥
async function getEncryptionKey(password: string) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('git-cloud-pan-salt'), // 固定盐值
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密 ArrayBuffer
 */
export const encryptFile = async (data: ArrayBuffer, password: string): Promise<string> => {
  const key = await getEncryptionKey(password);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // 合并 IV 和加密数据
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // 使用 FileReader 进行高效且内存安全的 Base64 转换
  return new Promise((resolve) => {
    const blob = new Blob([combined], { type: 'application/octet-stream' });
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
};

/**
 * 解密数据
 */
export const decryptFile = async (data: ArrayBuffer, password: string): Promise<ArrayBuffer> => {
  const key = await getEncryptionKey(password);
  
  const combined = new Uint8Array(data);
  const iv = combined.slice(0, 12);
  const content = combined.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    content
  );

  return decrypted;
};

/**
 * 兼容旧版的简单字符串哈希 (用于密码验证)
 */
export const hashPassword = async (password: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// 保留旧的接口名称以减少改动，但内部改为异步
export const encrypt = async (data: string, key: string) => {
  const enc = new TextEncoder();
  return encryptFile(enc.encode(data), key);
};

export const decrypt = async (ciphertext: string, key: string) => {
  try {
    const binaryString = atob(ciphertext);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decrypted = await decryptFile(bytes.buffer, key);
    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
};
