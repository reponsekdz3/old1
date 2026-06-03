import Constants from 'expo-constants';

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

export const API_URL = ENV_API_URL
  ? `${ENV_API_URL}/api`
  : 'http://localhost:8000/api';

export const SOCKET_URL = ENV_API_URL || 'http://localhost:8000';

export const COLORS = {
  primary: '#075E54',
  secondary: '#128C7E',
  accent: '#25D366',
  lightGreen: '#DCF8C6',
  bg: '#f0f2f5',
  white: '#FFFFFF',
  gray: '#8696A0',
  lightGray: '#F0F2F5',
  border: '#E9EDEF',
  danger: '#EF4444',
  blue: '#3B82F6',
  dark: '#111B21',
  textGray: '#667781',
};

export const AVATAR_COLORS = [
  '#25D366', '#128C7E', '#075E54',
  '#3B82F6', '#8B5CF6', '#EC4899',
  '#F59E0B', '#EF4444', '#06B6D4',
];
