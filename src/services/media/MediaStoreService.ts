import * as MediaLibrary from 'expo-media-library/legacy';
import * as MediaLibraryNew from 'expo-media-library';
import { PixoraMediaInfo, MediaPermissionStatus } from './mediaTypes';
import { normalizeTimestamp } from '../../utils/dateGrouping';
import { SMART_ALBUM_DEFS, isDownloadMedia, isScreenshotMedia, isWhatsAppMedia } from '../../hooks/useSmartAlbums';
import { useTrashStore } from '../../store/useTrashStore';
import { usePrivacyStore } from '../../store/usePrivacyStore';

const PAGE_SIZE = 100;

/**
 * Safely parses standard EXIF date strings (e.g. "YYYY:MM:DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS").
 */
export function parseDateFromExif(exif?: Record<string, any> | null): number | null {
  if (!exif || typeof exif !== 'object') return null;
  const rawDate = exif.DateTimeOriginal || exif.DateTimeDigitized || exif.DateTime;
  if (!rawDate || typeof rawDate !== 'string') return null;
  const match = rawDate.trim().match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour = '00', min = '00', sec = '00'] = match;
  const y = parseInt(year, 10);
  if (y < 1970 || y > 2099) return null;
  const parsed = new Date(
    y,
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(min, 10),
    parseInt(sec, 10)
  ).getTime();
  return isNaN(parsed) || parsed <= 0 || parsed > 4102444800000 ? null : parsed;
}

/**
 * Recovers genuine capture date embedded in standard camera filenames (e.g. IMG_20250115_120000, PXL_20250115_...).
 * Only applied when MediaStore DATE_TAKEN was overwritten or zeroed out on restoration.
 */
export function parseDateFromFilename(filename?: string | null): number | null {
  if (!filename || typeof filename !== 'string') return null;
  // Match YYYYMMDD preceded by delimiter or prefix (e.g. IMG_20250115_143022 or PXL_20250115_143022 or 20250115_143022)
  const match = filename.match(/(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[_\-T]?([01]\d|2[0-3])([0-5]\d)([0-5]\d))?/);
  if (!match) return null;
  const [, year, month, day, hour = '12', min = '00', sec = '00'] = match;
  const y = parseInt(year, 10);
  if (y < 2000 || y > 2099) return null;
  const parsed = new Date(
    y,
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(min, 10),
    parseInt(sec, 10)
  ).getTime();
  return isNaN(parsed) || parsed <= 0 || parsed > 4102444800000 ? null : parsed;
}

/**
 * Resolves the canonical display timestamp for any media item according to the strict policy:
 * 1. Preserved Restored Timestamps:
 *    If an item was restored from Pixora Trash, its genuine capture date before deletion was recorded
 *    and takes absolute precedence over any MediaStore re-indexing artifacts.
 * 2. Downloaded media (in Download buckets, download URIs, or dl filenames):
 *    Internal container creation timestamps (e.g. MP4 render dates from years ago) are stale external metadata.
 *    The item's arrival on this device is defined by its modificationTime (download timestamp) when valid (> 0).
 * 3. Historical camera photos, WhatsApp media, and all other device media:
 *    Genuine capture date (cTime > 0) is paramount and must ALWAYS be preserved.
 *    Restoration, file move, or backup operations that update modificationTime must NEVER displace a photo's genuine capture date.
 *    If MediaStore DATE_TAKEN was overwritten to Today by Android OS or left zero, the original date is recovered
 *    from EXIF metadata or the camera capture filename.
 * 4. Fallback for missing/corrupted timestamps (<= 0 or post-2100):
 *    Falls back to modificationTime if valid, else Date.now().
 */
