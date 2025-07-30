import { useState, useCallback, useRef } from 'react';
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

// Cache for encrypted results to avoid re-encryption
const encryptionCache = new Map<string, string>();
const MAX_CACHE_SIZE = 10; // Keep last 10 encrypted results

// Image processing cache
const imageCache = new Map<string, { bytes: string; timestamp: number }>();
const MAX_IMAGE_CACHE_SIZE = 5; // Keep last 5 processed images

export function useImageCrypter() {
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [encryptedImageText, setEncryptedImageText] = useState('');
  const [decryptedImageUri, setDecryptedImageUri] = useState('');
  const [imageKey, setImageKey] = useState('');
  const [imageTextInput, setImageTextInput] = useState('');
  const [showImageResult, setShowImageResult] = useState(false);
  const [isEncryptingImage, setIsEncryptingImage] = useState(false);
  const [isDecryptingImage, setIsDecryptingImage] = useState(false);

  // Refs for performance tracking
  const processingRef = useRef(false);
  const lastProcessedImageRef = useRef<string>('');

  // Cache management functions
  const addToEncryptionCache = useCallback((key: string, result: string) => {
    if (encryptionCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = encryptionCache.keys().next().value;
      if (firstKey) {
        encryptionCache.delete(firstKey);
      }
    }
    encryptionCache.set(key, result);
  }, []);

  const addToImageCache = useCallback((uri: string, bytes: string) => {
    if (imageCache.size >= MAX_IMAGE_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = imageCache.keys().next().value;
      if (firstKey) {
        imageCache.delete(firstKey);
      }
    }
    imageCache.set(uri, { bytes, timestamp: Date.now() });
  }, []);

  const getFromImageCache = useCallback((uri: string) => {
    const cached = imageCache.get(uri);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
      return cached.bytes;
    }
    return null;
  }, []);

  // Generate cache key for encryption
  const generateCacheKey = useCallback((imageUri: string, key: string) => {
    return `${imageUri}_${key}`;
  }, []);

  // New: pick image from gallery or camera
  const pickImage = async () => {
    const pickFromLibrary = async () => {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false, // Don't get base64, we'll get bytes
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
        base64: false, // Don't get base64, we'll get bytes
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

    // Prevent multiple simultaneous operations
    if (processingRef.current) {
      return;
    }
    processingRef.current = true;
    setIsEncryptingImage(true);

    try {
      const imageUri = selectedImage.uri;
      const cacheKey = generateCacheKey(imageUri, imageKey);

      // Check if we have cached result
      const cachedResult = encryptionCache.get(cacheKey);
      if (cachedResult) {
        setEncryptedImageText(cachedResult);
        setShowImageResult(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // Check if we have cached image bytes
      let imageBytes = getFromImageCache(imageUri);
      
      if (!imageBytes) {
        // Read image as bytes with progress tracking
        imageBytes = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (!imageBytes) {
          Alert.alert('Error', 'Failed to read image data.');
          return;
        }

        // Cache the image bytes for future use
        addToImageCache(imageUri, imageBytes);
      }

      // Check file size (base64 is ~33% larger than original)
      const sizeInMB = (imageBytes.length * 0.75 / (1024 * 1024));
      if (sizeInMB > 10) {
        Alert.alert('Error', 'Image is too large. Please select a smaller image or reduce quality.');
        return;
      }

      // Optimized encryption with chunking for large files
      const encrypted = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Encryption timeout'));
        }, 5000); // 5 second timeout

        try {
          // Use requestIdleCallback for better performance (if available)
          const encryptTask = () => {
            try {
              const result = CryptoJS.AES.encrypt(imageBytes, imageKey).toString();
              clearTimeout(timeout);
              resolve(result);
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          };

          // Execute immediately for smaller files, or with delay for larger ones
          if (sizeInMB < 2) {
            encryptTask();
          } else {
            setTimeout(encryptTask, 100); // Small delay to prevent UI blocking
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Cache the result
      addToEncryptionCache(cacheKey, encrypted);
      
      setEncryptedImageText(encrypted);
      setShowImageResult(true);
      lastProcessedImageRef.current = imageUri;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error) {
      console.error('Encryption error:', error);
      Alert.alert('Error', 'Image encryption failed. Try with a smaller image.');
    } finally {
      setIsEncryptingImage(false);
      processingRef.current = false;
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
            const imageBytes = decrypted.toString(CryptoJS.enc.Utf8);
            
            if (!imageBytes || imageBytes.length < 100) {
              reject(new Error('Invalid key or corrupted text'));
              return;
            }

            // Validate that it's a valid image format
            let mime = '';
            if (imageBytes.startsWith('/9j/')) mime = 'image/jpeg';
            else if (imageBytes.startsWith('iVBORw0KGgo')) mime = 'image/png';
            else if (imageBytes.startsWith('R0lGODlh')) mime = 'image/gif';
            else {
              reject(new Error('Decrypted data is not a valid image'));
              return;
            }
            
            resolve({ imageBytes, mime });
          } catch (error) {
            reject(error);
          }
        }, 2000); // Reduced timeout for bytes
      });
      
      const { imageBytes, mime } = await decryptionPromise as { imageBytes: string, mime: string };
      const uri = `data:${mime};base64,${imageBytes}`;
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
    
    // Clear processing state
    processingRef.current = false;
    lastProcessedImageRef.current = '';
  };

  // Clear all caches (useful for memory management)
  const clearCaches = useCallback(() => {
    encryptionCache.clear();
    imageCache.clear();
  }, []);

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
      
      if (res.canceled || !res.assets || !Array.isArray(res.assets) || res.assets.length === 0 || !res.assets[0]?.uri) {
        return;
      }
      
      const fileUri = res.assets[0]!.uri;
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
      const filename = `fezdata_${timestamp}.txt`;
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
    clearCaches,
    exportEncryptedImageText,
    importEncryptedImageText,
    shareEncryptedImageText,
  };
} 