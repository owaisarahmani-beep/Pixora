import * as LocalAuthentication from 'expo-local-authentication';

export type AppLockCapability = {
  isAvailable: boolean;
  securityLevel: LocalAuthentication.SecurityLevel;
  error?: string;
};

class AppLockService {
  /**
   * Checks if the device can perform authentication (Biometric or Device PIN)
   */
  async checkCapabilityAsync(): Promise<AppLockCapability> {
    try {
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
      
      // We consider authentication available if they have at least a SECRET (PIN/Pattern) or Biometric
      const isAvailable = isEnrolled && securityLevel >= LocalAuthentication.SecurityLevel.SECRET;
      
      return { isAvailable, securityLevel };
    } catch (e: any) {
      return { isAvailable: false, securityLevel: LocalAuthentication.SecurityLevel.NONE, error: e.message };
    }
  }

  /**
   * Prompts the user to authenticate.
   * Fails closed on any error or cancellation.
   */
  async authenticateAsync(promptMessage: string = 'Unlock Pixora'): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        disableDeviceFallback: false, // Ensure PIN fallback is enabled
        requireConfirmation: true, // For Face Unlock, require user to tap "Confirm" before unlocking
        cancelLabel: 'Cancel'
      });

      return result.success;
    } catch (e) {
      console.warn('Authentication encountered an unexpected error:', e);
      return false;
    }
  }
}

export const appLockService = new AppLockService();
