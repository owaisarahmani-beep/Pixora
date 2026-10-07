import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Hook to protect sensitive screens from being captured or exposed
 * in the recent apps task switcher (via FLAG_SECURE on Android).
 * 
 * @param isActive Whether the protection should be active
 */
export function useSecureScreen(isActive: boolean = true) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let ScreenCapture: any;
    try {
      // Dynamically require so it doesn't crash the JS bundle if the native module is missing in the current APK
      ScreenCapture = require('expo-screen-capture');
    } catch (e) {
      console.warn('ExpoScreenCapture native module is missing. Please rebuild the dev client.');
      return;
    }

    let isActiveState = false;

    async function enableProtection() {
      try {
        if (ScreenCapture?.preventScreenCaptureAsync) {
          await ScreenCapture.preventScreenCaptureAsync();
          isActiveState = true;
        }
      } catch (e) {
        console.warn('Failed to enable secure screen protection:', e);
      }
    }

    async function disableProtection() {
      if (!isActiveState) return;
      try {
        if (ScreenCapture?.allowScreenCaptureAsync) {
          await ScreenCapture.allowScreenCaptureAsync();
          isActiveState = false;
        }
      } catch (e) {
        console.warn('Failed to disable secure screen protection:', e);
      }
    }

    if (isActive) {
      enableProtection();
    } else {
      disableProtection();
    }

    return () => {
      disableProtection();
    };
  }, [isActive]);
}
