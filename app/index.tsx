import React, { useCallback, memo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTextCrypter } from './hooks/useTextCrypter';
import { useImageCrypter } from './hooks/useImageCrypter';

const { width, height } = Dimensions.get('window');

const Header = memo(() => (
  <View style={styles.header}>
    <View style={styles.headerContent}>
      <Ionicons name="shield-checkmark" size={32} color="#00d4ff" />
      <Text style={styles.title}>Fezla Crypter</Text>
    </View>
    <Text style={styles.subtitle}>Secure Communication Made Easy</Text>
  </View>
));

const ModeToggle = memo(({ mode, switchMode }: { mode: 'text' | 'image'; switchMode: (m: 'text' | 'image') => void }) => (
  <View style={styles.modeContainer}>
    <TouchableOpacity
      style={[styles.modeTab, mode === 'text' && styles.activeModeTab]}
      onPress={() => switchMode('text')}
    >
      <Ionicons name="chatbubble" size={18} color={mode === 'text' ? '#1a1a2e' : '#00d4ff'} />
      <Text style={[styles.modeText, mode === 'text' && styles.activeModeText]}>Text</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.modeTab, mode === 'image' && styles.activeModeTab]}
      onPress={() => switchMode('image')}
    >
      <Ionicons name="image" size={18} color={mode === 'image' ? '#1a1a2e' : '#00d4ff'} />
      <Text style={[styles.modeText, mode === 'image' && styles.activeModeText]}>Image</Text>
    </TouchableOpacity>
  </View>
));

const TabSwitcher = memo(({ activeTab, switchTab }: { activeTab: 'encrypt' | 'decrypt'; switchTab: (t: 'encrypt' | 'decrypt') => void }) => (
  <View style={styles.tabContainer}>
    <TouchableOpacity
      style={[styles.tab, activeTab === 'encrypt' && styles.activeTab]}
      onPress={() => switchTab('encrypt')}
    >
      <Ionicons name="lock-closed" size={20} color={activeTab === 'encrypt' ? '#1a1a2e' : '#00d4ff'} />
      <Text style={[styles.tabText, activeTab === 'encrypt' && styles.activeTabText]}>Encrypt</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tab, activeTab === 'decrypt' && styles.activeTab]}
      onPress={() => switchTab('decrypt')}
    >
      <Ionicons name="lock-open" size={20} color={activeTab === 'decrypt' ? '#1a1a2e' : '#00d4ff'} />
      <Text style={[styles.tabText, activeTab === 'decrypt' && styles.activeTabText]}>Decrypt</Text>
    </TouchableOpacity>
  </View>
));

const Footer = memo(() => (
  <View style={styles.footer}>
    <Text style={styles.footerText}>Developed by Mhmd-Aslam</Text>
  </View>
));

