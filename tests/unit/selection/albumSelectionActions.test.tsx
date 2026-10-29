import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AlbumMediaScreen from '../../../src/app/album/[id]';
import { useSelectionStore } from '../../../src/store/useSelectionStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { toastController } from '../../../src/components/common/Toast';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-router params
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    },
    useLocalSearchParams: jest.fn(() => ({ id: 'album-101' })),
    useFocusEffect: (callback: any) => {
      React.useEffect(callback, []);
    },
    Stack: {
      Screen: ({ options }: any) =>
        React.createElement(
          React.Fragment,
          null,
          typeof options?.headerLeft === 'function' ? options.headerLeft() : null,
          typeof options?.headerTitle === 'function' ? options.headerTitle() : null,
          typeof options?.headerRight === 'function' ? options.headerRight() : null
        ),
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
      {ui}
    </SafeAreaProvider>
  );
};

describe('Album Selection Actions & UX Lifecycle', () => {
  const sampleMedia1: PixoraMediaInfo = {
    id: 'media-1',
    uri: 'file:///photo1.jpg',
    filename: 'photo1.jpg',
    mediaType: 'photo',
    width: 100,
    height: 100,
    creationTime: 1000,
    modificationTime: 1000,
    duration: 0,
  };

  const sampleMedia2: PixoraMediaInfo = {
    id: 'media-2',
    uri: 'file:///photo2.jpg',
    filename: 'photo2.jpg',
    mediaType: 'photo',
    width: 100,
    height: 100,
    creationTime: 2000,
    modificationTime: 2000,
    duration: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useSelectionStore.getState().exitSelectionMode();

    useAlbumsStore.setState({
      albums: [{ id: 'album-101', title: 'Vacation', assetCount: 2 } as any],
      activeAlbumId: 'album-101',
      activeAlbumMedia: [sampleMedia1, sampleMedia2],
      isLoadingMedia: false,
      albumCovers: {},
    });

    useMediaStore.setState({
      media: [sampleMedia1, sampleMedia2],
      isLoading: false,
    });

    usePrivacyStore.setState({
      lockedAlbumIds: [],
      unlockedAlbums: [],
      archivedAssetIds: [],
      privateAssetIds: [],
      hiddenAssetIds: [],
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('selection toolbar appears inside an album screen when selection mode is active', async () => {
    // Activate selection mode scoped to album-101
    useSelectionStore.getState().enterSelectionMode('media', 'media-1', ['media-1', 'media-2'], 'album:album-101');

    const { getByText } = await renderWithSafeArea(<AlbumMediaScreen />);

    // Selection bar top title and action labels are rendered inside the album
    expect(getByText('1 Selected')).toBeTruthy();
    expect(getByText('Share')).toBeTruthy();
    expect(getByText('Favorite')).toBeTruthy();
    expect(getByText('Archive')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
  });

  it('selected count updates dynamically when selection changes', async () => {
    useSelectionStore.getState().enterSelectionMode('media', 'media-1', ['media-1', 'media-2'], 'album:album-101');

    const { getByText, queryByText } = await renderWithSafeArea(<AlbumMediaScreen />);
    expect(getByText('1 Selected')).toBeTruthy();

    // Select second item
    useSelectionStore.getState().toggleSelection('media-2');

    await waitFor(() => {
      expect(getByText('2 Selected')).toBeTruthy();
      expect(queryByText('1 Selected')).toBeNull();
    });
  });

  it('leaving an album unmounts/blurs and clears album-specific selection', async () => {
    useSelectionStore.getState().enterSelectionMode('media', 'media-1', ['media-1', 'media-2'], 'album:album-101');
    expect(useSelectionStore.getState().isSelectionMode).toBe(true);

    const { unmount } = await renderWithSafeArea(<AlbumMediaScreen />);

    // Navigating away / unmounting screen runs useFocusEffect cleanup
    await unmount();

    expect(useSelectionStore.getState().isSelectionMode).toBe(false);
    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(useSelectionStore.getState().scopeId).toBeNull();
  });

  it('returning to an album does not show stale selection from a previous visit', async () => {
    // User selected media previously
    useSelectionStore.getState().enterSelectionMode('media', 'media-1', ['media-1', 'media-2'], 'album:album-101');
    useSelectionStore.getState().exitSelectionMode();

    // Now user opens the album again
    const { queryByText } = await renderWithSafeArea(<AlbumMediaScreen />);

    // Selection toolbar must NOT be visible
    expect(queryByText('Selected')).toBeNull();
    expect(queryByText('1 Selected')).toBeNull();
    expect(useSelectionStore.getState().isSelectionMode).toBe(false);
  });

  it('scope mismatch protection wipes lingering selection when opening a different album', () => {
    // User had items selected in Album A
    useSelectionStore.getState().enterSelectionMode('media', 'media-1', ['media-1'], 'album:album-A');
    expect(useSelectionStore.getState().selectedIds.size).toBe(1);

    // User navigates into Album B
    useSelectionStore.getState().clearIfScopeMismatch('album:album-B');

    // Selection is cleanly wiped and does not leak across albums
    expect(useSelectionStore.getState().isSelectionMode).toBe(false);
    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(useSelectionStore.getState().scopeId).toBeNull();
  });

  it('actions provide concise feedback via toast notifications', async () => {
    const toastSpy = jest.spyOn(toastController, 'show');

    useSelectionStore.getState().enterSelectionMode('media', 'media-1', ['media-1', 'media-2'], 'album:album-101');

    const { getByText } = await renderWithSafeArea(<AlbumMediaScreen />);

    // Tap Archive in the selection bar
    const archiveBtn = getByText('Archive');
    fireEvent.press(archiveBtn);

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('archived'),
          type: 'success',
        })
      );
    });

    // Selection mode automatically exits after action
    expect(useSelectionStore.getState().isSelectionMode).toBe(false);
  });
});
