import { SMART_ALBUM_DEFS } from '../../../src/hooks/useSmartAlbums';
import { mediaStoreService } from '../../../src/services/media/MediaStoreService';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { useAuthorizedMedia } from '../../../src/hooks/useVisibleMedia';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

jest.mock('expo-media-library/legacy');
jest.mock('expo-media-library');

describe('Smart Album Actual Media Membership & Reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAlbumsStore.setState({
      activeSmartAlbumId: null,
      activeSmartAlbumMedia: [],
      activeSmartAlbumGrouped: [],
      isLoadingSmartAlbum: false,
      hasMoreSmartAlbum: true,
      smartAlbumCursor: undefined,
      smartAlbumSortOrder: 'newest',
    });
    useTrashStore.setState({
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });
    usePrivacyStore.setState({
      hiddenAlbumIds: [],
      lockedAlbumIds: [],
      unlockedAlbums: [],
      hiddenAssetIds: [],
      privateAssetIds: [],
      archivedAssetIds: [],
      isVaultUnlocked: false,
    });
  });

  describe('1. Filter & Query Mapping for Each Smart Album', () => {
    const now = Date.now();
    const mockCameraPhoto: PixoraMediaInfo = {
      id: 'cam-1',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20261027_001.jpg',
      filename: 'IMG_20261027_001.jpg',
      mediaType: 'photo',
      width: 4000,
      height: 3000,
      creationTime: now - 1000,
      modificationTime: now - 1000,
      duration: 0,
    };

    const mockCameraVideo: PixoraMediaInfo = {
      id: 'cam-vid-1',
      uri: 'file:///storage/emulated/0/DCIM/Camera/VID_20261027_002.mp4',
      filename: 'VID_20261027_002.mp4',
      mediaType: 'video',
      width: 1920,
      height: 1080,
      creationTime: now - 2000,
      modificationTime: now - 2000,
      duration: 15.5,
    };

    const mockPixelPhoto: PixoraMediaInfo = {
      id: 'pixel-1',
      uri: 'file:///storage/emulated/0/DCIM/Camera/PXL_20261027_003.jpg',
      filename: 'PXL_20261027_003.jpg',
      mediaType: 'photo',
      width: 4000,
      height: 3000,
      creationTime: now - 3000,
      modificationTime: now - 3000,
      duration: 0,
    };

    const mockScreenshot: PixoraMediaInfo = {
      id: 'sc-1',
      uri: 'file:///storage/emulated/0/Pictures/Screenshots/Screenshot_20261027.png',
      filename: 'Screenshot_20261027.png',
      mediaType: 'photo',
      width: 1080,
      height: 2400,
      creationTime: now - 4000,
      modificationTime: now - 4000,
      duration: 0,
    };

    const mockWhatsAppImage: PixoraMediaInfo = {
      id: 'wa-1',
      uri: 'file:///storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/IMG-20261027-WA0001.jpg',
      filename: 'IMG-20261027-WA0001.jpg',
      mediaType: 'photo',
      width: 1200,
      height: 1600,
      creationTime: 0,
      modificationTime: now - 5000,
      duration: 0,
    };

    const mockWhatsAppVideo: PixoraMediaInfo = {
      id: 'wa-vid-1',
      uri: 'file:///storage/emulated/0/WhatsApp/Media/WhatsApp Video/VID-20261027-WA0002.mp4',
      filename: 'VID-20261027-WA0002.mp4',
      mediaType: 'video',
      width: 720,
      height: 1280,
      creationTime: 0,
      modificationTime: now - 6000,
      duration: 30,
    };

    const mockDownload: PixoraMediaInfo = {
      id: 'dl-1',
      uri: 'file:///storage/emulated/0/Download/wallpaper.jpg',
      filename: 'wallpaper.jpg',
      mediaType: 'photo',
      width: 1920,
      height: 1080,
      creationTime: 0,
      modificationTime: now - 7000,
      duration: 0,
    };

    const mockOldMedia: PixoraMediaInfo = {
      id: 'old-1',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2020.jpg',
      filename: 'IMG_2020.jpg',
      mediaType: 'photo',
      width: 1920,
      height: 1080,
      creationTime: now - 60 * 24 * 60 * 60 * 1000, // 60 days ago
      modificationTime: now - 60 * 24 * 60 * 60 * 1000,
      duration: 0,
    };

    it('__smart_videos matches all video files and rejects photos', () => {
      const def = SMART_ALBUM_DEFS.find(d => d.id === '__smart_videos')!;
      expect(def.filter(mockCameraVideo)).toBe(true);
      expect(def.filter(mockWhatsAppVideo)).toBe(true);
      expect(def.filter(mockCameraPhoto)).toBe(false);
      expect(def.filter(mockScreenshot)).toBe(false);
    });

    it('__smart_screenshots matches screenshots by URI or filename', () => {
      const def = SMART_ALBUM_DEFS.find(d => d.id === '__smart_screenshots')!;
      expect(def.filter(mockScreenshot)).toBe(true);
      expect(def.filter(mockCameraPhoto)).toBe(false);
      expect(def.filter(mockDownload)).toBe(false);
    });

    it('__smart_whatsapp matches WhatsApp media including scoped storage and WA prefixes', () => {
      const def = SMART_ALBUM_DEFS.find(d => d.id === '__smart_whatsapp')!;
      expect(def.filter(mockWhatsAppImage)).toBe(true);
      expect(def.filter(mockWhatsAppVideo)).toBe(true);
      expect(def.filter(mockCameraPhoto)).toBe(false);
    });

    it('__smart_downloads matches download directory and download prefixes', () => {
      const def = SMART_ALBUM_DEFS.find(d => d.id === '__smart_downloads')!;
      expect(def.filter(mockDownload)).toBe(true);
      expect(def.filter(mockCameraPhoto)).toBe(false);
    });

    it('__smart_camera matches standard Android, Pixel, and camera video captures', () => {
      const def = SMART_ALBUM_DEFS.find(d => d.id === '__smart_camera')!;
      expect(def.filter(mockCameraPhoto)).toBe(true);
      expect(def.filter(mockCameraVideo)).toBe(true);
      expect(def.filter(mockPixelPhoto)).toBe(true);
      expect(def.filter(mockScreenshot)).toBe(false);
      expect(def.filter(mockDownload)).toBe(false);
    });

    it('__smart_recent matches media within 30 days even if creationTime is 0', () => {
      const def = SMART_ALBUM_DEFS.find(d => d.id === '__smart_recent')!;
      // creationTime > 0 within 30 days
      expect(def.filter(mockCameraPhoto)).toBe(true);
      // creationTime == 0 but modified recently (WhatsApp / Download)
      expect(def.filter(mockWhatsAppImage)).toBe(true);
      expect(def.filter(mockDownload)).toBe(true);
      // 60 days old
      expect(def.filter(mockOldMedia)).toBe(false);
    });
  });

  describe('2. MediaStoreService getSmartAlbumMediaAsync', () => {
    it('__smart_videos queries MediaLibrary natively with mediaType: [video]', async () => {
      const mockGetAssets = (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            id: 'v-1',
            uri: 'file:///v-1.mp4',
            filename: 'v-1.mp4',
            mediaType: 'video',
            width: 1920,
            height: 1080,
            creationTime: 1700000000000,
            modificationTime: 1700000000000,
            duration: 10,
          },
        ],
        hasNextPage: false,
        endCursor: '1',
      });

      const res = await mediaStoreService.getSmartAlbumMediaAsync('__smart_videos', undefined, 50, 'newest');
      expect(res.assets).toHaveLength(1);
      expect(res.assets[0].id).toBe('v-1');
      expect(mockGetAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: ['video'],
        })
      );
    });

    it('__smart_screenshots streams and filters media from MediaStore batches', async () => {
      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            id: 'p-regular',
            uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_001.jpg',
            filename: 'IMG_001.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1700000000000,
            modificationTime: 1700000000000,
            duration: 0,
          },
          {
            id: 'sc-1',
            uri: 'file:///storage/emulated/0/Pictures/Screenshots/Screenshot_001.png',
            filename: 'Screenshot_001.png',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1700000000000,
            modificationTime: 1700000000000,
            duration: 0,
          },
        ],
        hasNextPage: false,
        endCursor: '2',
      });

      const res = await mediaStoreService.getSmartAlbumMediaAsync('__smart_screenshots', undefined, 50, 'newest');
      expect(res.assets).toHaveLength(1);
      expect(res.assets[0].id).toBe('sc-1');
    });

    it('returns empty assets when smartAlbumId is unrecognized', async () => {
      const res = await mediaStoreService.getSmartAlbumMediaAsync('__unknown_smart_id', undefined, 50, 'newest');
      expect(res.assets).toEqual([]);
      expect(res.hasNextPage).toBe(false);
    });
  });

  describe('3. Route ID Resolution & useAlbumsStore Integration', () => {
    it('openSmartAlbum loads and populates dedicated smart album state', async () => {
      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            id: 'sc-101',
            uri: 'file:///Pictures/Screenshots/sc-101.png',
            filename: 'Screenshot_101.png',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1710000000000,
            modificationTime: 1710000000000,
            duration: 0,
          },
        ],
        hasNextPage: false,
        endCursor: '1',
      });

      await useAlbumsStore.getState().openSmartAlbum('__smart_screenshots');

      const state = useAlbumsStore.getState();
      expect(state.activeSmartAlbumId).toBe('__smart_screenshots');
      expect(state.activeSmartAlbumMedia).toHaveLength(1);
      expect(state.activeSmartAlbumMedia[0].id).toBe('sc-101');
      expect(state.isLoadingSmartAlbum).toBe(false);
    });

    it('setSmartAlbumSortOrder preserves membership and passes sortOrder correctly', async () => {
      const mockGetAssets = (MediaLibrary.getAssetsAsync as jest.Mock)
        .mockResolvedValueOnce({
          assets: [
            {
              id: 'cam-recent',
              uri: 'file:///DCIM/Camera/IMG_recent.jpg',
              filename: 'IMG_recent.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 1720000000000,
              modificationTime: 1720000000000,
              duration: 0,
            },
          ],
          hasNextPage: false,
          endCursor: '1',
        })
        .mockResolvedValueOnce({
          assets: [
            {
              id: 'cam-oldest',
              uri: 'file:///DCIM/Camera/IMG_old.jpg',
              filename: 'IMG_old.jpg',
              mediaType: 'photo',
              width: 100,
              height: 100,
              creationTime: 1350000000000,
              modificationTime: 1350000000000,
              duration: 0,
            },
          ],
          hasNextPage: false,
          endCursor: '1',
        });

      // 1. Initial load with newest
      await useAlbumsStore.getState().openSmartAlbum('__smart_camera', 'newest');
      expect(useAlbumsStore.getState().activeSmartAlbumMedia[0].id).toBe('cam-recent');

      // 2. Switch to oldest
      await useAlbumsStore.getState().setSmartAlbumSortOrder('oldest');
      expect(useAlbumsStore.getState().smartAlbumSortOrder).toBe('oldest');
      expect(useAlbumsStore.getState().activeSmartAlbumMedia[0].id).toBe('cam-oldest');
      expect(mockGetAssets).toHaveBeenCalledTimes(2);
    });
  });

  describe('4. Pagination Without Missing or Duplicate Items', () => {
    it('loadMoreSmartAlbumMedia appends next page items and rejects duplicates', async () => {
      useAlbumsStore.setState({
        activeSmartAlbumId: '__smart_whatsapp',
        activeSmartAlbumMedia: [
          {
            id: 'wa-1',
            uri: 'file:///WhatsApp/Media/IMG-wa-1.jpg',
            filename: 'IMG-wa-1.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1710000000000,
            modificationTime: 1710000000000,
            duration: 0,
          },
        ],
        smartAlbumCursor: '10',
        hasMoreSmartAlbum: true,
      });

      // Next batch contains 1 duplicate and 1 new item
      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            id: 'wa-1', // duplicate
            uri: 'file:///WhatsApp/Media/IMG-wa-1.jpg',
            filename: 'IMG-wa-1.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1710000000000,
            modificationTime: 1710000000000,
            duration: 0,
          },
          {
            id: 'wa-2', // new
            uri: 'file:///WhatsApp/Media/IMG-wa-2.jpg',
            filename: 'IMG-wa-2.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1705000000000,
            modificationTime: 1705000000000,
            duration: 0,
          },
        ],
        hasNextPage: false,
        endCursor: '20',
      });

      await useAlbumsStore.getState().loadMoreSmartAlbumMedia();

      const media = useAlbumsStore.getState().activeSmartAlbumMedia;
      expect(media).toHaveLength(2);
      expect(media.map(m => m.id)).toEqual(['wa-1', 'wa-2']);
      expect(useAlbumsStore.getState().hasMoreSmartAlbum).toBe(false);
    });
  });

  describe('5. Exclusion of Trashed and Protected Media', () => {
    it('excludes trashed media from active smart album view', async () => {
      useTrashStore.setState({
        items: [
          {
            id: 'sc-trashed',
            uri: 'file:///Pictures/Screenshots/sc-trashed.png',
            filename: 'sc-trashed.png',
            mediaType: 'photo',
            width: 100,
            height: 100,
            trashedAt: Date.now(),
            creationTime: Date.now() - 1000,
            duration: 0,
          },
        ],
      });

      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            id: 'sc-trashed',
            uri: 'file:///Pictures/Screenshots/sc-trashed.png',
            filename: 'Screenshot_trashed.png',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1700000000000,
            modificationTime: 1700000000000,
            duration: 0,
          },
          {
            id: 'sc-valid',
            uri: 'file:///Pictures/Screenshots/sc-valid.png',
            filename: 'Screenshot_valid.png',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1700000000000,
            modificationTime: 1700000000000,
            duration: 0,
          },
        ],
        hasNextPage: false,
        endCursor: '2',
      });

      await useAlbumsStore.getState().openSmartAlbum('__smart_screenshots');

      const media = useAlbumsStore.getState().activeSmartAlbumMedia;
      expect(media).toHaveLength(1);
      expect(media[0].id).toBe('sc-valid');
    });

    it('removeMediaFromActiveSmartAlbum immediately excises deleted asset', () => {
      useAlbumsStore.setState({
        activeSmartAlbumMedia: [
          {
            id: 'item-1',
            uri: 'file:///item-1.jpg',
            filename: 'Screenshot_1.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1700000000000,
            modificationTime: 1700000000000,
            duration: 0,
          },
          {
            id: 'item-2',
            uri: 'file:///item-2.jpg',
            filename: 'Screenshot_2.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1700000000000,
            modificationTime: 1700000000000,
            duration: 0,
          },
        ],
      });

      useAlbumsStore.getState().removeMediaFromActiveSmartAlbum('item-1');

      const media = useAlbumsStore.getState().activeSmartAlbumMedia;
      expect(media).toHaveLength(1);
      expect(media[0].id).toBe('item-2');
    });
  });

  describe('6. Empty Results and Refresh Behavior', () => {
    it('handles empty results without error and sets empty media', async () => {
      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [],
        hasNextPage: false,
        endCursor: '0',
      });

      await useAlbumsStore.getState().openSmartAlbum('__smart_downloads');

      expect(useAlbumsStore.getState().activeSmartAlbumMedia).toEqual([]);
      expect(useAlbumsStore.getState().isLoadingSmartAlbum).toBe(false);
    });

    it('refreshSmartAlbum resets cursor and reloads media', async () => {
      useAlbumsStore.setState({
        activeSmartAlbumId: '__smart_camera',
        activeSmartAlbumMedia: [
          {
            id: 'stale-1',
            uri: 'file:///DCIM/Camera/stale.jpg',
            filename: 'IMG_stale.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1700000000000,
            modificationTime: 1700000000000,
            duration: 0,
          },
        ],
        smartAlbumCursor: '100',
      });

      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [
          {
            id: 'fresh-1',
            uri: 'file:///DCIM/Camera/fresh.jpg',
            filename: 'IMG_fresh.jpg',
            mediaType: 'photo',
            width: 100,
            height: 100,
            creationTime: 1720000000000,
            modificationTime: 1720000000000,
            duration: 0,
          },
        ],
        hasNextPage: false,
        endCursor: '1',
      });

      await useAlbumsStore.getState().refreshSmartAlbum();

      const media = useAlbumsStore.getState().activeSmartAlbumMedia;
      expect(media).toHaveLength(1);
      expect(media[0].id).toBe('fresh-1');
    });
  });
});