export default function CrypterApp() {
  const [activeTab, setActiveTab] = React.useState<'encrypt' | 'decrypt'>('encrypt');
  const [mode, setMode] = React.useState<'text' | 'image'>('text');

  // Text mode hook
  const textCrypter = useTextCrypter();
  // Image mode hook
  const imageCrypter = useImageCrypter();

  // Tab/mode switching
  const switchTab = useCallback((tab: 'encrypt' | 'decrypt') => {
    setActiveTab(tab);
    textCrypter.clearFields();
    imageCrypter.clearImageFields();
  }, [textCrypter, imageCrypter]);

  const switchMode = useCallback((newMode: 'text' | 'image') => {
    setMode(newMode);
    textCrypter.clearFields();
    imageCrypter.clearImageFields();
  }, [textCrypter, imageCrypter]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Header />
          <ModeToggle mode={mode} switchMode={switchMode} />
          <TabSwitcher activeTab={activeTab} switchTab={switchTab} />

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
                    value={textCrypter.message}
                    onChangeText={textCrypter.setMessage}
                    textAlignVertical="top"
                  />
                  <Text style={{ fontSize: 11, color: '#b0b0b0', alignSelf: 'flex-end', marginTop: 4, marginRight: 2 }}>
                    {textCrypter.message.length} chars
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Secret Key</Text>
                  <TextInput
                    style={styles.keyInput}
                    placeholder="Enter your secret key..."
                    placeholderTextColor="#666"
                    value={textCrypter.key}
                    onChangeText={textCrypter.setKey}
                    secureTextEntry
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={activeTab === 'encrypt' ? textCrypter.encrypt : textCrypter.decrypt}
                    disabled={textCrypter.isEncrypting || textCrypter.isDecrypting}
                  >
                    <Ionicons 
                      name={activeTab === 'encrypt' ? 'shield' : 'shield-checkmark'} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.buttonText}>
                      {activeTab === 'encrypt' ? (textCrypter.isEncrypting ? 'Encrypting...' : 'Encrypt Message') : (textCrypter.isDecrypting ? 'Decrypting...' : 'Decrypt Message')}
                    </Text>
                    {(textCrypter.isEncrypting || textCrypter.isDecrypting) && (
                      <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.clearButton} onPress={textCrypter.clearFields}>
                    <Ionicons name="refresh" size={20} color="#ff6b6b" />
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Result Section */}
              {textCrypter.showResult && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultLabel}>
                    {activeTab === 'encrypt' ? 'Encrypted Message' : 'Decrypted Message'}
                  </Text>
                  <View style={styles.resultContainer}>
                    <Text style={styles.resultText} selectable>
                      {textCrypter.result}
                    </Text>
                    <TouchableOpacity style={styles.copyButton} onPress={textCrypter.copyToClipboard}>
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
                      ? 'Copy the encrypted message and share via any chat app'
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
                <View style={[styles.inputSection, { marginTop: 0 }]}>  
                  <Text style={styles.inputLabel}>Image Encryption</Text>
                  <TouchableOpacity style={styles.actionButton} onPress={imageCrypter.pickImage}>
                    <Ionicons name="image" size={20} color="#fff" />
                    <Text style={styles.buttonText}>{imageCrypter.selectedImage ? 'Change Image' : 'Pick Image'}</Text>
                  </TouchableOpacity>
                  {imageCrypter.selectedImage && imageCrypter.selectedImage.uri && (
                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                      <Image source={{ uri: imageCrypter.selectedImage.uri }} style={{ width: 120, height: 120, borderRadius: 10 }} />
                    </View>
                  )}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Secret Key</Text>
                    <TextInput
                      style={styles.keyInput}
                      placeholder="Enter key for image..."
                      placeholderTextColor="#666"
                      value={imageCrypter.imageKey}
                      onChangeText={imageCrypter.setImageKey}
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.actionButton} onPress={imageCrypter.encryptImage} disabled={imageCrypter.isEncryptingImage}>
                      <Ionicons name="shield" size={20} color="#fff" />
                      <Text style={styles.buttonText}>{imageCrypter.isEncryptingImage ? 'Encrypting...' : 'Encrypt Image'}</Text>
                      {imageCrypter.isEncryptingImage && (
                        <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.clearButton} onPress={imageCrypter.clearImageFields}>
                      <Ionicons name="refresh" size={20} color="#ff6b6b" />
                      <Text style={styles.clearButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  {imageCrypter.isEncryptingImage && (
                    <View style={styles.progressContainer}>
                      <Text style={styles.progressText}>Processing...</Text>
                      <Text style={styles.progressSubtext}>Please wait, this may take a few seconds</Text>
                    </View>
                  )}
                  {imageCrypter.showImageResult && !!imageCrypter.encryptedImageText && (
                    <View style={styles.resultSection}>
                      <Text style={styles.resultLabel}>Encrypted Image Text</Text>
                      <ScrollView style={{ maxHeight: 120 }}>
                        <Text style={styles.resultText} selectable>{imageCrypter.encryptedImageText}</Text>
                      </ScrollView>
                      <Text style={{ fontSize: 11, color: '#b0b0b0', alignSelf: 'flex-end', marginTop: 4, marginRight: 2 }}>
                        {imageCrypter.encryptedImageText.length} chars
                      </Text>
                      {/* Copy button in top-right corner, only if text length <= 20000 */}
                      {imageCrypter.encryptedImageText.length <= 20000 && (
                        <TouchableOpacity style={styles.copyButton} onPress={imageCrypter.copyImageText}>
                          <Ionicons name="copy" size={20} color="#00d4ff" />
                          <Text style={styles.copyButtonText}>Copy</Text>
                        </TouchableOpacity>
                      )}
                      {/* Share Button */}
                      <View style={styles.resultButtonRow}>
                        <TouchableOpacity style={styles.resultActionButton} onPress={imageCrypter.shareEncryptedImageText}>
                          <Ionicons name="share-social" size={20} color="#00d4ff" />
                          <Text style={styles.copyButtonText}>Share via...</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'decrypt' && (
                <View style={[styles.inputSection, { marginTop: 0 }]}>  
                  <Text style={styles.inputLabel}>Image Decryption</Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Encrypted Image Text</Text>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        style={styles.messageInput}
                        multiline
                        placeholder="Paste encrypted image text here..."
                        placeholderTextColor="#666"
                        value={imageCrypter.imageTextInput}
                        onChangeText={imageCrypter.setImageTextInput}
                        textAlignVertical="top"
                      />
                      {/* Import .txt button in top-right of textbox */}
                      <TouchableOpacity style={[styles.copyButton, { top: 10, right: 10 }]} onPress={imageCrypter.importEncryptedImageText}>
                        <Ionicons name="document" size={20} color="#00d4ff" />
                        <Text style={styles.copyButtonText}>Import .txt</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11, color: '#b0b0b0', alignSelf: 'flex-end', marginTop: 4, marginRight: 2 }}>
                      {imageCrypter.imageTextInput.length} chars
                    </Text>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Secret Key</Text>
                    <TextInput
                      style={styles.keyInput}
                      placeholder="Enter key for image..."
                      placeholderTextColor="#666"
                      value={imageCrypter.imageKey}
                      onChangeText={imageCrypter.setImageKey}
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.actionButton} onPress={imageCrypter.decryptImage} disabled={imageCrypter.isDecryptingImage}>
                      <Ionicons name="shield-checkmark" size={20} color="#fff" />
                      <Text style={styles.buttonText}>{imageCrypter.isDecryptingImage ? 'Decrypting...' : 'Decrypt Image'}</Text>
                      {imageCrypter.isDecryptingImage && (
                        <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.clearButton} onPress={imageCrypter.clearImageFields}>
                      <Ionicons name="refresh" size={20} color="#ff6b6b" />
                      <Text style={styles.clearButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  {imageCrypter.showImageResult && !!imageCrypter.decryptedImageUri && (
                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                      <Image source={{ uri: imageCrypter.decryptedImageUri }} style={{ width: 180, height: 180, borderRadius: 10 }} />
                      <TouchableOpacity 
                        style={[styles.actionButton, { marginTop: 10, width: '30%', alignSelf: 'center' }]} 
                        onPress={imageCrypter.saveDecryptedImage}
                      >
                        <Ionicons name="download" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Save Image</Text>
                      </TouchableOpacity>
                    </View>
                  )}
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
                      : 'Paste the encrypted image text (or import from a .txt file) and enter the secret key'
                    }
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>2.</Text>
                  <Text style={styles.instructionText}>
                    {activeTab === 'encrypt' 
                      ? 'Tap "Encrypt Image" to convert image to encrypted text (you can export or share this as a .txt file)'
                      : 'Tap "Decrypt Image" to convert text back to image'
                    }
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={styles.instructionNumber}>3.</Text>
                  <Text style={styles.instructionText}>
                    {activeTab === 'encrypt' 
                      ? 'Copy the encrypted text and share via any chat app, or save/share as a .txt file'
                      : 'View the decrypted image and save it to your gallery'
                    }
                  </Text>
                </View>
              </View>
            </>
          )}

          <Footer />
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
  resultButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  resultActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00d4ff',
    marginLeft: 0,
  },
  progressContainer: {
    marginTop: 15,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressSubtext: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
});