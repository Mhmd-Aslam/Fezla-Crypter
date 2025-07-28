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
      
      // Write the base64 image data to file
      await FileSystem.writeAsStringAsync(tempUri, base64, { 
        encoding: FileSystem.EncodingType.Base64 
      });
      
      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(tempUri);
      
      // Try to create album, but don't fail if it doesn't work
      try {
        await MediaLibrary.createAlbumAsync('Fezla Crypter', asset, false);
      } catch (albumError) {
        // Album creation failed, but asset is still saved
        console.log('Album creation failed, but image was saved');
      }
      
      Alert.alert('Success', `Image saved to gallery as ${filename}`);
      
      // Clean up the temporary file
      setTimeout(async () => {
        try {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        } catch (err) {
          // Ignore cleanup errors
        }
      }, 1000);
      
    } catch (error) {
      console.error('Save image error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('permission')) {
        Alert.alert('Error', 'Permission denied. Please check app permissions.');
      } else if (errorMessage.includes('storage')) {
        Alert.alert('Error', 'Storage error. Please check available space.');
      } else {
        Alert.alert('Error', 'Failed to save image. Please try again.');
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
    // This function is now the same as shareEncryptedImageText
    return shareEncryptedImageText();
  };

  const importEncryptedImageText = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ 
        type: 'text/plain',
        copyToCacheDirectory: true
      });
      
      if (res.canceled || !res.assets || !Array.isArray(res.assets) || res.assets.length === 0 || !res.assets[0].uri) {
        return;
      }
      
      const fileUri = res.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, { 
        encoding: FileSystem.EncodingType.UTF8 
      });
      
      if (!content || content.trim().length === 0) {
        Alert.alert('Error', 'The selected file is empty or invalid.');
        return;
      }
      
      setImageTextInput(content);
      Alert.alert('Success', 'Encrypted image text imported!');
      
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Failed to import .txt file. Please try again.');
    }
  };



  const shareEncryptedImageText = async () => {
    if (!encryptedImageText) {
      Alert.alert('Error', 'No data to share.');
      return;
    }
    try {
      const timestamp = Date.now();
      const filename = `data_${timestamp}.txt`;
      const fileUri = FileSystem.documentDirectory + filename;
      
      // Write the encrypted text to file
      await FileSystem.writeAsStringAsync(fileUri, encryptedImageText, { 
        encoding: FileSystem.EncodingType.UTF8 
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      // Share the file
      await Sharing.shareAsync(fileUri, { 
        mimeType: 'text/plain', 
        dialogTitle: 'Share Data',
        UTI: 'public.plain-text' // For iOS
      });

      // Clean up the temporary file
      setTimeout(async () => {
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (err) {
          // Ignore cleanup errors
        }
      }, 1000);

    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share data. Please try again.');
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
    shareEncryptedImageText,
  };
} 