export function resolveMediaTimestamp(
  item: {
    id?: string;
    uri?: string;
    filename?: string;
    albumId?: string;
    creationTime?: number | null;
    modificationTime?: number | null;
    exif?: Record<string, any> | null;
  },
  physicalAlbums?: MediaLibrary.Album[]
): number {
  const strId = String(item.id || '');

  // 1. Check preserved restored timestamps (from trash store by ID or URI)
  try {
    const preserved = useTrashStore.getState().getPreservedTimestamp?.(strId, item.uri);
    if (preserved && preserved > 0) {
      return preserved;
    }
  } catch {}

  const cTime = normalizeTimestamp(item.creationTime);
  const mTime = normalizeTimestamp(item.modificationTime);

  const mediaObj: PixoraMediaInfo = {
    id: strId,
    uri: item.uri || '',
    filename: item.filename || '',
    albumId: item.albumId,
  } as PixoraMediaInfo;

  const isDownload = isDownloadMedia(mediaObj, physicalAlbums);

  // 2. Downloaded media: prioritize download timestamp (mTime) so stale external MP4 container headers
  // do not bury newly downloaded files into past years.
  if (isDownload) {
    if (mTime > 0) return mTime;
    if (cTime > 0) return cTime;
    return Date.now();
  }

  // 3. WhatsApp media:
  // Preserves genuine EXIF/capture date if cTime > 0.
  // If no capture date (cTime <= 0), falls back strictly to file modification time (mTime).
  const isWA = isWhatsAppMedia(mediaObj, physicalAlbums);
  if (isWA) {
    if (cTime > 0) return cTime;
    if (mTime > 0) return mTime;
    return Date.now();
  }

  // 4. For camera photos and other device media:
  // Check if EXIF DateTimeOriginal / DateTimeDigitized / DateTime is available
  const exifTime = parseDateFromExif(item.exif);
  if (exifTime && exifTime > 0) {
    return exifTime;
  }

  const filenameDate = parseDateFromFilename(item.filename);

  // If cTime is nonzero:
  if (cTime > 0) {
    // Detect if Android MediaStore re-indexing overwrote DATE_TAKEN to Today upon restoration:
    // If cTime is within 48h of now and matches mTime, but the camera filename indicates a historical date:
    const isTodayOrRecent = Math.abs(Date.now() - cTime) < 48 * 60 * 60 * 1000;
    if (isTodayOrRecent && filenameDate && filenameDate < Date.now() - 7 * 24 * 60 * 60 * 1000) {
      return filenameDate;
    }
    return cTime;
  }

  // 5. Fallback for camera media where MediaStore returned cTime <= 0: recover from filename if present
  if (filenameDate && filenameDate > 0) {
    return filenameDate;
  }

  // 6. Final fallback to modificationTime if valid, else Date.now()
  if (mTime > 0) {
    return mTime;
  }

  return Date.now();
}

/**
 * Maps a raw MediaLibrary asset to PixoraMediaInfo with robust timestamp resolution.
 */
export function mapRawAssetToPixoraMedia(
  asset: MediaLibrary.Asset | MediaLibrary.AssetInfo,
  physicalAlbums?: MediaLibrary.Album[]
): PixoraMediaInfo {
  const resolvedTime = resolveMediaTimestamp(asset, physicalAlbums);
  const mTime = normalizeTimestamp(asset.modificationTime);

  return {
    id: String(asset.id),
    uri: (asset as MediaLibrary.AssetInfo).localUri || asset.uri,
    filename: asset.filename,
    mediaType: asset.mediaType,
    width: asset.width,
    height: asset.height,
    creationTime: resolvedTime,
    modificationTime: mTime || resolvedTime,
    duration: asset.duration,
    albumId: asset.albumId,
  };
}

class MediaStoreService {
  /**
   * Request permissions and return status.
   */
  async requestPermissionsAsync(): Promise<MediaPermissionStatus> {
    const response = await MediaLibraryNew.requestPermissionsAsync();
    
    if (response.granted) {
      return response.accessPrivileges === 'limited' ? 'LIMITED' : 'GRANTED';
    }
    
    if (response.canAskAgain) {
      return 'UNDETERMINED';
    }
    
    return 'DENIED';
  }

  /**
   * Get permissions without requesting.
   */
  async getPermissionsAsync(): Promise<MediaPermissionStatus> {
    const response = await MediaLibraryNew.getPermissionsAsync();
    
    if (response.granted) {
      return response.accessPrivileges === 'limited' ? 'LIMITED' : 'GRANTED';
    }
    
    return response.canAskAgain ? 'UNDETERMINED' : 'DENIED';
  }

