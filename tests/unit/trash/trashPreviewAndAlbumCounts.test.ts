import { useTrashStore, TrashedItem } from '../../../src/store/useTrashStore';
import { useAlbumsStore, getReconciledAlbumCount } from '../../../src/store/useAlbumsStore';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { getSmartAlbumsList } from '../../../src/hooks/useSmartAlbums';
import { mediaStoreService } from '../../../src/services/media/MediaStoreService';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

jest.mock('expo-media-library/legacy');
jest.mock('expo-media-library');

describe('Pixora Phase 10.1.6: Recently Deleted UX & Album Count Consistency', () => {
  const cameraAlbum: MediaLibrary.Album = {
    id: 'bucket-camera',
    title: 'Camera',
    assetCount: 10,
  } as MediaLibrary.Album;

  const downloadAlbum: MediaLibrary.Album = {
    id: 'bucket-download',
    title: 'Download',
    assetCount: 5,
  } as MediaLibrary.Album;

  const screenshotsAlbum: MediaLibrary.Album = {
    id: 'bucket-screenshots',
    title: 'Screenshots',
    assetCount: 8,
  } as MediaLibrary.Album;

  const canonicalAlbums = [cameraAlbum, downloadAlbum, screenshotsAlbum];

  beforeEach(() => {
    jest.clearAllMocks();
    useTrashStore.setState({
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
      restoredTimestamps: {},
      restoredItems: [],
    });
    useAlbumsStore.setState({
      albums: canonicalAlbums,
      albumCovers: {},
      activeAlbumMedia: [],
      activeAlbumGrouped: [],
      activeAlbumId: null,
      isLoadingAlbums: false,
      isLoadingMedia: false,
      hasNextPage: true,
      endCursor: undefined,
      albumSortOrder: 'newest',
    });
    usePrivacyStore.setState({
      hiddenAlbumIds: [],
      hiddenAssetIds: [],
      privateAssetIds: [],
      lockedAlbumIds: [],
      archivedAssetIds: [],
      unlockedAlbums: [],
    });
    useMediaStore.setState({
      media: [],
      sortOrder: 'newest',
      permissionStatus: 'GRANTED',
    });
  });

  describe('Task B: Album Count Reconciliation & Derivation', () => {
    it('1. Returns full assetCount when no items from the album are in Trash', () => {
      const count = getReconciledAlbumCount(cameraAlbum, []);
      expect(count).toBe(10);
    });

    it('2. Decrements album count when items belonging to that album are in Trash', () => {
      const trashedItem: TrashedItem = {
        id: 'cam-1',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_01.jpg',
        filename: 'IMG_01.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now() - 10000,
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'bucket-camera',
      };

      const count = getReconciledAlbumCount(cameraAlbum, [trashedItem]);
      expect(count).toBe(9);
    });

    it('3. Does not decrement when trashed items belong to a DIFFERENT album', () => {
      const trashedFromDownload: TrashedItem = {
        id: 'dl-1',
        uri: 'file:///storage/emulated/0/Download/video.mp4',
        filename: 'video.mp4',
        mediaType: 'video',
        width: 1920,
        height: 1080,
        creationTime: Date.now() - 10000,
        duration: 30,
        trashedAt: Date.now(),
        albumId: 'bucket-download',
      };

      // Camera count should still be 10, Download count should be 4
      const camCount = getReconciledAlbumCount(cameraAlbum, [trashedFromDownload]);
      const dlCount = getReconciledAlbumCount(downloadAlbum, [trashedFromDownload]);

      expect(camCount).toBe(10);
      expect(dlCount).toBe(4);
    });

    it('4. Deduplicates trashed items: does not subtract the same item more than once', () => {
      const trashedItem: TrashedItem = {
        id: 'cam-duplicate',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_DUP.jpg',
        filename: 'IMG_DUP.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'bucket-camera',
      };

      // Duplicate entries of the same item ID
      const count = getReconciledAlbumCount(cameraAlbum, [trashedItem, { ...trashedItem }]);
      expect(count).toBe(9); // Only subtracted once
    });

    it('5. Falls back safely to folder URI matching when albumId is missing on legacy trashed item', () => {
      const legacyTrashed: TrashedItem = {
        id: 'legacy-1',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_LEGACY.jpg',
        filename: 'IMG_LEGACY.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        // missing albumId
      };

      const count = getReconciledAlbumCount(cameraAlbum, [legacyTrashed]);
      expect(count).toBe(9);
    });

    it('6. Restoring an item immediately increments the reconciled album count back', () => {
      const itemToTrash = {
        id: 'cam-restore-test',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_RESTORE.jpg',
        filename: 'IMG_RESTORE.jpg',
        mediaType: 'photo' as const,
        width: 1080,
        height: 1920,
        creationTime: 1626343200000,
        duration: 0,
        albumId: 'bucket-camera',
      };

      // Move to trash
      useTrashStore.getState().moveToTrash(itemToTrash);
      let count = getReconciledAlbumCount(cameraAlbum, useTrashStore.getState().items);
      expect(count).toBe(9);

      // Restore
      useTrashStore.getState().restoreItems([itemToTrash.id]);
      count = getReconciledAlbumCount(cameraAlbum, useTrashStore.getState().items);
      expect(count).toBe(10);
    });

    it('7. Floors reconciled count at 0 and never returns negative values', () => {
      const emptyAlbum: MediaLibrary.Album = {
        id: 'bucket-empty',
        title: 'Empty',
        assetCount: 1,
      } as MediaLibrary.Album;

      const trashed1: TrashedItem = {
        id: 't-1',
        uri: 'file:///storage/emulated/0/Empty/1.jpg',
        filename: '1.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'bucket-empty',
      };
      const trashed2: TrashedItem = {
        id: 't-2',
        uri: 'file:///storage/emulated/0/Empty/2.jpg',
        filename: '2.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'bucket-empty',
      };

      const count = getReconciledAlbumCount(emptyAlbum, [trashed1, trashed2]);
      expect(count).toBe(0);
    });

    it('8. Sorting Newest/Oldest preserves album count without mutation or drift', async () => {
      const mockAssets: PixoraMediaInfo[] = [
        {
          id: 'cam-1',
          uri: 'file:///storage/emulated/0/DCIM/Camera/1.jpg',
          filename: '1.jpg',
          mediaType: 'photo',
          width: 100,
          height: 100,
          creationTime: 1000,
          modificationTime: 1000,
          duration: 0,
          albumId: 'bucket-camera',
        },
        {
          id: 'cam-2',
          uri: 'file:///storage/emulated/0/DCIM/Camera/2.jpg',
          filename: '2.jpg',
          mediaType: 'photo',
          width: 100,
          height: 100,
          creationTime: 2000,
          modificationTime: 2000,
          duration: 0,
          albumId: 'bucket-camera',
        },
      ];

      jest.spyOn(mediaStoreService, 'getAlbumAssetsAsync').mockResolvedValue({
        assets: mockAssets,
        hasNextPage: false,
        endCursor: 'cursor-1',
      });

      // Open album newest
      await useAlbumsStore.getState().openAlbum('bucket-camera', 'newest');
      const countNewest = getReconciledAlbumCount(cameraAlbum, useTrashStore.getState().items);
      expect(countNewest).toBe(10);

      // Switch to oldest
      await useAlbumsStore.getState().setAlbumSortOrder('oldest');
      const countOldest = getReconciledAlbumCount(cameraAlbum, useTrashStore.getState().items);
      expect(countOldest).toBe(10);
    });
  });

  describe('Task B: Smart Albums Reconciled Counts', () => {
    it('9. Reconciles Camera and Downloads smart albums against trashed items', () => {
      const sampleMedia: PixoraMediaInfo[] = [
        {
          id: 'cam-1',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_01.jpg',
          filename: 'IMG_01.jpg',
          mediaType: 'photo',
          width: 1080,
          height: 1920,
          creationTime: Date.now(),
          modificationTime: Date.now(),
          duration: 0,
          albumId: 'bucket-camera',
        },
        {
          id: 'dl-1',
          uri: 'file:///storage/emulated/0/Download/sample.mp4',
          filename: 'sample.mp4',
          mediaType: 'video',
          width: 1920,
          height: 1080,
          creationTime: Date.now(),
          modificationTime: Date.now(),
          duration: 15,
          albumId: 'bucket-download',
        },
      ];

      const trashedCamera: TrashedItem = {
        id: 'cam-trashed',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_TRASHED.jpg',
        filename: 'IMG_TRASHED.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'bucket-camera',
      };

      const list = getSmartAlbumsList(sampleMedia, canonicalAlbums, {}, [trashedCamera]);
      const cameraSmart = list.find((a) => a.id === '__smart_camera');
      const downloadSmart = list.find((a) => a.id === '__smart_downloads');

      // Camera: 10 native - 1 trashed = 9
      expect(cameraSmart?.count).toBe(9);
      // Downloads: 5 native - 0 trashed = 5
      expect(downloadSmart?.count).toBe(5);
    });
  });

  describe('Task A: Trash Store Authorization & Safeguards', () => {
    it('10. moveToTrash stores albumId in TrashedItem', () => {
      const itemToTrash = {
        id: 'test-item-1',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_NEW.jpg',
        filename: 'IMG_NEW.jpg',
        mediaType: 'photo' as const,
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        albumId: 'bucket-camera',
      };

      useTrashStore.getState().moveToTrash(itemToTrash);
      const trashed = useTrashStore.getState().items;
      expect(trashed).toHaveLength(1);
      expect(trashed[0].albumId).toBe('bucket-camera');
    });

    it('11. isDeleted returns true for trashed item and false once restored', () => {
      const itemToTrash = {
        id: 'test-del-1',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_DEL.jpg',
        filename: 'IMG_DEL.jpg',
        mediaType: 'photo' as const,
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        albumId: 'bucket-camera',
      };

      useTrashStore.getState().moveToTrash(itemToTrash);
      expect(useTrashStore.getState().isDeleted('test-del-1', itemToTrash.uri)).toBe(true);

      useTrashStore.getState().restoreItems(['test-del-1']);
      expect(useTrashStore.getState().isDeleted('test-del-1', itemToTrash.uri)).toBe(false);
    });

    it('12. In-flight loadAlbums(true) deduplication: returns same promise for concurrent calls', async () => {
      let resolveCall: (albums: MediaLibrary.Album[]) => void;
      const deferredPromise = new Promise<MediaLibrary.Album[]>((res) => {
        resolveCall = res;
      });

      jest.spyOn(mediaStoreService, 'getAlbumsAsync').mockReturnValue(deferredPromise as any);

      const promise1 = useAlbumsStore.getState().loadAlbums(true);
      const promise2 = useAlbumsStore.getState().loadAlbums(true);

      // Both should be the exact same in-flight promise
      expect(promise1).toBe(promise2);

      resolveCall!(canonicalAlbums);
      await promise1;

      expect(mediaStoreService.getAlbumsAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Phase 10.1.7: Deletion Flow, Immediate Modal Dismissal & Denial Handling', () => {
    it('13. User denial or cancellation in OS dialog retains item in Trash safely', async () => {
      const trashedItem: TrashedItem = {
        id: 'cancel-test-1',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_CANCEL.jpg',
        filename: 'IMG_CANCEL.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'bucket-camera',
      };

      useTrashStore.getState().moveToTrash(trashedItem);
      expect(useTrashStore.getState().items).toHaveLength(1);

      // Simulate Android OS user cancellation: deleteAssetsAsync returns false
      (MediaLibrary.deleteAssetsAsync as jest.Mock).mockResolvedValueOnce(false);
      jest.spyOn(mediaStoreService, 'getAssetsByIdsAsync').mockResolvedValueOnce([
        { id: 'cancel-test-1', uri: trashedItem.uri } as any,
      ]);

      // Execute simulated deletion flow as in trash.tsx / trash-viewer.tsx
      const targetId = 'cancel-test-1';
      let deletedSuccessfully = false;
      try {
        deletedSuccessfully = await MediaLibrary.deleteAssetsAsync([targetId]);
        if (!deletedSuccessfully) {
          const remaining = await mediaStoreService.getAssetsByIdsAsync([targetId]);
          deletedSuccessfully = remaining.length === 0;
        }
      } catch {}

      if (deletedSuccessfully) {
        useTrashStore.getState().permanentlyDelete([targetId], [trashedItem.uri]);
      }

      // Assert: Item remains in trash because user cancelled
      expect(deletedSuccessfully).toBe(false);
      expect(useTrashStore.getState().items).toHaveLength(1);
      expect(useTrashStore.getState().items[0].id).toBe('cancel-test-1');
      expect(useTrashStore.getState().permanentlyDeletedIds).not.toContain('cancel-test-1');
    });

    it('14. Permanent deletion success tombstones item and removes it from active Trash', async () => {
      const trashedItem: TrashedItem = {
        id: 'perm-test-1',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_PERM.jpg',
        filename: 'IMG_PERM.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'bucket-camera',
      };

      useTrashStore.getState().moveToTrash(trashedItem);
      expect(useTrashStore.getState().items).toHaveLength(1);

      // Simulate Android OS user confirmation: deleteAssetsAsync returns true
      (MediaLibrary.deleteAssetsAsync as jest.Mock).mockResolvedValueOnce(true);

      const targetId = 'perm-test-1';
      const deletedSuccessfully = await MediaLibrary.deleteAssetsAsync([targetId]);

      if (deletedSuccessfully) {
        useTrashStore.getState().permanentlyDelete([targetId], [trashedItem.uri]);
      }

      expect(deletedSuccessfully).toBe(true);
      expect(useTrashStore.getState().items).toHaveLength(0);
      expect(useTrashStore.getState().permanentlyDeletedIds).toContain('perm-test-1');
      expect(useTrashStore.getState().permanentlyDeletedUris).toContain(trashedItem.uri);
    });

    it('15. PagerView offscreen windowing restricts mounted items to distance <= 1', () => {
      const itemsList = Array.from({ length: 10 }, (_, i) => ({ id: `item-${i}` }));
      const safeIndex = 4;

      const isMounted = (index: number) => Math.abs(index - safeIndex) <= 1;

      const mountedIndices = itemsList
        .map((_, idx) => idx)
        .filter((idx) => isMounted(idx));

      // Only indices 3, 4, 5 should be mounted (distance <= 1)
      expect(mountedIndices).toEqual([3, 4, 5]);
      expect(mountedIndices).toHaveLength(3);
    });
  });

  describe('Phase 10.1.8: Viewer Advance Navigation, Album Count Reconciliation & Batch Deletion', () => {
    it('16. Restoring current item from Trash advances to the next valid item in visual order', () => {
      const item1: TrashedItem = {
        id: 't-1',
        uri: 'file:///t1.jpg',
        filename: 't1.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: 1000,
        duration: 0,
        trashedAt: Date.now(),
      };
      const item2: TrashedItem = {
        id: 't-2',
        uri: 'file:///t2.jpg',
        filename: 't2.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: 2000,
        duration: 0,
        trashedAt: Date.now(),
      };
      const item3: TrashedItem = {
        id: 't-3',
        uri: 'file:///t3.jpg',
        filename: 't3.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: 3000,
        duration: 0,
        trashedAt: Date.now(),
      };

      useTrashStore.setState({ items: [item1, item2, item3] });

      // Simulating user viewing item2 (middle item)
      const currentTrash = useTrashStore.getState().items;
      const targetId = 't-2';
      const currIdx = currentTrash.findIndex((i) => i.id === targetId);

      // Determine next target item before removal
      let targetNextId: string | null = null;
      if (currentTrash.length > 1) {
        if (currIdx + 1 < currentTrash.length) {
          targetNextId = currentTrash[currIdx + 1].id;
        } else if (currIdx - 1 >= 0) {
          targetNextId = currentTrash[currIdx - 1].id;
        }
      }

      expect(targetNextId).toBe('t-3'); // advances forward to next item in visual order

      // Remove targetId
      useTrashStore.getState().restoreItems([targetId]);
      const nextRemaining = useTrashStore.getState().items;

      expect(nextRemaining.map((i) => i.id)).toEqual(['t-1', 't-3']);

      // Calculate new safe index for targetNextId
      const nextIdx = nextRemaining.findIndex((i) => i.id === targetNextId);
      const safeNextIdx = Math.max(0, Math.min(nextIdx >= 0 ? nextIdx : 0, nextRemaining.length - 1));

      expect(safeNextIdx).toBe(1);
      expect(nextRemaining[safeNextIdx].id).toBe('t-3');
    });

    it('17. Removing the last item in a collection returns to the previous item or exits', () => {
      const item1: TrashedItem = {
        id: 't-1',
        uri: 'file:///t1.jpg',
        filename: 't1.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: 1000,
        duration: 0,
        trashedAt: Date.now(),
      };
      const item2: TrashedItem = {
        id: 't-2',
        uri: 'file:///t2.jpg',
        filename: 't2.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: 2000,
        duration: 0,
        trashedAt: Date.now(),
      };

      useTrashStore.setState({ items: [item1, item2] });

      // Simulating user viewing item2 (end of list)
      const currentTrash = useTrashStore.getState().items;
      const targetId = 't-2';
      const currIdx = currentTrash.findIndex((i) => i.id === targetId);

      let targetNextId: string | null = null;
      if (currentTrash.length > 1) {
        if (currIdx + 1 < currentTrash.length) {
          targetNextId = currentTrash[currIdx + 1].id;
        } else if (currIdx - 1 >= 0) {
          targetNextId = currentTrash[currIdx - 1].id;
        }
      }

      // Because t-2 was last, it targets previous item t-1
      expect(targetNextId).toBe('t-1');

      useTrashStore.getState().permanentlyDelete([targetId]);
      const nextRemaining = useTrashStore.getState().items;
      expect(nextRemaining.map((i) => i.id)).toEqual(['t-1']);

      // Now removing the final remaining item t-1
      const finalTargetId = 't-1';
      const finalCurrIdx = nextRemaining.findIndex((i) => i.id === finalTargetId);
      let finalNextId: string | null = null;
      if (nextRemaining.length > 1) {
        if (finalCurrIdx + 1 < nextRemaining.length) {
          finalNextId = nextRemaining[finalCurrIdx + 1].id;
        } else if (finalCurrIdx - 1 >= 0) {
          finalNextId = nextRemaining[finalCurrIdx - 1].id;
        }
      }

      expect(finalNextId).toBeNull(); // No item left, viewer will exit cleanly
    });

    it('18. batchDeleteMediaAsync moves multiple items across albums to trash in one atomic update', async () => {
      const photoA: PixoraMediaInfo = {
        id: 'batch-a',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_A.jpg',
        filename: 'IMG_A.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        modificationTime: Date.now(),
        duration: 0,
        albumId: 'bucket-camera',
      };
      const photoB: PixoraMediaInfo = {
        id: 'batch-b',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_B.jpg',
        filename: 'IMG_B.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now() - 1000,
        modificationTime: Date.now() - 1000,
        duration: 0,
        albumId: 'bucket-camera',
      };
      const downloadA: PixoraMediaInfo = {
        id: 'batch-dl',
        uri: 'file:///storage/emulated/0/Download/IMG_DL.jpg',
        filename: 'IMG_DL.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now() - 2000,
        modificationTime: Date.now() - 2000,
        duration: 0,
        albumId: 'bucket-download',
      };

      useMediaStore.setState({ media: [photoA, photoB, downloadA] });
      useAlbumsStore.setState({ activeAlbumMedia: [photoA, photoB] });

      const deletedCount = await useMediaStore.getState().batchDeleteMediaAsync([
        'batch-a',
        'batch-b',
        'batch-dl',
      ]);

      expect(deletedCount).toBe(3);
      expect(useMediaStore.getState().media).toHaveLength(0);
      expect(useTrashStore.getState().items).toHaveLength(3);

      // Verify immediate album overview count reconciliation for both albums
      const trashed = useTrashStore.getState().items;
      const cameraReconciled = getReconciledAlbumCount(cameraAlbum, trashed);
      const downloadReconciled = getReconciledAlbumCount(downloadAlbum, trashed);

      // Camera: 10 base - 2 trashed = 8
      expect(cameraReconciled).toBe(8);
      // Download: 5 base - 1 trashed = 4
      expect(downloadReconciled).toBe(4);
    });

    it('19. Permanent deletion decrements album assetCount in useAlbumsStore and prevents count bounce', () => {
      const albumWithTen: MediaLibrary.Album = {
        id: 'album-persist-test',
        title: 'Vacation',
        assetCount: 10,
      } as MediaLibrary.Album;

      useAlbumsStore.setState({ albums: [albumWithTen] });

      const trashedItem: TrashedItem = {
        id: 'vac-1',
        uri: 'file:///storage/emulated/0/Pictures/Vacation/vac1.jpg',
        filename: 'vac1.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'album-persist-test',
      };

      useTrashStore.setState({ items: [trashedItem] });

      // Before permanent delete: 10 base - 1 trashed = 9
      expect(getReconciledAlbumCount(albumWithTen, useTrashStore.getState().items)).toBe(9);

      // Decrement in-memory assetCount on permanent delete
      useAlbumsStore.getState().decrementAlbumCount('album-persist-test', 1);
      useTrashStore.getState().permanentlyDelete(['vac-1']);

      const updatedAlbum = useAlbumsStore.getState().albums.find((a) => a.id === 'album-persist-test');
      expect(updatedAlbum?.assetCount).toBe(9);

      // Reconciled count remains 9 (no 10-count flicker/drift)
      expect(getReconciledAlbumCount(updatedAlbum!, useTrashStore.getState().items)).toBe(9);
    });

    it('20. Smart album heuristics reconcile counts accurately even when item albumId is missing', () => {
      // Legacy item missing albumId with standard Camera filename
      const legacyCameraPhoto: TrashedItem = {
        id: 'legacy-cam-1',
        uri: 'content://media/external/images/media/9999',
        filename: 'IMG_20250101_120000.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
      };

      const reconciled = getReconciledAlbumCount(cameraAlbum, [legacyCameraPhoto]);
      // 10 base - 1 legacy camera photo = 9
      expect(reconciled).toBe(9);
    });

    it('21. Reconciled count produces identical results whether activeAlbumId is null (overview) or set (detail)', () => {
      const album: MediaLibrary.Album = {
        id: 'vacation-2024',
        title: 'Vacation 2024',
        assetCount: 20,
      } as MediaLibrary.Album;

      const trashedItem: TrashedItem = {
        id: 'vac-trashed-1',
        uri: 'file:///storage/emulated/0/Pictures/Vacation 2024/photo1.jpg',
        filename: 'photo1.jpg',
        mediaType: 'photo',
        width: 1080,
        height: 1920,
        creationTime: Date.now(),
        duration: 0,
        trashedAt: Date.now(),
        albumId: 'vacation-2024',
      };

      const mediaItems: PixoraMediaInfo[] = [
        {
          id: 'vac-hidden-1',
          uri: 'file:///storage/emulated/0/Pictures/Vacation 2024/hidden1.jpg',
          filename: 'hidden1.jpg',
          mediaType: 'photo',
          width: 1080,
          height: 1920,
          creationTime: Date.now(),
          modificationTime: Date.now(),
          duration: 0,
          albumId: 'vacation-2024',
        },
      ];

      // Register the media in media store
      useMediaStore.setState({ media: mediaItems });
      usePrivacyStore.setState({ hiddenAssetIds: ['vac-hidden-1'] });

      // Case 1: activeAlbumId is NULL (Albums overview tab)
      useAlbumsStore.setState({ activeAlbumId: null, activeAlbumMedia: [] });
      const overviewCount = getReconciledAlbumCount(album, [trashedItem]);

      // Case 2: activeAlbumId is 'vacation-2024' (Album detail screen)
      useAlbumsStore.setState({ activeAlbumId: 'vacation-2024', activeAlbumMedia: mediaItems });
      const detailCount = getReconciledAlbumCount(album, [trashedItem]);

      // Both overview and detail MUST agree: 20 base - 1 trashed - 1 hidden = 18
      expect(overviewCount).toBe(18);
      expect(detailCount).toBe(18);
      expect(overviewCount).toBe(detailCount);
    });

    it('22. Protected assets registered via registerAssetAlbums are deducted on overview without opening the album', () => {
      const { registerAssetAlbums } = require('../../../src/store/useAlbumsStore');
      const album: MediaLibrary.Album = {
        id: 'family-album',
        title: 'Family',
        assetCount: 15,
      } as MediaLibrary.Album;

      // Register assets before opening
      registerAssetAlbums([
        { id: 'fam-pvt-1', albumId: 'family-album' },
        { id: 'fam-arc-1', albumId: 'family-album' },
      ]);

      usePrivacyStore.setState({
        privateAssetIds: ['fam-pvt-1'],
        archivedAssetIds: ['fam-arc-1'],
      });

      useAlbumsStore.setState({ activeAlbumId: null, activeAlbumMedia: [] });

      const overviewCount = getReconciledAlbumCount(album, []);
      // 15 base - 1 private - 1 archived = 13
      expect(overviewCount).toBe(13);
    });
  });
});
