import { useEffect } from 'react';
import { Platform } from 'react-native';

// Web-only framework ready hook
export function useFrameworkReady() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Only call frameworkReady on web platform
      const win = window as any;
      win.frameworkReady?.();
    }
  }, []);
}
