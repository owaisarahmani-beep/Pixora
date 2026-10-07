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

    // TODO: Re-enable `require('expo-screen-capture')` once the new APK is installed.
    // RedBox catches the NativeModule missing error even inside a try/catch, 
    // so we must completely stub this out for now to allow dev testing.
    let ScreenCapture: any = null;

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
