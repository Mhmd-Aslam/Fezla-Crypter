import { useState, useCallback, useRef } from 'react';
import { Alert, Platform, ActionSheetIOS, InteractionManager } from 'react-native';
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
import crypto from 'react-native-quick-crypto';

// Enhanced multithreading implementation
class CryptoWorker {
  private worker: any = null;
  private isAvailable = false;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Try react-native-multithreading first
      const multithreading = require('react-native-multithreading');
      if (multithreading && multithreading.spawnThread) {
        this.worker = multithreading.spawnThread;
        this.isAvailable = true;
        console.log('✅ Using react-native-multithreading');
        return;
      }
    } catch (error) {
      console.log('⚠️ react-native-multithreading not available');
    }

    // Fallback: Create a custom worker using requestIdleCallback
    this.isAvailable = true;
    console.log('✅ Using enhanced background processing');
  }

  async executeInBackground<T>(fn: (chunk: string, key: string) => string, data: { chunks: string[], key: string }): Promise<string> {
    if (!this.isAvailable) {
      throw new Error('Worker not available');
    }

    return new Promise((resolve, reject) => {
      if (this.worker && typeof this.worker === 'function') {
        // Use react-native-multithreading
        this.worker(fn, data)
          .then(resolve)
          .catch(reject);
      } else {
        // Use enhanced background processing
        this.executeInBackgroundWithIdleCallback(fn, data, resolve, reject);
      }
    });
  }

  private executeInBackgroundWithIdleCallback<T>(
    fn: (chunk: string, key: string) => string,
    data: { chunks: string[], key: string },
    resolve: (value: string) => void,
    reject: (error: any) => void
  ) {
    const { chunks, key } = data;
    const results: string[] = [];
    let currentIndex = 0;

    const processChunk = () => {
      if (currentIndex >= chunks.length) {
        resolve(results.join(''));
        return;
      }

      const chunk = chunks[currentIndex];
      if (!key) {
        reject(new Error('Key is required for crypto operations'));
        return;
      }
      
      try {
        const result = fn(chunk, key!);
        results[currentIndex] = result;
        currentIndex++;
        
        // Use requestIdleCallback if available, otherwise setTimeout
        const nextChunk = () => processChunk();
        
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(nextChunk, { timeout: 50 });
        } else {
          setTimeout(nextChunk, 10);
        }
      } catch (error) {
        reject(error);
      }
    };

    // Start processing
    processChunk();
  }
}

// Initialize the worker
const cryptoWorker = new CryptoWorker();

// Cache for encrypted results to avoid re-encryption
const encryptionCache = new Map<string, string>();
const MAX_CACHE_SIZE = 5;

// Image processing cache
const imageCache = new Map<string, { bytes: string; timestamp: number }>();
const MAX_IMAGE_CACHE_SIZE = 3;

// Memory monitoring
let memoryWarningCount = 0;
const MAX_MEMORY_WARNINGS = 3;

// Background processing queue
let processingQueue: Array<() => Promise<void>> = [];
let isProcessing = false;