  /**
   * Load a page of media.
   * When sortOrder === 'newest': uses dual-sorting (modificationTime DESC, creationTime DESC) so media
   * with null, 0, or legacy DATE_TAKEN (e.g. downloaded images, WhatsApp media, screenshots, camera videos)
   * reliably appear at the top.
   * When sortOrder === 'oldest': queries MediaStore ascending (creationTime ASC, modificationTime ASC)
   * so oldest genuine photos and videos on the device appear first.
   */
  async getMediaAsync(
    after?: string,
    mediaType?: MediaLibrary.MediaTypeValue[] | MediaLibrary.MediaTypeValue,
    pageSize: number = PAGE_SIZE,
    sortOrder: 'newest' | 'oldest' = 'newest'
  ): Promise<{
    assets: PixoraMediaInfo[];
    hasNextPage: boolean;
    endCursor: string;
  }> {
    const isOldest = sortOrder === 'oldest';
    let result = await MediaLibrary.getAssetsAsync({
      first: pageSize,
      after,
      mediaType: mediaType || [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      createdAfter: isOldest ? 1 : undefined,
      sortBy: isOldest
        ? [
            [MediaLibrary.SortBy.creationTime, true],
            [MediaLibrary.SortBy.modificationTime, true],
          ]
        : [
            [MediaLibrary.SortBy.modificationTime, false],
            [MediaLibrary.SortBy.creationTime, false],
          ],
    });

    // Fallback: If device has zero media with valid DATE_TAKEN > 1 on initial oldest fetch,
    // query without createdAfter so media-less or synthetic emulators still display files.
    if (isOldest && !after && result.assets.length === 0) {
      result = await MediaLibrary.getAssetsAsync({
        first: pageSize,
        after,
        mediaType: mediaType || [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [
          [MediaLibrary.SortBy.creationTime, true],
          [MediaLibrary.SortBy.modificationTime, true],
        ],
      });
    }

    const assets: PixoraMediaInfo[] = result.assets.map((asset) => mapRawAssetToPixoraMedia(asset));

    if (__DEV__ && isOldest) {
      console.log('[Pixora MediaStore Diagnostic] Oldest query result:', {
        count: assets.length,
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor,
        oldestResolvedTime: assets.length > 0 ? assets[0].creationTime : null,
        oldestIsoDate: assets.length > 0 ? new Date(assets[0].creationTime).toISOString().slice(0, 10) : null,
        oldestId: assets.length > 0 ? assets[0].id : null,
        rawCreationTime: result.assets.length > 0 ? result.assets[0].creationTime : null,
        rawModificationTime: result.assets.length > 0 ? result.assets[0].modificationTime : null,
      });
    }

    return {
      assets,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
    };
  }

  /**
   * Dedicated MediaStore loader for Smart Albums.
   * Handles querying, filtering, and anti-stall pagination for each smart album category.
   */
  async getSmartAlbumMediaAsync(
    smartAlbumId: string,
    after?: string,
    pageSize: number = 50,
    sortOrder: 'newest' | 'oldest' = 'newest',
    physicalAlbums?: MediaLibrary.Album[]
  ): Promise<{
    assets: PixoraMediaInfo[];
    hasNextPage: boolean;
    endCursor: string;
  }> {
    // 1. Videos smart album: native query via mediaType: 'video'
    if (smartAlbumId === '__smart_videos') {
      return this.getMediaAsync(after, [MediaLibrary.MediaType.video], pageSize, sortOrder);
    }

    // 2. Resolve definition
    const def = SMART_ALBUM_DEFS.find((d) => d.id === smartAlbumId);
    if (!def) {
      return { assets: [], hasNextPage: false, endCursor: '' };
    }

    // 3. Resolve physical albums
    const albums = physicalAlbums || (await this.getAlbumsAsync().catch(() => []));

    // 4. Physical album fast-paths for Camera, Screenshots, Downloads, WhatsApp
    if (smartAlbumId === '__smart_camera') {
      const cam = albums.find(
        (a) => a.title.toLowerCase() === 'camera' || a.title.toLowerCase() === 'dcim'
      );
      if (cam) {
        const result = await this.getAlbumAssetsAsync(cam.id, after, sortOrder);
        // Ensure non-camera files (like Samsung DCIM/Screenshots) are excluded
        const assets = result.assets.filter((item) => def.filter(item, albums));
        if (__DEV__) {
          console.log('[Pixora SmartAlbum Diagnostic]', {
            smartAlbumId,
            sortOrder,
            bucketId: cam.id,
            rawScannedCount: result.assets.length,
            matchingCount: assets.length,
            hasNextPage: result.hasNextPage,
            endCursor: result.endCursor,
          });
        }
        return {
          assets,
          hasNextPage: result.hasNextPage,
          endCursor: result.endCursor,
        };
      }
    }

    if (smartAlbumId === '__smart_screenshots') {
      const ssAlbums = albums.filter((a) => a.title.toLowerCase().includes('screenshot'));
      if (ssAlbums.length === 1) {
        const result = await this.getAlbumAssetsAsync(ssAlbums[0].id, after, sortOrder);
        const assets = result.assets.filter((item) => def.filter(item, albums));
        if (__DEV__) {
          console.log('[Pixora SmartAlbum Diagnostic]', {
            smartAlbumId,
            sortOrder,
            bucketId: ssAlbums[0].id,
            rawScannedCount: result.assets.length,
            matchingCount: assets.length,
            hasNextPage: result.hasNextPage,
            endCursor: result.endCursor,
          });
        }
        return {
          assets,
          hasNextPage: result.hasNextPage,
          endCursor: result.endCursor,
        };
      }
    }

    if (smartAlbumId === '__smart_downloads') {
      const dlAlbums = albums.filter(
        (a) => a.title.toLowerCase() === 'download' || a.title.toLowerCase() === 'downloads'
      );
      if (dlAlbums.length === 1) {
        const result = await this.getAlbumAssetsAsync(dlAlbums[0].id, after, sortOrder);
        const assets = result.assets.filter((item) => def.filter(item, albums));
        if (__DEV__) {
          console.log('[Pixora SmartAlbum Diagnostic]', {
            smartAlbumId,
            sortOrder,
            bucketId: dlAlbums[0].id,
            rawScannedCount: result.assets.length,
            matchingCount: assets.length,
            hasNextPage: result.hasNextPage,
            endCursor: result.endCursor,
          });
        }
        return {
          assets,
          hasNextPage: result.hasNextPage,
          endCursor: result.endCursor,
        };
      }
    }

    if (smartAlbumId === '__smart_whatsapp') {
      const waAlbums = albums.filter((a) => a.title.toLowerCase().includes('whatsapp'));
      if (waAlbums.length === 1) {
        const result = await this.getAlbumAssetsAsync(waAlbums[0].id, after, sortOrder);
        const assets = result.assets.filter((item) => def.filter(item, albums));
        if (__DEV__) {
          console.log('[Pixora SmartAlbum Diagnostic]', {
            smartAlbumId,
            sortOrder,
            bucketId: waAlbums[0].id,
            rawScannedCount: result.assets.length,
            matchingCount: assets.length,
            hasNextPage: result.hasNextPage,
            endCursor: result.endCursor,
          });
        }
        return {
          assets,
          hasNextPage: result.hasNextPage,
          endCursor: result.endCursor,
        };
      }
    }

    // 5. Native query for 'recent' in oldest sort order
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (smartAlbumId === '__smart_recent' && sortOrder === 'oldest') {
      try {
        const result = await MediaLibrary.getAssetsAsync({
          first: pageSize,
          after: after as any,
          createdAfter: thirtyDaysAgo,
          sortBy: [[MediaLibrary.SortBy.creationTime, true]],
          mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        });
        if (result && Array.isArray(result.assets) && result.assets.length > 0) {
          const mappedAssets: PixoraMediaInfo[] = result.assets.map((asset) =>
            mapRawAssetToPixoraMedia(asset, physicalAlbums)
          );
          if (__DEV__) {
            console.log('[Pixora SmartAlbum Diagnostic]', {
              smartAlbumId,
              sortOrder,
              rawScannedCount: mappedAssets.length,
              matchingCount: mappedAssets.length,
              hasNextPage: result.hasNextPage,
              endCursor: result.endCursor,
            });
          }
          return {
            assets: mappedAssets,
            hasNextPage: result.hasNextPage,
            endCursor: result.endCursor,
          };
        }
      } catch (e) {
        console.warn('[Pixora MediaStore] Native recent oldest query fallback:', e);
      }
    }

    // 6. Generic streaming fallback for multi-album categories or devices without standard buckets:
    let currentCursor = after;
    let hasNextPage = true;
    let endCursor = after || '';
    const accumulated: PixoraMediaInfo[] = [];
    let rawScannedCount = 0;
    let attempts = 0;
    const maxAttempts = 15;

    while (accumulated.length < pageSize && hasNextPage && attempts < maxAttempts) {
      attempts++;
      const result = await this.getMediaAsync(currentCursor, undefined, 100, sortOrder);
      rawScannedCount += result.assets.length;
      currentCursor = result.endCursor;
      endCursor = result.endCursor;
      hasNextPage = result.hasNextPage;

      for (const item of result.assets) {
        if (def.filter(item, albums)) {
          accumulated.push(item);
          if (accumulated.length >= pageSize) break;
        }
      }

      // Optimization for 'recent' in newest sort: once we encounter items older than 30 days,
      // subsequent pages will also be older than 30 days, so we can terminate early.
      if (smartAlbumId === '__smart_recent' && sortOrder === 'newest') {
        const lastItem = result.assets[result.assets.length - 1];
        if (lastItem) {
          const effective = Math.max(lastItem.creationTime || 0, lastItem.modificationTime || 0);
          if (effective < thirtyDaysAgo) {
            hasNextPage = false;
            break;
          }
        }
      }

      if (result.assets.length === 0) {
        break;
      }
    }

    if (__DEV__) {
      console.log('[Pixora SmartAlbum Diagnostic]', {
        smartAlbumId,
        sortOrder,
        rawScannedCount,
        matchingCount: accumulated.length,
        hasNextPage,
        endCursor,
      });
    }

    return {
      assets: accumulated,
      hasNextPage,
      endCursor,
    };
  }

  /**
   * Fast aggressive metadata fetch for search indexing.
   */
  async getAllMediaMetadataAsync(): Promise<PixoraMediaInfo[]> {
    let hasNextPage = true;
    let endCursor: string | undefined = undefined;
    const allAssets: PixoraMediaInfo[] = [];
    
    // We fetch in large chunks to index quickly
    while (hasNextPage) {
      const result = await MediaLibrary.getAssetsAsync({
        first: 500,
        after: endCursor,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [
          [MediaLibrary.SortBy.modificationTime, false],
          [MediaLibrary.SortBy.creationTime, false],
        ],
      });
      
      const mapped = result.assets.map((asset) => mapRawAssetToPixoraMedia(asset));
      
      allAssets.push(...mapped);
      
      hasNextPage = result.hasNextPage;
      endCursor = result.endCursor;
    }
    
    return allAssets;
  }

  /**
   * Subscribe to native Android MediaStore / iOS PhotoKit change events.
   * Fires whenever assets are added, modified, or deleted by camera, downloads, or other apps.
   */
  subscribeToMediaChanges(callback: () => void): () => void {
    try {
      const subscription = MediaLibrary.addListener(() => {
        callback();
      });
      return () => {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        } else if (typeof (MediaLibrary as any).removeSubscription === 'function') {
          (MediaLibrary as any).removeSubscription(subscription);
        }
      };
    } catch (e) {
      console.warn('[MediaStoreService] Failed to subscribe to media library changes', e);
      return () => {};
    }
  }

  async getAlbumsAsync() {
    return await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
  }

  async getAssetsByIdsAsync(ids: string[]): Promise<PixoraMediaInfo[]> {
    const assets = await Promise.all(
      ids.map(id => MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: false }).catch(() => null))
    );

