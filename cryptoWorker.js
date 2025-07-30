import crypto from 'react-native-quick-crypto';
import { self } from 'react-native-threads';

self.onmessage = (msg) => {
  const { data, key, iv, mode } = msg;
  let result;
  try {
    if (mode === 'encrypt') {
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));
      result = cipher.update(data, 'base64', 'base64') + cipher.final('base64');
    } else {
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));
      result = decipher.update(data, 'base64', 'base64') + decipher.final('base64');
    }
    self.postMessage({ result, error: null });
  } catch (error) {
    self.postMessage({ result: null, error: error.message });
  }
};