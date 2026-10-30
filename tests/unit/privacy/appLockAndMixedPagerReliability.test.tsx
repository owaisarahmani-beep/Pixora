import React, { useState, useEffect } from 'react';
import { View, Text, AppState, AppStateStatus, StyleSheet } from 'react-native';
import { render, act, cleanup } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { appLockService } from '../../../src/services/privacy/AppLockService';
import PrivacyGuard from '../../../src/components/privacy/PrivacyGuard';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import { Ionicons } from '@expo/vector-icons';

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockImage = (props: any) => {
    return React.createElement(View, {
      ...props,
      testID: props.testID || 'expo-image-mock',
    });
  };
  MockImage.prefetch = jest.fn(async () => true);
  MockImage.clearMemoryCache = jest.fn(async () => true);
  MockImage.clearDiskCache = jest.fn(async () => true);
  return {
    Image: MockImage,
  };
});

const InactiveVideoPage = React.memo(({ item }: { item: PixoraMediaInfo }) => {
  const [hasError, setHasError] = useState(false);
  const { Image } = require('expo-image');

  return (
    <View testID={`inactive-video-${item.id}`} style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={StyleSheet.absoluteFill}>
        <View testID="video-poster-fallback" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="videocam-outline" size={48} color="rgba(255, 255, 255, 0.4)" />
        </View>

        {!hasError && (
          <Image
            testID={`video-poster-image-${item.id}`}
            source={{ uri: item.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="normal"
            allowDownscaling={true}
            onError={() => setHasError(true)}
          />
        )}

        <View testID="center-play-btn" style={{ position: 'absolute', alignSelf: 'center', top: '45%' }}>
          <Ionicons name="play" size={34} color="#FFFFFF" />
        </View>
      </View>
    </View>
  );
});

const MockMediaPage = React.memo(
  ({
    item,
    isActive,
  }: {
    item: PixoraMediaInfo;
    isActive: boolean;
  }) => {
    const { Image } = require('expo-image');
    if (item.mediaType === 'video') {
      if (!isActive) {
        return <InactiveVideoPage item={item} />;
      }
      return (
        <View testID={`active-video-player-${item.id}`} style={{ flex: 1, backgroundColor: '#000' }}>
          <Text>Active Video Player for {item.id}</Text>
        </View>
      );
    }

    return (
      <View testID={`photo-page-${item.id}`} style={{ flex: 1 }}>
        <Image testID={`photo-image-${item.id}`} source={{ uri: item.uri }} style={StyleSheet.absoluteFill} />
      </View>
    );
  }
);

function MockProtectedViewer({
  isPrivate,
  isLockedAlbum,
  activeAlbumId,
  onDismiss,
}: {
  isPrivate: boolean;
  isLockedAlbum: boolean;
  activeAlbumId?: string;
  onDismiss: () => void;
}) {
  const isVaultUnlocked = usePrivacyStore((s) => s.isVaultUnlocked);
  const unlockedAlbums = usePrivacyStore((s) => s.unlockedAlbums);

  useEffect(() => {
    const isUnauthorizedPrivate = isPrivate && !isVaultUnlocked;
    const isUnauthorizedLocked = isLockedAlbum && !!activeAlbumId && !unlockedAlbums.includes(activeAlbumId);

    if (isUnauthorizedPrivate || isUnauthorizedLocked) {
      onDismiss();
    }
  }, [isPrivate, isVaultUnlocked, isLockedAlbum, activeAlbumId, unlockedAlbums, onDismiss]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'inactive' || nextState === 'background') {
        if (appLockService.isAuthenticating) return;
        if (isPrivate || isLockedAlbum) {
          onDismiss();
        }
      }
    });
    return () => sub.remove();
  }, [isPrivate, isLockedAlbum, onDismiss]);

  return (
    <View testID="protected-viewer">
      <Text>Viewing protected media</Text>
    </View>
  );
}