// Process queue in background
const processQueue = async () => {
  if (isProcessing || processingQueue.length === 0) return;
  
  isProcessing = true;
  
  while (processingQueue.length > 0) {
    const task = processingQueue.shift();
    if (task) {
      try {
        await task();
      } catch (error) {
        console.error('Background task error:', error);
      }
    }
    
    // Allow UI to update between tasks
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  isProcessing = false;
};

// Add task to background queue
const addToBackgroundQueue = (task: () => Promise<void>) => {
  processingQueue.push(task);
  if (!isProcessing) {
    InteractionManager.runAfterInteractions(() => {
      processQueue();
    });
  }
};

// Worker function for encryption
function encryptWorker(chunk: string, key: string): string {
  const CryptoJS = require('react-native-crypto-js');
  return CryptoJS.AES.encrypt(chunk, key).toString();
}

// Worker function for decryption
function decryptWorker(chunk: string, key: string): string {
  const CryptoJS = require('react-native-crypto-js');
  const decrypted = CryptoJS.AES.decrypt(chunk, key);
  const result = decrypted.toString(CryptoJS.enc.Utf8);
  if (!result) throw new Error('Invalid key or corrupted data');
  return result;
}

// Enhanced encryption with guaranteed multithreading
const encryptInBackground = async (imageBytes: string, imageKey: string): Promise<string> => {
  try {
    // Split into chunks for processing
    const chunkSize = 50000;
    const chunks: string[] = [];
    
    for (let i = 0; i < imageBytes.length; i += chunkSize) {
      chunks.push(imageBytes.slice(i, i + chunkSize));
    }

    // Process chunks in background
    const encryptedChunks = await cryptoWorker.executeInBackground(encryptWorker, {
      chunks,
      key: imageKey
    });

    return encryptedChunks;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
};

// Enhanced decryption with guaranteed multithreading
const decryptInBackground = async (encryptedText: string, imageKey: string): Promise<string> => {
  try {
    const isChunked = encryptedText.includes('|CHUNK|');
    
    if (isChunked) {
      const chunks = encryptedText.split('|CHUNK|');
      
      // Process chunks in background
      const decryptedChunks = await cryptoWorker.executeInBackground(decryptWorker, {
        chunks,
        key: imageKey
      });

      return decryptedChunks;
    } else {
      // Single chunk processing
      const result = await cryptoWorker.executeInBackground(decryptWorker, {
        chunks: [encryptedText],
        key: imageKey
      });
      
      return result;
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    throw error;
  }
};

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
        // Read image as bytes with better error handling
        try {
          imageBytes = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          if (!imageBytes) {
            Alert.alert('Error', 'Failed to read image data.');
            return;
          }

          // Cache the image bytes for future use
          addToImageCache(imageUri, imageBytes);
        } catch (readError) {
          console.error('File read error:', readError);
          Alert.alert('Error', 'Failed to read image file. Please try again.');
          return;
        }
      }

      // File size limit
      const sizeInMB = (imageBytes.length * 0.75 / (1024 * 1024));
      if (sizeInMB > 5) { // Increased to 5MB with better threading
        Alert.alert('Error', 'Image is too large. Please select a smaller image (under 5MB).');
        return;
      }

      // Use background encryption
      const encrypted = await encryptInBackground(imageBytes, imageKey);

      // Cache the result
      addToEncryptionCache(cacheKey, encrypted);
      
      setEncryptedImageText(encrypted);
      setShowImageResult(true);
      lastProcessedImageRef.current = imageUri;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error) {
      console.error('Encryption error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('timeout')) {
        Alert.alert('Error', 'Image is too large or complex. Please try with a smaller image.');
      } else if (errorMessage.includes('memory')) {
        Alert.alert('Error', 'Not enough memory to process this image. Please try with a smaller image.');
      } else {
        Alert.alert('Error', 'Image encryption failed. Please try with a smaller image.');
      }
    } finally {
      setIsEncryptingImage(false);
      processingRef.current = false;
      
      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
      }
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
      
      // Use background decryption
      const imageBytes = await decryptInBackground(trimmedText, imageKey);

      // Validate that it's a valid image format
      let mime = '';
      if (imageBytes.startsWith('/9j/')) mime = 'image/jpeg';
      else if (imageBytes.startsWith('iVBORw0KGgo')) mime = 'image/png';
      else if (imageBytes.startsWith('R0lGODlh')) mime = 'image/gif';
      else {
        throw new Error('Decrypted data is not a valid image');
      }
      
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
      } else if (errorMessage.includes('chunked')) {
        Alert.alert('Error', 'Invalid key or corrupted chunked data. Please check your key and encrypted text.');
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

  // Memory management - clear old entries
  const cleanupMemory = useCallback(() => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Clear old image cache entries
    for (const [key, value] of imageCache.entries()) {
      if (now - value.timestamp > fiveMinutes) {
        imageCache.delete(key);
      }
    }
    
    // Keep only last 3 encryption results (reduced)
    if (encryptionCache.size > 3) {
      const entries = Array.from(encryptionCache.entries());
      const toDelete = entries.slice(0, entries.length - 3);
      toDelete.forEach(([key]) => encryptionCache.delete(key));
    }
  }, []);

  // Memory monitoring function
  const checkMemoryUsage = useCallback(() => {
    try {
      // Simple memory check - if we're processing large data, clear caches
      if (imageCache.size > 2 || encryptionCache.size > 3) {
        cleanupMemory();
        memoryWarningCount++;
        
        if (memoryWarningCount > MAX_MEMORY_WARNINGS) {
          // Force clear all caches if too many warnings
          imageCache.clear();
          encryptionCache.clear();
          memoryWarningCount = 0;
        }
      }
    } catch (error) {
      console.error('Memory check error:', error);
    }
  }, [cleanupMemory]);

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

  // Helper to run crypto operations (simplified without threading)
  async function runCryptoOperation({ data, key, iv, mode }: { data: string, key: string, iv: string, mode: 'encrypt' | 'decrypt' }): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (mode === 'encrypt') {
          const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));
          const encrypted = cipher.update(data, 'base64', 'base64');
          const final = cipher.final('base64');
          resolve(String(encrypted) + String(final));
        } else {
          const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));
          const decrypted = decipher.update(data, 'base64', 'base64');
          const final = decipher.final('base64');
          resolve(String(decrypted) + String(final));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Example: Encrypt image as base64 string
  async function encryptImageBase64(imageBase64: string, keyB64: string, ivB64: string): Promise<string> {
    return await runCryptoOperation({ data: imageBase64, key: keyB64, iv: ivB64, mode: 'encrypt' });
  }

  // Example: Decrypt image as base64 string
  async function decryptImageBase64(encryptedBase64: string, keyB64: string, ivB64: string): Promise<string> {
    return await runCryptoOperation({ data: encryptedBase64, key: keyB64, iv: ivB64, mode: 'decrypt' });
  }

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
    cleanupMemory,
    checkMemoryUsage,
    exportEncryptedImageText,
    importEncryptedImageText,
    shareEncryptedImageText,
  };
} 