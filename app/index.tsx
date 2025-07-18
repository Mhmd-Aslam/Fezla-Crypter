import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import CryptoJS from 'react-native-crypto-js';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const { width, height } = Dimensions.get('window');

export default function CrypterApp() {
  const [activeTab, setActiveTab] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [mode, setMode] = useState<'text' | 'image'>('text'); // Add mode state
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('');
  const [result, setResult] = useState('');
  const [showResult, setShowResult] = useState(false);

  // Image encryption/decryption states
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [encryptedImageText, setEncryptedImageText] = useState('');
  const [decryptedImageUri, setDecryptedImageUri] = useState('');
  const [imageKey, setImageKey] = useState('');
  const [imageTextInput, setImageTextInput] = useState('');
  const [showImageResult, setShowImageResult] = useState(false);
  const [isEncryptingImage, setIsEncryptingImage] = useState(false);
  const [isDecryptingImage, setIsDecryptingImage] = useState(false);

  // Add state for debug info:
  const [decryptionDebug, setDecryptionDebug] = useState('');

  const encrypt = () => {
    if (!message.trim() || !key.trim()) {
      Alert.alert('Error', 'Please enter both message and key');
      return;
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(message, key).toString();
      setResult(encrypted);
      setShowResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Encryption failed. Please try again.');
    }
  };

  const decrypt = () => {
    if (!message.trim() || !key.trim()) {
      Alert.alert('Error', 'Please enter both encrypted message and key');
      return;
    }

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

  const switchTab = (tab: 'encrypt' | 'decrypt') => {
    setActiveTab(tab);
    clearFields();
    clearImageFields();
  };

  // Add function to switch modes:
  const switchMode = (newMode: 'text' | 'image') => {
    setMode(newMode);
    clearFields();
    clearImageFields();
  };

  // Pick image from gallery or camera
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8, // Reduced from 1.0 to 0.8 for better performance
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  };

  // Encrypt image to text
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
      
      // Check if image is too large (more than 5MB)
      const sizeInMB = (base64.length * 0.75 / (1024 * 1024));
      if (sizeInMB > 5) {
        Alert.alert('Error', 'Image is too large. Please select a smaller image or reduce quality.');
        setIsEncryptingImage(false);
        return;
      }
      
      // Add timeout for encryption
      const encryptionPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const encrypted = CryptoJS.AES.encrypt(base64, imageKey).toString();
            resolve(encrypted);
          } catch (error) {
            reject(error);
          }
        }, 10000); // 10 second timeout
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

  // Decrypt text to image
  const decryptImage = async () => {
    if (!imageTextInput.trim() || !imageKey.trim()) {
      Alert.alert('Error', 'Please paste the encrypted text and enter the key');
      return;
    }
    setIsDecryptingImage(true);
    setDecryptionDebug('');
    try {
      const trimmedText = imageTextInput.trim();
      // Add debug: show encrypted text length
      setDecryptionDebug(`Encrypted text length: ${trimmedText.length}`);
      // Add timeout for decryption
      const decryptionPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const decrypted = CryptoJS.AES.decrypt(trimmedText, imageKey);
            const base64 = decrypted.toString(CryptoJS.enc.Utf8);
            // Add debug: show first 40 chars of base64
            setDecryptionDebug(prev => prev + `\nBase64 preview: ${base64.slice(0, 40)}`);
            if (!base64 || base64.length < 100) {
              reject(new Error('Invalid key or corrupted text'));
              return;
            }
            // Detect image type
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
      console.error('Decryption error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setDecryptionDebug(prev => prev + `\nError: ${errorMessage}`);
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

  // Save decrypted image to device
  const saveDecryptedImage = async () => {
    if (!decryptedImageUri) {
      Alert.alert('Error', 'No image to save. Please decrypt an image first.');
      return;
    }
    
    try {
      // Request permissions first
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save images to your gallery.');
        return;
      }
      
      // Extract base64 and determine file extension
      const base64 = decryptedImageUri.split(',')[1];
      if (!base64) {
        Alert.alert('Error', 'No image data to save.');
        return;
      }
      
      // Determine file extension based on image type
      let fileExtension = 'jpg'; // default
      if (decryptedImageUri.includes('image/png')) {
        fileExtension = 'png';
      } else if (decryptedImageUri.includes('image/gif')) {
        fileExtension = 'gif';
      }
      
      // Create filename with timestamp
      const timestamp = Date.now();
      const filename = `decrypted_image_${timestamp}.${fileExtension}`;
      
      console.log('Saving image as:', filename);
      console.log('Image type:', fileExtension);
      console.log('Base64 length:', base64.length);
      
      // Save to temporary file first
      const tempUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(tempUri, base64, { 
        encoding: FileSystem.EncodingType.Base64 
      });
      
      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(tempUri);
      await MediaLibrary.createAlbumAsync('Fezla Crypter', asset, false);
      
      console.log('Image saved successfully to gallery');
      Alert.alert('Success', `Image saved to gallery as ${filename}`);
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
      
    } catch (error) {
      console.error('Save image error:', error);
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

  // Copy encrypted image text
  const copyImageText = async () => {
    await Clipboard.setStringAsync(encryptedImageText);
    Alert.alert('Success', 'Encrypted image text copied!');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Clear image fields
  const clearImageFields = () => {
    setSelectedImage(null);
    setEncryptedImageText('');
    setDecryptedImageUri('');
    setImageKey('');
    setImageTextInput('');
    setShowImageResult(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="shield-checkmark" size={32} color="#00d4ff" />
              <Text style={styles.title}>Fezla Crypter</Text>
            </View>
            <Text style={styles.subtitle}>Secure Communication Made Easy</Text>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'text' && styles.activeModeTab]}
              onPress={() => switchMode('text')}
            >
              <Ionicons 
                name="chatbubble" 
                size={18} 
                color={mode === 'text' ? '#1a1a2e' : '#00d4ff'} 
              />
              <Text style={[styles.modeText, mode === 'text' && styles.activeModeText]}>
                Text
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'image' && styles.activeModeTab]}
              onPress={() => switchMode('image')}
            >
              <Ionicons 
                name="image" 
                size={18} 
                color={mode === 'image' ? '#1a1a2e' : '#00d4ff'} 
              />
              <Text style={[styles.modeText, mode === 'image' && styles.activeModeText]}>
                Image
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'encrypt' && styles.activeTab]}
              onPress={() => switchTab('encrypt')}
            >
              <Ionicons 
                name="lock-closed" 
                size={20} 
                color={activeTab === 'encrypt' ? '#1a1a2e' : '#00d4ff'} 
              />
              <Text style={[styles.tabText, activeTab === 'encrypt' && styles.activeTabText]}>
                Encrypt
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'decrypt' && styles.activeTab]}
              onPress={() => switchTab('decrypt')}
            >
              <Ionicons 
                name="lock-open" 
                size={20} 
                color={activeTab === 'decrypt' ? '#1a1a2e' : '#00d4ff'} 
              />
              <Text style={[styles.tabText, activeTab === 'decrypt' && styles.activeTabText]}>
                Decrypt
              </Text>
            </TouchableOpacity>
          </View>

          {/* Text Mode UI */}
          {mode === 'text' && (
            <>
              {/* Input Section */}
              <View style={styles.inputSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {activeTab === 'encrypt' ? 'Secret Message' : 'Encrypted Message'}
                  </Text>
                  <TextInput
                    style={styles.messageInput}
                    multiline
                    placeholder={activeTab === 'encrypt' ? 'Enter your secret message...' : 'Paste encrypted message here...'}
                    placeholderTextColor="#666"
                    value={message}
                    onChangeText={setMessage}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Secret Key</Text>
                  <TextInput
                    style={styles.keyInput}
                    placeholder="Enter your secret key..."
                    placeholderTextColor="#666"
                    value={key}
                    onChangeText={setKey}
                    secureTextEntry
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={activeTab === 'encrypt' ? encrypt : decrypt}
                  >
                    <Ionicons 
                      name={activeTab === 'encrypt' ? 'shield' : 'shield-checkmark'} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.buttonText}>
                      {activeTab === 'encrypt' ? 'Encrypt Message' : 'Decrypt Message'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.clearButton} onPress={clearFields}>
                    <Ionicons name="refresh" size={20} color="#ff6b6b" />
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Result Section */}
              {showResult && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultLabel}>
                    {activeTab === 'encrypt' ? 'Encrypted Message' : 'Decrypted Message'}
                  </Text>
                  <View style={styles.resultContainer}>
                    <Text style={styles.resultText} selectable>
                      {result}
                    </Text>
                    <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                      <Ionicons name="copy" size={20} color="#00d4ff" />
                      <Text style={styles.copyButtonText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Text Instructions */}
              <View style={styles.instructionsSection}>
                <Text style={styles.instructionsTitle}>How to use Text Mode:</Text>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>1.</Text>
                  <Text style={styles.instructionText}>
                    {activeTab === 'encrypt' 
                      ? 'Type your secret message and create a secret key'
                      : 'Paste the encrypted message and enter the secret key'
                    }
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>2.</Text>
                  <Text style={styles.instructionText}>
                    {activeTab === 'encrypt' 
                      ? 'Tap "Encrypt Message" to generate encrypted text'
                      : 'Tap "Decrypt Message" to reveal the original message'
                    }
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>3.</Text>
                  <Text style={styles.instructionText}>
                    {activeTab === 'encrypt' 
                      ? 'Copy the encrypted message and share via WhatsApp or any chat app'
                      : 'View your decrypted message'
                    }
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Image Mode UI */}
          {mode === 'image' && (
            <>
              {activeTab === 'encrypt' && (
                <View style={styles.inputSection}>  
                  <Text style={styles.inputLabel}>Image Encryption</Text>
                  <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
                    <Ionicons name="image" size={20} color="#fff" />
                    <Text style={styles.buttonText}>{selectedImage ? 'Change Image' : 'Pick Image'}</Text>
                  </TouchableOpacity>
                  {selectedImage && selectedImage.uri && (
                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                      <Image source={{ uri: selectedImage.uri }} style={{ width: 120, height: 120, borderRadius: 10 }} />
                    </View>
                  )}
                  <TextInput
                    style={styles.keyInput}
                    placeholder="Enter key for image..."
                    placeholderTextColor="#666"
                    value={imageKey}
                    onChangeText={setImageKey}
                    secureTextEntry
                  />
                  <TouchableOpacity style={styles.actionButton} onPress={encryptImage} disabled={isEncryptingImage}>
                    <Ionicons name="shield" size={20} color="#fff" />
                    <Text style={styles.buttonText}>{isEncryptingImage ? 'Encrypting...' : 'Encrypt Image'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearButton} onPress={clearImageFields}>
                    <Ionicons name="refresh" size={20} color="#ff6b6b" />
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                  {showImageResult && !!encryptedImageText && (
                    <View style={styles.resultSection}>
                      <Text style={styles.resultLabel}>Encrypted Image Text</Text>
                      <ScrollView style={{ maxHeight: 120 }}>
                        <Text style={styles.resultText} selectable>{encryptedImageText}</Text>
                      </ScrollView>
                      <TouchableOpacity style={styles.copyButton} onPress={copyImageText}>
                        <Ionicons name="copy" size={20} color="#00d4ff" />
                        <Text style={styles.copyButtonText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'decrypt' && (
                <View style={styles.inputSection}>  
                  <Text style={styles.inputLabel}>Image Decryption</Text>
                  <TextInput
                    style={styles.messageInput}
                    multiline
                    placeholder="Paste encrypted image text here..."
                    placeholderTextColor="#666"
                    value={imageTextInput}
                    onChangeText={setImageTextInput}
                    textAlignVertical="top"
                  />
                  <TextInput
                    style={styles.keyInput}
                    placeholder="Enter key for image..."
                    placeholderTextColor="#666"
                    value={imageKey}
                    onChangeText={setImageKey}
                    secureTextEntry
                  />
                  <TouchableOpacity style={styles.actionButton} onPress={decryptImage} disabled={isDecryptingImage}>
                    <Ionicons name="shield-checkmark" size={20} color="#fff" />
                    <Text style={styles.buttonText}>{isDecryptingImage ? 'Decrypting...' : 'Decrypt Image'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearButton} onPress={clearImageFields}>
                    <Ionicons name="refresh" size={20} color="#ff6b6b" />
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                  {showImageResult && !!decryptedImageUri && (
                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                      <Image source={{ uri: decryptedImageUri }} style={{ width: 180, height: 180, borderRadius: 10 }} />
                      <TouchableOpacity style={[styles.actionButton, { marginTop: 10 }]} onPress={saveDecryptedImage}>
                        <Ionicons name="download" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Save Image</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {decryptionDebug ? (
                    <View style={{ backgroundColor: '#222', padding: 10, borderRadius: 8, marginTop: 10 }}>
                      <Text style={{ color: '#fff', fontSize: 12 }}>Debug Info:</Text>
                      <Text style={{ color: '#0ff', fontSize: 12 }}>{decryptionDebug}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Image Instructions */}
              <View style={styles.instructionsSection}>
                <Text style={styles.instructionsTitle}>How to use Image Mode:</Text>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>1.</Text>
                  <Text style={styles.instructionText}>
                    {activeTab === 'encrypt' 
                      ? 'Select an image from your gallery and enter a secret key'
                      : 'Paste the encrypted image text and enter the secret key'
                    }
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>2.</Text>
                  <Text style={styles.instructionText}>
                    {activeTab === 'encrypt' 
                      ? 'Tap "Encrypt Image" to convert image to encrypted text'
                      : 'Tap "Decrypt Image" to convert text back to image'
                    }
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>3.</Text>
                  <Text style={styles.instructionText}>
                    {activeTab === 'encrypt' 
                      ? 'Copy the encrypted text and share via WhatsApp or any chat app'
                      : 'View the decrypted image and save it to your gallery'
                    }
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Developed by Mhmd-Aslam</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#2a2a3e',
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#00d4ff',
  },
  tabText: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#1a1a2e',
  },
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  messageInput: {
    backgroundColor: '#2a2a3e',
    borderRadius: 15,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  keyInput: {
    backgroundColor: '#2a2a3e',
    borderRadius: 15,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#00d4ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 15,
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  clearButton: {
    backgroundColor: '#2a2a3e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  clearButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  resultContainer: {
    backgroundColor: '#2a2a3e',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#00d4ff',
    position: 'relative',
  },
  resultText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  copyButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#1a1a2e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  copyButtonText: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  instructionsSection: {
    marginHorizontal: 20,
    marginBottom: 40,
    backgroundColor: '#2a2a3e',
    borderRadius: 15,
    padding: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 15,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginRight: 12,
    width: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  footerText: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  modeContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#2a2a3e',
    borderRadius: 20,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 17,
  },
  activeModeTab: {
    backgroundColor: '#00d4ff',
  },
  modeText: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeModeText: {
    color: '#1a1a2e',
  },
});