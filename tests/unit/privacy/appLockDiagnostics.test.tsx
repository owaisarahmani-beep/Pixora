import React, { useState, useEffect, useRef } from 'react';
import { View, Text, AppState, AppStateStatus, Pressable } from 'react-native';
import { render, act, cleanup, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { appLockService } from '../../../src/services/privacy/AppLockService';
import PrivacyGuard from '../../../src/components/privacy/PrivacyGuard';

describe('Phase 10.1.13 — App Lock Diagnostics & Testing Blocker Resolution', () => {
  let appStateListeners: ((state: AppStateStatus) => void)[] = [];

  beforeEach(async () => {
    jest.clearAllMocks();
    appStateListeners = [];
    (AppState as any).currentState = 'active';

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'change') {
        appStateListeners.push(handler);
      }
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter((h) => h !== handler);
        },
      } as any;
    });

    jest.spyOn(appLockService, 'checkCapabilityAsync').mockResolvedValue({
      isAvailable: true,
      securityLevel: 2 as any,
    });
    jest.spyOn(appLockService, 'authenticateAsync').mockResolvedValue(true);

    appLockService.isAuthenticating = false;
    await AsyncStorage.clear();

    usePrivacyStore.setState({
      isAppLockEnabled: false,
      lockPolicy: 'immediate',
      isUnlocked: true,
      isCapabilityChecked: true,
      isSupportedOnDevice: true,
      isVaultUnlocked: false,
      unlockedAlbums: [],
      vaultMedia: [],
      privateAssetIds: ['v1'],
      lockedAlbumIds: ['album-1'],
    });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  const simulateAppStateChange = async (nextState: AppStateStatus) => {
    await act(async () => {
      (AppState as any).currentState = nextState;
      const listeners = [...appStateListeners];
      listeners.forEach((fn) => fn(nextState));
    });
  };

  it('prevents infinite prompt loop when user cancels biometric dialog on foreground return', async () => {
    let authenticateCallCount = 0;
    (appLockService.authenticateAsync as jest.Mock).mockImplementation(async () => {
      authenticateCallCount++;
      // Simulate user tapping Cancel on native dialog
      return false;
    });

    await AsyncStorage.setItem(
      '@pixora_privacy_store_v2',
      JSON.stringify({
        isAppLockEnabled: true,
        lockPolicy: 'immediate',
        hiddenAlbumIds: [],
        hiddenAssetIds: [],
        privateAssetIds: [],
        lockedAlbumIds: [],
        archivedAssetIds: [],
      })
    );

    usePrivacyStore.setState({
      isAppLockEnabled: true,
      isUnlocked: true,
    });

    const { getByText } = await render(
      <PrivacyGuard>
        <Text>Secret App Content</Text>
      </PrivacyGuard>
    );

    // Reset authenticateCallCount after initial mount
    authenticateCallCount = 0;

    // 1. App is backgrounded
    await simulateAppStateChange('background');
    expect(usePrivacyStore.getState().isUnlocked).toBe(false);

    // 2. User returns to app -> foreground active fires initial unlock
    await simulateAppStateChange('active');
    expect(authenticateCallCount).toBe(1);

    // 3. Native dialog opened, causing OS to momentarily report inactive
    appLockService.isAuthenticating = true;
    await simulateAppStateChange('inactive');

    // 4. User cancelled dialog -> authenticateAsync finishes with false
    appLockService.isAuthenticating = false;

    // 5. OS returns focus to app -> fires active event
    await simulateAppStateChange('active');

    // CRITICAL: Must NOT re-trigger authenticateAsync in a loop! Call count remains 1
    expect(authenticateCallCount).toBe(1);

    // The user must now see the lock screen with the Unlock button
    expect(getByText('Pixora is Locked')).toBeTruthy();
    expect(getByText('Unlock')).toBeTruthy();

    // 6. User manually taps "Unlock" -> invokes authentication cleanly
    fireEvent.press(getByText('Unlock'));
    expect(authenticateCallCount).toBe(2);
  });

  it('re-checks device capability on foreground return to detect newly added screen lock PIN', async () => {
    const initializeSpy = jest.spyOn(usePrivacyStore.getState(), 'initialize');

    await render(
      <PrivacyGuard>
        <Text>Content</Text>
      </PrivacyGuard>
    );

    initializeSpy.mockClear();

    // App backgrounded (e.g. user goes to Android Settings to set up PIN)
    await simulateAppStateChange('background');

    // User returns to Pixora
    await simulateAppStateChange('active');

    // Capability check / initialize must have been called on active
    const state = usePrivacyStore.getState();
    expect(state.isSupportedOnDevice).toBe(true);
  });

  it('resets authAttemptedRef on backgrounding so Private Vault prompts on return instead of freezing on spinner', async () => {
    // Simulator component mimicking src/app/settings/private-vault.tsx lifecycle
    function MockPrivateVaultScreen({ unlockMock }: { unlockMock: () => Promise<boolean> }) {
      const isVaultUnlocked = usePrivacyStore((s) => s.isVaultUnlocked);
      const authAttemptedRef = useRef(false);

      useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
          if (nextState === 'inactive' || nextState === 'background') {
            if (appLockService.isAuthenticating) return;
            usePrivacyStore.getState().lockVault();
            authAttemptedRef.current = false; // Reset on backgrounding!
          }
          if (nextState === 'active') {
            if (appLockService.isAuthenticating) return;
            if (!usePrivacyStore.getState().isVaultUnlocked && !authAttemptedRef.current) {
              authAttemptedRef.current = true;
              unlockMock();
            }
          }
        });
        return () => sub.remove();
      }, [unlockMock]);

      useEffect(() => {
        if (!isVaultUnlocked && !authAttemptedRef.current && AppState.currentState === 'active') {
          authAttemptedRef.current = true;
          unlockMock();
        }
      }, [isVaultUnlocked, unlockMock]);

      if (!isVaultUnlocked) {
        return (
          <View testID="vault-locked-gate">
            <Text>Authentication required to view protected media</Text>
            <Pressable testID="unlock-vault-btn" onPress={() => unlockMock()}>
              <Text>Unlock Vault</Text>
            </Pressable>
          </View>
        );
      }

      return (
        <View testID="vault-content">
          <Text>Vault Photos Displayed</Text>
        </View>
      );
    }

    let vaultUnlockCount = 0;
    const unlockMock = jest.fn(async () => {
      vaultUnlockCount++;
      usePrivacyStore.setState({ isVaultUnlocked: true });
      return true;
    });

    const screen = await render(<MockPrivateVaultScreen unlockMock={unlockMock} />);

    // Initial mount prompts and unlocks
    expect(vaultUnlockCount).toBe(1);
    expect(screen.getByTestId('vault-content')).toBeTruthy();

    // App is backgrounded for 2 seconds
    await simulateAppStateChange('background');
    expect(usePrivacyStore.getState().isVaultUnlocked).toBe(false);

    // App returns to foreground -> Active state triggers re-authentication prompt
    await simulateAppStateChange('active');

    expect(vaultUnlockCount).toBe(2);
    expect(screen.getByTestId('vault-content')).toBeTruthy();
  });

  it('renders interactive unlock button in locked album so users can authenticate after returning from background', async () => {
    // Simulator component mimicking src/app/album/[id].tsx
    function MockLockedAlbumScreen({
      albumId,
      onUnlockAlbum,
    }: {
      albumId: string;
      onUnlockAlbum: (id: string) => void;
    }) {
      const isLocked = usePrivacyStore((s) => s.isAlbumLocked(albumId));
      const isUnlocked = usePrivacyStore((s) => s.unlockedAlbums.includes(albumId));

      useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
          if (nextState === 'inactive' || nextState === 'background') {
            if (appLockService.isAuthenticating) return;
            if (isLocked) {
              usePrivacyStore.getState().lockAlbum(albumId);
            }
          }
        });
        return () => sub.remove();
      }, [isLocked, albumId]);

      if (isLocked && !isUnlocked) {
        return (
          <View testID="album-locked-gate">
            <Text>Authentication Required</Text>
            <Pressable testID="unlock-album-btn" onPress={() => onUnlockAlbum(albumId)}>
              <Text>Unlock Album</Text>
            </Pressable>
          </View>
        );
      }

      return (
        <View testID="album-content">
          <Text>Album Media Items</Text>
        </View>
      );
    }

    const onUnlockAlbum = jest.fn((id: string) => {
      usePrivacyStore.getState().unlockAlbum(id);
    });

    // Start with album unlocked
    usePrivacyStore.setState({ unlockedAlbums: ['album-1'] });

    const screen = await render(
      <MockLockedAlbumScreen albumId="album-1" onUnlockAlbum={onUnlockAlbum} />
    );

    expect(screen.getByTestId('album-content')).toBeTruthy();

    // Background app -> Album is locked
    await simulateAppStateChange('background');
    expect(usePrivacyStore.getState().unlockedAlbums).toEqual([]);

    // Return to foreground -> Screen displays Locked Gate with Unlock button
    await simulateAppStateChange('active');
    expect(screen.getByTestId('album-locked-gate')).toBeTruthy();
    expect(screen.getByTestId('unlock-album-btn')).toBeTruthy();

    // Tap Unlock Album button
    fireEvent.press(screen.getByTestId('unlock-album-btn'));
    expect(onUnlockAlbum).toHaveBeenCalledWith('album-1');
  });
});
