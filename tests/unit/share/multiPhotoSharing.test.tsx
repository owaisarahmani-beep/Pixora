import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, act, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import PixoraEditorModule from '../../../modules/pixora-editor/src/PixoraEditorModule';
import { shareService } from '../../../src/services/share/ShareService';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { useFavoritesStore } from '../../../src/store/useFavoritesStore';
import { useSelectionStore } from '../../../src/store/useSelectionStore';
import { toastController } from '../../../src/components/common/Toast';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import GlobalSelectionBar from '../../../src/components/gallery/GlobalSelectionBar';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock('../../../modules/pixora-editor/src/PixoraEditorModule', () => ({
  __esModule: true,
  default: {
    shareMediaAsync: jest.fn(async () => true),
  },
}));

describe('Pixora Phase 10.1.14 — Multi-Photo Sharing Pipeline', () => {
  let shareMediaAsyncSpy: jest.SpyInstance;
  let toastSpy: jest.SpyInstance;

  const createMockItem = (id: string, ext: 'jpg' | 'mp4' = 'jpg', albumId?: string): PixoraMediaInfo => ({
    id,
    uri: `content://media/external/images/media/${id}.${ext}`,
    filename: `media_${id}.${ext}`,
    mediaType: ext === 'mp4' ? 'video' : 'photo',
    width: 1920,
    height: 1080,
    creationTime: 1700000000000,
    modificationTime: 1700000000000,
    duration: ext === 'mp4' ? 15 : 0,
    albumId,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';

    const editorModule = PixoraEditorModule as NonNullable<typeof PixoraEditorModule>;
    if (!editorModule.shareMediaAsync) {
      editorModule.shareMediaAsync = jest.fn(async () => true);
    }
    shareMediaAsyncSpy = jest.spyOn(editorModule, 'shareMediaAsync').mockResolvedValue(true);
    toastSpy = jest.spyOn(toastController, 'show').mockImplementation(() => {});

    // Reset stores
    usePrivacyStore.setState({
      privateAssetIds: [],
      hiddenAssetIds: [],
      lockedAlbumIds: [],
      unlockedAlbums: [],
      isVaultUnlocked: false,
    });

    useTrashStore.setState({
      items: [],
      isDeleted: (_id: string, _uri?: string) => false,
    });

    useMediaStore.setState({
      media: [],
      isLoading: false,
    });

    useAlbumsStore.setState({
      activeAlbumMedia: [],
    });

    useFavoritesStore.setState({
      favorites: new Set<string>(),
      favoritesMedia: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Case 1: Sharing 1 photo
  // ---------------------------------------------------------------------------
  test('Case 1: Sharing 1 photo sends the single URI to the share intent', async () => {
    const photo = createMockItem('p1');
    const result = await shareService.shareSelectedAsync(['p1'], [photo]);

    expect(result.success).toBe(true);
    expect(result.sharedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(shareMediaAsyncSpy).toHaveBeenCalledTimes(1);
    expect(shareMediaAsyncSpy).toHaveBeenCalledWith([photo.uri], 'Share via');
  });

  // ---------------------------------------------------------------------------
  // Case 2: Sharing 2 photos
  // ---------------------------------------------------------------------------
  test('Case 2: Sharing 2 photos sends both URIs in a single multi-share intent', async () => {
    const p1 = createMockItem('p1');
    const p2 = createMockItem('p2');

    const result = await shareService.shareSelectedAsync(['p1', 'p2'], [p1, p2]);

    expect(result.success).toBe(true);
    expect(result.sharedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(shareMediaAsyncSpy).toHaveBeenCalledTimes(1);
    expect(shareMediaAsyncSpy).toHaveBeenCalledWith([p1.uri, p2.uri], 'Share via');
  });

  // ---------------------------------------------------------------------------
  // Case 3: Sharing 10 photos
  // ---------------------------------------------------------------------------
  test('Case 3: Sharing 10 photos sends all 10 URIs simultaneously to the share intent', async () => {
    const photos = Array.from({ length: 10 }, (_, i) => createMockItem(`p_${i + 1}`));
    const ids = photos.map((p) => p.id);

    const result = await shareService.shareSelectedAsync(ids, photos);

    expect(result.success).toBe(true);
    expect(result.sharedCount).toBe(10);
    expect(result.failedCount).toBe(0);
    expect(shareMediaAsyncSpy).toHaveBeenCalledTimes(1);
    expect(shareMediaAsyncSpy).toHaveBeenCalledWith(
      photos.map((p) => p.uri),
      'Share via'
    );
  });

  // ---------------------------------------------------------------------------
  // Case 4: Sharing 15 photos
  // ---------------------------------------------------------------------------
  test('Case 4: Sharing 15 photos handles batch of 15 without truncation', async () => {
    const photos = Array.from({ length: 15 }, (_, i) => createMockItem(`p_${i + 1}`));
    const ids = photos.map((p) => p.id);

    const result = await shareService.shareSelectedAsync(ids, photos);

    expect(result.success).toBe(true);
    expect(result.sharedCount).toBe(15);
    expect(result.failedCount).toBe(0);
    expect(shareMediaAsyncSpy).toHaveBeenCalledTimes(1);
    expect(shareMediaAsyncSpy).toHaveBeenCalledWith(
      photos.map((p) => p.uri),
      'Share via'
    );
  });

  // ---------------------------------------------------------------------------
  // Case 5: Sharing mixed selection of supported images and videos
  // ---------------------------------------------------------------------------
  test('Case 5: Sharing mixed selection of photos and videos includes all formats', async () => {
    const p1 = createMockItem('p1', 'jpg');
    const v1 = createMockItem('v1', 'mp4');
    const p2 = createMockItem('p2', 'jpg');
    const v2 = createMockItem('v2', 'mp4');

    const result = await shareService.shareSelectedAsync(['p1', 'v1', 'p2', 'v2'], [p1, v1, p2, v2]);

    expect(result.success).toBe(true);
    expect(result.sharedCount).toBe(4);
    expect(shareMediaAsyncSpy).toHaveBeenCalledTimes(1);
    expect(shareMediaAsyncSpy).toHaveBeenCalledWith([p1.uri, v1.uri, p2.uri, v2.uri], 'Share via');
  });

  // ---------------------------------------------------------------------------
  // Case 6: Empty selection handling
  // ---------------------------------------------------------------------------
  test('Case 6: Empty selection fails gracefully with toast feedback and no intent dispatch', async () => {
    const result = await shareService.shareSelectedAsync([]);

    expect(result.success).toBe(false);
    expect(result.sharedCount).toBe(0);
    expect(shareMediaAsyncSpy).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'No items selected to share',
        type: 'error',
      })
    );
  });

  // ---------------------------------------------------------------------------
  // Case 7: Missing or inaccessible media URI handling
  // ---------------------------------------------------------------------------
  test('Case 7: Missing or inaccessible media URIs are filtered and feedback is provided', async () => {
    const p1 = createMockItem('p1');
    const pBroken: PixoraMediaInfo = { ...createMockItem('p_broken'), uri: '' };
    const p3 = createMockItem('p3');

    // p_ghost is not in allAvailableMedia or any store
    const result = await shareService.shareSelectedAsync(
      ['p1', 'p_broken', 'p3', 'p_ghost'],
      [p1, pBroken, p3]
    );

    expect(result.success).toBe(true);
    expect(result.sharedCount).toBe(2);
    expect(result.failedCount).toBe(2);
    expect(shareMediaAsyncSpy).toHaveBeenCalledWith([p1.uri, p3.uri], 'Share via');
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Sharing 2 items (2 unavailable)',
        type: 'info',
      })
    );
  });

  // ---------------------------------------------------------------------------
  // Case 8: Rapid repeated Share taps (concurrency guard)
  // ---------------------------------------------------------------------------
  test('Case 8: Concurrency guard blocks rapid repeated share requests', async () => {
    const p1 = createMockItem('p1');
    let resolveShare: (val: boolean) => void;
    shareMediaAsyncSpy.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveShare = resolve;
        })
    );

    const call1Promise = shareService.shareSelectedAsync(['p1'], [p1]);
    const call2Promise = shareService.shareSelectedAsync(['p1'], [p1]);

    const result2 = await call2Promise;
    expect(result2.success).toBe(false);
    expect(result2.error).toBe('Share already in progress');

    resolveShare!(true);
    const result1 = await call1Promise;
    expect(result1.success).toBe(true);
    expect(shareMediaAsyncSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Case 9: Selection order preservation
  // ---------------------------------------------------------------------------
  test('Case 9: Preserves exact user selection order across resolution', async () => {
    const pA = createMockItem('item_A');
    const pB = createMockItem('item_B');
    const pC = createMockItem('item_C');
    const pD = createMockItem('item_D');

    // User selected in non-alphabetical sequence: C, A, D, B
    const selectedSequence = ['item_C', 'item_A', 'item_D', 'item_B'];
    const result = await shareService.shareSelectedAsync(
      selectedSequence,
      [pA, pB, pC, pD]
    );

    expect(result.success).toBe(true);
    expect(shareMediaAsyncSpy).toHaveBeenCalledWith(
      [pC.uri, pA.uri, pD.uri, pB.uri],
      'Share via'
    );
  });

  // ---------------------------------------------------------------------------
  // Case 10: Privacy and Trash protection
  // ---------------------------------------------------------------------------
  describe('Case 10: Privacy and Trash enforcement', () => {
    test('Excludes items marked as deleted in Trash', async () => {
      const p1 = createMockItem('p1');
      const pTrash = createMockItem('p_trash');

      useTrashStore.setState({
        isDeleted: (id: string) => id === 'p_trash',
      });

      const result = await shareService.shareSelectedAsync(['p1', 'p_trash'], [p1, pTrash]);

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(shareMediaAsyncSpy).toHaveBeenCalledWith([p1.uri], 'Share via');
    });

    test('Excludes Private Vault items when Vault is locked', async () => {
      const p1 = createMockItem('p1');
      const pVault = createMockItem('p_vault');

      usePrivacyStore.setState({
        privateAssetIds: ['p_vault'],
        isVaultUnlocked: false,
        isAssetPrivate: (id: string) => id === 'p_vault',
      } as any);

      const result = await shareService.shareSelectedAsync(['p1', 'p_vault'], [p1, pVault]);

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(1);
      expect(shareMediaAsyncSpy).toHaveBeenCalledWith([p1.uri], 'Share via');
    });

    test('Excludes media from locked albums when album is not unlocked', async () => {
      const pNormal = createMockItem('p1');
      const pLockedAlbum = createMockItem('p_locked', 'jpg', 'secret_album');

      usePrivacyStore.setState({
        lockedAlbumIds: ['secret_album'],
        unlockedAlbums: [],
        isAlbumLocked: (id: string) => id === 'secret_album',
      } as any);

      const result = await shareService.shareSelectedAsync(
        ['p1', 'p_locked'],
        [pNormal, pLockedAlbum]
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(1);
      expect(shareMediaAsyncSpy).toHaveBeenCalledWith([pNormal.uri], 'Share via');
    });

    test('Excludes hidden media assets', async () => {
      const pNormal = createMockItem('p1');
      const pHidden = createMockItem('p_hidden');

      usePrivacyStore.setState({
        hiddenAssetIds: ['p_hidden'],
        isAssetHidden: (id: string) => id === 'p_hidden',
      } as any);

      const result = await shareService.shareSelectedAsync(
        ['p1', 'p_hidden'],
        [pNormal, pHidden]
      );

      expect(result.success).toBe(true);
      expect(result.sharedCount).toBe(1);
      expect(shareMediaAsyncSpy).toHaveBeenCalledWith([pNormal.uri], 'Share via');
    });

    test('Shows error toast and does not share when all selected items are protected', async () => {
      const pVault = createMockItem('p_vault');

      usePrivacyStore.setState({
        privateAssetIds: ['p_vault'],
        isVaultUnlocked: false,
        isAssetPrivate: (id: string) => id === 'p_vault',
      } as any);

      const result = await shareService.shareSelectedAsync(['p_vault'], [pVault]);

      expect(result.success).toBe(false);
      expect(result.sharedCount).toBe(0);
      expect(shareMediaAsyncSpy).not.toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Selected items are not accessible or have been removed',
          type: 'error',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Single-item viewer helper
  // ---------------------------------------------------------------------------
  test('shareSingleAsync delegates single item cleanly', async () => {
    const photo = createMockItem('single_photo');
    const result = await shareService.shareSingleAsync(photo);

    expect(result.success).toBe(true);
    expect(result.sharedCount).toBe(1);
    expect(shareMediaAsyncSpy).toHaveBeenCalledWith([photo.uri], 'Share via');
  });

  // ---------------------------------------------------------------------------
  // Fallback to expo-sharing on non-android or without native module
  // ---------------------------------------------------------------------------
  test('Falls back to expo-sharing for 1 item if native module is absent', async () => {
    (Platform as any).OS = 'ios';
    (PixoraEditorModule as any).shareMediaAsync = undefined;

    const photo = createMockItem('fallback_photo');
    const result = await shareService.shareSelectedAsync(['fallback_photo'], [photo]);

    expect(result.success).toBe(true);
    expect(result.sharedCount).toBe(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(photo.uri, { dialogTitle: 'Share via' });
  });

  // ---------------------------------------------------------------------------
  // GlobalSelectionBar UI Integration
  // ---------------------------------------------------------------------------
  describe('GlobalSelectionBar UI integration', () => {
    afterEach(async () => {
      await cleanup();
    });

    test('Invokes shareService with selected media and exits selection mode on success', async () => {
      const shareSelectedSpy = jest.spyOn(shareService, 'shareSelectedAsync').mockResolvedValue({
        success: true,
        sharedCount: 2,
        failedCount: 0,
      });

      const photo1 = createMockItem('p1');
      const photo2 = createMockItem('p2');
      useMediaStore.setState({ media: [photo1, photo2] });

      useSelectionStore.setState({
        isSelectionMode: true,
        selectionContext: 'media',
        selectedIds: new Set(['p1', 'p2']),
        availableIds: ['p1', 'p2'],
      });

      const rendered = await render(
        <SafeAreaProvider initialMetrics={{ insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 375, height: 812 } }}>
          <ThemeProvider>
            <GlobalSelectionBar />
          </ThemeProvider>
        </SafeAreaProvider>
      );

      const shareBtn = rendered.getByText('Share');
      await act(async () => {
        fireEvent.press(shareBtn);
      });

      expect(shareSelectedSpy).toHaveBeenCalledWith(
        ['p1', 'p2'],
        expect.arrayContaining([photo1, photo2])
      );
      expect(useSelectionStore.getState().isSelectionMode).toBe(false);
    });

    test('Shows info toast and does not share when selection context is album', async () => {
      const shareSelectedSpy = jest.spyOn(shareService, 'shareSelectedAsync');

      useSelectionStore.setState({
        isSelectionMode: true,
        selectionContext: 'album',
        selectedIds: new Set(['album-1']),
        availableIds: ['album-1'],
      });

      const rendered = await render(
        <SafeAreaProvider initialMetrics={{ insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 375, height: 812 } }}>
          <ThemeProvider>
            <GlobalSelectionBar />
          </ThemeProvider>
        </SafeAreaProvider>
      );

      const shareBtn = rendered.getByText('Share');
      await act(async () => {
        fireEvent.press(shareBtn);
      });

      expect(shareSelectedSpy).not.toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Select photos inside an album to share them',
          type: 'info',
        })
      );
    });
  });
});
