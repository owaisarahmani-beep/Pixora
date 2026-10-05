import { useMemo } from 'react';
import { usePrivacyStore } from '../store/usePrivacyStore';
import { PixoraMediaInfo } from '../services/media/mediaTypes';
import * as MediaLibrary from 'expo-media-library/legacy';

export function filterHiddenMedia(media: PixoraMediaInfo[], hiddenAlbumIds: string[], hiddenAssetIds: string[]): PixoraMediaInfo[] {
  if (hiddenAlbumIds.length === 0 && hiddenAssetIds.length === 0) return media;
  const hiddenAlbumSet = new Set(hiddenAlbumIds);
  const hiddenAssetSet = new Set(hiddenAssetIds);
  return media.filter(item => 
    !hiddenAssetSet.has(item.id) && (!item.albumId || !hiddenAlbumSet.has(item.albumId))
  );
}

export function filterHiddenAlbums(albums: MediaLibrary.Album[], hiddenAlbumIds: string[]): MediaLibrary.Album[] {
  if (hiddenAlbumIds.length === 0) return albums;
  const hiddenSet = new Set(hiddenAlbumIds);
  return albums.filter(album => !hiddenSet.has(album.id));
}

/**
 * Hook to filter media assets, removing any that belong to hidden albums.
 */
export function useVisibleMedia(media: PixoraMediaInfo[]): PixoraMediaInfo[] {
  const hiddenAlbumIds = usePrivacyStore(state => state.hiddenAlbumIds);
  const hiddenAssetIds = usePrivacyStore(state => state.hiddenAssetIds);
  return useMemo(() => filterHiddenMedia(media, hiddenAlbumIds, hiddenAssetIds), [media, hiddenAlbumIds, hiddenAssetIds]);
}

/**
 * Hook to filter albums, removing any that are marked as hidden.
 */
export function useVisibleAlbums(albums: MediaLibrary.Album[]): MediaLibrary.Album[] {
  const hiddenAlbumIds = usePrivacyStore(state => state.hiddenAlbumIds);
  return useMemo(() => filterHiddenAlbums(albums, hiddenAlbumIds), [albums, hiddenAlbumIds]);
}
