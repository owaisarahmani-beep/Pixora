import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, AppState, AppStateStatus, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrivacyStore } from '../../store/usePrivacyStore';
import { useTheme } from '../../theme/ThemeProvider';

export default function PrivacyGuard({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  
  const { 
    isAppLockEnabled, 
    lockPolicy, 
    isUnlocked, 
    isCapabilityChecked, 
    initialize, 
    lock, 
    unlock 
  } = usePrivacyStore();

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    // Initialize the store on mount (loads async storage)
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isAppLockEnabled) return;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Transitioning to background/inactive
      if (
        appStateRef.current === 'active' &&
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        if (lockPolicy === 'immediate') {
          lock();
        } else if (lockPolicy === 'inactivity') {
          // For Stage 5, "inactivity" is simple: we lock on background.
          // Inactivity could be more complex (e.g. timeout), but as per user instructions:
          // "If a reliable inactivity policy is too complex for this stage, implement immediate background locking first and document the limitation."
          // We will just treat 'inactivity' the same as 'immediate' for now if they are physically backgrounded.
          // Wait, 'inactivity' might mean 1 minute. Let's just lock immediately on background.
          lock();
        }
      }

      // Transitioning to foreground
      if (
        (appStateRef.current === 'inactive' || appStateRef.current === 'background') &&
        nextAppState === 'active'
      ) {
        // We are now active. If we are locked, prompt for unlock immediately.
        if (!usePrivacyStore.getState().isUnlocked) {
          unlock();
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAppLockEnabled, lockPolicy, lock, unlock]);

  // Initial trigger for unlock if we mount in an active state and are locked
  useEffect(() => {
    if (isCapabilityChecked && isAppLockEnabled && !isUnlocked && AppState.currentState === 'active') {
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
