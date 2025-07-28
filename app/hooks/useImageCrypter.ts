import { useState } from 'react';
import { Alert, Platform, ActionSheetIOS } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import CryptoJS from 'react-native-crypto-js';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
// @ts-ignore
import * as Sharing from 'expo-sharing';
// @ts-ignore
import * as DocumentPicker from 'expo-document-picker';

export function useImageCrypter() {
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [encryptedImageText, setEncryptedImageText] = useState('');
  const [decryptedImageUri, setDecryptedImageUri] = useState('');
  const [imageKey, setImageKey] = useState('');
  const [imageTextInput, setImageTextInput] = useState('');
  const [showImageResult, setShowImageResult] = useState(false);
  const [isEncryptingImage, setIsEncryptingImage] = useState(false);
  const [isDecryptingImage, setIsDecryptingImage] = useState(false);

  // New: pick image from gallery or camera
  const pickImage = async () => {
    const pickFromLibrary = async () => {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
      }
    };
    const pickFromCamera = async () => {
      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Pick from Gallery', 'Take Photo'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await pickFromLibrary();
          } else if (buttonIndex === 2) {
            await pickFromCamera();
          }
        }
      );
    } else {
      // For Android, use Alert as a simple action sheet
      Alert.alert(
        'Select Image Source',
        undefined,
        [
          { text: 'Pick from Gallery', onPress: pickFromLibrary },
          { text: 'Take Photo', onPress: pickFromCamera },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const encryptImage = async () => {
    if (!selectedImage || !imageKey.trim()) {
      Alert.alert('Error', 'Please select an image and enter a key');
      return;
    }
    setIsEncryptingImage(true);
    try {
      const base64 = selectedImage.base64 || '';
      if (!base64) {
        Alert.alert('Error', 'Failed to get image data.');
        setIsEncryptingImage(false);
        return;
      }
      const sizeInMB = (base64.length * 0.75 / (1024 * 1024));
      if (sizeInMB > 5) {
        Alert.alert('Error', 'Image is too large. Please select a smaller image or reduce quality.');
        setIsEncryptingImage(false);
        return;
      }
      const encryptionPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const encrypted = CryptoJS.AES.encrypt(base64, imageKey).toString();
            resolve(encrypted);
          } catch (error) {
            reject(error);
          }
        }, 10000);
      });
      const encrypted = await encryptionPromise as string;
      setEncryptedImageText(encrypted);
      setShowImageResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Image encryption failed. Try with a smaller image.');
    } finally {
      setIsEncryptingImage(false);
    }
  };

  const decryptImage = async () => {
    if (!imageTextInput.trim() || !imageKey.trim()) {
      Alert.alert('Error', 'Please paste the encrypted text and enter the key');
      return;
    }
    setIsDecryptingImage(true);
    try {
      const trimmedText = imageTextInput.trim();
      const decryptionPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const decrypted = CryptoJS.AES.decrypt(trimmedText, imageKey);
            const base64 = decrypted.toString(CryptoJS.enc.Utf8);
            if (!base64 || base64.length < 100) {
              reject(new Error('Invalid key or corrupted text'));
              return;
            }
            let mime = '';
            if (base64.startsWith('/9j/')) mime = 'image/jpeg';
            else if (base64.startsWith('iVBORw0KGgo')) mime = 'image/png';
            else if (base64.startsWith('R0lGODlh')) mime = 'image/gif';
            else {
              reject(new Error('Decrypted data is not a valid image'));
              return;
            }
            resolve({ base64, mime });
          } catch (error) {
            reject(error);
          }
        }, 5000);
      });
      const { base64, mime } = await decryptionPromise as { base64: string, mime: string };
      const uri = `data:${mime};base64,${base64}`;
      setDecryptedImageUri(uri);
      setShowImageResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Invalid key or corrupted text') {
        Alert.alert('Error', 'Invalid key or corrupted text. Please check your key and encrypted text.');
      } else if (errorMessage === 'Decrypted data is not a valid image') {
        Alert.alert('Error', 'The decrypted data is not a valid image. Please check your encrypted text.');
      } else {
        Alert.alert('Error', 'Image decryption failed. Please check your key and encrypted text.');
      }
    } finally {
      setIsDecryptingImage(false);
    }
  };

  const saveDecryptedImage = async () => {
    if (!decryptedImageUri) {
      Alert.alert('Error', 'No image to save. Please decrypt an image first.');
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save images to your gallery.');
        return;
      }
      const base64 = decryptedImageUri.split(',')[1];
      if (!base64) {
        Alert.alert('Error', 'No image data to save.');
        return;
      }
      let fileExtension = 'jpg';
      if (decryptedImageUri.includes('image/png')) {
        fileExtension = 'png';
      } else if (decryptedImageUri.includes('image/gif')) {
        fileExtension = 'gif';
      }
      const timestamp = Date.now();
      const filename = `decrypted_image_${timestamp}.${fileExtension}`;
      const tempUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(tempUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      const asset = await MediaLibrary.createAssetAsync(tempUri);
      await MediaLibrary.createAlbumAsync('Fezla Crypter', asset, false);
      Alert.alert('Success', `Image saved to gallery as ${filename}`);
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('permission')) {
        Alert.alert('Error', 'Permission denied. Please check app permissions.');
      } else if (errorMessage.includes('storage')) {
        Alert.alert('Error', 'Storage error. Please check available space.');
      } else {
        Alert.alert('Error', `Failed to save image: ${errorMessage}`);
      }
    }
  };

  const copyImageText = async () => {
    await Clipboard.setStringAsync(encryptedImageText);
    Alert.alert('Success', 'Encrypted image text copied!');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const clearImageFields = () => {
    setSelectedImage(null);
    setEncryptedImageText('');
    setDecryptedImageUri('');
    setImageKey('');
    setImageTextInput('');
    setShowImageResult(false);
  };

  const exportEncryptedImageText = async () => {
    if (!encryptedImageText) {
      Alert.alert('Error', 'No encrypted image text to export.');
      return;
    }
    try {
      const timestamp = Date.now();
      const filename = `encrypted_image_${timestamp}.txt`;
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, encryptedImageText, { encoding: FileSystem.EncodingType.UTF8 });
      let shareUri = fileUri;
      if (Platform.OS === 'android') {
        try {
          shareUri = await FileSystem.getContentUriAsync(fileUri);
        } catch (err) {
          Alert.alert('Error', 'Failed to get content URI for sharing on Android.');
          return;
        }
      }
      try {
        await Sharing.shareAsync(shareUri, { mimeType: 'text/plain', dialogTitle: 'Share Encrypted Image Text' });
      } catch (err) {
        Alert.alert('Error', 'Sharing failed. Make sure you have a sharing app installed.');
        return;
      }
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (err) {}
    } catch (error) {
      Alert.alert('Error', 'Failed to export .txt file.');
    }
  };

  const importEncryptedImageText = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'text/plain' });
      if (res.canceled || !res.assets || !Array.isArray(res.assets) || res.assets.length === 0 || !res.assets[0].uri) return;
      const fileUri = res.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
      setImageTextInput(content);
      Alert.alert('Success', 'Encrypted image text imported!');
    } catch (error) {
      Alert.alert('Error', 'Failed to import .txt file.');
    }
  };

  const downloadEncryptedImageText = async () => {
    if (!encryptedImageText) {
      Alert.alert('Error', 'No encrypted image text to download.');
      return;
    }
    try {
      const timestamp = Date.now();
      const filename = `encrypted_image_${timestamp}.txt`;
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, encryptedImageText, { encoding: FileSystem.EncodingType.UTF8 });
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('Download', asset, false);
      Alert.alert('Success', `File saved to Downloads as ${filename}`);
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      Alert.alert('Error', 'Failed to download .txt file.');
    }
  };

  const shareEncryptedImageText = async () => {
    if (!encryptedImageText) {
      Alert.alert('Error', 'No encrypted image text to share.');
      return;
    }
    try {
      const timestamp = Date.now();
      const filename = `encrypted_image_${timestamp}.txt`;
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, encryptedImageText, { encoding: FileSystem.EncodingType.UTF8 });
      let shareUri = fileUri;
      if (Platform.OS === 'android') {
        try {
          shareUri = await FileSystem.getContentUriAsync(fileUri);
        } catch (err) {
          Alert.alert('Error', 'Failed to get content URI for sharing on Android.');
          return;
        }
      }
      try {
        await Sharing.shareAsync(shareUri, { mimeType: 'text/plain', dialogTitle: 'Share Encrypted Image Text' });
      } catch (err) {
        Alert.alert('Error', 'Sharing failed. Make sure you have a sharing app installed.');
        return;
      }
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (err) {}
    } catch (error) {
      Alert.alert('Error', 'Failed to share .txt file.');
    }
  };

  return {
    selectedImage,
    setSelectedImage,
    encryptedImageText,
    setEncryptedImageText,
    decryptedImageUri,
    setDecryptedImageUri,
    imageKey,
    setImageKey,
    imageTextInput,
    setImageTextInput,
    showImageResult,
    setShowImageResult,
    isEncryptingImage,
    isDecryptingImage,
    pickImage,
    encryptImage,
    decryptImage,
    saveDecryptedImage,
    copyImageText,
    clearImageFields,
    exportEncryptedImageText,
    importEncryptedImageText,
    downloadEncryptedImageText,
    shareEncryptedImageText,
  };
} 