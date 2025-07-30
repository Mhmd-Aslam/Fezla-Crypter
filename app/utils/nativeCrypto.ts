import * as Crypto from 'expo-crypto';

// Utility functions for string/bytes conversion
export const stringToBytes = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

export const bytesToString = (bytes: Uint8Array): string => {
  return new TextDecoder().decode(bytes);
};

export const base64ToBytes = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary);
};

// Generate random IV
export const generateIV = (): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(16));
};

// Derive key from password using PBKDF2
const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt function
export const encrypt = async (message: string, key: string): Promise<{ data: Uint8Array; iv: Uint8Array }> => {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = generateIV();
    const cryptoKey = await deriveKey(key, salt);
    
    const messageBytes = stringToBytes(message);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      messageBytes
    );
    
    // Combine salt + iv + encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return {
      data: result,
      iv: iv
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Encryption failed');
  }
};

// Decrypt function
export const decrypt = async (encryptedData: Uint8Array, key: string, iv: Uint8Array): Promise<string> => {
  try {
    const salt = encryptedData.slice(0, 16);
    const actualIv = encryptedData.slice(16, 32);
    const data = encryptedData.slice(32);
    
    const cryptoKey = await deriveKey(key, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: actualIv },
      cryptoKey,
      data
    );
    
    return bytesToString(new Uint8Array(decrypted));
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Decryption failed');
  }
};

// Encrypt base64 (for images)
export const encryptBase64 = async (base64Data: string, key: string): Promise<{ data: Uint8Array; iv: Uint8Array }> => {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = generateIV();
    const cryptoKey = await deriveKey(key, salt);
    
    const dataBytes = base64ToBytes(base64Data);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBytes
    );
    
    // Combine salt + iv + encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return {
      data: result,
      iv: iv
    };
  } catch (error) {
    console.error('Base64 encryption error:', error);
    throw new Error('Image encryption failed');
  }
};

// Decrypt to base64 (for images)
export const decryptToBase64 = async (encryptedData: Uint8Array, key: string, iv: Uint8Array): Promise<string> => {
  try {
    const salt = encryptedData.slice(0, 16);
    const actualIv = encryptedData.slice(16, 32);
    const data = encryptedData.slice(32);
    
    const cryptoKey = await deriveKey(key, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: actualIv },
      cryptoKey,
      data
    );
    
    return bytesToBase64(new Uint8Array(decrypted));
  } catch (error) {
    console.error('Base64 decryption error:', error);
    throw new Error('Image decryption failed');
  }
}; 