import { useMemo } from 'react';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';
import { getReconciledAlbumCount } from '../store/useAlbumsStore';
import { useTrashStore, TrashedItem } from '../store/useTrashStore';

export interface SmartAlbum {
  id: string;
  title: string;
  icon: string;
  filter: (item: PixoraMediaInfo, physicalAlbums?: any) => boolean;
}

/**
 * Checks if a media item is a screenshot without false-positives from camera captures.
 */
export function isScreenshotMedia(item: PixoraMediaInfo, physicalAlbums?: any): boolean {
  if (Array.isArray(physicalAlbums) && item.albumId) {
    const matched = physicalAlbums.some(
      (a: MediaLibrary.Album) => a.id === item.albumId && a.title.toLowerCase().includes('screenshot')
    );
    if (matched) return true;
  }
  const uriLower = (item.uri || '').toLowerCase();
  const fileLower = (item.filename || '').toLowerCase();
  if (uriLower.includes('/screenshots/') || uriLower.includes('/screenshot/')) return true;
  if (fileLower.includes('screenshot') || fileLower.includes('screencap') || fileLower.startsWith('capture_')) return true;
  return false;
}

/**
 * Checks if a media item is from WhatsApp using Scoped Storage paths, WA prefixes, or album bucket.
 */
export function isWhatsAppMedia(item: PixoraMediaInfo, physicalAlbums?: any): boolean {
  if (Array.isArray(physicalAlbums) && item.albumId) {
    const matched = physicalAlbums.some(
      (a: MediaLibrary.Album) => a.id === item.albumId && a.title.toLowerCase().includes('whatsapp')
    );
    if (matched) return true;
  }
  const uriLower = (item.uri || '').toLowerCase();
  const fileLower = (item.filename || '').toLowerCase();
  if (uriLower.includes('whatsapp') || uriLower.includes('com.whatsapp')) return true;
  if (fileLower.includes('whatsapp')) return true;
  // Standard WhatsApp export/received naming: IMG-YYYYMMDD-WAXXXX or VID-YYYYMMDD-WAXXXX
  if (/^(?:img|vid)-\d{8}-wa\d+/i.test(fileLower)) return true;
  return false;
}

/**
 * Checks if a media item is from the device Downloads directory or download manager.
 */
export function isDownloadMedia(item: PixoraMediaInfo, physicalAlbums?: any): boolean {
  if (Array.isArray(physicalAlbums) && item.albumId) {
    const matched = physicalAlbums.some(
      (a: MediaLibrary.Album) => a.id === item.albumId && (a.title.toLowerCase() === 'download' || a.title.toLowerCase() === 'downloads')
    );
    if (matched) return true;
  }
  const uriLower = (item.uri || '').toLowerCase();
  const fileLower = (item.filename || '').toLowerCase();
  if (uriLower.includes('/download/') || uriLower.includes('/downloads/')) return true;
  if (fileLower.startsWith('download') || fileLower.startsWith('dl_')) return true;
  return false;
}

/**
 * Checks if a media item is from the Camera.
 * Strictly excludes screenshots, WhatsApp files, downloads, screen recordings, and social media exports.
 */
export function isCameraMedia(item: PixoraMediaInfo, physicalAlbums?: any): boolean {
  // 1. If physical albums are provided, enforce physical bucket mapping
  if (Array.isArray(physicalAlbums) && physicalAlbums.length > 0) {
    const cameraAlbums = physicalAlbums.filter(
      (a: MediaLibrary.Album) => a.title.toLowerCase() === 'camera' || a.title.toLowerCase() === 'dcim'
    );
    if (cameraAlbums.length > 0) {
      if (item.albumId) {
        const isCameraBucket = cameraAlbums.some((a: MediaLibrary.Album) => a.id === item.albumId);
        if (!isCameraBucket) {
          // Belongs to a known non-camera physical album (e.g. Downloads, WhatsApp, Screenshots)
          return false;
        }
        // Belongs to the camera bucket: exclude screenshots saved in DCIM/Screenshots
        return !isScreenshotMedia(item, physicalAlbums);
      }
    }
  }

  // 2. Strict exclusions: must not be screenshot, whatsapp, or download
  if (isScreenshotMedia(item, physicalAlbums)) return false;
  if (isWhatsAppMedia(item, physicalAlbums)) return false;
  if (isDownloadMedia(item, physicalAlbums)) return false;

  const uriLower = (item.uri || '').toLowerCase();
  const fileLower = (item.filename || '').toLowerCase();

  // Exclude non-camera subdirectories that live inside /dcim/
  if (uriLower.includes('/screenshots/') || uriLower.includes('/screenrecorder/') || uriLower.includes('/facebook/')) {
    return false;
  }

  // 3. Genuine camera directories
  if (uriLower.includes('/dcim/camera/') || uriLower.includes('/camera/')) return true;

  // 4. DCIM root with camera filename markers
  if (
    uriLower.includes('/dcim/') &&
    (fileLower.startsWith('img_') || fileLower.startsWith('vid_') || fileLower.startsWith('pxl_') || fileLower.startsWith('dsc'))
  ) {
    return true;
  }

  return false;
}