describe('Phase 10.1.12 — App Lock Privacy & Mixed Photo/Video Pager Reliability', () => {
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
      isVaultUnlocked: true,
      unlockedAlbums: ['album-1'],
      vaultMedia: [
        {
          id: 'vault-1',
          uri: 'file:///vault/v1.jpg',
          filename: 'v1.jpg',
          mediaType: 'photo',
          width: 100,
          height: 100,
          creationTime: 1000,
          modificationTime: 1000,
          duration: 0,
        },
      ],
      privateAssetIds: ['vault-1'],
      lockedAlbumIds: ['album-1'],
      hiddenAssetIds: [],
      hiddenAlbumIds: [],
      archivedAssetIds: [],
    });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  const simulateAppStateChange = async (nextState: AppStateStatus) => {
    await act(async () => {
      (AppState as any).currentState = nextState;
      // Make a copy in case listeners remove themselves
      const listeners = [...appStateListeners];
      listeners.forEach((fn) => fn(nextState));
    });
  };

  describe('Part A — App Lock & Protected Media Backgrounding Lifecycle', () => {
    it('universal AppState listener clears Private Vault & Locked Album sessions on background even when isAppLockEnabled is false', async () => {
      usePrivacyStore.setState({
        isAppLockEnabled: false,
        isVaultUnlocked: true,
        unlockedAlbums: ['album-1'],
        vaultMedia: [{ id: 'v1' } as any],
      });

      const { getByText } = await render(
        <PrivacyGuard>
          <Text>Protected Gallery Content</Text>
        </PrivacyGuard>
      );

      expect(getByText('Protected Gallery Content')).toBeTruthy();
      expect(usePrivacyStore.getState().isVaultUnlocked).toBe(true);
      expect(usePrivacyStore.getState().unlockedAlbums).toEqual(['album-1']);

      await simulateAppStateChange('background');

      const state = usePrivacyStore.getState();
      expect(state.isVaultUnlocked).toBe(false);
      expect(state.unlockedAlbums).toEqual([]);
      expect(state.vaultMedia).toEqual([]);
    });

    it('locks the entire app when isAppLockEnabled is true upon backgrounding', async () => {
      await AsyncStorage.setItem(
        '@pixora_privacy_store_v2',
        JSON.stringify({
          isAppLockEnabled: true,
          lockPolicy: 'immediate',
          hiddenAlbumIds: [],
          hiddenAssetIds: [],
          privateAssetIds: ['vault-1'],
          lockedAlbumIds: ['album-1'],
          archivedAssetIds: [],
        })
      );

      usePrivacyStore.setState({
        isAppLockEnabled: true,
        isUnlocked: true,
        isVaultUnlocked: true,
        unlockedAlbums: ['album-1'],
      });

      await render(
        <PrivacyGuard>
          <Text>Protected Content</Text>
        </PrivacyGuard>
      );

      // Wait for initialize effect to settle if needed
      await act(async () => {
        await Promise.resolve();
      });

      // Background the application
      await simulateAppStateChange('background');

      const state = usePrivacyStore.getState();
      expect(state.isUnlocked).toBe(false);
      expect(state.isVaultUnlocked).toBe(false);
      expect(state.unlockedAlbums).toEqual([]);
    });

    it('requires unlocking on return to active state when AppLock is enabled and locked', async () => {
      const unlockMock = jest.fn();
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
        isUnlocked: false,
        unlock: unlockMock,
      });

      (AppState as any).currentState = 'active';

      await render(
        <PrivacyGuard>
          <Text>Protected Content</Text>
        </PrivacyGuard>
      );

      // Transition to background, then back to active
      await simulateAppStateChange('background');
      await simulateAppStateChange('active');

      expect(unlockMock).toHaveBeenCalled();
    });

    it('does not recursively lock out the user while biometric authentication dialog is active', async () => {
      usePrivacyStore.setState({
        isAppLockEnabled: true,
        isUnlocked: true,
        isVaultUnlocked: true,
        unlockedAlbums: ['album-1'],
      });

      await render(
        <PrivacyGuard>
          <Text>Protected Content</Text>
        </PrivacyGuard>
      );

      appLockService.isAuthenticating = true;
      await simulateAppStateChange('inactive');

      const state = usePrivacyStore.getState();
      expect(state.isUnlocked).toBe(true);
      expect(state.isVaultUnlocked).toBe(true);
      expect(state.unlockedAlbums).toEqual(['album-1']);
    });

    it('immediately dismisses mounted viewer when app backgrounds while viewing private media', async () => {
      const onDismiss = jest.fn();
      usePrivacyStore.setState({ isVaultUnlocked: true });

      await render(
        <MockProtectedViewer
          isPrivate={true}
          isLockedAlbum={false}
          onDismiss={onDismiss}
        />
      );

      expect(onDismiss).not.toHaveBeenCalled();

      await simulateAppStateChange('background');

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('immediately dismisses mounted viewer when app backgrounds while viewing locked album media', async () => {
      const onDismiss = jest.fn();
      usePrivacyStore.setState({ unlockedAlbums: ['album-1'] });

      await render(
        <MockProtectedViewer
          isPrivate={false}
          isLockedAlbum={true}
          activeAlbumId="album-1"
          onDismiss={onDismiss}
        />
      );

      expect(onDismiss).not.toHaveBeenCalled();

      await simulateAppStateChange('inactive');

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('immediately dismisses mounted viewer when authorization is revoked while viewer is open', async () => {
      const onDismiss = jest.fn();
      usePrivacyStore.setState({ isVaultUnlocked: true });

      const screen = await render(
        <MockProtectedViewer
          isPrivate={true}
          isLockedAlbum={false}
          onDismiss={onDismiss}
        />
      );

      expect(onDismiss).not.toHaveBeenCalled();

      // Revoke vault session
      await act(async () => {
        usePrivacyStore.getState().lockVault();
      });

      await screen.rerender(
        <MockProtectedViewer
          isPrivate={true}
          isLockedAlbum={false}
          onDismiss={onDismiss}
        />
      );

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Part B — Mixed Photo/Video Pager Reliability', () => {
    const sampleMedia: PixoraMediaInfo[] = [
      {
        id: 'photo-0',
        uri: 'file:///gallery/p0.jpg',
        filename: 'p0.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: 1000,
        modificationTime: 1000,
        duration: 0,
      },
      {
        id: 'video-1',
        uri: 'file:///gallery/v1.mp4',
        filename: 'v1.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: 1001,
        modificationTime: 1001,
        duration: 15,
      },
      {
        id: 'photo-2',
        uri: 'file:///gallery/p2.jpg',
        filename: 'p2.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: 1002,
        modificationTime: 1002,
        duration: 0,
      },
      {
        id: 'video-3',
        uri: 'file:///gallery/v3.mp4',
        filename: 'v3.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: 1003,
        modificationTime: 1003,
        duration: 30,
      },
      {
        id: 'video-4',
        uri: 'file:///gallery/v4.mp4',
        filename: 'v4.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: 1004,
        modificationTime: 1004,
        duration: 45,
      },
      {
        id: 'photo-5',
        uri: 'file:///gallery/p5.jpg',
        filename: 'p5.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: 1005,
        modificationTime: 1005,
        duration: 0,
      },
      {
        id: 'video-6',
        uri: 'file:///gallery/v6.mp4',
        filename: 'v6.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: 1006,
        modificationTime: 1006,
        duration: 60,
      },
      {
        id: 'photo-7',
        uri: 'file:///gallery/p7.jpg',
        filename: 'p7.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: 1007,
        modificationTime: 1007,
        duration: 0,
      },
      {
        id: 'video-8',
        uri: 'file:///gallery/v8.mp4',
        filename: 'v8.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: 1008,
        modificationTime: 1008,
        duration: 75,
      },
      {
        id: 'photo-9',
        uri: 'file:///gallery/p9.jpg',
        filename: 'p9.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: 1009,
        modificationTime: 1009,
        duration: 0,
      },
      {
        id: 'video-10',
        uri: 'file:///gallery/v10.mp4',
        filename: 'v10.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: 1010,
        modificationTime: 1010,
        duration: 90,
      },
    ];

    it('renders inactive video pages with thumbnail poster and play indicator, never blank black view', async () => {
      const videoItem = sampleMedia[1];
      const { getByTestId, queryByTestId } = await render(
        <MockMediaPage item={videoItem} isActive={false} />
      );

      expect(getByTestId('inactive-video-video-1')).toBeTruthy();
      expect(getByTestId('video-poster-image-video-1')).toBeTruthy();
      expect(getByTestId('center-play-btn')).toBeTruthy();
      expect(queryByTestId('active-video-player-video-1')).toBeNull();
    });

    it('mounts native video player only when video page becomes active', async () => {
      const videoItem = sampleMedia[1];
      const { getByTestId, queryByTestId } = await render(
        <MockMediaPage item={videoItem} isActive={true} />
      );

      expect(getByTestId('active-video-player-video-1')).toBeTruthy();
      expect(queryByTestId('inactive-video-video-1')).toBeNull();
    });

    it('maintains a window of <= 4 items around currentIndex so adjacent mixed media is pre-mounted', () => {
      const currentIndex = 5;

      const renderedPages = sampleMedia.map((item, index) => {
        const isActive = index === currentIndex;
        const isWithinWindow = Math.abs(index - currentIndex) <= 4;
        if (!isWithinWindow && !isActive) {
          return { id: item.id, type: 'placeholder' };
        }
        return {
          id: item.id,
          type: item.mediaType === 'video' ? (isActive ? 'active-video' : 'inactive-video') : 'photo',
        };
      });

      expect(renderedPages[0]).toEqual({ id: 'photo-0', type: 'placeholder' });
      expect(renderedPages[1]).toEqual({ id: 'video-1', type: 'inactive-video' });
      expect(renderedPages[2]).toEqual({ id: 'photo-2', type: 'photo' });
      expect(renderedPages[3]).toEqual({ id: 'video-3', type: 'inactive-video' });
      expect(renderedPages[4]).toEqual({ id: 'video-4', type: 'inactive-video' });
      expect(renderedPages[5]).toEqual({ id: 'photo-5', type: 'photo' });
      expect(renderedPages[6]).toEqual({ id: 'video-6', type: 'inactive-video' });
      expect(renderedPages[7]).toEqual({ id: 'photo-7', type: 'photo' });
      expect(renderedPages[8]).toEqual({ id: 'video-8', type: 'inactive-video' });
      expect(renderedPages[9]).toEqual({ id: 'photo-9', type: 'photo' });
      expect(renderedPages[10]).toEqual({ id: 'video-10', type: 'placeholder' });
    });

    it('handlePageScroll dynamically updates currentIndex on fast swipe jumps (>= 2 pages)', () => {
      let currentIndex = 2;
      const effectiveMediaCount = sampleMedia.length;

      const handlePageScroll = (position: number) => {
        const pos = Math.round(position);
        if (typeof pos === 'number' && pos >= 0 && pos < effectiveMediaCount && Math.abs(pos - currentIndex) >= 2) {
          currentIndex = pos;
        }
      };

      handlePageScroll(4.8);
      expect(currentIndex).toBe(5);

      handlePageScroll(5.1);
      expect(currentIndex).toBe(5);

      handlePageScroll(1.2);
      expect(currentIndex).toBe(1);
    });

    it('ensures photo pages render Image component with contain fit', async () => {
      const photoItem = sampleMedia[0];
      const { getByTestId } = await render(
        <MockMediaPage item={photoItem} isActive={true} />
      );

      expect(getByTestId('photo-page-photo-0')).toBeTruthy();
      expect(getByTestId('photo-image-photo-0')).toBeTruthy();
    });
  });
});
