import { useState } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { encrypt, decrypt } from '../utils/nativeCrypto';

export function useTextCrypter() {
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('');
  const [result, setResult] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const encryptText = async () => {
    if (!message.trim() || !key.trim()) {
      Alert.alert('Error', 'Please enter both message and key');
      return;
    }
    setIsEncrypting(true);
    try {
      const encrypted = await encrypt(message, key);
      // Store both encrypted data and IV
      const resultData = {
        data: Array.from(encrypted.data), // Convert Uint8Array to array for JSON
        iv: Array.from(encrypted.iv)
      };
      setResult(JSON.stringify(resultData));
      setShowResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Encryption failed. Please try again.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const decryptText = async () => {
    if (!message.trim() || !key.trim()) {
      Alert.alert('Error', 'Please enter both encrypted message and key');
      return;
    }
    setIsDecrypting(true);
    try {
      // Parse the encrypted data (should be JSON with data and iv)
      let encryptedData;
      try {
        encryptedData = JSON.parse(message);
      } catch (parseError) {
        Alert.alert('Error', 'Invalid encrypted message format');
        return;
      }

      if (!encryptedData.data || !encryptedData.iv) {
        Alert.alert('Error', 'Invalid encrypted message format');
        return;
      }

      // Convert arrays back to Uint8Array
      const dataBytes = new Uint8Array(encryptedData.data);
      const ivBytes = new Uint8Array(encryptedData.iv);

      const decryptedText = await decrypt(dataBytes, key, ivBytes);
      if (!decryptedText) {
        Alert.alert('Error', 'Invalid key or corrupted message');
        return;
      }
      setResult(decryptedText);
      setShowResult(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert('Error', 'Decryption failed. Please check your key and message.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(result);
    Alert.alert('Success', 'Copied to clipboard!');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const clearFields = () => {
    setMessage('');
    setKey('');
    setResult('');
    setShowResult(false);
  };

  return {
    message,
    setMessage,
    key,
    setKey,
    result,
    showResult,
    isEncrypting,
    isDecrypting,
    encrypt: encryptText,
    decrypt: decryptText,
    copyToClipboard,
    clearFields,
    setShowResult,
  };
} 