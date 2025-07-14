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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import CryptoJS from 'react-native-crypto-js';

const { width, height } = Dimensions.get('window');

export default function CrypterApp() {
  const [activeTab, setActiveTab] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('');
  const [result, setResult] = useState('');
  const [showResult, setShowResult] = useState(false);

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

          {/* Instructions */}
          <View style={styles.instructionsSection}>
            <Text style={styles.instructionsTitle}>How to use:</Text>
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
});