    return assets
      .filter((a): a is MediaLibrary.AssetInfo => a !== null)
      .map(asset => {
        const mapped = mapRawAssetToPixoraMedia(asset as any);
        if (asset.localUri) {
          mapped.uri = asset.localUri;
        }
        return mapped;
      });
  }

  async getAlbumAssetsAsync(
    albumId: string, 
    after?: string | MediaLibrary.AssetRef,
    sortOrder: 'newest' | 'oldest' = 'newest'
  ) {
    const isOldest = sortOrder === 'oldest';
    const result = await MediaLibrary.getAssetsAsync({
      album: albumId,
      after: after as any,
      first: 100,
      sortBy: isOldest
        ? [
            [MediaLibrary.SortBy.creationTime, true],
            [MediaLibrary.SortBy.modificationTime, true],
          ]
        : [
            [MediaLibrary.SortBy.modificationTime, false],
            [MediaLibrary.SortBy.creationTime, false],
          ],
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
    });

    const mapped = result.assets.map((asset) => mapRawAssetToPixoraMedia(asset));

    if (__DEV__ && isOldest) {
      console.log('[Pixora MediaStore Diagnostic] Oldest album query result:', {
        albumId,
        count: mapped.length,
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor,
        oldestResolvedTime: mapped.length > 0 ? mapped[0].creationTime : null,
        oldestIsoDate: mapped.length > 0 ? new Date(mapped[0].creationTime).toISOString().slice(0, 10) : null,
        oldestId: mapped.length > 0 ? mapped[0].id : null,
      });
    }

    return { assets: mapped, hasNextPage: result.hasNextPage, endCursor: result.endCursor };
  }

  async getAlbumCoverAsync(albumId: string, isCamera: boolean = false): Promise<string | null> {
    try {
      const result = await MediaLibrary.getAssetsAsync({
        album: albumId,
        first: 10,
        sortBy: [
          [MediaLibrary.SortBy.creationTime, false],
          [MediaLibrary.SortBy.modificationTime, false],
        ],
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      });
      if (result.assets.length > 0) {
        const trashStore = useTrashStore.getState();
        const privacyStore = usePrivacyStore.getState();

        for (const rawAsset of result.assets) {
          const strId = String(rawAsset.id);
          const uri = rawAsset.uri;

          // 1. Exclude trashed / tombstoned media
          if (trashStore.isDeleted(strId, uri)) continue;

          // 2. Exclude hidden assets
          if (privacyStore.hiddenAssetIds.includes(strId)) continue;

          // 3. Exclude private vault assets
          if (privacyStore.privateAssetIds.includes(strId)) continue;

          // 4. Exclude archived assets
          if (privacyStore.archivedAssetIds.includes(strId)) continue;

          // 5. For Camera album, verify asset is genuine camera media (exclude Samsung DCIM screenshots)
          if (isCamera) {
            const mapped = mapRawAssetToPixoraMedia(rawAsset);
            if (isScreenshotMedia(mapped)) continue;
          }

          return uri;
        }
      }
    } catch {
      // Ignore gracefully
    }
    return null;
  }

  async exportImageToMediaStoreAsync(localUri: string): Promise<PixoraMediaInfo | null> {
    try {
      const asset = await MediaLibrary.createAssetAsync(localUri);
      
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
      
      return {
        id: assetInfo.id,
        uri: assetInfo.localUri || assetInfo.uri,
        filename: assetInfo.filename,
        mediaType: assetInfo.mediaType,
        width: assetInfo.width,
        height: assetInfo.height,
        creationTime: assetInfo.creationTime,
        modificationTime: assetInfo.modificationTime,
        duration: assetInfo.duration,
        albumId: assetInfo.albumId,
      };
    } catch (e) {
      console.error('Failed to export image to MediaStore', e);
      return null;
    }
  }
}

export const mediaStoreService = new MediaStoreService();
