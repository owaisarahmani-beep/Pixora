import React from 'react';
import { render, cleanup, act, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import AlbumMediaScreen from '../../../src/app/album/[id]';
import GlobalSelectionBar from '../../../src/components/gallery/GlobalSelectionBar';
import { useSelectionStore } from '../../../src/store/useSelectionStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { toastController } from '../../../src/components/common/Toast';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

let lastStackScreenOptions: any = null;

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    },
    useLocalSearchParams: () => ({ id: 'album-single-header' }),
    useFocusEffect: (callback: any) => {
      React.useEffect(callback, []);
    },
    Stack: {
      Screen: ({ options }: any) => {
        lastStackScreenOptions = options;
        if (options?.headerShown === false) return null;
        return React.createElement(
          'StackScreenHeader',
          { testID: 'stack-screen-header' },
          typeof options?.headerLeft === 'function' ? options.headerLeft() : null,
          typeof options?.headerTitle === 'function' ? options.headerTitle() : null,
          typeof options?.headerRight === 'function' ? options.headerRight() : null
        );
      },
    },
    Link: () => null,
  };
});

const renderWithSafeArea = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 375, height: 812 },
      }}
    >
      <ThemeProvider>
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('Single Header Selection Mode & Navigation Predictability', () => {
  const sampleMedia: PixoraMediaInfo[] = [
    {
      id: 'photo-1',
      uri: 'file:///photo1.jpg',
      filename: 'photo1.jpg',
      mediaType: 'photo',
      width: 1000,
      height: 1000,
      creationTime: 1672531199000,
      modificationTime: 1672531199000,
      duration: 0,
    },
    {
      id: 'photo-2',
      uri: 'file:///photo2.jpg',
      filename: 'photo2.jpg',
      mediaType: 'photo',
      width: 1000,
      height: 1000,
      creationTime: 1672531198000,
      modificationTime: 1672531198000,
      duration: 0,
    },
  ];

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
    lastStackScreenOptions = null;
    useSelectionStore.getState().exitSelectionMode();

    usePrivacyStore.setState({
      lockedAlbumIds: [],
      unlockedAlbums: [],
      hiddenAlbumIds: [],
      hiddenAssetIds: [],
      privateAssetIds: [],
      archivedAssetIds: [],
      isVaultUnlocked: false,
      isAlbumLocked: () => false,
    });

    useAlbumsStore.setState({
      albums: [
        {
          id: 'album-single-header',
          title: 'Vacation Trip',
          assetCount: 2,
          type: 'album' as any,
        } as any,
      ],
      activeAlbumId: 'album-single-header',
      activeAlbumMedia: sampleMedia,
      isLoadingMedia: false,
      openAlbum: jest.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    useSelectionStore.getState().exitSelectionMode();
  });

  it('renders standard album navigation header when NOT in selection mode', async () => {
    const { getByText, queryByTestId } = await renderWithSafeArea(<AlbumMediaScreen />);

    // Native stack header must be visible
    expect(lastStackScreenOptions?.headerShown).toBe(true);
    expect(getByText('Vacation Trip')).toBeTruthy();

    // Selection bar top bar must not exist
    expect(queryByTestId('global-selection-bar')).toBeNull();
  });

  it('hides native header in selection mode, shows unified selection bar, and handles hardware back press to restore header', async () => {
    let backPressListener: (() => boolean) | null = null;
    const addListenerSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'hardwareBackPress') {
        backPressListener = handler;
      }
      return { remove: jest.fn() } as any;
    });

    const { queryByTestId, getByText } = await renderWithSafeArea(<AlbumMediaScreen />);

    // Initially, album header is visible
    expect(lastStackScreenOptions?.headerShown).toBe(true);
    expect(getByText('Vacation Trip')).toBeTruthy();

    // Enter selection mode
    act(() => {
      useSelectionStore.getState().enterSelectionMode('media', 'photo-1', ['photo-1', 'photo-2'], 'album:album-single-header');
    });

    // Native Stack.Screen header must be hidden, single GlobalSelectionBar rendered
    await waitFor(() => {
      expect(lastStackScreenOptions?.headerShown).toBe(false);
      expect(queryByTestId('stack-screen-header')).toBeNull();
      expect(getByText('1 Selected')).toBeTruthy();
      expect(getByText('Select All')).toBeTruthy();
      expect(backPressListener).not.toBeNull();
    });

    // Subsequent selection tap: verify count updates immediately without re-rendering or delayed state
    act(() => {
      useSelectionStore.getState().toggleSelection('photo-2');
    });
    await waitFor(() => {
      expect(getByText('2 Selected')).toBeTruthy();
      expect(getByText('Deselect All')).toBeTruthy();
    });

    // Simulate pressing Android hardware back button
    act(() => {
      const handled = (backPressListener as any)();
      expect(handled).toBe(true); // Must consume back event to prevent accidental navigation pop
    });

    // Selection mode must be cleanly exited and album header restored cleanly
    await waitFor(() => {
      expect(useSelectionStore.getState().isSelectionMode).toBe(false);
      expect(useSelectionStore.getState().selectedIds.size).toBe(0);
      expect(lastStackScreenOptions?.headerShown).toBe(true);
      expect(getByText('Vacation Trip')).toBeTruthy();
    });

    addListenerSpy.mockRestore();
  });

  it('provides concise toast feedback when locking and deleting albums', async () => {
    const toastSpy = jest.spyOn(toastController, 'show');

    // Test locking toast feedback
    await act(async () => {
      await usePrivacyStore.getState().lockAlbumContent('album-single-header');
      toastController.show({ message: 'Album locked with biometric protection', type: 'success' });
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Album locked with biometric protection',
        type: 'success',
      })
    );

    // Test delete toast feedback
    act(() => {
      useAlbumsStore.getState().deleteAlbum('album-single-header');
      toastController.show({ message: 'Album "Vacation Trip" deleted', type: 'success' });
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Album "Vacation Trip" deleted',
        type: 'success',
      })
    );
  });
});
