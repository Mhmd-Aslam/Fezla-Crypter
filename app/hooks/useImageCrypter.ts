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
import RNFS from 'react-native-fs';

// Enhanced worker with file-based chunk processing
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

    try {
      // Try alternative multithreading approach
      const { NativeModules } = require('react-native');
      if (NativeModules.MultithreadingModule) {
        this.worker = NativeModules.MultithreadingModule.spawnThread;
        this.isAvailable = true;
        console.log('✅ Using native multithreading module');
        return;
      }
    } catch (error) {
      console.log('⚠️ Native multithreading module not available');
    }

    // Fallback: File-based processing
    this.isAvailable = true;
    console.log('✅ Using file-based background processing');
  }

  async executeInBackground<T>(
    fn: (chunkPath: string, key: string) => Promise<string>,
    data: { inputPath: string, outputPath: string, key: string, chunkSize: number }
  ): Promise<void> {
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
        // Use file-based processing for large data
        this.processFileInChunks(fn, data, resolve, reject);
      }
    });
  }

  private async processFileInChunks<T>(
    fn: (chunkPath: string, key: string) => Promise<string>,
    data: { inputPath: string, outputPath: string, key: string, chunkSize: number },
    resolve: () => void,
    reject: (error: any) => void
  ) {
    const { inputPath, outputPath, key, chunkSize } = data;
    const concurrency = 4; // Optimal for memory/performance balance
    let currentPosition = 0;
    let activeOperations = 0;
    let hasError = false;

    try {
      // Clear output file before starting
      await RNFS.writeFile(outputPath, '', 'utf8');
      
      const fileInfo = await RNFS.stat(inputPath);
      const totalSize = fileInfo.size;

      const processNextChunk = async () => {
        if (hasError || currentPosition >= totalSize) {
          if (activeOperations === 0 && !hasError) {
            resolve();
          }
        return;
      }

        activeOperations++;
        const start = currentPosition;
        const end = Math.min(start + chunkSize, totalSize);
        currentPosition = end;
      
      try {
          // Read chunk directly from file
          const chunk = await RNFS.read(inputPath, end - start, start, 'base64');
          const tempChunkPath = `${RNFS.TemporaryDirectoryPath}/chunk_${Date.now()}_${Math.random()}.tmp`;
          
          // Write chunk to temporary file
          await RNFS.writeFile(tempChunkPath, chunk, 'base64');
          
          // Process chunk through crypto function
          const result = await fn(tempChunkPath, key);
          
          // Append result to output file
          await RNFS.appendFile(outputPath, result, 'utf8');
          
          // Clean up temporary file
          await RNFS.unlink(tempChunkPath);
        } catch (error) {
          hasError = true;
          reject(error);
          return;
        } finally {
          activeOperations--;
        }

        // Continue processing
        if (!hasError) {
          processNextChunk();
        }
      };

      // Start initial batch of concurrent operations
      for (let i = 0; i < Math.min(concurrency, Math.ceil(totalSize / chunkSize)); i++) {
        processNextChunk();
        }
      } catch (error) {
        reject(error);
      }
  }
}

// Initialize crypto worker
const cryptoWorker = new CryptoWorker();

// Worker functions with file-based processing
async function encryptWorker(chunkPath: string, key: string): Promise<string> {
  try {
    const chunkData = await RNFS.readFile(chunkPath, 'base64');
    const encrypted = CryptoJS.AES.encrypt(chunkData, key).toString();
    return encrypted + '|CHUNK|'; // Add separator
  } catch (error) {
    console.error('Encryption worker error:', error);
    throw new Error('Encryption failed');
  }
}

async function decryptWorker(chunkPath: string, key: string): Promise<string> {
  try {
    const encryptedData = await RNFS.readFile(chunkPath, 'utf8');
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!result) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }
    return result;
  } catch (error) {
    console.error('Decryption worker error:', error);
    throw new Error('Decryption failed');
  }
}

