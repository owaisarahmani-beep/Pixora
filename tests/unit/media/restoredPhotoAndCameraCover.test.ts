import {
  mapRawAssetToPixoraMedia,
  resolveMediaTimestamp,
  parseDateFromExif,
  parseDateFromFilename,
  mediaStoreService,
} from '../../../src/services/media/MediaStoreService';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { groupMediaByDate, normalizeTimestamp } from '../../../src/utils/dateGrouping';
import { isCameraMedia, getSmartAlbumsList } from '../../../src/hooks/useSmartAlbums';
import * as MediaLibrary from 'expo-media-library/legacy';

jest.mock('expo-media-library/legacy');
jest.mock('expo-media-library');

describe('Phase 10.1.2: Restored Photo Dates and Camera Album Cover', () => {
  const now = Date.now();
  const jan2025CaptureTime = 1736942400000; // Jan 15, 2025
  const downloadTime = now - 30000; // 30 seconds ago

  const cameraBucket: MediaLibrary.Album = {
    id: 'bucket-camera',
    title: 'Camera',
    assetCount: 15,
  } as MediaLibrary.Album;

  const downloadBucket: MediaLibrary.Album = {
    id: 'bucket-downloads',
    title: 'Download',
    assetCount: 5,
  } as MediaLibrary.Album;

  const screenshotBucket: MediaLibrary.Album = {
    id: 'bucket-screenshots',
    title: 'Screenshots',
    assetCount: 8,
  } as MediaLibrary.Album;

  const physicalAlbums = [cameraBucket, downloadBucket, screenshotBucket];

  beforeEach(() => {
    jest.clearAllMocks();
    useMediaStore.setState({
      media: [],
      isLoading: false,
      isRefreshing: false,
      hasNextPage: true,
      endCursor: undefined,
      sortOrder: 'newest',
      permissionStatus: 'GRANTED',
    });
    useAlbumsStore.setState({
      albums: physicalAlbums,
      albumCovers: {},
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
      restoredTimestamps: {},
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

  describe('Part A — Restored Photo Dates', () => {
    it('1. Restores genuine January 2025 capture date preserved in TrashStore metadata', () => {
      // Simulate photo deleted to Trash
      useTrashStore.getState().moveToTrash({
        id: 'cam-jan-2025',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20250115_120000.jpg',
        filename: 'IMG_20250115_120000.jpg',
        mediaType: 'photo',
        width: 4000,
        height: 3000,
        creationTime: jan2025CaptureTime,
        duration: 0,
      });

      // Restore the photo
      useTrashStore.getState().restoreItems(['cam-jan-2025']);

      // Check preserved timestamp is recorded in trash store
      const preserved = useTrashStore.getState().getPreservedTimestamp('cam-jan-2025');
      expect(preserved).toBe(jan2025CaptureTime);

      // Now simulate Android MediaStore re-query returning touched modificationTime = now
      const rawAsset: MediaLibrary.Asset = {
        id: 'cam-jan-2025',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20250115_120000.jpg',
        filename: 'IMG_20250115_120000.jpg',
        mediaType: 'photo',
        width: 4000,
        height: 3000,
        creationTime: 0, // MediaStore zeroed out creationTime
        modificationTime: now, // Touched today
        duration: 0,
        albumId: 'bucket-camera',
      };

      const resolved = resolveMediaTimestamp(rawAsset, physicalAlbums);
      expect(resolved).toBe(jan2025CaptureTime);

      const mapped = mapRawAssetToPixoraMedia(rawAsset, physicalAlbums);
      expect(mapped.creationTime).toBe(jan2025CaptureTime);

      const groups = groupMediaByDate([mapped]);
      expect(groups).toHaveLength(1);
      expect(groups[0].title).toBe('January 2025');
    });

    it('2. Recovers January 2025 date from camera filename when MediaStore re-indexes creationTime to Today', () => {
      const reindexedAsset: MediaLibrary.Asset = {
        id: 'cam-reindexed',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20250115_143022.jpg',
        filename: 'IMG_20250115_143022.jpg',
        mediaType: 'photo',
        width: 4000,
        height: 3000,
        creationTime: now, // Overwritten to Today by Android OS MediaScanner
        modificationTime: now,
        duration: 0,
        albumId: 'bucket-camera',
      };

      const resolved = resolveMediaTimestamp(reindexedAsset, physicalAlbums);
      const resolvedDate = new Date(resolved);
      expect(resolvedDate.getFullYear()).toBe(2025);
      expect(resolvedDate.getMonth()).toBe(0); // January
      expect(resolvedDate.getDate()).toBe(15);

      const mapped = mapRawAssetToPixoraMedia(reindexedAsset, physicalAlbums);
      const groups = groupMediaByDate([mapped]);
      expect(groups[0].title).toBe('January 2025');
    });

    it('3. Recovers January 2025 date from EXIF metadata when creationTime is missing or zero', () => {
      const assetWithExif = {
        id: 'cam-exif-photo',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_custom.jpg',
        filename: 'IMG_custom.jpg',
        mediaType: 'photo' as const,
        width: 4000,
        height: 3000,
        creationTime: 0,
        modificationTime: now,
        duration: 0,
        albumId: 'bucket-camera',
        exif: {
          DateTimeOriginal: '2025:01:15 09:30:00',
        },
      };

      const parsedExif = parseDateFromExif(assetWithExif.exif);
      expect(parsedExif).not.toBeNull();
      const exifDate = new Date(parsedExif!);
      expect(exifDate.getFullYear()).toBe(2025);
      expect(exifDate.getMonth()).toBe(0);
      expect(exifDate.getDate()).toBe(15);

      const resolved = resolveMediaTimestamp(assetWithExif, physicalAlbums);
      expect(resolved).toBe(parsedExif);
    });

    it('4. Preserves downloaded video with stale metadata appearing under Today', () => {
      const staleDownloadedVideo: MediaLibrary.Asset = {
        id: 'dl-video-today',
        uri: 'file:///storage/emulated/0/Download/video_web_sample.mp4',
        filename: 'video_web_sample.mp4',
        mediaType: 'video',
        width: 1920,
        height: 1080,
        creationTime: 1609459200000, // Jan 2021 embedded MP4 container time
        modificationTime: downloadTime, // Downloaded today
        duration: 45,
        albumId: 'bucket-downloads',
      };

      const resolved = resolveMediaTimestamp(staleDownloadedVideo, physicalAlbums);
      expect(resolved).toBe(downloadTime);

      const mapped = mapRawAssetToPixoraMedia(staleDownloadedVideo, physicalAlbums);
      const groups = groupMediaByDate([mapped]);
      expect(groups[0].title).toBe('Today');
    });

    it('5. Ensures sorting and grouping use the exact same resolved timestamp', () => {
      const restoredJanPhoto = mapRawAssetToPixoraMedia({
        id: 'photo-jan-2025',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20250115_080000.jpg',
        filename: 'IMG_20250115_080000.jpg',
        mediaType: 'photo',
        width: 4000,
        height: 3000,
        creationTime: jan2025CaptureTime,
        modificationTime: now,
        duration: 0,
        albumId: 'bucket-camera',
      }, physicalAlbums);

      const downloadedTodayVideo = mapRawAssetToPixoraMedia({
        id: 'video-today',
        uri: 'file:///storage/emulated/0/Download/downloaded_vid.mp4',
        filename: 'downloaded_vid.mp4',
        mediaType: 'video',
        width: 1920,
        height: 1080,
        creationTime: 1609459200000,
        modificationTime: downloadTime,
        duration: 30,
        albumId: 'bucket-downloads',
      }, physicalAlbums);

      // Verify mapped creationTime is canonical
      expect(restoredJanPhoto.creationTime).toBe(jan2025CaptureTime);
      expect(downloadedTodayVideo.creationTime).toBe(downloadTime);

      // Sorting comparator used across useMediaStore and index.tsx
      const items = [restoredJanPhoto, downloadedTodayVideo];
      const sorted = [...items].sort((a, b) => {
        const timeA = normalizeTimestamp(a.creationTime || a.modificationTime);
        const timeB = normalizeTimestamp(b.creationTime || b.modificationTime);
        return timeB - timeA;
      });

      // Newest first: downloadedTodayVideo must be at index 0
      expect(sorted[0].id).toBe('video-today');
      expect(sorted[1].id).toBe('photo-jan-2025');

      // Grouping uses the same sorted array
      const groups = groupMediaByDate(sorted);
      expect(groups).toHaveLength(2);
      expect(groups[0].title).toBe('Today');
      expect(groups[0].data[0].id).toBe('video-today');
      expect(groups[1].title).toBe('January 2025');
      expect(groups[1].data[0].id).toBe('photo-jan-2025');
    });
  });

  describe('Part B — Camera Album Cover Selection', () => {
    it('6. Rejects downloaded, whatsapp, and screenshot media from isCameraMedia even if filename starts with VID_ or IMG_', () => {
      const downloadedVid = {
        id: 'dl-vid-1',
        uri: 'file:///storage/emulated/0/Download/VID_20261028_100000.mp4',
        filename: 'VID_20261028_100000.mp4',
        albumId: 'bucket-downloads',
      } as any;

      const whatsappPhoto = {
        id: 'wa-photo-1',
        uri: 'file:///storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/IMG-20261028-WA0001.jpg',
        filename: 'IMG-20261028-WA0001.jpg',
        albumId: 'bucket-wa',
      } as any;

      const screenshotPhoto = {
        id: 'ss-photo-1',
        uri: 'file:///storage/emulated/0/Pictures/Screenshots/Screenshot_20261028.png',
        filename: 'Screenshot_20261028.png',
        albumId: 'bucket-screenshots',
      } as any;

      const genuineCameraPhoto = {
        id: 'cam-photo-1',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20261028_110000.jpg',
        filename: 'IMG_20261028_110000.jpg',
        albumId: 'bucket-camera',
      } as any;

      expect(isCameraMedia(downloadedVid, physicalAlbums)).toBe(false);
      expect(isCameraMedia(whatsappPhoto, physicalAlbums)).toBe(false);
      expect(isCameraMedia(screenshotPhoto, physicalAlbums)).toBe(false);
      expect(isCameraMedia(genuineCameraPhoto, physicalAlbums)).toBe(true);
    });

    it('7. Excludes trashed/tombstoned media from becoming album covers in getAlbumCoverAsync', async () => {
      const trashedCameraAsset = {
        id: 'cam-trashed',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_trashed.jpg',
      };
      const eligibleCameraAsset = {
        id: 'cam-eligible',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_eligible.jpg',
      };

      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [trashedCameraAsset, eligibleCameraAsset],
      });

      // Mark the first asset as trashed
      useTrashStore.getState().moveToTrash({
        id: 'cam-trashed',
        uri: trashedCameraAsset.uri,
        filename: 'IMG_trashed.jpg',
        mediaType: 'photo',
        width: 1000,
        height: 1000,
        creationTime: now,
        duration: 0,
      });

      const cover = await mediaStoreService.getAlbumCoverAsync('bucket-camera', true);
      // Must skip the trashed candidate and pick the eligible one
      expect(cover).toBe(eligibleCameraAsset.uri);
    });

    it('8. Excludes hidden, private vault, and archived assets from album covers', async () => {
      const hiddenAsset = { id: 'cam-hidden', uri: 'file:///DCIM/Camera/hidden.jpg' };
      const vaultAsset = { id: 'cam-vault', uri: 'file:///DCIM/Camera/vault.jpg' };
      const archivedAsset = { id: 'cam-archived', uri: 'file:///DCIM/Camera/archived.jpg' };
      const publicAsset = { id: 'cam-public', uri: 'file:///DCIM/Camera/public.jpg' };

      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [hiddenAsset, vaultAsset, archivedAsset, publicAsset],
      });

      usePrivacyStore.setState({
        hiddenAssetIds: ['cam-hidden'],
        privateAssetIds: ['cam-vault'],
        archivedAssetIds: ['cam-archived'],
      });

      const cover = await mediaStoreService.getAlbumCoverAsync('bucket-camera', true);
      expect(cover).toBe(publicAsset.uri);
    });

    it('9. Excludes Samsung DCIM screenshots from becoming the Camera cover', async () => {
      const dcimScreenshot = {
        id: 'samsung-ss',
        uri: 'file:///storage/emulated/0/DCIM/Screenshots/Screenshot_2026.png',
        filename: 'Screenshot_2026.png',
        mediaType: 'photo',
      };
      const genuinePhoto = {
        id: 'real-camera-pic',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_real.jpg',
        filename: 'IMG_real.jpg',
        mediaType: 'photo',
      };

      (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
        assets: [dcimScreenshot, genuinePhoto],
      });

      const cover = await mediaStoreService.getAlbumCoverAsync('bucket-camera', true);
      expect(cover).toBe(genuinePhoto.uri);
    });

    it('10. Derives Smart Album Camera cover from canonical physical Camera album cover', () => {
      const albumCovers = {
        'bucket-camera': 'file:///storage/emulated/0/DCIM/Camera/verified_cam_cover.jpg',
        'bucket-downloads': 'file:///storage/emulated/0/Download/verified_dl_cover.mp4',
      };

      // Even if allMedia contains a newly downloaded video as item 0
      const newlyDownloadedVideo = {
        id: 'dl-vid-today',
        uri: 'file:///storage/emulated/0/Download/VID_new.mp4',
        filename: 'VID_new.mp4',
        albumId: 'bucket-downloads',
        creationTime: now,
        mediaType: 'video',
      } as any;

      const smartAlbums = getSmartAlbumsList([newlyDownloadedVideo], physicalAlbums, albumCovers);
      const camSmartAlbum = smartAlbums.find(a => a.id === '__smart_camera');

      expect(camSmartAlbum).toBeDefined();
      expect(camSmartAlbum?.coverUri).toBe('file:///storage/emulated/0/DCIM/Camera/verified_cam_cover.jpg');
      expect(camSmartAlbum?.coverUri).not.toBe(newlyDownloadedVideo.uri);
    });
  });
});
