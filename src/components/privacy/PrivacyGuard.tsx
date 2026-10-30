import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, AppState, AppStateStatus, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useTheme } from '../../theme/ThemeProvider';
import { appLockService } from '../../services/privacy/AppLockService';

export default function PrivacyGuard({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  
  const { 
    isAppLockEnabled, 
    isUnlocked, 
    isCapabilityChecked, 
    initialize, 
    unlock 
  } = usePrivacyStore();

  const appStateRef = useRef(AppState.currentState);
  const wasAuthenticatingRef = useRef(false);
  const hasInitialUnlockFiredRef = useRef(false);

  useEffect(() => {
    // Initialize the store on mount (loads async storage)
    initialize();
  }, [initialize]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // If the app is currently showing the native biometric / PIN challenge dialog,
      // the OS momentarily marks the window as 'inactive'. Do not lock out the user while authenticating.
      if (appLockService.isAuthenticating) {
        wasAuthenticatingRef.current = true;
        appStateRef.current = nextAppState;
        return;
      }

      // Transitioning to background or inactive (screen turned off or switched to another app)
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        const privacyState = usePrivacyStore.getState();
        // Ephemeral sessions (Private Vault, Locked Albums, in-memory registries) must lock on background
        privacyState.clearAllSessions();

        // If global App Lock is enabled, lock the entire app
        if (privacyState.isAppLockEnabled) {
          privacyState.lock();
        }
      }

      // Transitioning back to foreground active
      if (
        (appStateRef.current === 'inactive' || appStateRef.current === 'background') &&
        nextAppState === 'active'
      ) {
        const privacyState = usePrivacyStore.getState();
        // Re-check hardware / PIN capability so returning from system settings updates capability
        privacyState.initialize();

        // If returning from an authentication dialog (success or cancel), do not auto-retrigger prompt
        if (wasAuthenticatingRef.current) {
          wasAuthenticatingRef.current = false;
        } else if (privacyState.isAppLockEnabled && !privacyState.isUnlocked) {
          unlock();
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [unlock]);

  // Initial trigger for unlock if we mount in an active state and are locked
  useEffect(() => {
    if (
      isCapabilityChecked &&
      isAppLockEnabled &&
      !isUnlocked &&
      AppState.currentState === 'active' &&
      !hasInitialUnlockFiredRef.current
    ) {
      hasInitialUnlockFiredRef.current = true;
      unlock();
    }
  }, [isCapabilityChecked, isAppLockEnabled, isUnlocked, unlock]);

  // If we haven't checked capability/loaded storage yet, render nothing to avoid flashing
  if (!isCapabilityChecked) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  // If locked, render the Lock Screen and block children
  if (isAppLockEnabled && !isUnlocked) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Ionicons name="lock-closed" size={64} color={theme.accent} style={{ marginBottom: 24 }} />
        <Text style={[styles.title, { color: theme.text }]}>Pixora is Locked</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Authentication is required to access your gallery.
        </Text>
        
        <Pressable 
          style={[styles.button, { backgroundColor: theme.surface }]}
          onPress={() => unlock()}
        >
          <Text style={[styles.buttonText, { color: theme.text }]}>Unlock</Text>
        </Pressable>
      </View>
    );
  }

  // If unlocked or lock is disabled, render normal app
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
