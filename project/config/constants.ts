export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://jsonplaceholder.typicode.com',
  TIMEOUT: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '10000', 10),
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

export const AUTH_CONFIG = {
  TOKEN_KEY: 'auth_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
  USER_KEY: 'user_data',
  TOKEN_EXPIRY_BUFFER: 5 * 60 * 1000, // 5 minutes in milliseconds
} as const;

export const APP_CONFIG = {
  NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Production App',
  VERSION: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
} as const;

export const VALIDATION_RULES = {
  EMAIL_REGEX: /^.+@.+$/,  // Very basic email check - just needs @ symbol
  PASSWORD_MIN_LENGTH: 6,   // Reduced from 8 to 6
  NAME_MIN_LENGTH: 1,       // Reduced from 2 to 1
  NAME_MAX_LENGTH: 50,
} as const;

export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 3000,
  DEBOUNCE_DELAY: 500,
} as const;