const SMART_ALBUM_DEFS: SmartAlbum[] = [
  {
    id: '__smart_videos',
    title: 'Videos',
    icon: 'videocam',
    filter: (item) =>
      item.mediaType === 'video' ||
      (item.mediaType as string) === 'VIDEO' ||
      (!!item.filename && /\.(mp4|mov|m4v|avi|mkv|webm|3gp|flv)$/i.test(item.filename)),
  },
  {
    id: '__smart_screenshots',
    title: 'Screenshots',
    icon: 'phone-portrait',
    filter: (item, physicalAlbums) => isScreenshotMedia(item, physicalAlbums),
  },
  {
    id: '__smart_whatsapp',
    title: 'WhatsApp',
    icon: 'logo-whatsapp',
    filter: (item, physicalAlbums) => isWhatsAppMedia(item, physicalAlbums),
  },
  {
    id: '__smart_downloads',
    title: 'Downloads',
    icon: 'download',
    filter: (item, physicalAlbums) => isDownloadMedia(item, physicalAlbums),
  },
  {
    id: '__smart_camera',
    title: 'Camera',
    icon: 'camera',
    filter: (item, physicalAlbums) => isCameraMedia(item, physicalAlbums),
  },
  {
    id: '__smart_recent',
    title: 'Recently Added',
    icon: 'time',
    filter: (item) => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const effectiveTime = Math.max(item.creationTime || 0, item.modificationTime || 0);
      return effectiveTime > thirtyDaysAgo;
    },
  },
];

export function getSmartAlbumsList(
  allMedia: PixoraMediaInfo[],
  canonicalAlbums?: MediaLibrary.Album[],
  albumCovers?: Record<string, string | null>,
  trashedItems: TrashedItem[] = []
) {
  const list = SMART_ALBUM_DEFS.map((def) => {
    const items = allMedia.filter((item) => def.filter(item, canonicalAlbums));
    
    // Calculate true total count and canonical cover when physical albums are available
    let calculatedCount = items.length;
    let coverUri: string | null = null;

    if (canonicalAlbums && canonicalAlbums.length > 0) {
      if (def.id === '__smart_camera') {
        const cam = canonicalAlbums.find((a) => a.title.toLowerCase() === 'camera' || a.title.toLowerCase() === 'dcim');
        if (cam) {
          calculatedCount = getReconciledAlbumCount(cam, trashedItems);
          if (albumCovers && albumCovers[cam.id]) coverUri = albumCovers[cam.id];
        }
      } else if (def.id === '__smart_screenshots') {
        const ss = canonicalAlbums.filter((a) => a.title.toLowerCase().includes('screenshot'));
        if (ss.length > 0) {
          calculatedCount = ss.reduce((sum, a) => sum + getReconciledAlbumCount(a, trashedItems), 0);
          if (albumCovers && albumCovers[ss[0].id]) coverUri = albumCovers[ss[0].id];
        }
      } else if (def.id === '__smart_downloads') {
        const dl = canonicalAlbums.filter((a) => a.title.toLowerCase() === 'download' || a.title.toLowerCase() === 'downloads');
        if (dl.length > 0) {
          calculatedCount = dl.reduce((sum, a) => sum + getReconciledAlbumCount(a, trashedItems), 0);
          if (albumCovers && albumCovers[dl[0].id]) coverUri = albumCovers[dl[0].id];
        }
      } else if (def.id === '__smart_whatsapp') {
        const wa = canonicalAlbums.filter((a) => a.title.toLowerCase().includes('whatsapp'));
        if (wa.length > 0) {
          calculatedCount = wa.reduce((sum, a) => sum + getReconciledAlbumCount(a, trashedItems), 0);
          if (albumCovers && albumCovers[wa[0].id]) coverUri = albumCovers[wa[0].id];
        }
      }
    }

    // Fallback cover from filtered eligible media
    if (!coverUri && items.length > 0) {
      coverUri = items[0]?.uri || null;
    }

    return { ...def, count: calculatedCount, items, coverUri };
  });

  const withItems = list.filter((album) => album.count > 0);
  return withItems.length > 0 ? withItems : list;
}

export function useSmartAlbums(
  allMedia: PixoraMediaInfo[],
  canonicalAlbums?: MediaLibrary.Album[],
  albumCovers?: Record<string, string | null>,
  trashedItemsOverride?: TrashedItem[]
) {
  const trashedStoreItems = useTrashStore((state) => state.items);
  const trashedItems = trashedItemsOverride ?? trashedStoreItems;
  return useMemo(() => {
    return getSmartAlbumsList(allMedia, canonicalAlbums, albumCovers, trashedItems);
  }, [allMedia, canonicalAlbums, albumCovers, trashedItems]);
}

export { SMART_ALBUM_DEFS };
