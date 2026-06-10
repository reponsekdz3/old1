const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Production optimizations
config.transformer = {
  ...config.transformer,
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    compress: {
      drop_console: process.env.NODE_ENV === 'production',
      reduce_funcs: true,
      collapse_vars: true,
      pure_getters: true,
    },
    mangle: {
      keep_fnames: false,
      keep_classnames: false,
    },
    output: {
      comments: false,
      ascii_only: true,
    },
  },
};

// Enable asset caching
config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts, 'db', 'sqlite', 'wav', 'mp3'],
  sourceExts: [...config.resolver.sourceExts, 'jsx', 'js', 'ts', 'tsx'],
};

// Cache configuration for faster rebuilds
config.cacheStores = [
  {
    name: 'metro-cache',
    maxSize: 500 * 1024 * 1024, // 500 MB
  },
];

module.exports = config;
