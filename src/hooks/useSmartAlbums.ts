import { useMemo } from 'react';
import { PixoraMediaInfo } from '../services/media/mediaTypes';

export interface SmartAlbum {
  id: string;
  title: string;
  icon: string;
  filter: (item: PixoraMediaInfo) => boolean;
}

const SMART_ALBUM_DEFS: SmartAlbum[] = [
  {
    id: '__smart_videos',
    title: 'Videos',
    icon: 'videocam',
    filter: (item) => item.mediaType === 'video',
  },
  {
    id: '__smart_screenshots',
    title: 'Screenshots',
    icon: 'phone-portrait',
    filter: (item) =>
      item.uri.toLowerCase().includes('screenshot') ||
      item.filename.toLowerCase().includes('screenshot'),
  },
  {
    id: '__smart_whatsapp',
    title: 'WhatsApp',
    icon: 'logo-whatsapp',
    filter: (item) =>
      item.uri.toLowerCase().includes('whatsapp') ||
      item.filename.toLowerCase().includes('whatsapp') ||
      item.filename.toLowerCase().startsWith('img-'),
  },
  {
    id: '__smart_downloads',
    title: 'Downloads',
    icon: 'download',
    filter: (item) =>
      item.uri.toLowerCase().includes('/download/') ||
      item.uri.toLowerCase().includes('/downloads/'),
  },
  {
    id: '__smart_camera',
    title: 'Camera',
    icon: 'camera',
    filter: (item) =>
      item.uri.toLowerCase().includes('/dcim/') ||
      item.filename.toLowerCase().startsWith('img_') ||
      item.filename.toLowerCase().startsWith('dsc'),
  },
  {
    id: '__smart_recent',
    title: 'Recently Added',
    icon: 'time',
    filter: (item) => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return item.creationTime > thirtyDaysAgo;
    },
  },
];

export function useSmartAlbums(allMedia: PixoraMediaInfo[]) {
  return useMemo(() => {
    return SMART_ALBUM_DEFS
      .map((def) => {
        const items = allMedia.filter(def.filter);
        return { ...def, count: items.length, items };
      })
      .filter((album) => album.count > 0);
  }, [allMedia]);
}

export { SMART_ALBUM_DEFS };
