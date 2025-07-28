import { useState } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import CryptoJS from 'react-native-crypto-js';

export function useTextCrypter() {
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('');
  const [result, setResult] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const encrypt = async () => {
    if (!message.trim() || !key.trim()) {
      Alert.alert('Error', 'Please enter both message and key');
      return;
    }
    setIsEncrypting(true);
    try {
      const encrypted = CryptoJS.AES.encrypt(message, key).toString();
      setResult(encrypted);
      setShowResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Encryption failed. Please try again.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const decrypt = async () => {
    if (!message.trim() || !key.trim()) {
      Alert.alert('Error', 'Please enter both encrypted message and key');
      return;
    }
    setIsDecrypting(true);
    try {
      const decrypted = CryptoJS.AES.decrypt(message, key);
      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
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
    encrypt,
    decrypt,
    copyToClipboard,
    clearFields,
    setShowResult,
  };
} 