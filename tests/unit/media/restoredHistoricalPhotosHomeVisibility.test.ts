import {
  mapRawAssetToPixoraMedia,
  resolveMediaTimestamp,
  mediaStoreService,
} from '../../../src/services/media/MediaStoreService';
import { useMediaStore } from '../../../src/store/useMediaStore';
import { useAlbumsStore } from '../../../src/store/useAlbumsStore';
import { useTrashStore } from '../../../src/store/useTrashStore';
import { usePrivacyStore } from '../../../src/store/usePrivacyStore';
import { groupMediaByDate, normalizeTimestamp } from '../../../src/utils/dateGrouping';
import { PixoraMediaInfo } from '../../../src/services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

jest.mock('expo-media-library/legacy');
jest.mock('expo-media-library');

describe('Phase 10.1.3: Restored Historical Photos Visibility on Photos Home Feed', () => {
  const now = Date.now();
  const july2021CaptureTime = 1626343200000; // July 15, 2021 10:00:00 UTC
  const downloadTime = now - 60000; // 1 minute ago

  const cameraBucket: MediaLibrary.Album = {
    id: 'bucket-camera',
    title: 'Camera',
    assetCount: 20,
  } as MediaLibrary.Album;

  const downloadBucket: MediaLibrary.Album = {
    id: 'bucket-downloads',
    title: 'Download',
    assetCount: 5,
  } as MediaLibrary.Album;

  const physicalAlbums = [cameraBucket, downloadBucket];

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
      activeAlbumMedia: [],
      activeSmartAlbumMedia: [],
      isLoadingMedia: false,
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
      restoredItems: [],
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

  it('1. Persists restored 2021 photo in useTrashStore.restoredItems upon restoreItems', () => {
    // Trashed historical item
    useTrashStore.getState().moveToTrash({
      id: 'photo-2021-001',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_100000.jpg',
      filename: 'IMG_20210715_100000.jpg',
      mediaType: 'photo',
      width: 4032,
      height: 3024,
      creationTime: july2021CaptureTime,
      duration: 0,
    });

    expect(useTrashStore.getState().items).toHaveLength(1);

    // Execute restore
    useTrashStore.getState().restoreItems(['photo-2021-001']);

    // Trash items list is cleared
    expect(useTrashStore.getState().items).toHaveLength(0);

    // Preserved timestamp is stored
    expect(useTrashStore.getState().getPreservedTimestamp('photo-2021-001')).toBe(july2021CaptureTime);

    // Persistent restoredItems holds the asset metadata
    const restored = useTrashStore.getState().restoredItems;
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('photo-2021-001');
    expect(restored[0].creationTime).toBe(july2021CaptureTime);
    expect(restored[0].filename).toBe('IMG_20210715_100000.jpg');
  });

  it('2. Ingestion in handleRestore survives getAssetsByIdsAsync failure on Android', async () => {
    // Simulate photo in trash
    useTrashStore.getState().moveToTrash({
      id: 'photo-2021-failed-native',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_110000.jpg',
      filename: 'IMG_20210715_110000.jpg',
      mediaType: 'photo',
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      duration: 0,
    });

    // Simulate MediaLibrary.getAssetInfoAsync throwing an error (Scoped Storage / ExifInterface failure)
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockRejectedValueOnce(
      new Error('FileNotFoundException: Scoped Storage permission denied')
    );

    // Emulate handleRestore implementation
    const ids = ['photo-2021-failed-native'];
    const trashItems = useTrashStore.getState().items;
    const itemsToRestore = trashItems.filter(i => ids.includes(String(i.id)));
    useTrashStore.getState().restoreItems(ids);

    const restoredBaseline = itemsToRestore.map(i => ({
      id: String(i.id),
      uri: i.uri,
      filename: i.filename,
      mediaType: i.mediaType,
      width: i.width,
      height: i.height,
      creationTime: i.creationTime,
      modificationTime: i.creationTime,
      duration: i.duration,
    }));

    // getAssetsByIdsAsync will return [] due to catch
    const nativeAssets = await mediaStoreService.getAssetsByIdsAsync(ids);
    expect(nativeAssets).toEqual([]);

    // Upsert baseline into useMediaStore
    useMediaStore.getState().upsertMedia(restoredBaseline);

    const media = useMediaStore.getState().media;
    expect(media).toHaveLength(1);
    expect(media[0].id).toBe('photo-2021-failed-native');
    expect(media[0].creationTime).toBe(july2021CaptureTime);
  });

  it('3. Survives app restart: loadInitialMedia merges restored historical photos with recent page', async () => {
    // Pre-populate useTrashStore with a restored 2021 photo (from a previous session)
    useTrashStore.setState({
      restoredItems: [
        {
          id: 'photo-2021-persisted',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_120000.jpg',
          filename: 'IMG_20210715_120000.jpg',
          mediaType: 'photo',
          width: 4000,
          height: 3000,
          creationTime: july2021CaptureTime,
          modificationTime: july2021CaptureTime,
          duration: 0,
        },
      ],
      restoredTimestamps: {
        'photo-2021-persisted': july2021CaptureTime,
      },
    });

    // Device MediaStore returns only recent (2026/2025) assets on page 1
    const recentAssets = [
      {
        id: 'photo-recent-1',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20261028_01.jpg',
        filename: 'IMG_20261028_01.jpg',
        mediaType: MediaLibrary.MediaType.photo,
        width: 4000,
        height: 3000,
        creationTime: now,
        modificationTime: now,
        duration: 0,
      },
      {
        id: 'photo-recent-2',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20261028_02.jpg',
        filename: 'IMG_20261028_02.jpg',
        mediaType: MediaLibrary.MediaType.photo,
        width: 4000,
        height: 3000,
        creationTime: now - 3600000,
        modificationTime: now - 3600000,
        duration: 0,
      },
    ];

    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: recentAssets,
      hasNextPage: true,
      endCursor: 'cursor-page-1',
    });

    // Simulate app startup
    await useMediaStore.getState().loadInitialMedia();

    const media = useMediaStore.getState().media;
    expect(media).toHaveLength(3); // 2 recent + 1 restored 2021

    // Newest first sorting: recent items come first, 2021 photo is at index 2
    expect(media[0].id).toBe('photo-recent-1');
    expect(media[1].id).toBe('photo-recent-2');
    expect(media[2].id).toBe('photo-2021-persisted');
    expect(media[2].creationTime).toBe(july2021CaptureTime);
  });

  it('4. refreshMedia preserves restored historical photos and respects preserved timestamps', async () => {
    // Restored 2021 photo recorded in store
    useTrashStore.setState({
      restoredItems: [
        {
          id: 'photo-2021-refresh',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_130000.jpg',
          filename: 'IMG_20210715_130000.jpg',
          mediaType: 'photo',
          width: 4000,
          height: 3000,
          creationTime: july2021CaptureTime,
          modificationTime: july2021CaptureTime,
          duration: 0,
        },
      ],
      restoredTimestamps: {
        'photo-2021-refresh': july2021CaptureTime,
      },
    });

    // Initial load
    useMediaStore.setState({
      media: [
        {
          id: 'photo-recent-1',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2026.jpg',
          filename: 'IMG_2026.jpg',
          mediaType: 'photo',
          width: 4000,
          height: 3000,
          creationTime: now,
          modificationTime: now,
          duration: 0,
        },
        {
          id: 'photo-2021-refresh',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_130000.jpg',
          filename: 'IMG_20210715_130000.jpg',
          mediaType: 'photo',
          width: 4000,
          height: 3000,
          creationTime: july2021CaptureTime,
          modificationTime: july2021CaptureTime,
          duration: 0,
        },
      ],
      endCursor: 'cursor-1',
      hasNextPage: true,
    });

    // MediaStore query on refresh returns only page 1 (does not have 2021 photo)
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'photo-recent-1',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2026.jpg',
          filename: 'IMG_2026.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: now,
          modificationTime: now,
          duration: 0,
        },
      ],
      hasNextPage: true,
      endCursor: 'cursor-1',
    });

    await useMediaStore.getState().refreshMedia();

    const media = useMediaStore.getState().media;
    expect(media).toHaveLength(2);
    expect(media.some(m => m.id === 'photo-2021-refresh')).toBe(true);
  });

  it('5. Correctly groups on Photos Home: 2021 photo appears in "July 2021", downloaded video under "Today"', () => {
    const downloadedTodayVideo = mapRawAssetToPixoraMedia({
      id: 'video-downloaded-today',
      uri: 'file:///storage/emulated/0/Download/tutorial.mp4',
      filename: 'tutorial.mp4',
      mediaType: 'video' as any,
      width: 1920,
      height: 1080,
      creationTime: 1600000000000, // Old container render time
      modificationTime: downloadTime, // Downloaded today
      duration: 60,
      albumId: 'bucket-downloads',
    }, physicalAlbums);

    const restored2021Photo = mapRawAssetToPixoraMedia({
      id: 'photo-2021-restored',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_090000.jpg',
      filename: 'IMG_20210715_090000.jpg',
      mediaType: 'photo' as any,
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: now, // Re-index artifact touched today
      duration: 0,
      albumId: 'bucket-camera',
    }, physicalAlbums);

    // Set preserved timestamp in trash store
    useTrashStore.getState().recordRestoredTimestamps([
      { id: 'photo-2021-restored', creationTime: july2021CaptureTime },
    ]);

    // Recalculate resolved time
    restored2021Photo.creationTime = resolveMediaTimestamp(restored2021Photo, physicalAlbums);

    const items = [restored2021Photo, downloadedTodayVideo];

    // Sorted as index.tsx does
    const sorted = [...items].sort((a, b) => {
      const timeA = normalizeTimestamp(a.creationTime || a.modificationTime);
      const timeB = normalizeTimestamp(b.creationTime || b.modificationTime);
      return timeB - timeA;
    });

    expect(sorted[0].id).toBe('video-downloaded-today');
    expect(sorted[1].id).toBe('photo-2021-restored');

    const groups = groupMediaByDate(sorted);
    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe('Today');
    expect(groups[0].data[0].id).toBe('video-downloaded-today');
    expect(groups[1].title).toBe('July 2021');
    expect(groups[1].data[0].id).toBe('photo-2021-restored');
  });

  it('6. Infinite scroll loadMoreMedia appends without duplicate keys and maintains chronological order', async () => {
    // Initial state: page 1 (recent) + restored 2021 photo
    useMediaStore.setState({
      media: [
        {
          id: 'photo-2026',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2026.jpg',
          filename: 'IMG_2026.jpg',
          mediaType: 'photo',
          width: 4000,
          height: 3000,
          creationTime: now,
          modificationTime: now,
          duration: 0,
        },
        {
          id: 'photo-2021-restored',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2021.jpg',
          filename: 'IMG_2021.jpg',
          mediaType: 'photo',
          width: 4000,
          height: 3000,
          creationTime: july2021CaptureTime,
          modificationTime: july2021CaptureTime,
          duration: 0,
        },
      ],
      endCursor: 'cursor-page-1',
      hasNextPage: true,
      sortOrder: 'newest',
    });

    // loadMoreMedia fetches page 2: media from 2024
    const midTimestamp = 1710000000000; // early 2024
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'photo-2024',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2024.jpg',
          filename: 'IMG_2024.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: midTimestamp,
          modificationTime: midTimestamp,
          duration: 0,
        },
      ],
      hasNextPage: false,
      endCursor: 'cursor-page-2',
    });

    await useMediaStore.getState().loadMoreMedia();

    const media = useMediaStore.getState().media;
    expect(media).toHaveLength(3);

    // Strictly ordered: 2026 -> 2024 -> 2021
    expect(media[0].id).toBe('photo-2026');
    expect(media[1].id).toBe('photo-2024');
    expect(media[2].id).toBe('photo-2021-restored');
  });

  it('7. Excludes restored photo if moved back to trash or permanently deleted', () => {
    const item = {
      id: 'photo-2021-retrashed',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2021.jpg',
      filename: 'IMG_2021.jpg',
      mediaType: 'photo' as const,
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: july2021CaptureTime,
      duration: 0,
    };

    // Initially restored
    useTrashStore.setState({
      restoredItems: [item],
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });

    // Check not deleted
    expect(useTrashStore.getState().isDeleted(item.id, item.uri)).toBe(false);
    expect(useTrashStore.getState().restoredItems).toHaveLength(1);

    // Retrashed
    useTrashStore.getState().moveToTrash(item);
    expect(useTrashStore.getState().isDeleted(item.id, item.uri)).toBe(true);
    expect(useTrashStore.getState().restoredItems).toHaveLength(0);

    // Re-restore
    useTrashStore.getState().restoreItems([item.id]);
    expect(useTrashStore.getState().isDeleted(item.id, item.uri)).toBe(false);
    expect(useTrashStore.getState().restoredItems).toHaveLength(1);

    // Permanently deleted
    useTrashStore.getState().permanentlyDelete([item.id], [item.uri]);
    expect(useTrashStore.getState().isDeleted(item.id, item.uri)).toBe(true);
    expect(useTrashStore.getState().restoredItems).toHaveLength(0);
  });

  it('8. Switching to oldest sort order maintains restored historical photo at correct position', async () => {
    useTrashStore.setState({
      restoredItems: [
        {
          id: 'photo-2021-sort',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2021.jpg',
          filename: 'IMG_2021.jpg',
          mediaType: 'photo',
          width: 4000,
          height: 3000,
          creationTime: july2021CaptureTime,
          modificationTime: july2021CaptureTime,
          duration: 0,
        },
      ],
      restoredTimestamps: {
        'photo-2021-sort': july2021CaptureTime,
      },
    });

    // Query for oldest returns a very old photo (e.g. 2018)
    const oldestTimestamp2018 = 1520000000000;
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'photo-2018',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2018.jpg',
          filename: 'IMG_2018.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: oldestTimestamp2018,
          modificationTime: oldestTimestamp2018,
          duration: 0,
        },
      ],
      hasNextPage: false,
      endCursor: 'cursor-oldest',
    });

    await useMediaStore.getState().setSortOrder('oldest');

    const media = useMediaStore.getState().media;
    expect(media).toHaveLength(2);
    // Oldest first: 2018 -> 2021
    expect(media[0].id).toBe('photo-2018');
    expect(media[1].id).toBe('photo-2021-sort');
  });

  it('9. Authoritative deletion: permanently deleted photo CANNOT reappear even if restoredItems has a stale record', () => {
    const item = {
      id: 'photo-2021-perm-deleted',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_perm.jpg',
      filename: 'IMG_20210715_perm.jpg',
      mediaType: 'photo' as const,
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: july2021CaptureTime,
      duration: 0,
    };

    useTrashStore.setState({
      restoredItems: [item],
      items: [],
      // Authoritative permanent deletion tombstone:
      permanentlyDeletedIds: ['photo-2021-perm-deleted'],
      permanentlyDeletedUris: ['file:///storage/emulated/0/DCIM/Camera/IMG_20210715_perm.jpg'],
    });

    // Permanent deletion tombstone MUST be authoritative and return true
    expect(useTrashStore.getState().isDeleted(item.id, item.uri)).toBe(true);
  });

  it('10. Authoritative soft-delete: moving a restored photo back to trash immediately marks it deleted', () => {
    const item = {
      id: 'photo-2021-retrash-auth',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_retrash.jpg',
      filename: 'IMG_20210715_retrash.jpg',
      mediaType: 'photo' as const,
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: july2021CaptureTime,
      duration: 0,
    };

    // 1. Move to trash initially
    useTrashStore.getState().moveToTrash(item);
    expect(useTrashStore.getState().isDeleted(item.id, item.uri)).toBe(true);

    // 2. Restore photo
    useTrashStore.getState().restoreItems([item.id]);
    expect(useTrashStore.getState().isDeleted(item.id, item.uri)).toBe(false);

    // 3. Move back to trash: MUST be immediately deleted
    useTrashStore.getState().moveToTrash(item);
    expect(useTrashStore.getState().isDeleted(item.id, item.uri)).toBe(true);
    expect(useTrashStore.getState().restoredItems).toHaveLength(0);
    expect(useTrashStore.getState().getPreservedTimestamp(item.id, item.uri)).toBeUndefined();
  });

  it('11. Filename matches alone never grant access, override deletion, or establish identity', () => {
    // A file with the same filename in a different folder
    const itemA = {
      id: 'asset-101',
      uri: 'file:///storage/emulated/0/DCIM/Camera/photo.jpg',
      filename: 'photo.jpg',
    };
    const itemB = {
      id: 'asset-999',
      uri: 'file:///storage/emulated/0/Download/photo.jpg',
      filename: 'photo.jpg',
    };

    // Permanently delete item A
    useTrashStore.getState().permanentlyDelete([itemA.id], [itemA.uri]);

    // Item A is permanently deleted
    expect(useTrashStore.getState().isDeleted(itemA.id, itemA.uri)).toBe(true);

    // Item B with same filename but different ID/URI is NOT affected
    expect(useTrashStore.getState().isDeleted(itemB.id, itemB.uri)).toBe(false);

    // Filename alone never recovers preserved timestamp
    expect(useTrashStore.getState().getPreservedTimestamp('unknown-id', 'unknown-uri')).toBeUndefined();
  });

  it('12. Preserved timestamps do not overwrite modificationTime: creationTime and modificationTime remain distinct', async () => {
    const rawModTime = now - 120000;
    useTrashStore.setState({
      restoredItems: [
        {
          id: 'photo-2021-distinct-times',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2021_distinct.jpg',
          filename: 'IMG_2021_distinct.jpg',
          mediaType: 'photo',
          width: 4000,
          height: 3000,
          creationTime: july2021CaptureTime,
          modificationTime: rawModTime,
          duration: 0,
        },
      ],
      restoredTimestamps: {
        'photo-2021-distinct-times': july2021CaptureTime,
      },
    });

    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'photo-2021-distinct-times',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2021_distinct.jpg',
          filename: 'IMG_2021_distinct.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: 0,
          modificationTime: rawModTime,
          duration: 0,
        },
      ],
      hasNextPage: false,
      endCursor: 'cursor-refresh',
    });

    await useMediaStore.getState().refreshMedia();

    const media = useMediaStore.getState().media;
    expect(media).toHaveLength(1);
    // creationTime is preserved historical capture date (2021)
    expect(media[0].creationTime).toBe(july2021CaptureTime);
    // modificationTime is NOT overwritten with capture date!
    expect(media[0].modificationTime).toBe(rawModTime);
  });

  it('13. Album query retains complete asset list across Newest/Oldest sort orders without collapsing or dropping zero DATE_TAKEN assets', async () => {
    const albumAssets = [
      {
        id: 'cam-photo-valid-datetaken',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_01.jpg',
        filename: 'IMG_20210715_01.jpg',
        mediaType: MediaLibrary.MediaType.photo,
        width: 4000,
        height: 3000,
        creationTime: 1626343200000, // Valid DATE_TAKEN > 1
        modificationTime: 1626343200000,
        duration: 0,
      },
      {
        id: 'restored-photo-zero-datetaken',
        uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_20210715_02.jpg',
        filename: 'IMG_20210715_02.jpg',
        mediaType: MediaLibrary.MediaType.photo,
        width: 4000,
        height: 3000,
        creationTime: 0, // Missing or zero DATE_TAKEN from Android MediaStore
        modificationTime: 1626343210000,
        duration: 0,
      },
      {
        id: 'downloaded-photo-zero-datetaken',
        uri: 'file:///storage/emulated/0/DCIM/Camera/download.jpg',
        filename: 'download.jpg',
        mediaType: MediaLibrary.MediaType.photo,
        width: 1920,
        height: 1080,
        creationTime: 0, // Missing or zero DATE_TAKEN
        modificationTime: 1626343220000,
        duration: 0,
      },
    ];

    // Mock MediaLibrary.getAssetsAsync for newest and oldest queries
    (MediaLibrary.getAssetsAsync as jest.Mock).mockImplementation(async (params) => {
      // Must NOT filter by createdAfter in album queries
      expect(params.createdAfter).toBeUndefined();
      expect(params.album).toBe('bucket-camera');
      return {
        assets: albumAssets,
        hasNextPage: false,
        endCursor: 'cursor-album-end',
      };
    });

    // Query album in newest sort
    const newestResult = await mediaStoreService.getAlbumAssetsAsync('bucket-camera', undefined, 'newest');
    expect(newestResult.assets).toHaveLength(3);

    // Query album in oldest sort: MUST retain all 3 items (must NEVER collapse to 1)
    const oldestResult = await mediaStoreService.getAlbumAssetsAsync('bucket-camera', undefined, 'oldest');
    expect(oldestResult.assets).toHaveLength(3);
    expect(oldestResult.assets.map(a => a.id)).toEqual(
      expect.arrayContaining(['cam-photo-valid-datetaken', 'restored-photo-zero-datetaken', 'downloaded-photo-zero-datetaken'])
    );
  });

  it('14. registerRestoredItems stores enriched native metadata (albumId, URI) and updates preserved timestamps by stable identity', () => {
    // 1. Initial restore baseline (missing albumId)
    useTrashStore.getState().restoreItems(['photo-2021-enriched']);
    
    // 2. Enriched baseline with albumId and canonical content URI
    const enrichedItem: PixoraMediaInfo = {
      id: 'photo-2021-enriched',
      uri: 'content://media/external/images/media/999888',
      filename: 'IMG_20210715_enriched.jpg',
      mediaType: 'photo',
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: now,
      duration: 0,
      albumId: 'bucket-camera',
    };

    useTrashStore.getState().registerRestoredItems([enrichedItem]);

    const restored = useTrashStore.getState().restoredItems;
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('photo-2021-enriched');
    expect(restored[0].albumId).toBe('bucket-camera');
    expect(restored[0].uri).toBe('content://media/external/images/media/999888');

    // Preserved timestamp accessible by ID and URI
    expect(useTrashStore.getState().getPreservedTimestamp('photo-2021-enriched')).toBe(july2021CaptureTime);
    expect(useTrashStore.getState().getPreservedTimestamp('unknown', 'content://media/external/images/media/999888')).toBe(july2021CaptureTime);
  });

  it('15. setSortOrder retains valid loaded in-memory items while strictly applying authoritative deletion filters', async () => {
    const validPhoto: PixoraMediaInfo = {
      id: 'photo-valid-loaded',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_valid.jpg',
      filename: 'IMG_valid.jpg',
      mediaType: 'photo',
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: july2021CaptureTime,
      duration: 0,
    };
    const trashedPhoto: PixoraMediaInfo = {
      id: 'photo-trashed-loaded',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_trashed.jpg',
      filename: 'IMG_trashed.jpg',
      mediaType: 'photo' as const,
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: july2021CaptureTime,
      duration: 0,
    };
    const permDeletedPhoto: PixoraMediaInfo = {
      id: 'photo-perm-loaded',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_perm.jpg',
      filename: 'IMG_perm.jpg',
      mediaType: 'photo',
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: july2021CaptureTime,
      duration: 0,
    };

    useTrashStore.setState({
      items: [{ ...trashedPhoto, mediaType: 'photo', trashedAt: Date.now() }],
      permanentlyDeletedIds: ['photo-perm-loaded'],
      permanentlyDeletedUris: [permDeletedPhoto.uri],
      restoredItems: [],
      restoredTimestamps: {},
    });

    useMediaStore.setState({
      media: [validPhoto, trashedPhoto, permDeletedPhoto],
      sortOrder: 'newest',
    });

    // Native query returns 1 native item from oldest sort
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'native-oldest-photo',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_oldest.jpg',
          filename: 'IMG_oldest.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: 1500000000000,
          modificationTime: 1500000000000,
          duration: 0,
        },
      ],
      hasNextPage: false,
      endCursor: 'cursor-end',
    });

    await useMediaStore.getState().setSortOrder('oldest');

    const result = useMediaStore.getState().media;
    expect(result.map(m => m.id)).toEqual(['native-oldest-photo', 'photo-valid-loaded']);
    expect(result.some(m => m.id === 'photo-trashed-loaded')).toBe(false);
    expect(result.some(m => m.id === 'photo-perm-loaded')).toBe(false);
  });

  it('16. openAlbum merges matching restored historical photos and reorders strictly using effective timestamps', async () => {
    const restoredPhotoInCam: PixoraMediaInfo = {
      id: 'photo-2021-restored-cam',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2021.jpg',
      filename: 'IMG_2021.jpg',
      mediaType: 'photo',
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: july2021CaptureTime,
      duration: 0,
      albumId: 'bucket-camera',
    };

    useTrashStore.setState({
      restoredItems: [restoredPhotoInCam],
      restoredTimestamps: { 'photo-2021-restored-cam': july2021CaptureTime },
    });

    // Album query returns recent photo
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'photo-recent-cam',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2026.jpg',
          filename: 'IMG_2026.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: now,
          modificationTime: now,
          duration: 0,
          albumId: 'bucket-camera',
        },
      ],
      hasNextPage: false,
      endCursor: 'cursor-1',
    });

    await useAlbumsStore.getState().openAlbum('bucket-camera', 'newest');

    const albumMedia = useAlbumsStore.getState().activeAlbumMedia;
    expect(albumMedia).toHaveLength(2);
    // Newest first: 2026 -> 2021
    expect(albumMedia[0].id).toBe('photo-recent-cam');
    expect(albumMedia[1].id).toBe('photo-2021-restored-cam');

    // And verify upsertMedia kept useMediaStore in sync
    const homeMedia = useMediaStore.getState().media;
    expect(homeMedia.some(m => m.id === 'photo-2021-restored-cam')).toBe(true);
  });

  it('17. Restored historical photo survives multiple refresh cycles, sort toggles, and store hydration', async () => {
    const historicalPhoto: PixoraMediaInfo = {
      id: 'photo-historical-survivor',
      uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2021_survivor.jpg',
      filename: 'IMG_2021_survivor.jpg',
      mediaType: 'photo',
      width: 4000,
      height: 3000,
      creationTime: july2021CaptureTime,
      modificationTime: july2021CaptureTime,
      duration: 0,
      albumId: 'bucket-camera',
    };

    useTrashStore.setState({
      restoredItems: [historicalPhoto],
      restoredTimestamps: { 'photo-historical-survivor': july2021CaptureTime },
      items: [],
      permanentlyDeletedIds: [],
      permanentlyDeletedUris: [],
    });

    // 1. Initial startup
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'photo-2026-fresh',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_fresh.jpg',
          filename: 'IMG_fresh.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: now,
          modificationTime: now,
          duration: 0,
        },
      ],
      hasNextPage: true,
      endCursor: 'cursor-p1',
    });

    await useMediaStore.getState().loadInitialMedia();
    expect(useMediaStore.getState().media.some(m => m.id === 'photo-historical-survivor')).toBe(true);

    // 2. Tab switch / background refresh cycles
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'photo-2026-fresh',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_fresh.jpg',
          filename: 'IMG_fresh.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: now,
          modificationTime: now,
          duration: 0,
        },
      ],
      hasNextPage: true,
      endCursor: 'cursor-p1',
    });

    await useMediaStore.getState().refreshMedia();
    expect(useMediaStore.getState().media.some(m => m.id === 'photo-historical-survivor')).toBe(true);

    // 3. Sort toggle to Oldest
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValueOnce({
      assets: [
        {
          id: 'photo-2015-oldest',
          uri: 'file:///storage/emulated/0/DCIM/Camera/IMG_2015.jpg',
          filename: 'IMG_2015.jpg',
          mediaType: MediaLibrary.MediaType.photo,
          width: 4000,
          height: 3000,
          creationTime: 1420000000000,
          modificationTime: 1420000000000,
          duration: 0,
        },
      ],
      hasNextPage: false,
      endCursor: 'cursor-old',
    });

    await useMediaStore.getState().setSortOrder('oldest');
    const sortedMedia = useMediaStore.getState().media;
    expect(sortedMedia.some(m => m.id === 'photo-historical-survivor')).toBe(true);
    const survivorIdx = sortedMedia.findIndex(m => m.id === 'photo-historical-survivor');
    const oldestIdx = sortedMedia.findIndex(m => m.id === 'photo-2015-oldest');
    const freshIdx = sortedMedia.findIndex(m => m.id === 'photo-2026-fresh');
    expect(oldestIdx).toBeLessThan(survivorIdx);
    expect(survivorIdx).toBeLessThan(freshIdx);
  });
});
