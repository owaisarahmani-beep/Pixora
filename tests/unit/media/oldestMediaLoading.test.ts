import { normalizeTimestamp, groupMediaByDate } from '../../../src/utils/dateGrouping';
import { mediaStoreService } from '../../../src/services/media/MediaStoreService';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

jest.mock('expo-media-library/legacy');
jest.mock('expo-media-library');

describe('Oldest Media Loading & Timestamp Preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMediaStore.setState({
      media: [],
      isLoading: false,
      isRefreshing: false,
      hasNextPage: true,
      endCursor: undefined,
      sortOrder: 'newest',
    });
    useTrashStore.setState({
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });
  });

  describe('Timestamp Resolution & Preservation', () => {
    it('preserves genuine capture date for older photos without letting newer modificationTime overwrite it', async () => {
      // Historical photo taken in 2015 (1420070400000), but transferred/copied to phone in 2024 (1710000000000)
      const historicalCaptureTime = 1420070400000; // Jan 1, 2015
      const recentCopyTime = 1710000000000; // March 2024

      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            id: 'photo-old-1',
            uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20150101.jpg',
            filename: 'IMG_20150101.jpg',
            mediaType: 'photo',
            width: 1920,
            height: 1080,
            creationTime: historicalCaptureTime,
            modificationTime: recentCopyTime,
            duration: 0,
            albumId: 'camera',
          },
        ],
        hasNextPage: false,
        endCursor: '1',
        totalCount: 1,
      });

      const result = await mediaStoreService.getMediaAsync();
      expect(result.assets).toHaveLength(1);
      const asset = result.assets[0];

      // Must preserve the genuine 2015 capture time, NOT the 2024 disk write time
      expect(asset.creationTime).toBe(historicalCaptureTime);
      expect(asset.modificationTime).toBe(recentCopyTime);
    });

    it('falls back to modificationTime when creationTime is 0 or missing (e.g. WhatsApp / downloads without EXIF)', async () => {
      const downloadTime = 1710000000000;

      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            id: 'wa-img-1',
            uri: 'file:///storage/emulated/0/WhatsApp/Media/IMG-wa.jpg',
            filename: 'IMG-wa.jpg',
            mediaType: 'photo',
            width: 800,
            height: 600,
            creationTime: 0, // EXIF DATE_TAKEN missing
            modificationTime: downloadTime,
            duration: 0,
            albumId: 'whatsapp',
          },
        ],
        hasNextPage: false,
        endCursor: '1',
        totalCount: 1,
      });

      const result = await mediaStoreService.getMediaAsync();
      expect(result.assets).toHaveLength(1);
      const asset = result.assets[0];

      // Falls back cleanly to download time
      expect(asset.creationTime).toBe(downloadTime);
    });

    it('groups historical photos into correct past month/year headers', () => {
      const photo2012: PixoraMediaInfo = {
        id: 'p-2012',
        uri: 'file:///photo-2012.jpg',
        filename: 'p-2012.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: 1325376000000, // Jan 1, 2012
        modificationTime: 1325376000000,
        duration: 0,
      };

      const photo2016: PixoraMediaInfo = {
        id: 'p-2016',
        uri: 'file:///photo-2016.jpg',
        filename: 'p-2016.jpg',
        mediaType: 'photo',
        width: 100,
        height: 100,
        creationTime: 1463270400000, // May 15, 2016
        modificationTime: 1463270400000,
        duration: 0,
      };

      const groups = groupMediaByDate([photo2016, photo2012]);
      expect(groups).toHaveLength(2);
      expect(groups[0].title).toBe('May 2016');
      expect(groups[0].data[0].id).toBe('p-2016');
      expect(groups[1].title).toBe('January 2012');
      expect(groups[1].data[0].id).toBe('p-2012');
    });
  });

  describe('Anti-Stall Infinite Scroll Pagination', () => {
    it('continues fetching subsequent page when a page contains only trashed items so older photos are reachable', async () => {
      useMediaStore.setState({
        media: [
          {
            id: 'existing-1',
            uri: 'file:///existing-1.jpg',
            filename: 'existing-1.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: Date.now(),
            modificationTime: Date.now(),
            duration: 0,
          },
        ],
        endCursor: '50',
        hasNextPage: true,
      });

      // Mark trashed item
      useTrashStore.setState({
        items: [
          {
            id: 'trashed-1',
            uri: 'file:///trashed-1.jpg',
            filename: 'trashed-1.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            trashedAt: Date.now(),
            creationTime: Date.now() - 1000,
            duration: 0,
          },
        ],
      });

      // Batch 1: returns only trashed-1, hasNextPage: true
      (MediaLibrary.getAssetsAsync as jest.Mock)
        .mockResolvedValueOnce({
          assets: [
            {
              id: 'trashed-1',
              uri: 'file:///trashed-1.jpg',
              filename: 'trashed-1.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 1400000000000,
              modificationTime: 1400000000000,
              duration: 0,
            },
          ],
          hasNextPage: true,
          endCursor: '100',
        })
        // Batch 2: returns older genuine photo
        .mockResolvedValueOnce({
          assets: [
            {
              id: 'old-photo-reached',
              uri: 'file:///old-reached.jpg',
              filename: 'old-reached.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 1300000000000,
              modificationTime: 1300000000000,
              duration: 0,
            },
          ],
          hasNextPage: false,
          endCursor: '150',
        });

      await useMediaStore.getState().loadMoreMedia();

      const media = useMediaStore.getState().media;
      expect(media.some(m => m.id === 'old-photo-reached')).toBe(true);
      expect(media.some(m => m.id === 'trashed-1')).toBe(false);
      expect(useMediaStore.getState().endCursor).toBe('150');
      expect(useMediaStore.getState().hasNextPage).toBe(false);
    });
  });

  describe('Genuine Oldest Media Querying & Sorting', () => {
    it('queries MediaStore with creationTime ASC, modificationTime ASC when sortOrder is oldest', async () => {
      const mockGetAssets = jest.spyOn(MediaLibrary, 'getAssetsAsync').mockResolvedValueOnce({
        assets: [
          {
            id: 'photo-2012',
            uri: 'file:///photo-2012.jpg',
            filename: 'photo-2012.jpg',
            mediaType: 'photo',
            width: 1920,
            height: 1080,
            creationTime: 1325376000000,
            modificationTime: 1325376000000,
            duration: 0,
          } as any,
        ],
        endCursor: 'cursor-old-1',
        hasNextPage: true,
        totalCount: 1,
      });

      const res = await mediaStoreService.getMediaAsync(undefined, undefined, 100, 'oldest');

      expect(mockGetAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAfter: 1,
          sortBy: [
            ['creationTime', true],
            ['modificationTime', true],
          ],
        })
      );
      expect(res.assets[0].id).toBe('photo-2012');
    });

    it('setSortOrder("oldest") resets media/cursor and loads genuine oldest photos from MediaStore', async () => {
      // Mock existing media from "newest" sorting
      useMediaStore.setState({
        media: [
          {
            id: 'recent-photo',
            uri: 'file:///recent.jpg',
            filename: 'recent.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: Date.now(),
            modificationTime: Date.now(),
            duration: 0,
          },
        ],
        sortOrder: 'newest',
        endCursor: 'cursor-newest',
        hasNextPage: true,
      });

      // Mock MediaStore returning genuine oldest photos (from 2013)
      jest.spyOn(MediaLibrary, 'getAssetsAsync').mockResolvedValueOnce({
        assets: [
          {
            id: 'true-oldest-2013',
            uri: 'file:///oldest-2013.jpg',
            filename: 'oldest-2013.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1360000000000,
            modificationTime: 1360000000000,
            duration: 0,
          } as any,
        ],
        endCursor: 'cursor-oldest-1',
        hasNextPage: true,
        totalCount: 500,
      });

      await useMediaStore.getState().setSortOrder('oldest');

      const state = useMediaStore.getState();
      expect(state.sortOrder).toBe('oldest');
      expect(state.media).toHaveLength(2);
      expect(state.media[0].id).toBe('true-oldest-2013');
      expect(state.media[1].id).toBe('recent-photo');
      expect(state.endCursor).toBe('cursor-oldest-1');
    });

    it('loadMoreMedia forwards sortOrder="oldest" when paginating from oldest edge', async () => {
      useMediaStore.setState({
        media: [
          {
            id: 'true-oldest-2013',
            uri: 'file:///oldest-2013.jpg',
            filename: 'oldest-2013.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1360000000000,
            modificationTime: 1360000000000,
            duration: 0,
          },
        ],
        sortOrder: 'oldest',
        endCursor: 'cursor-oldest-1',
        hasNextPage: true,
      });

      const mockGetAssets = jest.spyOn(MediaLibrary, 'getAssetsAsync').mockResolvedValueOnce({
        assets: [
          {
            id: 'oldest-page-2-2014',
            uri: 'file:///oldest-2014.jpg',
            filename: 'oldest-2014.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1390000000000,
            modificationTime: 1390000000000,
            duration: 0,
          } as any,
        ],
        endCursor: 'cursor-oldest-2',
        hasNextPage: false,
        totalCount: 500,
      });

      await useMediaStore.getState().loadMoreMedia();

      expect(mockGetAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          after: 'cursor-oldest-1',
          createdAfter: 1,
          sortBy: [
            ['creationTime', true],
            ['modificationTime', true],
          ],
        })
      );

      const media = useMediaStore.getState().media;
      expect(media).toHaveLength(2);
      expect(media[0].id).toBe('true-oldest-2013');
      expect(media[1].id).toBe('oldest-page-2-2014');
    });

    it('useAlbumsStore setAlbumSortOrder("oldest") queries album media ascending without createdAfter filter', async () => {
      const mockGetAssets = jest.spyOn(MediaLibrary, 'getAssetsAsync').mockResolvedValueOnce({
        assets: [
          {
            id: 'album-oldest-1',
            uri: 'file:///album-old.jpg',
            filename: 'album-old.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1350000000000,
            modificationTime: 1350000000000,
            duration: 0,
          } as any,
        ],
        endCursor: 'album-cursor-old-1',
        hasNextPage: false,
        totalCount: 1,
      });

      useAlbumsStore.setState({
        activeAlbumId: 'vacation-album',
        albumSortOrder: 'newest',
      });

      await useAlbumsStore.getState().setAlbumSortOrder('oldest');

      expect(mockGetAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          album: 'vacation-album',
          sortBy: [
            ['creationTime', true],
            ['modificationTime', true],
          ],
        })
      );
      expect((mockGetAssets.mock.calls[0][0] as any).createdAfter).toBeUndefined();
      expect(useAlbumsStore.getState().albumSortOrder).toBe('oldest');
      expect(useAlbumsStore.getState().activeAlbumMedia[0].id).toBe('album-oldest-1');
    });

    it('multi-page boundary: paginates multi-page dataset preserving strict ascending chronological order', async () => {
      // Simulating a multi-page boundary dataset:
      // Page 1: 2 oldest photos from 2012 (1325376000000, 1335376000000)
      // Page 2: 2 subsequent photos from 2013 and 2015
      const mockGetAssets = jest.spyOn(MediaLibrary, 'getAssetsAsync')
        .mockResolvedValueOnce({
          assets: [
            {
              id: 'p-2012-1',
              uri: 'file:///p-2012-1.jpg',
              filename: 'p-2012-1.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 1325376000000, // Jan 2012
              modificationTime: 1325376000000,
              duration: 0,
            } as any,
            {
              id: 'p-2012-2',
              uri: 'file:///p-2012-2.jpg',
              filename: 'p-2012-2.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 1335376000000, // Apr 2012
              modificationTime: 1335376000000,
              duration: 0,
            } as any,
          ],
          endCursor: 'cursor-page-1',
          hasNextPage: true,
          totalCount: 4,
        })
        .mockResolvedValueOnce({
          assets: [
            {
              id: 'p-2013-1',
              uri: 'file:///p-2013-1.jpg',
              filename: 'p-2013-1.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 1360000000000, // Feb 2013
              modificationTime: 1360000000000,
              duration: 0,
            } as any,
            {
              id: 'p-2015-1',
              uri: 'file:///p-2015-1.jpg',
              filename: 'p-2015-1.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 1420070400000, // Jan 2015
              modificationTime: 1420070400000,
              duration: 0,
            } as any,
          ],
          endCursor: 'cursor-page-2',
          hasNextPage: false,
          totalCount: 4,
        });

      // Load initial page with sortOrder === 'oldest'
      await useMediaStore.getState().setSortOrder('oldest');

      const page1Media = useMediaStore.getState().media;
      expect(page1Media).toHaveLength(2);
      expect(page1Media[0].id).toBe('p-2012-1');
      expect(page1Media[1].id).toBe('p-2012-2');
      expect(useMediaStore.getState().hasNextPage).toBe(true);

      // Load next page across the boundary
      await useMediaStore.getState().loadMoreMedia();

      const combinedMedia = useMediaStore.getState().media;
      expect(combinedMedia).toHaveLength(4);
      expect(combinedMedia.map(m => m.id)).toEqual([
        'p-2012-1',
        'p-2012-2',
        'p-2013-1',
        'p-2015-1',
      ]);
      expect(useMediaStore.getState().hasNextPage).toBe(false);
      expect(mockGetAssets).toHaveBeenCalledTimes(2);
    });

    it('fallback: queries without createdAfter when device has 0 media with positive DATE_TAKEN', async () => {
      // First call (with createdAfter: 1) returns empty assets (simulating device with no EXIF dates)
      // Second call (fallback) returns media without createdAfter
      const mockGetAssets = jest.spyOn(MediaLibrary, 'getAssetsAsync')
        .mockResolvedValueOnce({
          assets: [],
          endCursor: '0',
          hasNextPage: false,
          totalCount: 0,
        })
        .mockResolvedValueOnce({
          assets: [
            {
              id: 'download-1',
              uri: 'file:///download-1.jpg',
              filename: 'download-1.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 0,
              modificationTime: 1600000000000,
              duration: 0,
            } as any,
          ],
          endCursor: '1',
          hasNextPage: false,
          totalCount: 1,
        });

      const res = await mediaStoreService.getMediaAsync(undefined, undefined, 100, 'oldest');

      expect(mockGetAssets).toHaveBeenCalledTimes(2);
      expect(res.assets).toHaveLength(1);
      expect(res.assets[0].id).toBe('download-1');
      expect(res.assets[0].creationTime).toBe(1600000000000);
    });
  });
});