// Main encryption function with file-based processing
const encryptInBackground = async (
  inputUri: string,
  outputPath: string,
  imageKey: string
): Promise<void> => {
  try {
    // Determine optimal chunk size based on available memory
    const chunkSize = 1024 * 1024; // 1MB chunks (adjust based on testing)
    
    await cryptoWorker.executeInBackground(encryptWorker, {
      inputPath: inputUri,
      outputPath,
      key: imageKey,
      chunkSize
    });

    console.log('Encryption completed successfully');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
};

// Main decryption function with file-based processing
const decryptInBackground = async (
  inputPath: string,
  outputPath: string,
  imageKey: string
): Promise<void> => {
  try {
    // Use larger chunks for decryption (encrypted text is larger)
    const chunkSize = 1.5 * 1024 * 1024; // 1.5MB chunks
    
    await cryptoWorker.executeInBackground(decryptWorker, {
      inputPath,
      outputPath,
      key: imageKey,
      chunkSize
    });
    
    console.log('Decryption completed successfully');
  } catch (error) {
    console.error('Decryption failed:', error);
    throw error;
  }
};

// Cache management with better memory limits
const MAX_CACHE_SIZE = 5;
const encryptionCache = new Map<string, string>();

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

  // Generate cache key for encryption
  const generateCacheKey = useCallback((imageUri: string, key: string) => {
    return `${imageUri}_${key}`;
  }, []);

  // Memory cleanup function
  const cleanupMemory = useCallback(() => {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.error('Memory cleanup error:', error);
    }
  }, []);

  const pickImage = async () => {
    const pickFromLibrary = async () => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.8,
          base64: false,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          const selectedAsset = result.assets[0];
          
          // Check file size before processing
          const fileInfo = await FileSystem.getInfoAsync(selectedAsset.uri);
          const sizeInMB = fileInfo.exists && 'size' in fileInfo ? (fileInfo.size || 0) / (1024 * 1024) : 0;
          
          if (sizeInMB > 50) { // Increased limit for file-based processing
            Alert.alert(
              'Large Image',
              'This image is quite large. Processing may take longer. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', onPress: () => setSelectedImage(selectedAsset) }
              ]
            );
            return;
          }
          
          setSelectedImage(selectedAsset);
          setEncryptedImageText('');
          setShowImageResult(false);
        }
      } catch (error) {
        console.error('Error picking from library:', error);
        Alert.alert('Error', 'Failed to pick image from library');
      }
    };

    const pickFromCamera = async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.8,
          base64: false,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          const selectedAsset = result.assets[0];
          
          // Check file size before processing
          const fileInfo = await FileSystem.getInfoAsync(selectedAsset.uri);
          const sizeInMB = fileInfo.exists && 'size' in fileInfo ? (fileInfo.size || 0) / (1024 * 1024) : 0;
          
          if (sizeInMB > 50) {
            Alert.alert(
              'Large Image',
              'This image is quite large. Processing may take longer. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', onPress: () => setSelectedImage(selectedAsset) }
              ]
            );
            return;
          }
          
          setSelectedImage(selectedAsset);
          setEncryptedImageText('');
          setShowImageResult(false);
        }
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to take photo');
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickFromCamera();
          } else if (buttonIndex === 2) {
            pickFromLibrary();
          }
        }
      );
    } else {
      Alert.alert(
        'Select Image',
        'Choose how to select an image',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: pickFromCamera },
          { text: 'Choose from Library', onPress: pickFromLibrary },
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

      // Convert file URI to RNFS path if needed
      let inputPath = imageUri;
      if (imageUri.startsWith('file://')) {
        inputPath = imageUri.replace('file://', '');
      }

      const tempPath = `${RNFS.TemporaryDirectoryPath}/encrypted-${Date.now()}.crypt`;
      
      // Process directly from file URI to file
      await encryptInBackground(inputPath, tempPath, imageKey);
      
      // Read result only when needed
      const encryptedResult = await RNFS.readFile(tempPath, 'utf8');

      // Cache the result
      addToEncryptionCache(cacheKey, encryptedResult);
      
      setEncryptedImageText(encryptedResult);
      setShowImageResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Clean up temporary file
      await RNFS.unlink(tempPath);
      
      console.log('Encryption completed successfully');
    } catch (error) {
      console.error('Encryption error:', error);
      Alert.alert('Error', 'Failed to encrypt image. Please try again with a different key.');
    } finally {
      setIsEncryptingImage(false);
      processingRef.current = false;
      
      // Clean up memory after encryption
      cleanupMemory();
    }
  };

    const decryptImage = async () => {
    if (!imageTextInput.trim() || !imageKey.trim()) {
      Alert.alert('Error', 'Please paste the encrypted text and enter the key');
      return;
    }

    // Prevent multiple simultaneous operations
    if (processingRef.current) {
      return;
    }
    processingRef.current = true;
    setIsDecryptingImage(true);

    try {
      const trimmedText = imageTextInput.trim();
      
      console.log('Starting decryption...');
      
      // Check if the encrypted text is large
      const textSize = trimmedText.length;
      const sizeInMB = (textSize * 2) / (1024 * 1024); // Approximate size in MB
      
      const tempInputPath = `${RNFS.TemporaryDirectoryPath}/decrypt-input-${Date.now()}.tmp`;
      const tempOutputPath = `${RNFS.TemporaryDirectoryPath}/decrypted-${Date.now()}.bin`;
      
      // Write encrypted text to temp file using appropriate method
      if (sizeInMB > 50) {
        // For large encrypted text, use RNFS for better performance
        await RNFS.writeFile(tempInputPath, trimmedText, 'utf8');
      } else {
        // For smaller text, use FileSystem
        await FileSystem.writeAsStringAsync(tempInputPath, trimmedText, { 
          encoding: FileSystem.EncodingType.UTF8 
        });
      }
      
      // Process through file system
      await decryptInBackground(tempInputPath, tempOutputPath, imageKey);
      
      // Read the decrypted result
      const decryptedBytes = await RNFS.readFile(tempOutputPath, 'base64');
      
      // Validate that it's a valid image format
      let mime = '';
      if (decryptedBytes.startsWith('/9j/')) mime = 'image/jpeg';
      else if (decryptedBytes.startsWith('iVBORw0KGgo')) mime = 'image/png';
      else if (decryptedBytes.startsWith('R0lGODlh')) mime = 'image/gif';
      else {
        throw new Error('Decrypted data is not a valid image');
      }
            
      const uri = `data:${mime};base64,${decryptedBytes}`;
      setDecryptedImageUri(uri);
      setShowImageResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Clean up temporary files
      await RNFS.unlink(tempInputPath);
      await RNFS.unlink(tempOutputPath);
      
      console.log('Decryption completed successfully');
    } catch (error) {
      console.error('Decryption error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Invalid key') || errorMessage.includes('corrupted')) {
        Alert.alert('Error', 'Invalid key or corrupted data. Please check your key and encrypted text.');
      } else if (errorMessage.includes('not a valid image')) {
        Alert.alert('Error', 'The decrypted data is not a valid image. Please check your encrypted text.');
      } else {
        Alert.alert('Error', 'Failed to decrypt image. Please check your key and encrypted text.');
      }
    } finally {
      setIsDecryptingImage(false);
      processingRef.current = false;
      
      // Clean up memory after decryption
      cleanupMemory();
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
  };

  // Clear all caches (useful for memory management)
  const clearCaches = useCallback(() => {
    encryptionCache.clear();
  }, []);

  // Memory monitoring function
  const checkMemoryUsage = useCallback(() => {
    try {
      // Simple memory check - if we're processing large data, clear caches
      if (encryptionCache.size > 3) {
        cleanupMemory();
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
      
      // Convert file URI to RNFS path if needed
      let inputPath = fileUri;
      if (fileUri.startsWith('file://')) {
        inputPath = fileUri.replace('file://', '');
      }
      
      // Check file size before processing
      try {
        const fileInfo = await RNFS.stat(inputPath);
        const sizeInMB = fileInfo.size / (1024 * 1024);
        
        if (sizeInMB > 100) { // 100MB limit for text files
          Alert.alert(
            'Large File',
            'This file is very large. Processing may take longer. Continue?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue', onPress: () => processLargeFile(inputPath) }
            ]
          );
          return;
        }
      } catch (statError) {
        console.log('Could not get file size, proceeding with import');
      }
      
      // For smaller files, read directly
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

  // Helper function to process large text files in chunks
  const processLargeFile = async (inputPath: string) => {
    try {
      const tempOutputPath = `${RNFS.TemporaryDirectoryPath}/imported-text-${Date.now()}.txt`;
      
      // Read file in chunks and write to temporary file
      const chunkSize = 1024 * 1024; // 1MB chunks
      const fileInfo = await RNFS.stat(inputPath);
      const totalSize = fileInfo.size;
      
      // Clear output file
      await RNFS.writeFile(tempOutputPath, '', 'utf8');
      
      let currentPosition = 0;
      const concurrency = 4;
      let activeOperations = 0;
      let hasError = false;
      
      const processNextChunk = async () => {
        if (hasError || currentPosition >= totalSize) {
          if (activeOperations === 0 && !hasError) {
            // Read the complete processed file
            const finalContent = await RNFS.readFile(tempOutputPath, 'utf8');
            setImageTextInput(finalContent);
            Alert.alert('Success', 'Large encrypted text file imported successfully!');
            
            // Clean up temporary file
            await RNFS.unlink(tempOutputPath);
          }
          return;
        }
        
        activeOperations++;
        const start = currentPosition;
        const end = Math.min(start + chunkSize, totalSize);
        currentPosition = end;
        
        try {
          // Read chunk from input file
          const chunk = await RNFS.read(inputPath, end - start, start, 'utf8');
          
          // Append chunk to output file
          await RNFS.appendFile(tempOutputPath, chunk, 'utf8');
        } catch (error) {
          hasError = true;
          console.error('Chunk processing error:', error);
          Alert.alert('Error', 'Failed to process large file. Please try again.');
          return;
        } finally {
          activeOperations--;
        }
        
        // Continue processing
        if (!hasError) {
          processNextChunk();
        }
      };
      
      // Start initial batch of concurrent operations
      for (let i = 0; i < Math.min(concurrency, Math.ceil(totalSize / chunkSize)); i++) {
        processNextChunk();
      }
      
    } catch (error) {
      console.error('Large file processing error:', error);
      Alert.alert('Error', 'Failed to process large file. Please try again.');
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
      
      // Check if the encrypted text is large
      const textSize = encryptedImageText.length;
      const sizeInMB = (textSize * 2) / (1024 * 1024); // Approximate size in MB
      
      if (sizeInMB > 50) { // For large encrypted text
        // Use RNFS for better performance with large files
        const rnfsPath = fileUri.replace('file://', '');
        await RNFS.writeFile(rnfsPath, encryptedImageText, 'utf8');
      } else {
        // Use FileSystem for smaller files
        await FileSystem.writeAsStringAsync(fileUri, encryptedImageText, { 
          encoding: FileSystem.EncodingType.UTF8 
        });
      }

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
    cleanupMemory,
    checkMemoryUsage,
    exportEncryptedImageText,
    importEncryptedImageText,
    shareEncryptedImageText,
  };
} 