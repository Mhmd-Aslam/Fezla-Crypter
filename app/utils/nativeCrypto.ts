import AES from 'react-native-simple-crypto';

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

// Encrypt function
export const encrypt = async (message: string, key: string): Promise<{ data: Uint8Array; iv: Uint8Array }> => {
  try {
    const messageBytes = stringToBytes(message);
    const keyBytes = stringToBytes(key);
    const iv = generateIV();
    
    const encrypted = await AES.AES.encrypt(messageBytes.buffer as ArrayBuffer, keyBytes.buffer as ArrayBuffer, iv.buffer as ArrayBuffer);
    
    return {
      data: new Uint8Array(encrypted),
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
    const keyBytes = stringToBytes(key);
    const decrypted = await AES.AES.decrypt(encryptedData.buffer as ArrayBuffer, keyBytes.buffer as ArrayBuffer, iv.buffer as ArrayBuffer);
    return bytesToString(new Uint8Array(decrypted));
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Decryption failed');
  }
};

// Encrypt base64 (for images)
export const encryptBase64 = async (base64Data: string, key: string): Promise<{ data: Uint8Array; iv: Uint8Array }> => {
  try {
    const dataBytes = base64ToBytes(base64Data);
    const keyBytes = stringToBytes(key);
    const iv = generateIV();
    
    const encrypted = await AES.AES.encrypt(dataBytes.buffer as ArrayBuffer, keyBytes.buffer as ArrayBuffer, iv.buffer as ArrayBuffer);
    
    return {
      data: new Uint8Array(encrypted),
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
    const keyBytes = stringToBytes(key);
    const decrypted = await AES.AES.decrypt(encryptedData.buffer as ArrayBuffer, keyBytes.buffer as ArrayBuffer, iv.buffer as ArrayBuffer);
    return bytesToBase64(new Uint8Array(decrypted));
  } catch (error) {
    console.error('Base64 decryption error:', error);
    throw new Error('Image decryption failed');
  }
}; 