import React from 'react';
import { render } from '@testing-library/react-native';
import { mapRawAssetToPixoraMedia, resolveMediaTimestamp, mediaStoreService } from '../../../src/services/media/MediaStoreService';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { groupMediaByDate } from '../../../src/utils/dateGrouping';
import { useAuthorizedMedia } from '../../../src/hooks/useVisibleMedia';
import * as MediaLibrary from 'expo-media-library/legacy';

jest.mock('expo-media-library/legacy');
jest.mock('expo-media-library');

async function getHookResult<T>(hookFn: (...args: any[]) => T, args: any[]): Promise<T> {
  let result!: T;
  function HookWrapper() {
    result = hookFn(...args);
    return null;
  }
  await render(React.createElement(HookWrapper));
  return result;
}

describe('Phase 10.1 & 10.1.1: Media Timestamp Policy & Restored Photos Preservation', () => {
  const now = Date.now();
  const jan2025CaptureTime = 1736940000000; // Jan 15, 2025
  const ancientEncodedTime = 1629000000000; // August 2021 (embedded container metadata)
  const downloadTime = now - 60000; // 1 minute ago (file modified/downloaded timestamp)

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
      activeSmartAlbumId: null,
      activeSmartAlbumMedia: [],
      activeSmartAlbumGrouped: [],
      isLoadingSmartAlbum: false,
      hasMoreSmartAlbum: true,
      smartAlbumCursor: undefined,
      smartAlbumSortOrder: 'newest',
      albums: [
        {
          id: 'bucket-downloads',
          title: 'Download',
          assetCount: 1,
        } as MediaLibrary.Album,
      ],
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

  describe('1. Timestamp Policy: Restored Historical Camera Photos', () => {
    it('preserves genuine January 2025 capture date for camera photo even if modificationTime is Today', () => {
      const restoredCameraPhoto: MediaLibrary.Asset = {
        id: 'cam-jan-2025',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20250115_123456.jpg',
        filename: 'IMG_20250115_123456.jpg',
        mediaType: 'photo',
        width: 4000,
        height: 3000,
        creationTime: jan2025CaptureTime,
        modificationTime: now, // File touched/restored today
        duration: 0,
        albumId: 'camera-bucket',
      };

      const resolved = resolveMediaTimestamp(restoredCameraPhoto);
      expect(resolved).toBe(jan2025CaptureTime);

      const mapped = mapRawAssetToPixoraMedia(restoredCameraPhoto);
      expect(mapped.creationTime).toBe(jan2025CaptureTime);

      // Must group under "January 2025", NEVER under "Today"
      const grouped = groupMediaByDate([mapped]);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].title).toBe('January 2025');
      expect(grouped[0].data[0].id).toBe('cam-jan-2025');
    });

    it('keeps restored January 2025 photo under January 2025 group when restored alongside Today downloads', async () => {
      const restoredPhoto = mapRawAssetToPixoraMedia({
        id: 'cam-restored',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20250115_001.jpg',
        filename: 'IMG_20250115_001.jpg',
        mediaType: 'photo',
        width: 4000,
        height: 3000,
        creationTime: jan2025CaptureTime,
        modificationTime: now, // file restored today
        duration: 0,
        albumId: 'camera-bucket',
      });

      const todayDownloadedVideo = mapRawAssetToPixoraMedia({
        id: 'vid-download-today',
        uri: 'file:///storage/emulated/0/Download/viral_clip.mp4',
        filename: 'viral_clip.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: ancientEncodedTime,
        modificationTime: downloadTime,
        duration: 30,
        albumId: 'bucket-downloads',
      });

      // Upsert both into media store
      useMediaStore.getState().upsertMedia([restoredPhoto, todayDownloadedVideo]);

      const media = useMediaStore.getState().media;
      expect(media).toHaveLength(2);

      // In Newest sorting: Today's downloaded video must be first, Jan 2025 photo second
      expect(media[0].id).toBe('vid-download-today');
      expect(media[1].id).toBe('cam-restored');

      // Date grouping must produce two separate groups: Today and January 2025
      const grouped = groupMediaByDate(media);
      expect(grouped).toHaveLength(2);
      expect(grouped[0].title).toBe('Today');
      expect(grouped[0].data[0].id).toBe('vid-download-today');
      expect(grouped[1].title).toBe('January 2025');
      expect(grouped[1].data[0].id).toBe('cam-restored');
    });
  });

  describe('2. Timestamp Policy: Downloaded Media', () => {
    it('resolves creationTime to download timestamp (mTime) instead of ancient container date', () => {
      const rawAsset: MediaLibrary.Asset = {
        id: 'vid-download-101',
        uri: 'file:///storage/emulated/0/Download/funny_clip.mp4',
        filename: 'funny_clip.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: ancientEncodedTime,
        modificationTime: downloadTime,
        duration: 45,
        albumId: 'bucket-downloads',
      };

      const mapped = mapRawAssetToPixoraMedia(rawAsset, [
        { id: 'bucket-downloads', title: 'Download', assetCount: 1 } as MediaLibrary.Album,
      ]);

      // creationTime must be resolved to the download time, not 2021
      expect(mapped.creationTime).toBe(downloadTime);
      expect(mapped.modificationTime).toBe(downloadTime);
      expect(mapped.mediaType).toBe('video');
    });

    it('groups downloaded video under "Today" in dateGrouping', () => {
      const mapped = mapRawAssetToPixoraMedia({
        id: 'vid-download-102',
        uri: 'file:///storage/emulated/0/Download/reel_2026.mp4',
        filename: 'reel_2026.mp4',
        mediaType: 'video',
        width: 720,
        height: 1280,
        creationTime: ancientEncodedTime,
        modificationTime: downloadTime,
        duration: 15,
        albumId: 'bucket-downloads',
      });

      const grouped = groupMediaByDate([mapped]);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].title).toBe('Today');
      expect(grouped[0].data[0].id).toBe('vid-download-102');
    });
  });

  describe('3. Timestamp Policy: WhatsApp Media', () => {
    it('preserves genuine capture date for WhatsApp photo when cTime > 0', () => {
      const waAsset: MediaLibrary.Asset = {
        id: 'wa-historical',
        uri: 'file:///storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/IMG-20250115-WA0001.jpg',
        filename: 'IMG-20250115-WA0001.jpg',
        mediaType: 'photo',
        width: 1200,
        height: 1600,
        creationTime: jan2025CaptureTime,
        modificationTime: now, // modified/received today
        duration: 0,
        albumId: 'wa-bucket',
      };

      const resolved = resolveMediaTimestamp(waAsset);
      expect(resolved).toBe(jan2025CaptureTime);

      const mapped = mapRawAssetToPixoraMedia(waAsset);
      expect(mapped.creationTime).toBe(jan2025CaptureTime);

      const grouped = groupMediaByDate([mapped]);
      expect(grouped[0].title).toBe('January 2025');
    });

    it('falls back to modificationTime when WhatsApp photo has no capture date (cTime = 0)', () => {
      const waNoExif: MediaLibrary.Asset = {
        id: 'wa-no-exif',
        uri: 'file:///storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/IMG-20261027-WA0002.jpg',
        filename: 'IMG-20261027-WA0002.jpg',
        mediaType: 'photo',
        width: 1200,
        height: 1600,
        creationTime: 0,
        modificationTime: downloadTime,
        duration: 0,
        albumId: 'wa-bucket',
      };

      const resolved = resolveMediaTimestamp(waNoExif);
      expect(resolved).toBe(downloadTime);

      const mapped = mapRawAssetToPixoraMedia(waNoExif);
      expect(mapped.creationTime).toBe(downloadTime);

      const grouped = groupMediaByDate([mapped]);
      expect(grouped[0].title).toBe('Today');
    });
  });

  describe('4. Missing, Invalid, and Fallback Timestamps', () => {
    it('safely handles missing or zero timestamps without producing NaN or corrupted dates', () => {
      const corruptedAsset = {
        id: 'corrupted-1',
        uri: 'file:///storage/emulated/0/DCIM/corrupted.jpg',
        filename: 'corrupted.jpg',
        creationTime: -1,
        modificationTime: 0,
      };

      const resolved = resolveMediaTimestamp(corruptedAsset);
      expect(typeof resolved).toBe('number');
      expect(resolved).toBeGreaterThan(0);
      expect(isNaN(resolved)).toBe(false);

      const mapped = mapRawAssetToPixoraMedia({
        ...corruptedAsset,
        mediaType: 'photo',
        width: 100,
        height: 100,
        duration: 0,
      } as any);

      expect(mapped.creationTime).toBeGreaterThan(0);
      const grouped = groupMediaByDate([mapped]);
      expect(grouped).toHaveLength(1);
    });
  });

  describe('5. Oldest vs Newest Sorting Consistency', () => {
    it('places genuine oldest camera photos first when sortOrder is oldest', async () => {
      const photo2012 = mapRawAssetToPixoraMedia({
        id: 'cam-2012',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20120101.jpg',
        filename: 'IMG_20120101.jpg',
        mediaType: 'photo',
        width: 2000,
        height: 1500,
        creationTime: 1325376000000, // Jan 2012
        modificationTime: 1325376000000,
        duration: 0,
      } as any);

      const photo2025 = mapRawAssetToPixoraMedia({
        id: 'cam-2025',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20250115.jpg',
        filename: 'IMG_20250115.jpg',
        mediaType: 'photo',
        width: 4000,
        height: 3000,
        creationTime: jan2025CaptureTime,
        modificationTime: now,
        duration: 0,
      } as any);

      const downloadedVideoToday = mapRawAssetToPixoraMedia({
        id: 'vid-today',
        uri: 'file:///storage/emulated/0/Download/video.mp4',
        filename: 'video.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: ancientEncodedTime,
        modificationTime: downloadTime,
        duration: 30,
        albumId: 'bucket-downloads',
      } as any);

      // In oldest sort order: 2012 first, 2025 second, today's download last
      useMediaStore.setState({ sortOrder: 'oldest' });
      useMediaStore.getState().upsertMedia([photo2025, downloadedVideoToday, photo2012]);

      const oldestList = useMediaStore.getState().media;
      expect(oldestList.map((m) => m.id)).toEqual(['cam-2012', 'cam-2025', 'vid-today']);

      // In newest sort order: today's download first, 2025 second, 2012 last
      useMediaStore.setState({ sortOrder: 'newest', media: [] });
      useMediaStore.getState().upsertMedia([photo2025, downloadedVideoToday, photo2012]);

      const newestList = useMediaStore.getState().media;
      expect(newestList.map((m) => m.id)).toEqual(['vid-today', 'cam-2025', 'cam-2012']);
    });
  });

  describe('6. Downloads Album to Photos Home Cross-Store Synchronization', () => {
    it('synchronizes downloaded video from Downloads smart album to useMediaStore via upsertMedia', async () => {
      const downloadedVideoRaw: MediaLibrary.Asset = {
        id: 'vid-from-downloads-album',
        uri: 'file:///storage/emulated/0/Download/viral.mp4',
        filename: 'viral.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: ancientEncodedTime,
        modificationTime: downloadTime,
        duration: 30,
        albumId: 'bucket-downloads',
      };

      jest.spyOn(mediaStoreService, 'getAlbumAssetsAsync').mockResolvedValueOnce({
        assets: [
          mapRawAssetToPixoraMedia(downloadedVideoRaw, [
            { id: 'bucket-downloads', title: 'Download', assetCount: 1 } as MediaLibrary.Album,
          ]),
        ],
        hasNextPage: false,
        endCursor: 'end',
      });

      // User opens Downloads smart album
      await useAlbumsStore.getState().openSmartAlbum('__smart_downloads');

      // Verify asset exists in Downloads smart album
      const dlMedia = useAlbumsStore.getState().activeSmartAlbumMedia;
      expect(dlMedia).toHaveLength(1);
      expect(dlMedia[0].id).toBe('vid-from-downloads-album');

      // Verify asset was automatically propagated to canonical useMediaStore
      const canonicalMedia = useMediaStore.getState().media;
      expect(canonicalMedia.some((m) => m.id === 'vid-from-downloads-album')).toBe(true);

      // Verify Photos screen visibility
      const visible = await getHookResult(useAuthorizedMedia, [canonicalMedia, 'public']);
      expect(visible.some((m) => m.id === 'vid-from-downloads-album')).toBe(true);
    });

    it('prevents duplicate entries when upsertMedia or refreshMedia is called multiple times', async () => {
      const item = mapRawAssetToPixoraMedia({
        id: 'vid-repeat',
        uri: 'file:///storage/emulated/0/Download/repeat.mp4',
        filename: 'repeat.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: downloadTime,
        modificationTime: downloadTime,
        duration: 10,
        albumId: 'bucket-downloads',
      });

      useMediaStore.getState().upsertMedia([item]);
      useMediaStore.getState().upsertMedia([item]);
      useMediaStore.getState().upsertMedia([item]);

      const media = useMediaStore.getState().media;
      expect(media.filter((m) => m.id === 'vid-repeat')).toHaveLength(1);
    });
  });

  describe('7. Privacy & Authorization Protection', () => {
    it('does not leak downloaded video if added to private vault or hidden', async () => {
      const item = mapRawAssetToPixoraMedia({
        id: 'vid-private',
        uri: 'file:///storage/emulated/0/Download/private_doc.mp4',
        filename: 'private_doc.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: downloadTime,
        modificationTime: downloadTime,
        duration: 10,
        albumId: 'bucket-downloads',
      });

      useMediaStore.getState().upsertMedia([item]);

      // Move to private vault
      usePrivacyStore.setState({
        privateAssetIds: ['vid-private'],
      });

      const publicVisible = await getHookResult(useAuthorizedMedia, [useMediaStore.getState().media, 'public']);
      expect(publicVisible.some((m) => m.id === 'vid-private')).toBe(false);
    });

    it('excludes trashed downloaded video from public feed', async () => {
      const item = mapRawAssetToPixoraMedia({
        id: 'vid-trashed',
        uri: 'file:///storage/emulated/0/Download/trashed.mp4',
        filename: 'trashed.mp4',
        mediaType: 'video',
        width: 1080,
        height: 1920,
        creationTime: downloadTime,
        modificationTime: downloadTime,
        duration: 10,
        albumId: 'bucket-downloads',
      });

      useTrashStore.setState({
        items: [
          {
            id: 'vid-trashed',
            uri: item.uri,
            trashedAt: Date.now(),
            filename: item.filename,
            mediaType: item.mediaType as 'video',
            width: item.width,
            height: item.height,
            creationTime: item.creationTime,
            duration: item.duration,
          },
        ],
      });

      useMediaStore.getState().upsertMedia([item]);

      const publicVisible = await getHookResult(useAuthorizedMedia, [useMediaStore.getState().media, 'public']);
      expect(publicVisible.some((m) => m.id === 'vid-trashed')).toBe(false);
    });
  });
});
