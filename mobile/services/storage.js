import AsyncStorage from '@react-native-async-storage/async-storage';

export const Storage = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
  clear: () => AsyncStorage.clear(),

  getJSON: async (key) => {
    const val = await AsyncStorage.getItem(key);
    try { return val ? JSON.parse(val) : null; } catch { return null; }
  },
  setJSON: (key, value) => AsyncStorage.setItem(key, JSON.stringify(value)),
};

export const TokenStorage = {
  getAccessToken: () => Storage.get('access_token'),
  getRefreshToken: () => Storage.get('refresh_token'),
  setTokens: (access, refresh) => Promise.all([
    Storage.set('access_token', access),
    Storage.set('refresh_token', refresh),
  ]),
  clearTokens: () => Promise.all([
    Storage.remove('access_token'),
    Storage.remove('refresh_token'),
  ]),
};
