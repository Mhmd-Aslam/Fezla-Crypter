Fezla Crypter
A secure communication app for Android and iOS that allows users to encrypt and decrypt messages using AES encryption.

Features
AES Encryption: Uses industry-standard AES encryption for secure messaging
Cross-Platform: Works on both Android and iOS
Easy to Use: Simple interface for encrypting and decrypting messages
Copy to Clipboard: Quick copy functionality for sharing encrypted messages
Secure Communication: Share encrypted messages via WhatsApp, Telegram, or any chat app
How it Works
Encryption: User A types a secret message and a secret key, gets encrypted output
Sharing: User A copies the encrypted message and shares it via any chat app
Decryption: User B receives the encrypted message and decrypts it using the same secret key
Installation
Clone the repository
Install dependencies:
bash
npm install
Start the development server:
bash
npm start
Run on device/emulator:
bash
npm run android  # for Android
npm run ios      # for iOS
Tech Stack
React Native
Expo
TypeScript
React Native Crypto JS
Expo Clipboard
Expo Haptics
Security Features
AES encryption algorithm
No data storage on device
Secure key handling
Real-time encryption/decryption
Usage
Encryption
Switch to "Encrypt" tab
Enter your secret message
Enter a secret key
Tap "Encrypt Message"
Copy the encrypted result
Share via any messaging app
Decryption
Switch to "Decrypt" tab
Paste the encrypted message
Enter the same secret key used for encryption
Tap "Decrypt Message"
View the original message
Development
This project uses Expo Router for navigation and is built with TypeScript for type safety.

Contributing
Feel free to submit issues and pull requests to improve the app.

License
MIT License

