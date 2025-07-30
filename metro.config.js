const { getDefaultConfig } = require('expo/metro-config');
const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push('cjs');
defaultConfig.resolver.sourceExts.push('js');

module.exports = defaultConfig;