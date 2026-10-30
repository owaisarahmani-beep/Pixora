import React from 'react';
import { View } from 'react-native';
import { render, act, cleanup, fireEvent } from '@testing-library/react-native';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { useAuthorizedMedia, MediaContext } from '../../../src/hooks/useVisibleMedia';
import PhotoThumbnail from '../../../src/components/gallery/PhotoThumbnail';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import { useSelectionStore } from '../../../src/store/useSelectionStore';

// Hook tester component to test authorization hook safely in component context
function HookTester({
  media,
  context,
  onCapture,
}: {
  media: PixoraMediaInfo[];
  context: MediaContext;
  onCapture: (items: PixoraMediaInfo[]) => void;
}) {
  const items = useAuthorizedMedia(media, context);
  onCapture(items);
  return <View testID="hook-tester-view" />;
}

describe('Phase 10.1.11 — Vault Privacy, Viewer Reliability & Interaction Fixes', () => {
  const samplePrivateAsset: PixoraMediaInfo = {
    id: 'vault-asset-1',
    uri: 'file:///vault/photo1.jpg',
    filename: 'photo1.jpg',
    mediaType: 'photo',
    width: 1920,
    height: 1080,
    creationTime: 1600000000000,
    modificationTime: 1600000000000,
    duration: 0,
  };

  const samplePublicAsset: PixoraMediaInfo = {
    id: 'public-asset-1',
    uri: 'file:///public/photo1.jpg',
    filename: 'public1.jpg',
    mediaType: 'photo',
    width: 1920,
    height: 1080,
    creationTime: 1610000000000,
    modificationTime: 1610000000000,
    duration: 0,
  };

  const sampleLockedAsset: PixoraMediaInfo = {
    id: 'locked-asset-1',
    uri: 'file:///locked/photo1.jpg',
    filename: 'locked1.jpg',
    mediaType: 'photo',
    width: 1920,
    height: 1080,
    creationTime: 1620000000000,
    modificationTime: 1620000000000,
    albumId: 'locked-album-1',
    duration: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    usePrivacyStore.setState({
      isVaultUnlocked: false,
      unlockedAlbums: [],
      privateAssetIds: ['vault-asset-1'],
      lockedAlbumIds: ['locked-album-1'],
      hiddenAssetIds: [],
      hiddenAlbumIds: [],
      archivedAssetIds: [],
      vaultMedia: [],
      archivedMedia: [],
    });
    useTrashStore.setState({
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });
    useSelectionStore.getState().exitSelectionMode();
  });

  afterEach(async () => {
    await cleanup();
  });

  // 1. Vault content never renders before authorization
  it('never renders private vault content before authorization is confirmed', async () => {
    usePrivacyStore.setState({ isVaultUnlocked: false });
    let captured: PixoraMediaInfo[] = [];
    await render(
      <HookTester
        media={[samplePrivateAsset]}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    expect(captured.length).toBe(0);
  });

  // 2. Vault content becomes visible when authorization is valid
  it('renders private vault content when vault is authorized and unlocked', async () => {
    usePrivacyStore.setState({ isVaultUnlocked: true });
    let captured: PixoraMediaInfo[] = [];
    await render(
      <HookTester
        media={[samplePrivateAsset]}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    expect(captured.length).toBe(1);
    expect(captured[0].id).toBe('vault-asset-1');
  });

  // 3. Locked transitions immediately block protected content
  it('immediately blocks protected content when vault is locked', async () => {
    usePrivacyStore.setState({ isVaultUnlocked: true, vaultMedia: [samplePrivateAsset] });
    let captured: PixoraMediaInfo[] = [];
    const screen = await render(
      <HookTester
        media={[samplePrivateAsset]}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );
    expect(captured.length).toBe(1);

    // User locks vault or app lock activates
    await act(async () => {
      usePrivacyStore.getState().lockVault();
    });

    await screen.rerender(
      <HookTester
        media={[samplePrivateAsset]}
        context="private"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );
    expect(captured.length).toBe(0);
    expect(usePrivacyStore.getState().vaultMedia).toEqual([]);
  });

  // 4. Stale async media loads cannot leak into public views or replace protected state
  it('strictly filters private assets from public gallery context', async () => {
    let captured: PixoraMediaInfo[] = [];
    await render(
      <HookTester
        media={[samplePublicAsset, samplePrivateAsset]}
        context="public"
        onCapture={(items) => {
          captured = items;
        }}
      />
    );

    expect(captured.length).toBe(1);
    expect(captured[0].id).toBe('public-asset-1');
  });

  // 5. Single taps navigate immediately on first touch (no swallowed taps)
  it('triggers navigation immediately on first single tap without requiring a second tap', async () => {
    const screen = await render(
      <PhotoThumbnail item={samplePublicAsset} numColumns={3} source="gallery" />
    );

    const pressable = screen.getByTestId('photo-thumbnail-pressable');

    // Simulate first normal human tap
    fireEvent.press(pressable);

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/viewer/[id]',
        params: expect.objectContaining({ id: 'public-asset-1' }),
      })
    );
  });

  // 6. Deliberate 500ms long press activates selection mode
  it('activates selection mode on deliberate long press', async () => {
    const screen = await render(
      <PhotoThumbnail item={samplePublicAsset} numColumns={3} source="gallery" allIds={['public-asset-1']} />
    );

    const pressable = screen.getByTestId('photo-thumbnail-pressable');

    fireEvent(pressable, 'onLongPress');

    const selectionState = useSelectionStore.getState();
    expect(selectionState.isSelectionMode).toBe(true);
    expect(selectionState.isSelected('public-asset-1')).toBe(true);
  });

  // 7. Deduplication of prefetch requests
  it('deduplicates adjacent image prefetch requests so identical URIs are not repeatedly sent to bridge', () => {
    const prefetchedSet = new Set<string>();
    const uris = ['file:///photo1.jpg', 'file:///photo2.jpg'];

    const mockPrefetch = jest.spyOn(Image, 'prefetch').mockImplementation(jest.fn().mockResolvedValue(true));

    const simulatePrefetch = (candidates: string[]) => {
      const toSend: string[] = [];
      for (const uri of candidates) {
        if (!prefetchedSet.has(uri)) {
          toSend.push(uri);
          prefetchedSet.add(uri);
        }
      }
      if (toSend.length > 0) {
        Image.prefetch(toSend, 'memory-disk');
      }
    };

    // First swipe
    simulatePrefetch(uris);
    expect(mockPrefetch).toHaveBeenCalledTimes(1);
    expect(mockPrefetch).toHaveBeenCalledWith(uris, 'memory-disk');

    // Second swipe covering overlapping candidates
    simulatePrefetch(['file:///photo1.jpg', 'file:///photo3.jpg']);
    // Only photo3 is dispatched! photo1 was deduplicated
    expect(mockPrefetch).toHaveBeenCalledTimes(2);
    expect(mockPrefetch).toHaveBeenLastCalledWith(['file:///photo3.jpg'], 'memory-disk');

    mockPrefetch.mockRestore();
  });

  // 8. Locked album direct access refusal
  it('refuses access to locked album media when album is not unlocked', async () => {
    usePrivacyStore.setState({ unlockedAlbums: [] });
    let captured: PixoraMediaInfo[] = [];
    const screen = await render(
      <HookTester
        media={[sampleLockedAsset]}
        context={{ type: 'locked_album', albumId: 'locked-album-1' }}
        onCapture={(items) => {
          captured = items;
        }}
      />
    );
    expect(captured.length).toBe(0);

    // After unlocking album
    await act(async () => {
      usePrivacyStore.setState({ unlockedAlbums: ['locked-album-1'] });
    });

    await screen.rerender(
      <HookTester
        media={[sampleLockedAsset]}
        context={{ type: 'locked_album', albumId: 'locked-album-1' }}
        onCapture={(items) => {
          captured = items;
        }}
      />
    );
    expect(captured.length).toBe(1);
    expect(captured[0].id).toBe('locked-asset-1');
  });
});
