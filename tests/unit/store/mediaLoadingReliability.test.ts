import { mediaStoreService } from '../../../src/services/media/MediaStoreService';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import * as MediaLibrary from 'expo-media-library/legacy';

describe('Media Loading Reliability & Overhaul Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMediaStore.setState({
      media: [],
      hasNextPage: true,
      endCursor: undefined,
      isLoading: false,
      isRefreshing: false,
      permissionStatus: 'GRANTED',
    });
    useAlbumsStore.setState({
      albums: [],
      albumCovers: {},
      isLoadingAlbums: false,
    });
    useTrashStore.setState({
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });
  });

  describe('MediaStoreService Sorting & Change Observation', () => {
    it('queries MediaStore with dual sorting: modificationTime DESC, creationTime DESC', async () => {
      const mockGetAssets = jest.spyOn(MediaLibrary, 'getAssetsAsync').mockResolvedValueOnce({
        assets: [
          {
            id: 'video-1',
            uri: 'file:///storage/emulated/0/DCIM/Camera/VID_001.mp4',
            filename: 'VID_001.mp4',
            mediaType: 'video',
            width: 1920,
            height: 1080,
            creationTime: 0, // 0 creationTime on Android
            modificationTime: 1700000000,
            duration: 15,
          } as any,
        ],
        endCursor: 'cursor-1',
        hasNextPage: false,
        totalCount: 1,
      });

      const res = await mediaStoreService.getMediaAsync();

      expect(mockGetAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: [
            ['modificationTime', false],
            ['creationTime', false],
          ],
        })
      );

      // Verify that 0 creationTime resolved using modificationTime
      expect(res.assets[0].creationTime).toBeGreaterThan(0);
      expect(res.assets[0].creationTime).toBe(1700000000000); // normalized to ms
    });

    it('subscribes to native media library changes and unsubscribes cleanly', () => {
      const mockRemove = jest.fn();
      const mockAddListener = jest.spyOn(MediaLibrary, 'addListener').mockReturnValueOnce({
        remove: mockRemove,
      } as any);

      const callback = jest.fn();
      const unsubscribe = mediaStoreService.subscribeToMediaChanges(callback);

      expect(mockAddListener).toHaveBeenCalled();

      // Trigger callback
      const listenerArg = mockAddListener.mock.calls[0][0];
      listenerArg({ hasIncrementalChanges: false });

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();
      expect(mockRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('useMediaStore Refresh & Media Retention', () => {
    it('refreshMedia() merges new top items without losing older items', async () => {
      const item1 = {
        id: 'item-1',
        uri: 'file:///1.jpg',
        filename: '1.jpg',
        mediaType: 'photo' as const,
        width: 100,
        height: 100,
        creationTime: 1000,
        modificationTime: 1000,
        duration: 0,
      };

      const item2 = {
        id: 'item-2',
        uri: 'file:///2.jpg',
        filename: '2.jpg',
        mediaType: 'photo' as const,
        width: 100,
        height: 100,
        creationTime: 2000,
        modificationTime: 2000,
        duration: 0,
      };

      useMediaStore.setState({
        media: [item1],
        endCursor: 'cursor-page-1',
        hasNextPage: true,
      });

      jest.spyOn(mediaStoreService, 'getMediaAsync').mockResolvedValueOnce({
        assets: [item2, item1],
        endCursor: 'cursor-page-1',
        hasNextPage: true,
      });

      await useMediaStore.getState().refreshMedia();

      const state = useMediaStore.getState();
      expect(state.media).toHaveLength(2);
      expect(state.media[0].id).toBe('item-2'); // newest item first
      expect(state.media[1].id).toBe('item-1');
    });

    it('partial query returning fewer items does NOT erase valid older existing media', async () => {
      const olderItem = {
        id: 'item-older-99',
        uri: 'file:///older.jpg',
        filename: 'older.jpg',
        mediaType: 'photo' as const,
        width: 100,
        height: 100,
        creationTime: 500,
        modificationTime: 500,
        duration: 0,
      };

      const freshItem = {
        id: 'item-fresh-1',
        uri: 'file:///fresh.jpg',
        filename: 'fresh.jpg',
        mediaType: 'photo' as const,
        width: 100,
        height: 100,
        creationTime: 3000,
        modificationTime: 3000,
        duration: 0,
      };

      useMediaStore.setState({
        media: [olderItem],
        endCursor: 'cursor-page-2',
        hasNextPage: true,
      });

      // MediaStore refresh only returns page 1 (which does not contain olderItem)
      jest.spyOn(mediaStoreService, 'getMediaAsync').mockResolvedValueOnce({
        assets: [freshItem],
        endCursor: 'cursor-page-1',
        hasNextPage: true,
      });

      await useMediaStore.getState().refreshMedia(false);

      const state = useMediaStore.getState();
      // olderItem MUST NOT be deleted merely because it wasn't returned on page 1 of refresh
      expect(state.media).toHaveLength(2);
      expect(state.media.some(m => m.id === 'item-older-99')).toBe(true);
      expect(state.media.some(m => m.id === 'item-fresh-1')).toBe(true);
    });

    it('discards out-of-order stale refresh responses', async () => {
      const itemInitial = {
        id: 'item-initial',
        uri: 'file:///init.jpg',
        filename: 'init.jpg',
        mediaType: 'photo' as const,
        width: 100,
        height: 100,
        creationTime: 1000,
        modificationTime: 1000,
        duration: 0,
      };

      const staleItem = {
        id: 'item-stale',
        uri: 'file:///stale.jpg',
        filename: 'stale.jpg',
        mediaType: 'photo' as const,
        width: 100,
        height: 100,
        creationTime: 1500,
        modificationTime: 1500,
        duration: 0,
      };

      const latestItem = {
        id: 'item-latest',
        uri: 'file:///latest.jpg',
        filename: 'latest.jpg',
        mediaType: 'photo' as const,
        width: 100,
        height: 100,
        creationTime: 2500,
        modificationTime: 2500,
        duration: 0,
      };

      useMediaStore.setState({ media: [itemInitial] });

      // Simulate Request 1 taking longer than Request 2
      let resolveRequest1: any;
      const request1Promise = new Promise<{ assets: any[]; hasNextPage: boolean; endCursor: string }>((resolve) => {
        resolveRequest1 = resolve;
      });

      const mockGetMedia = jest.spyOn(mediaStoreService, 'getMediaAsync');

      mockGetMedia.mockReturnValueOnce(request1Promise);

      // Trigger Request 1
      const p1 = useMediaStore.getState().refreshMedia();

      // Trigger Request 2 with fresh data
      useMediaStore.setState({ isRefreshing: false });
      mockGetMedia.mockResolvedValueOnce({
        assets: [latestItem, itemInitial],
        hasNextPage: false,
        endCursor: 'cursor-2',
      });
      const p2 = useMediaStore.getState().refreshMedia();
      await p2;

      // Verify that Request 2 updated the state
      expect(useMediaStore.getState().media.some(m => m.id === 'item-latest')).toBe(true);

      // Now Request 1 resolves later with stale data
      resolveRequest1({
        assets: [staleItem],
        hasNextPage: false,
        endCursor: 'cursor-1',
      });
      await p1;

      // Request 1's stale data MUST NOT have overwritten Request 2's latest media
      expect(useMediaStore.getState().media.some(m => m.id === 'item-latest')).toBe(true);
    });
  });

  describe('useTrashStore Restore Consistency', () => {
    it('restoreItems clears both ID and URI from tombstones', () => {
      useTrashStore.setState({
        items: [
          {
            id: 'item-10',
            uri: 'file:///storage/DCIM/Camera/restored.jpg',
            filename: 'restored.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1000,
            duration: 0,
            trashedAt: Date.now(),
          },
        ],
        permanentlyDeletedIds: ['item-10'],
        permanentlyDeletedUris: ['file:///storage/DCIM/Camera/restored.jpg'],
      });

      useTrashStore.getState().restoreItems(['item-10']);

      const state = useTrashStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.permanentlyDeletedIds).not.toContain('item-10');
      expect(state.permanentlyDeletedUris).not.toContain('file:///storage/DCIM/Camera/restored.jpg');
      expect(state.isDeleted('item-10', 'file:///storage/DCIM/Camera/restored.jpg')).toBe(false);
    });
  });

  describe('useAlbumsStore Force Refresh', () => {
    it('loadAlbums(false) skips reload if albums already present', async () => {
      useAlbumsStore.setState({
        albums: [{ id: 'album-1', title: 'Camera', assetCount: 10 } as any],
        isLoadingAlbums: false,
      });

      const spy = jest.spyOn(mediaStoreService, 'getAlbumsAsync');

      await useAlbumsStore.getState().loadAlbums(false);

      expect(spy).not.toHaveBeenCalled();
    });

    it('loadAlbums(true) forces re-querying albums from MediaStore', async () => {
      useAlbumsStore.setState({
        albums: [{ id: 'album-1', title: 'Camera', assetCount: 10 } as any],
        isLoadingAlbums: false,
      });

      const spy = jest.spyOn(mediaStoreService, 'getAlbumsAsync').mockResolvedValueOnce([
        { id: 'album-1', title: 'Camera', assetCount: 12 } as any,
        { id: 'album-2', title: 'Screenshots', assetCount: 5 } as any,
      ]);
      jest.spyOn(mediaStoreService, 'getAlbumCoverAsync').mockResolvedValue(null);

      await useAlbumsStore.getState().loadAlbums(true);

      expect(spy).toHaveBeenCalledTimes(1);
      const state = useAlbumsStore.getState();
      expect(state.albums).toHaveLength(2);
      expect(state.albums[0].assetCount).toBe(12);
    });
  });
});
